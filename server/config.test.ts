import { generateKeyPairSync } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DESCRIBE_BUDGET_MS, SCAN_BUDGET_MS } from '../shared/api'
import {
  checkoutReady,
  DEFAULT_BASE_URL,
  DEFAULT_MODELS,
  DEFAULT_RAZORPAY_BASE_URL,
  DEFAULT_TEXT_MODELS,
  loadConfig,
  parsePort,
  redactSecrets,
} from './config'
import { DEFAULT_PRICES } from './plans'

const pair = generateKeyPairSync('ed25519')
const PRIVATE_KEY_B64 = pair.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')
const PUBLIC_KEY_B64 = pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64')

describe('loadConfig', () => {
  it('uses sensible defaults for an empty environment', () => {
    expect(loadConfig({})).toEqual({
      apiKey: null,
      models: [...DEFAULT_MODELS],
      textModels: [...DEFAULT_TEXT_MODELS],
      baseUrl: DEFAULT_BASE_URL,
      timeoutMs: 35_000,
      describeTimeoutMs: 15_000,
      rateLimit: { max: 30, windowMs: 600_000 },
      proAiPerDay: 200,
      trustProxy: 0,
      maxConcurrentScans: 8,
      billing: {
        razorpay: null,
        razorpayBaseUrl: DEFAULT_RAZORPAY_BASE_URL,
        prices: { pro_monthly: 4900, pro_yearly: 39900, pro_lifetime: 99900 },
        rateLimit: { max: 30, windowMs: 600_000 },
      },
      license: { privateKey: null, publicKey: null, publicKeySpki: null },
      warnings: [],
    })
    expect(DEFAULT_MODELS).toEqual(['nvidia/nemotron-3.5-super-vl-120b-a12b', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning'])
    expect(DEFAULT_TEXT_MODELS).toEqual(['nvidia/nemotron-3.5-lightning-30b-a3b', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning'])
  })

  it('reads every variable', () => {
    const config = loadConfig({
      NVIDIA_API_KEY: '  nvapi-abc123DEF  ',
      NVIDIA_MODEL: 'a/b, c/d ,a/b,, e/f',
      NVIDIA_TEXT_MODEL: 't/fast, t/slow',
      NVIDIA_BASE_URL: 'https://example.test/v1///',
      NVIDIA_TIMEOUT_MS: '15000',
      NVIDIA_TEXT_TIMEOUT_MS: '9000',
      RATE_LIMIT_MAX: '5',
      RATE_LIMIT_WINDOW_MS: '60_000',
      PRO_AI_PER_DAY: '500',
      TRUST_PROXY: '1',
      MAX_CONCURRENT_SCANS: '4',
      RAZORPAY_KEY_ID: 'rzp_live_AbCdEf12345678',
      RAZORPAY_KEY_SECRET: ' "s3cretS3cret" ',
      PRO_PRICES: 'pro_monthly=9900, pro_lifetime=149900',
      BILLING_RATE_LIMIT_MAX: '12',
      LICENSE_PRIVATE_KEY: PRIVATE_KEY_B64,
    })
    expect(config).toMatchObject({
      apiKey: 'nvapi-abc123DEF',
      models: ['a/b', 'c/d', 'e/f'],
      textModels: ['t/fast', 't/slow'],
      baseUrl: 'https://example.test/v1',
      timeoutMs: 15_000,
      describeTimeoutMs: 9_000,
      rateLimit: { max: 5, windowMs: 60_000 },
      proAiPerDay: 500,
      trustProxy: 1,
      maxConcurrentScans: 4,
      billing: {
        razorpay: { keyId: 'rzp_live_AbCdEf12345678', keySecret: 's3cretS3cret' },
        prices: { pro_monthly: 9900, pro_yearly: 39900, pro_lifetime: 149900 },
        rateLimit: { max: 12, windowMs: 600_000 },
      },
      license: { publicKeySpki: PUBLIC_KEY_B64 },
      warnings: [],
    })
    expect(config.license.privateKey?.asymmetricKeyType).toBe('ed25519')
    expect(checkoutReady(config)).toBe(true)
  })

  it.each(['', '   ', 'nvapi-', 'nvapi-xxxxxxxx', 'your-api-key', 'YOUR_NVIDIA_API_KEY', '<your key>', '...', 'changeme', '""', "''", 'null'])(
    'treats placeholder key %j as not configured',
    (key) => {
      expect(loadConfig({ NVIDIA_API_KEY: key }).apiKey).toBeNull()
    },
  )

  it('strips quotes around values', () => {
    const config = loadConfig({ NVIDIA_API_KEY: '"nvapi-real-key-123"', NVIDIA_MODEL: "'x/y'" })
    expect(config.apiKey).toBe('nvapi-real-key-123')
    expect(config.models).toEqual(['x/y'])
  })

  it('falls back on invalid numbers and URLs', () => {
    const config = loadConfig({
      NVIDIA_TIMEOUT_MS: 'soon',
      RATE_LIMIT_MAX: '-1',
      RATE_LIMIT_WINDOW_MS: '0',
      NVIDIA_BASE_URL: 'ftp://nope',
      NVIDIA_MODEL: ' , ',
    })
    expect(config.timeoutMs).toBe(35_000)
    expect(config.rateLimit).toEqual({ max: 30, windowMs: 600_000 })
    expect(config.baseUrl).toBe(DEFAULT_BASE_URL)
    expect(config.models).toEqual([...DEFAULT_MODELS])
    expect(loadConfig({ NVIDIA_BASE_URL: 'not a url' }).baseUrl).toBe(DEFAULT_BASE_URL)
  })

  it('allows disabling the rate limit and the concurrency cap', () => {
    expect(loadConfig({ RATE_LIMIT_MAX: '0' }).rateLimit.max).toBe(0)
    expect(loadConfig({ MAX_CONCURRENT_SCANS: '0' }).maxConcurrentScans).toBe(0)
    expect(loadConfig({ MAX_CONCURRENT_SCANS: 'lots' }).maxConcurrentScans).toBe(8)
  })

  it('caps one attempt at the whole scan (or describe) budget', () => {
    expect(loadConfig({ NVIDIA_TIMEOUT_MS: '99999999' }).timeoutMs).toBe(SCAN_BUDGET_MS)
    expect(loadConfig({ NVIDIA_TEXT_TIMEOUT_MS: '99999999' }).describeTimeoutMs).toBe(DESCRIBE_BUDGET_MS)
  })

  it('lets PRO_AI_PER_DAY=0 and BILLING_RATE_LIMIT_MAX=0 lift those caps', () => {
    const config = loadConfig({ PRO_AI_PER_DAY: '0', BILLING_RATE_LIMIT_MAX: '0' })
    expect(config.proAiPerDay).toBe(0)
    expect(config.billing.rateLimit.max).toBe(0)
    expect(loadConfig({ PRO_AI_PER_DAY: 'lots' }).proAiPerDay).toBe(200)
  })

  it.each([
    ['0', 0],
    ['2', 2],
    ['5', 5],
    ['6', 0],
    ['-1', 0],
    ['true', 0],
    ['1.5', 0],
    ['', 0],
  ])('reads TRUST_PROXY=%j as %i (0–5 hops, anything else is ignored)', (raw, expected) => {
    expect(loadConfig({ TRUST_PROXY: raw }).trustProxy).toBe(expected)
  })

  it('returns a fresh models array each time', () => {
    const first = loadConfig({})
    first.models.push('mutated')
    expect(loadConfig({}).models).toEqual([...DEFAULT_MODELS])
  })
})

describe('parsePort', () => {
  it('accepts valid ports and falls back to 3000', () => {
    expect(parsePort('8080')).toBe(8080)
    expect(parsePort(undefined)).toBe(3000)
    expect(parsePort('0')).toBe(3000)
    expect(parsePort('70000')).toBe(3000)
    expect(parsePort('http')).toBe(3000)
  })
})

describe('redactSecrets', () => {
  it('removes every given secret and basic-auth credentials', () => {
    const text = 'nvapi-key=abc rzp=sk_live_123 Authorization: Basic cnpwX3Rlc3Q6c2VjcmV0'
    const redacted = redactSecrets(text, null, 'sk_live_123', undefined, 'abc')
    expect(redacted).not.toContain('sk_live_123')
    expect(redacted).not.toContain('cnpwX3Rlc3Q6c2VjcmV0')
    expect(redacted).not.toContain('=abc')
  })

  it('removes the configured key, key-shaped strings and bearer tokens', () => {
    const text = 'key=sk-secret-value nvapi-AbCdEf123456 Authorization: Bearer abc.def.ghi'
    const redacted = redactSecrets(text, 'sk-secret-value')
    expect(redacted).not.toContain('sk-secret-value')
    expect(redacted).not.toContain('AbCdEf123456')
    expect(redacted).not.toContain('abc.def.ghi')
    expect(redacted).toContain('[redacted]')
  })

  it('leaves ordinary text alone', () => {
    expect(redactSecrets('HTTP 404 model not found', null)).toBe('HTTP 404 model not found')
  })
})

describe('loadConfig — checkout and licensing', () => {
  it('turns checkout on only with both Razorpay keys and a license key to sign with', () => {
    const razorpay = { RAZORPAY_KEY_ID: 'rzp_test_AbCdEf12345678', RAZORPAY_KEY_SECRET: 'abcDEF123456ghiJKL789012' }
    expect(checkoutReady(loadConfig({ ...razorpay, LICENSE_PRIVATE_KEY: PRIVATE_KEY_B64 }))).toBe(true)
    expect(checkoutReady(loadConfig(razorpay))).toBe(false)
    expect(checkoutReady(loadConfig({ LICENSE_PRIVATE_KEY: PRIVATE_KEY_B64 }))).toBe(false)
  })

  it.each([
    [{ RAZORPAY_KEY_ID: 'rzp_test_AbCdEf12345678' }, /RAZORPAY_KEY_SECRET is missing/],
    [{ RAZORPAY_KEY_SECRET: 'abcDEF123456ghiJKL789012' }, /RAZORPAY_KEY_ID is missing/],
    [{ RAZORPAY_KEY_ID: 'key_123', RAZORPAY_KEY_SECRET: 'abcDEF123456ghiJKL789012' }, /should look like rzp_test_/],
  ])('keeps checkout off and explains why for %j', (env, warning) => {
    const config = loadConfig(env)
    expect(config.billing.razorpay).toBeNull()
    expect(config.warnings.join(' ')).toMatch(warning)
  })

  it.each(['', '  ', 'rzp_test_xxxxxxxxxxxxxx', 'rzp_live_', 'your_key_id', '<key id>'])('treats placeholder key id %j as not set', (keyId) => {
    const config = loadConfig({ RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: 'your_key_secret' })
    expect(config.billing.razorpay).toBeNull()
    expect(config.warnings).toEqual([])
  })

  it('never puts secrets in warnings', () => {
    const config = loadConfig({
      RAZORPAY_KEY_ID: 'oops-not-a-key-id',
      RAZORPAY_KEY_SECRET: 'superSecretValue123',
      LICENSE_PRIVATE_KEY: 'not-a-key-at-all',
      LICENSE_PUBLIC_KEY: 'also-not-a-key',
      PRO_PRICES: 'pro_monthly=1,pro_weekly=500',
    })
    const text = config.warnings.join('\n')
    expect(text).not.toContain('superSecretValue123')
    expect(text).not.toContain('not-a-key-at-all')
    expect(config.warnings).toHaveLength(5)
    expect(config.billing.prices).toEqual(DEFAULT_PRICES)
  })

  it('derives the public key from the private key and serves it as SPKI base64', () => {
    const config = loadConfig({ LICENSE_PRIVATE_KEY: PRIVATE_KEY_B64 })
    expect(config.license.publicKeySpki).toBe(PUBLIC_KEY_B64)
    expect(loadConfig({ LICENSE_PUBLIC_KEY: PUBLIC_KEY_B64 }).license).toMatchObject({ privateKey: null, publicKeySpki: PUBLIC_KEY_B64 })
  })
})

describe('.env.example', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
  const example = read('../.env.example')

  it('documents every variable the server reads', () => {
    const source = read('./config.ts') + read('./index.ts')
    const used = new Set([...source.matchAll(/\benv\.([A-Z][A-Z0-9_]*)/g)].map((match) => match[1] ?? ''))
    expect(used.size).toBeGreaterThan(15)
    for (const name of used) expect(example, name).toMatch(new RegExp(`^(?:# )?${name}=`, 'm'))
  })

  it('ships no secrets: keys are blank and the rest are commented-out defaults', () => {
    for (const line of example.split(/\r?\n/)) {
      const setting = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line)
      if (setting && setting[1] !== 'NVIDIA_MODEL' && setting[1] !== 'NVIDIA_TEXT_MODEL') expect(setting[2], setting[1]).toBe('')
    }
    expect(example).not.toMatch(/nvapi-[\w-]{6,}|rzp_(?:test|live)_[A-Za-z0-9]{8,}|-----BEGIN/)
  })

  it('suggests the same models and prices the server defaults to', () => {
    const value = (name: string) => new RegExp(`^(?:# )?${name}=(.*)$`, 'm').exec(example)?.[1]
    expect(value('NVIDIA_MODEL')).toBe(DEFAULT_MODELS.join(','))
    expect(value('NVIDIA_TEXT_MODEL')).toBe(DEFAULT_TEXT_MODELS.join(','))
    expect(value('PRO_PRICES')).toBe(Object.entries(DEFAULT_PRICES).map(([plan, paise]) => `${plan}=${paise}`).join(','))
    expect(loadConfig({ PRO_PRICES: value('PRO_PRICES') }).warnings).toEqual([])
  })
})
