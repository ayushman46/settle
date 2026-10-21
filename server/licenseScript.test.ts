/**
 * scripts/license.mjs, run for real: its tokens must verify on the server and vice versa.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadLicenseKeys, signLicense, verifyLicense } from './license'
import { OTHER_LICENSE_KEYS, TEST_LICENSE_KEYS } from './testing'

const SCRIPT = fileURLToPath(new URL('../scripts/license.mjs', import.meta.url))
const PRIVATE_B64 = TEST_LICENSE_KEYS.privateKey?.export({ type: 'pkcs8', format: 'der' }).toString('base64') ?? ''
const DAY = 86_400
const nowSeconds = () => Math.floor(Date.now() / 1000)

let cwd: string

beforeAll(() => {
  // An empty folder, so the repo's own .env is never read.
  cwd = mkdtempSync(join(tmpdir(), 'settle-license-'))
})

afterAll(() => {
  rmSync(cwd, { recursive: true, force: true })
})

function run(args: string[], env: Record<string, string> = { LICENSE_PRIVATE_KEY: PRIVATE_B64 }, dir = cwd) {
  const { LICENSE_PRIVATE_KEY: _private, LICENSE_PUBLIC_KEY: _public, ...inherited } = process.env
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, env: { ...inherited, ...env }, encoding: 'utf8', timeout: 20_000 })
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() }
}

describe('scripts/license.mjs', () => {
  it('keygen prints a working key pair as .env lines', () => {
    const { status, stdout, stderr } = run(['keygen'], {})
    expect(status).toBe(0)
    const lines = stdout.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatch(/^LICENSE_PRIVATE_KEY=[A-Za-z0-9+/=]+$/)
    expect(lines[1]).toMatch(/^LICENSE_PUBLIC_KEY=[A-Za-z0-9+/=]+$/)
    expect(stderr).toContain('Keep LICENSE_PRIVATE_KEY secret')

    const privateRaw = lines[0]?.split('=').slice(1).join('=')
    const publicRaw = lines[1]?.split('=').slice(1).join('=')
    const { keys, problems } = loadLicenseKeys(privateRaw, publicRaw)
    expect(problems).toEqual([])
    expect(keys.publicKeySpki).toBe(publicRaw)
  })

  it('issue prints a token the server accepts, with the plan length', () => {
    const before = nowSeconds()
    const { status, stdout, stderr } = run(['issue', '--plan', 'pro_yearly', '--id', 'code-diwali'])
    expect(status).toBe(0)
    expect(stderr).toMatch(/Pro · yearly · id code-diwali · issued \d{4}-\d{2}-\d{2} · expires \d{4}-\d{2}-\d{2}/)
    const check = verifyLicense(stdout, TEST_LICENSE_KEYS.publicKey!, nowSeconds())
    expect(check).toMatchObject({ valid: true, active: true, license: { id: 'code-diwali', plan: 'pro_yearly' } })
    const { iat, exp } = check.license!
    expect(iat).toBeGreaterThanOrEqual(before)
    expect(exp).toBe(iat + 365 * DAY)
  })

  it('issue honours --days, generates an id, and makes lifetime codes', () => {
    const trial = verifyLicense(run(['issue', '--plan=pro_lifetime', '--days=7']).stdout, TEST_LICENSE_KEYS.publicKey!, nowSeconds())
    expect(trial.license?.exp).toBe((trial.license?.iat ?? 0) + 7 * DAY)
    expect(trial.license?.id).toMatch(/^code-[0-9a-f]{10}$/)

    const forever = verifyLicense(run(['issue', '--plan', 'pro_lifetime']).stdout, TEST_LICENSE_KEYS.publicKey!, nowSeconds())
    expect(forever).toMatchObject({ valid: true, active: true, license: { plan: 'pro_lifetime', exp: null } })
  })

  it('reads the key from ./.env, written as a one-line PEM', () => {
    const dir = mkdtempSync(join(tmpdir(), 'settle-license-env-'))
    try {
      const pem = TEST_LICENSE_KEYS.privateKey?.export({ type: 'pkcs8', format: 'pem' }).toString() ?? ''
      writeFileSync(join(dir, '.env'), `# keys\nLICENSE_PRIVATE_KEY="${pem.trim().replace(/\n/g, '\\n')}"\n`)
      const { status, stdout } = run(['issue', '--plan', 'pro_monthly'], {}, dir)
      expect(status).toBe(0)
      expect(verifyLicense(stdout, TEST_LICENSE_KEYS.publicKey!, nowSeconds()).valid).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('verify accepts server-issued tokens and reports expiry', () => {
    const now = nowSeconds()
    const active = signLicense({ id: 'pay_Live123', plan: 'pro_monthly', iat: now, exp: now + 30 * DAY }, TEST_LICENSE_KEYS.privateKey!)
    const ok = run(['verify', active])
    expect(ok.status).toBe(0)
    expect(JSON.parse(ok.stdout)).toEqual({ valid: true, active: true, license: { id: 'pay_Live123', plan: 'pro_monthly', iat: now, exp: now + 30 * DAY } })
    expect(ok.stderr).toMatch(/^Active · Pro · monthly · id pay_Live123/)

    const old = signLicense({ id: 'pay_Old123', plan: 'pro_monthly', iat: now - 60 * DAY, exp: now - 30 * DAY }, TEST_LICENSE_KEYS.privateKey!)
    const expired = run(['verify', old])
    expect(expired.status).toBe(1)
    expect(JSON.parse(expired.stdout)).toMatchObject({ valid: true, active: false })
    expect(expired.stderr).toMatch(/^Expired/)
  })

  it('verify works with only the public key, and rejects other keys and junk', () => {
    const publicOnly = { LICENSE_PUBLIC_KEY: TEST_LICENSE_KEYS.publicKeySpki ?? '' }
    const now = nowSeconds()
    const ours = signLicense({ id: 'x1', plan: 'pro_lifetime', iat: now, exp: null }, TEST_LICENSE_KEYS.privateKey!)
    expect(run(['verify', ours], publicOnly).status).toBe(0)

    const theirs = signLicense({ id: 'x1', plan: 'pro_lifetime', iat: now, exp: null }, OTHER_LICENSE_KEYS.privateKey!)
    for (const token of [theirs, 'SETTLE1.abc.def', 'nonsense', `${ours.slice(0, -4)}AAAA`]) {
      const result = run(['verify', token], publicOnly)
      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toEqual({ valid: false, active: false, license: null })
      expect(result.stderr).toBe('Not a valid license for this key.')
    }
  })

  it.each([
    [['issue'], /--plan must be one of/],
    [['issue', '--plan', 'pro_forever'], /--plan must be one of/],
    [['issue', '--plan', 'toString'], /--plan must be one of/],
    [['issue', '--plan', 'pro_yearly', '--days', '0'], /--days must be a whole number/],
    [['issue', '--plan', 'pro_yearly', '--days', '1.5'], /--days must be a whole number/],
    [['issue', '--plan', 'pro_yearly', '--id', 'has spaces'], /--id may use/],
    [['issue', '--plan', 'pro_yearly', '--colour', 'red'], /Unknown option: --colour/],
    [['issue', '--plan'], /--plan needs a value/],
    [['verify'], /Usage: node scripts\/license.mjs verify <token>/],
    [['frobnicate'], /Unknown command "frobnicate"/],
  ])('%j fails with a helpful message', (args, message) => {
    const { status, stderr } = run(args)
    expect(status).toBe(2)
    expect(stderr).toMatch(message)
  })

  it('explains a missing or broken private key without echoing it', () => {
    const missing = run(['issue', '--plan', 'pro_yearly'], {})
    expect(missing.status).toBe(2)
    expect(missing.stderr).toContain('LICENSE_PRIVATE_KEY is not set')

    const broken = run(['issue', '--plan', 'pro_yearly'], { LICENSE_PRIVATE_KEY: 'definitely-not-a-key' })
    expect(broken.status).toBe(2)
    expect(broken.stderr).toContain('is not an Ed25519 private key')
    expect(broken.stderr).not.toContain('definitely-not-a-key')
  })

  it('prints usage for help', () => {
    const help = run(['help'])
    expect(help.status).toBe(0)
    expect(help.stdout).toContain('node scripts/license.mjs issue --plan')
    expect(run([]).status).toBe(2)
  })
})
