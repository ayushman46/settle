import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkLicenseToken, isLicenseActive, resetLicenseKeysForTests, verifyLicenseToken } from './license'
import { createTestSigner, DAY_SECONDS, type TestSigner } from './testKit'
import {
  base64ToBytes,
  base64UrlToBytes,
  bytesToBase64Url,
  extractLicenseToken,
  LICENSE_PREFIX,
  MAX_TOKEN_LENGTH,
  parseLicensePayload,
  parseLicenseToken,
} from './token'

const fetchMock = vi.fn<typeof fetch>()

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

let signer: TestSigner
let other: TestSigner

beforeAll(async () => {
  signer = await createTestSigner()
  other = await createTestSigner()
})

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  resetLicenseKeysForTests()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const ISSUED = 1_790_000_000

function encodeClaims(claims: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(claims)))
}

describe('base64 helpers', () => {
  it('round-trips bytes through base64url without padding', () => {
    const bytes = Uint8Array.from([0, 1, 2, 250, 251, 252, 253, 254, 255])
    const text = bytesToBase64Url(bytes)
    expect(text).not.toMatch(/[+/=]/)
    expect(Array.from(base64UrlToBytes(text) ?? [])).toEqual(Array.from(bytes))
  })

  it('accepts padded and unpadded standard base64, rejects junk', () => {
    expect(Array.from(base64ToBytes('AQI=') ?? [])).toEqual([1, 2])
    expect(Array.from(base64ToBytes('AQI') ?? [])).toEqual([1, 2])
    expect(Array.from(base64ToBytes(' AQ\nI= ') ?? [])).toEqual([1, 2])
    expect(base64ToBytes('A')).toBeNull()
    expect(base64ToBytes('AQ*I')).toBeNull()
    expect(base64ToBytes('A=B=')).toBeNull()
    expect(base64UrlToBytes('AQ+I')).toBeNull()
    expect(base64UrlToBytes('AQ=I')).toBeNull()
  })
})

describe('parseLicensePayload', () => {
  const ok = { id: 'pay_1', plan: 'pro_monthly', iat: ISSUED, exp: ISSUED + 30 * DAY_SECONDS }

  it('keeps the four claims and ignores extras', () => {
    expect(parseLicensePayload({ ...ok, extra: true })).toEqual(ok)
    expect(parseLicensePayload({ ...ok, plan: 'pro_lifetime', exp: null })).toEqual({ ...ok, plan: 'pro_lifetime', exp: null })
  })

  it.each([
    ['no id', { ...ok, id: undefined }],
    ['blank id', { ...ok, id: '  ' }],
    ['huge id', { ...ok, id: 'x'.repeat(129) }],
    ['unknown plan', { ...ok, plan: 'pro_forever' }],
    ['fractional iat', { ...ok, iat: 1.5 }],
    ['negative iat', { ...ok, iat: -1 }],
    ['iat as text', { ...ok, iat: String(ISSUED) }],
    ['exp before iat', { ...ok, exp: ISSUED - 1 }],
    ['exp equal to iat', { ...ok, exp: ISSUED }],
    ['exp missing', { id: 'a', plan: 'pro_monthly', iat: ISSUED }],
    ['an array', [ok]],
    ['null', null],
  ])('rejects %s', (_label, value) => {
    expect(parseLicensePayload(value)).toBeNull()
  })
})

describe('parseLicenseToken', () => {
  it('reads the claims and the exact bytes the signature covers', async () => {
    const token = await signer.token({ id: 'promo-diwali', plan: 'pro_lifetime', iat: ISSUED, exp: null })
    const parsed = parseLicenseToken(token)
    expect(parsed?.license).toEqual({ id: 'promo-diwali', plan: 'pro_lifetime', iat: ISSUED, exp: null })
    const [prefix, payload] = token.split('.')
    expect(new TextDecoder().decode(parsed?.signed)).toBe(`${prefix}.${payload}`)
    expect(parsed?.signature).toHaveLength(64)
  })

  it('rejects anything that is not a well-formed token', async () => {
    const token = await signer.token()
    const [, payload, sig] = token.split('.') as [string, string, string]
    const cases = [
      '',
      'SETTLE1',
      `SETTLE1.${payload}`,
      `${token}.extra`,
      `SETTLE2.${payload}.${sig}`,
      `settle1.${payload}.${sig}`,
      `SETTLE1..${sig}`,
      `SETTLE1.${payload}.`,
      `SETTLE1.${payload}.${sig.slice(0, -4)}`,
      `SETTLE1.${payload}.${sig}AAAA`,
      `SETTLE1.${payload}!.${sig}`,
      `SETTLE1.${bytesToBase64Url(Uint8Array.from([0xff, 0xfe]))}.${sig}`,
      `SETTLE1.${encodeClaims('just text')}.${sig}`,
      `SETTLE1.${encodeClaims({ id: 'x', plan: 'gold', iat: 1, exp: null })}.${sig}`,
      `SETTLE1.${'A'.repeat(MAX_TOKEN_LENGTH)}.${sig}`,
    ]
    for (const bad of cases) expect(parseLicenseToken(bad), bad.slice(0, 40)).toBeNull()
  })
})

describe('extractLicenseToken', () => {
  it('finds the code in whatever was pasted', async () => {
    const token = await signer.token()
    expect(extractLicenseToken(token)).toBe(token)
    expect(extractLicenseToken(`  ${token}\n`)).toBe(token)
    expect(extractLicenseToken(`Here's your Settle Pro code: ${token} Enjoy!`)).toBe(token)
    expect(extractLicenseToken(`"${token}".`)).toBe(token)
    expect(extractLicenseToken(`https://settle.example/app/pro?code=${encodeURIComponent(token)}&x=1`)).toBe(token)
    expect(extractLicenseToken(`settle1${token.slice(LICENSE_PREFIX.length)}`)).toBe(token)
    // A chat app wrapped it over three lines.
    const wrapped = `${token.slice(0, 40)}\n${token.slice(40, 90)}\r\n${token.slice(90)}`
    expect(extractLicenseToken(wrapped)).toBe(token)
    expect(extractLicenseToken(`${token.slice(0, 50)}\u200B${token.slice(50)}`)).toBe(token)
  })

  it('returns a token-shaped string even when it is not well-formed, so it can be called invalid', () => {
    expect(extractLicenseToken('code: SETTLE1.abc.def')).toBe('SETTLE1.abc.def')
  })

  it('returns null when there is no code at all', () => {
    expect(extractLicenseToken('')).toBeNull()
    expect(extractLicenseToken('PRO-2026-DIWALI')).toBeNull()
    expect(extractLicenseToken('SETTLE1.')).toBeNull()
    expect(extractLicenseToken('%E0%A4%A')).toBeNull()
  })
})

describe('verifyLicenseToken on the device (Ed25519)', () => {
  it('accepts a token signed by the server key', async () => {
    const token = await signer.token({ id: 'pay_A', plan: 'pro_monthly', iat: ISSUED, exp: ISSUED + 30 * DAY_SECONDS })
    await expect(verifyLicenseToken(token, signer.publicKey)).resolves.toEqual({
      id: 'pay_A',
      plan: 'pro_monthly',
      iat: ISSUED,
      exp: ISSUED + 30 * DAY_SECONDS,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns genuine licenses even when expired (expiry is isLicenseActive’s call)', async () => {
    const token = await signer.token({ iat: 1000, exp: 2000 })
    const license = await verifyLicenseToken(token, signer.publicKey)
    expect(license?.exp).toBe(2000)
    expect(isLicenseActive(license)).toBe(false)
  })

  it('rejects tokens signed by another key', async () => {
    const token = await other.token()
    await expect(verifyLicenseToken(token, signer.publicKey)).resolves.toBeNull()
    await expect(checkLicenseToken(token, signer.publicKey)).resolves.toEqual({ status: 'invalid' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects edited claims (lifetime swapped in, signature kept)', async () => {
    const token = await signer.token({ plan: 'pro_monthly', iat: ISSUED, exp: ISSUED + 30 * DAY_SECONDS })
    const [, , sig] = token.split('.')
    const forged = `SETTLE1.${encodeClaims({ id: 'pay_test123', plan: 'pro_lifetime', iat: ISSUED, exp: null })}.${sig}`
    expect(parseLicenseToken(forged)).not.toBeNull()
    await expect(verifyLicenseToken(forged, signer.publicKey)).resolves.toBeNull()
  })

  it('rejects a flipped signature bit', async () => {
    const token = await signer.token()
    const [prefix, payload, sig] = token.split('.') as [string, string, string]
    const bytes = base64UrlToBytes(sig) ?? new Uint8Array()
    bytes[10] = (bytes[10] ?? 0) ^ 1
    await expect(verifyLicenseToken(`${prefix}.${payload}.${bytesToBase64Url(bytes)}`, signer.publicKey)).resolves.toBeNull()
  })

  it('rejects malformed tokens without asking anyone', async () => {
    await expect(checkLicenseToken('SETTLE1.nope.nope', signer.publicKey)).resolves.toEqual({ status: 'invalid' })
    await expect(checkLicenseToken('SETTLE1.nope.nope', null)).resolves.toEqual({ status: 'invalid' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('imports each key once', async () => {
    const importKey = vi.spyOn(crypto.subtle, 'importKey')
    const token = await signer.token()
    await verifyLicenseToken(token, signer.publicKey)
    await verifyLicenseToken(token, signer.publicKey)
    expect(importKey).toHaveBeenCalledTimes(1)
  })
})

describe('verifyLicenseToken via the server', () => {
  async function serverAnswers(token: string, response: Response | Error, key: string | null = null) {
    if (response instanceof Error) fetchMock.mockRejectedValue(response)
    else fetchMock.mockResolvedValue(response)
    return checkLicenseToken(token, key)
  }

  it('asks the server when there is no key', async () => {
    const token = await signer.token({ iat: ISSUED, exp: null, plan: 'pro_lifetime' })
    const license = { id: 'pay_test123', plan: 'pro_lifetime', iat: ISSUED, exp: null }
    fetchMock.mockResolvedValue(json({ valid: true, active: true, license }))
    await expect(verifyLicenseToken(token, null)).resolves.toEqual(license)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('/api/license/verify')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ license: token })
  })

  it('asks the server when the browser has no Ed25519', async () => {
    vi.spyOn(crypto.subtle, 'importKey').mockRejectedValue(new DOMException('Unrecognized name.', 'NotSupportedError'))
    const token = await signer.token()
    fetchMock.mockResolvedValue(json({ valid: true, active: true, license: parseLicenseToken(token)?.license }))
    await expect(checkLicenseToken(token, signer.publicKey)).resolves.toMatchObject({ status: 'valid' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('asks the server when the page has no WebCrypto (plain-http LAN testing)', async () => {
    const token = await signer.token()
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    fetchMock.mockResolvedValue(json({ valid: false, active: false, license: null }))
    await expect(checkLicenseToken(token, signer.publicKey)).resolves.toEqual({ status: 'invalid' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('asks the server when the key itself is garbled', async () => {
    const token = await signer.token()
    fetchMock.mockImplementation(async () => json({ valid: true, active: true, license: parseLicenseToken(token)?.license }))
    await expect(checkLicenseToken(token, 'not*base64')).resolves.toMatchObject({ status: 'valid' })
    await expect(checkLicenseToken(token, 'AAAA')).resolves.toMatchObject({ status: 'valid' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('tells "not genuine" apart from "could not check"', async () => {
    const token = await signer.token()
    expect(await serverAnswers(token, json({ valid: false, active: false, license: null }))).toEqual({ status: 'invalid' })
    expect(await serverAnswers(token, json({ error: { code: 'bad_request' } }, 400))).toEqual({ status: 'invalid' })
    expect(await serverAnswers(token, json({ error: { code: 'billing_unavailable' } }, 503))).toEqual({ status: 'unverified' })
    expect(await serverAnswers(token, json({ error: { code: 'rate_limited' } }, 429))).toEqual({ status: 'unverified' })
    expect(await serverAnswers(token, new TypeError('Failed to fetch'))).toEqual({ status: 'unverified' })
    expect(await serverAnswers(token, new Response('<html>', { status: 200 }))).toEqual({ status: 'unverified' })
    expect(await serverAnswers(token, json({ ok: true }))).toEqual({ status: 'unverified' })
  })

  it('distrusts a server that decoded different claims', async () => {
    const token = await signer.token({ plan: 'pro_monthly', iat: ISSUED, exp: ISSUED + DAY_SECONDS })
    const check = await serverAnswers(
      token,
      json({ valid: true, active: true, license: { id: 'pay_test123', plan: 'pro_lifetime', iat: ISSUED, exp: null } }),
    )
    expect(check).toEqual({ status: 'unverified' })
  })

  it('does not call the server when offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const token = await signer.token()
    await expect(checkLicenseToken(token, null)).resolves.toEqual({ status: 'unverified' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('isLicenseActive', () => {
  const base = { id: 'x', plan: 'pro_monthly' as const, iat: 100 }

  it('is active until exp, forever for lifetime, never for null', () => {
    expect(isLicenseActive(null)).toBe(false)
    expect(isLicenseActive({ ...base, plan: 'pro_lifetime', exp: null }, 9e12)).toBe(true)
    expect(isLicenseActive({ ...base, exp: 200 }, 199.999)).toBe(true)
    expect(isLicenseActive({ ...base, exp: 200 }, 200)).toBe(false)
    expect(isLicenseActive({ ...base, exp: 200 }, 201)).toBe(false)
  })

  it('uses the clock by default', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(isLicenseActive({ ...base, exp: now + 60 })).toBe(true)
    expect(isLicenseActive({ ...base, exp: now - 60 })).toBe(false)
  })
})
