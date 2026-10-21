import { createPublicKey, generateKeyPairSync, sign, webcrypto } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { LICENSE_PREFIX, type LicensePayload } from '../shared/api'
import {
  isActive,
  licenseExpiry,
  loadLicenseKeys,
  MAX_TOKEN_LENGTH,
  parsePrivateKey,
  parsePublicKey,
  signLicense,
  spkiBase64,
  verifyLicense,
} from './license'
import { OTHER_LICENSE_KEYS, TEST_LICENSE_KEYS } from './testing'

const PRIVATE = TEST_LICENSE_KEYS.privateKey!
const PUBLIC = TEST_LICENSE_KEYS.publicKey!
const NOW = 1_790_000_000 // 2026-09-21
const DAY = 86_400
const YEARLY: LicensePayload = { id: 'pay_Abc123XYZ', plan: 'pro_yearly', iat: NOW, exp: NOW + 365 * DAY }

const b64url = (value: string | Buffer) => Buffer.from(value).toString('base64url')

describe('signLicense / verifyLicense', () => {
  it('round-trips a license and reports it active until it expires', () => {
    const token = signLicense(YEARLY, PRIVATE)
    expect(token.startsWith(`${LICENSE_PREFIX}.`)).toBe(true)
    expect(token.split('.')).toHaveLength(3)
    expect(verifyLicense(token, PUBLIC, NOW)).toEqual({ valid: true, active: true, license: YEARLY })
    expect(verifyLicense(token, PUBLIC, NOW + 365 * DAY - 1).active).toBe(true)
    expect(verifyLicense(token, PUBLIC, NOW + 365 * DAY)).toEqual({ valid: true, active: false, license: YEARLY })
  })

  it('keeps lifetime licenses active forever', () => {
    const lifetime: LicensePayload = { id: 'code-friends', plan: 'pro_lifetime', iat: NOW, exp: null }
    expect(verifyLicense(signLicense(lifetime, PRIVATE), PUBLIC, NOW + 50 * 365 * DAY)).toEqual({ valid: true, active: true, license: lifetime })
  })

  it('encodes exactly {id, plan, iat, exp} and signs the ASCII bytes "SETTLE1.<payload>"', () => {
    const token = signLicense({ ...YEARLY, extra: 'dropped' } as LicensePayload, PRIVATE)
    const [prefix, body, signature] = token.split('.')
    expect(JSON.parse(Buffer.from(body ?? '', 'base64url').toString('utf8'))).toEqual(YEARLY)
    const expected = sign(null, Buffer.from(`${prefix}.${body}`, 'ascii'), PRIVATE).toString('base64url')
    expect(signature).toBe(expected)
  })

  it('verifies in WebCrypto exactly as the browser will, with the SPKI public key', async () => {
    const token = signLicense(YEARLY, PRIVATE)
    const [prefix, body, signature] = token.split('.')
    const key = await webcrypto.subtle.importKey('spki', Buffer.from(TEST_LICENSE_KEYS.publicKeySpki ?? '', 'base64'), { name: 'Ed25519' }, false, ['verify'])
    const ok = await webcrypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      Buffer.from(signature ?? '', 'base64url'),
      new TextEncoder().encode(`${prefix}.${body}`),
    )
    expect(ok).toBe(true)
  })

  it('refuses to sign a malformed payload', () => {
    expect(() => signLicense({ ...YEARLY, id: '' }, PRIVATE)).toThrow()
    expect(() => signLicense({ ...YEARLY, exp: YEARLY.iat }, PRIVATE)).toThrow()
    expect(() => signLicense({ ...YEARLY, plan: 'pro_forever' } as unknown as LicensePayload, PRIVATE)).toThrow()
  })

  it('rejects tokens signed by another key', () => {
    const forged = signLicense(YEARLY, OTHER_LICENSE_KEYS.privateKey!)
    expect(verifyLicense(forged, PUBLIC, NOW)).toEqual({ valid: false, active: false, license: null })
  })

  it('rejects tampered payloads, prefixes and signatures', () => {
    const [prefix, body, signature] = signLicense(YEARLY, PRIVATE).split('.') as [string, string, string]
    const lifetimeBody = b64url(JSON.stringify({ ...YEARLY, plan: 'pro_lifetime', exp: null }))
    const flipped = Buffer.from(signature, 'base64url')
    flipped[0] = (flipped[0] ?? 0) ^ 1
    for (const token of [
      `${prefix}.${lifetimeBody}.${signature}`,
      `SETTLE2.${body}.${signature}`,
      `settle1.${body}.${signature}`,
      `${prefix}.${body}.${flipped.toString('base64url')}`,
      `${prefix}.${body}.${signature.slice(0, -2)}`,
      `${prefix}.${body}`,
      `${prefix}.${body}.${signature}.extra`,
      `${prefix}.${body}=.${signature}`,
      `${prefix}.${body}.${signature}==`,
    ]) {
      expect(verifyLicense(token, PUBLIC, NOW).valid).toBe(false)
    }
  })

  it('rejects a correctly signed payload that is not a license', () => {
    const forge = (payload: unknown) => {
      const body = b64url(JSON.stringify(payload))
      return `${LICENSE_PREFIX}.${body}.${sign(null, Buffer.from(`${LICENSE_PREFIX}.${body}`, 'ascii'), PRIVATE).toString('base64url')}`
    }
    for (const payload of [
      { ...YEARLY, plan: 'pro_forever' },
      { ...YEARLY, id: '' },
      { ...YEARLY, iat: 'yesterday' },
      { ...YEARLY, exp: NOW - 1 },
      { id: 'x', plan: 'pro_yearly' },
      [YEARLY],
      'SETTLE',
    ]) {
      expect(verifyLicense(forge(payload), PUBLIC, NOW).valid).toBe(false)
    }
    const notJson = `${LICENSE_PREFIX}.${b64url('{not json')}`
    expect(verifyLicense(`${notJson}.${sign(null, Buffer.from(notJson, 'ascii'), PRIVATE).toString('base64url')}`, PUBLIC, NOW).valid).toBe(false)
  })

  it('never throws on junk and refuses oversized tokens without checking them', () => {
    for (const junk of [undefined, null, 42, {}, '', '...', 'SETTLE1..', 'a'.repeat(MAX_TOKEN_LENGTH + 1), `SETTLE1.${'A'.repeat(2000)}.x`]) {
      expect(verifyLicense(junk, PUBLIC, NOW)).toEqual({ valid: false, active: false, license: null })
    }
  })

  it('accepts surrounding whitespace (a pasted code)', () => {
    expect(verifyLicense(`  ${signLicense(YEARLY, PRIVATE)}\n`, PUBLIC, NOW).valid).toBe(true)
  })
})

describe('isActive', () => {
  it('allows a day of clock skew for licenses issued "in the future", but no more', () => {
    expect(isActive({ ...YEARLY, iat: NOW + DAY - 1 }, NOW)).toBe(true)
    expect(isActive({ ...YEARLY, iat: NOW + 2 * DAY, exp: NOW + 400 * DAY }, NOW)).toBe(false)
  })
})

describe('licenseExpiry', () => {
  it('uses the plan length unless told otherwise', () => {
    expect(licenseExpiry('pro_monthly', NOW)).toBe(NOW + 30 * DAY)
    expect(licenseExpiry('pro_yearly', NOW)).toBe(NOW + 365 * DAY)
    expect(licenseExpiry('pro_lifetime', NOW)).toBeNull()
    expect(licenseExpiry('pro_lifetime', NOW, 7)).toBe(NOW + 7 * DAY)
    expect(licenseExpiry('pro_yearly', NOW, null)).toBeNull()
  })
})

describe('keys', () => {
  const pair = generateKeyPairSync('ed25519')
  const pkcs8Der = pair.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')
  const pkcs8Pem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  const spkiDer = pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
  const spkiPem = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString()

  it('reads private keys as base64 DER, PEM, or PEM with literal \\n (one-line .env)', () => {
    for (const raw of [pkcs8Der, ` "${pkcs8Der}" `, pkcs8Pem, pkcs8Pem.replace(/\n/g, '\\n'), `'${pkcs8Pem.replace(/\n/g, '\\n')}'`]) {
      const key = parsePrivateKey(raw)
      expect(key).not.toBeNull()
      if (key) expect(spkiBase64(createPublicKey(key))).toBe(spkiDer)
    }
  })

  it('reads public keys as base64 DER or PEM', () => {
    expect(spkiBase64(parsePublicKey(spkiDer)!)).toBe(spkiDer)
    expect(spkiBase64(parsePublicKey(spkiPem)!)).toBe(spkiDer)
  })

  it('refuses blanks, junk and keys of another type', () => {
    const rsa = generateKeyPairSync('rsa', { modulusLength: 1024 })
    for (const raw of [undefined, '', '   ', 'not-a-key', 'AAAA', rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()]) {
      expect(parsePrivateKey(raw)).toBeNull()
    }
    for (const raw of [undefined, '', 'junk', rsa.publicKey.export({ type: 'spki', format: 'pem' }).toString()]) {
      expect(parsePublicKey(raw)).toBeNull()
    }
  })

  it('derives the public key, and prefers the derived one when the configured one disagrees', () => {
    expect(loadLicenseKeys(pkcs8Der, undefined)).toMatchObject({ keys: { publicKeySpki: spkiDer }, problems: [] })
    const mismatch = loadLicenseKeys(pkcs8Der, TEST_LICENSE_KEYS.publicKeySpki ?? '')
    expect(mismatch.keys.publicKeySpki).toBe(spkiDer)
    expect(mismatch.problems).toEqual([expect.stringContaining("doesn't match")])
  })

  it('verifies with only a public key (a server that checks but never sells)', () => {
    const { keys } = loadLicenseKeys(undefined, TEST_LICENSE_KEYS.publicKeySpki ?? '')
    expect(keys.privateKey).toBeNull()
    expect(verifyLicense(signLicense(YEARLY, PRIVATE), keys.publicKey!, NOW).active).toBe(true)
  })

  it('explains bad keys without echoing them', () => {
    const { keys, problems } = loadLicenseKeys('secret-garbage-123', 'public-garbage-456')
    expect(keys).toEqual({ privateKey: null, publicKey: null, publicKeySpki: null })
    expect(problems).toHaveLength(2)
    expect(problems.join(' ')).not.toMatch(/garbage/)
  })
})
