#!/usr/bin/env node
/**
 * Settle Pro licenses from the command line — plain Node, no dependencies.
 *
 *   npm run license keygen                         new Ed25519 key pair, as .env lines
 *   npm run license issue -- --plan pro_yearly     a promo / support code (prints the token)
 *        [--days 30] [--id code-diwali]
 *   npm run license verify <token>                 check a token against this server's key
 *
 * Keys come from LICENSE_PRIVATE_KEY / LICENSE_PUBLIC_KEY in the environment or ./.env.
 * Tokens: SETTLE1.<base64url(JSON {id, plan, iat, exp})>.<base64url(Ed25519 signature over
 * the ASCII bytes "SETTLE1.<payload>")> — the same format as server/license.ts.
 */
import { createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign, verify } from 'node:crypto'

const PREFIX = 'SETTLE1'
const DAY_SECONDS = 86_400
/** Pass lengths in days; null = forever. Keep in step with server/plans.ts. */
const PLAN_DAYS = { pro_monthly: 30, pro_yearly: 365, pro_lifetime: null }
const PLAN_NAMES = { pro_monthly: 'Pro · monthly', pro_yearly: 'Pro · yearly', pro_lifetime: 'Pro · lifetime' }
const MAX_DAYS = 36_500
const ID_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/

const USAGE = `Settle Pro licenses

  node scripts/license.mjs keygen
      Prints a new LICENSE_PRIVATE_KEY and LICENSE_PUBLIC_KEY for .env.

  node scripts/license.mjs issue --plan <pro_monthly|pro_yearly|pro_lifetime> [--days N] [--id code-name]
      Prints a signed license token (a promo or support code). --days overrides the plan's length.

  node scripts/license.mjs verify <token>
      Checks a token. Exit code 0 when it is valid and active.

Keys are read from LICENSE_PRIVATE_KEY / LICENSE_PUBLIC_KEY in the environment or ./.env.`

class UsageError extends Error {}

function loadEnv() {
  try {
    process.loadEnvFile()
  } catch {
    // No .env here: the environment is all we have.
  }
}

/** `\n` written literally in a one-line .env value → real newlines; quotes and spaces off. */
function unescapeKey(raw) {
  return raw
    .trim()
    .replace(/^(["'])([\s\S]*)\1$/, '$2')
    .replace(/\\n/g, '\n')
    .trim()
}

function parsePrivateKey(raw) {
  const text = unescapeKey(raw ?? '')
  if (text === '') return null
  try {
    const key = text.includes('-----BEGIN')
      ? createPrivateKey({ key: text, format: 'pem' })
      : createPrivateKey({ key: Buffer.from(text.replace(/\s+/g, ''), 'base64'), format: 'der', type: 'pkcs8' })
    return key.asymmetricKeyType === 'ed25519' ? key : null
  } catch {
    return null
  }
}

function parsePublicKey(raw) {
  const text = unescapeKey(raw ?? '')
  if (text === '') return null
  try {
    const key = text.includes('-----BEGIN')
      ? createPublicKey({ key: text, format: 'pem' })
      : createPublicKey({ key: Buffer.from(text.replace(/\s+/g, ''), 'base64'), format: 'der', type: 'spki' })
    return key.asymmetricKeyType === 'ed25519' ? key : null
  } catch {
    return null
  }
}

function requirePrivateKey() {
  const key = parsePrivateKey(process.env.LICENSE_PRIVATE_KEY)
  if (key === null) {
    throw new UsageError(
      process.env.LICENSE_PRIVATE_KEY
        ? 'LICENSE_PRIVATE_KEY is not an Ed25519 private key (PKCS#8 PEM or base64 DER).'
        : 'LICENSE_PRIVATE_KEY is not set. Run "node scripts/license.mjs keygen" and add the lines to .env.',
    )
  }
  return key
}

/** The configured public key, or the one derived from the private key. */
function requirePublicKey() {
  const privateKey = parsePrivateKey(process.env.LICENSE_PRIVATE_KEY)
  if (privateKey !== null) return createPublicKey(privateKey)
  const publicKey = parsePublicKey(process.env.LICENSE_PUBLIC_KEY)
  if (publicKey === null) throw new UsageError('Set LICENSE_PUBLIC_KEY (or LICENSE_PRIVATE_KEY) to check licenses.')
  return publicKey
}

function isoDate(seconds) {
  return new Date(seconds * 1000).toISOString().slice(0, 10)
}

function describeLicense(license) {
  const expiry = license.exp === null ? 'never expires' : `expires ${isoDate(license.exp)}`
  return `${PLAN_NAMES[license.plan] ?? license.plan} · id ${license.id} · issued ${isoDate(license.iat)} · ${expiry}`
}

/** Reads `--name value` / `--name=value` options and positional arguments. */
function parseArgs(args) {
  const options = {}
  const positional = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const [name, inline] = arg.slice(2).split('=', 2)
      const value = inline ?? args[++i]
      if (value === undefined || value.startsWith('--')) throw new UsageError(`--${name} needs a value.`)
      options[name] = value
    } else positional.push(arg)
  }
  return { options, positional }
}

function keygen() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const privateB64 = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')
  const publicB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
  process.stdout.write(`LICENSE_PRIVATE_KEY=${privateB64}\nLICENSE_PUBLIC_KEY=${publicB64}\n`)
  process.stderr.write(
    'Add both lines to .env. Keep LICENSE_PRIVATE_KEY secret — anyone with it can mint Pro licenses.\n' +
      'Changing the key pair later invalidates every license issued with the old one.\n',
  )
}

function issue(args) {
  const { options, positional } = parseArgs(args)
  if (positional.length > 0) throw new UsageError(`Unexpected argument: ${positional[0]}`)
  const unknown = Object.keys(options).filter((name) => !['plan', 'days', 'id'].includes(name))
  if (unknown.length > 0) throw new UsageError(`Unknown option: --${unknown[0]}`)

  const plan = options.plan
  if (typeof plan !== 'string' || !Object.hasOwn(PLAN_DAYS, plan)) throw new UsageError(`--plan must be one of: ${Object.keys(PLAN_DAYS).join(', ')}.`)
  let days = PLAN_DAYS[plan]
  if (options.days !== undefined) {
    if (!/^\d+$/.test(options.days) || Number(options.days) < 1 || Number(options.days) > MAX_DAYS) {
      throw new UsageError(`--days must be a whole number from 1 to ${MAX_DAYS}.`)
    }
    days = Number(options.days)
  }
  const id = options.id ?? `code-${randomBytes(5).toString('hex')}`
  if (!ID_PATTERN.test(id)) throw new UsageError('--id may use letters, digits, ".", "_" and "-" (up to 100).')

  const privateKey = requirePrivateKey()
  const iat = Math.floor(Date.now() / 1000)
  const license = { id, plan, iat, exp: days === null ? null : iat + days * DAY_SECONDS }
  const body = Buffer.from(JSON.stringify(license)).toString('base64url')
  const signed = `${PREFIX}.${body}`
  const token = `${signed}.${sign(null, Buffer.from(signed, 'ascii'), privateKey).toString('base64url')}`
  process.stdout.write(`${token}\n`)
  process.stderr.write(`${describeLicense(license)}\n`)
}

/** @returns {{ valid: boolean, active: boolean, license: object | null }} */
function check(token, publicKey, nowSeconds) {
  const invalid = { valid: false, active: false, license: null }
  const parts = String(token).trim().split('.')
  if (parts.length !== 3) return invalid
  const [prefix, body, signature] = parts
  if (prefix !== PREFIX || !/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]+$/.test(signature)) return invalid
  const signatureBytes = Buffer.from(signature, 'base64url')
  if (signatureBytes.length !== 64 || signatureBytes.toString('base64url') !== signature) return invalid
  try {
    if (!verify(null, Buffer.from(`${prefix}.${body}`, 'ascii'), publicKey, signatureBytes)) return invalid
    const license = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    const wellFormed =
      typeof license === 'object' &&
      license !== null &&
      typeof license.id === 'string' &&
      license.id.length > 0 &&
      typeof license.plan === 'string' &&
      Object.hasOwn(PLAN_DAYS, license.plan) &&
      Number.isInteger(license.iat) &&
      (license.exp === null || (Number.isInteger(license.exp) && license.exp > license.iat))
    if (!wellFormed) return invalid
    const tidy = { id: license.id, plan: license.plan, iat: license.iat, exp: license.exp }
    const active = tidy.iat <= nowSeconds + DAY_SECONDS && (tidy.exp === null || tidy.exp > nowSeconds)
    return { valid: true, active, license: tidy }
  } catch {
    return invalid
  }
}

function verifyCommand(args) {
  const { positional } = parseArgs(args)
  if (positional.length !== 1) throw new UsageError('Usage: node scripts/license.mjs verify <token>')
  const result = check(positional[0], requirePublicKey(), Math.floor(Date.now() / 1000))
  process.stdout.write(`${JSON.stringify(result)}\n`)
  if (!result.valid) process.stderr.write('Not a valid license for this key.\n')
  else process.stderr.write(`${result.active ? 'Active' : 'Expired'} · ${describeLicense(result.license)}\n`)
  return result.valid && result.active ? 0 : 1
}

function main(argv) {
  const [command, ...args] = argv
  switch (command) {
    case 'keygen':
      keygen()
      return 0
    case 'issue':
      loadEnv()
      issue(args)
      return 0
    case 'verify':
      loadEnv()
      return verifyCommand(args)
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      process.stdout.write(`${USAGE}\n`)
      return command === undefined ? 2 : 0
    default:
      throw new UsageError(`Unknown command "${command}".\n\n${USAGE}`)
  }
}

try {
  process.exitCode = main(process.argv.slice(2))
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = error instanceof UsageError ? 2 : 1
}
