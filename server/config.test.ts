import { describe, expect, it } from 'vitest'
import { SCAN_BUDGET_MS } from '../shared/api'
import { DEFAULT_BASE_URL, DEFAULT_MODELS, loadConfig, parsePort, redactSecrets } from './config'

describe('loadConfig', () => {
  it('uses sensible defaults for an empty environment', () => {
    expect(loadConfig({})).toEqual({
      apiKey: null,
      models: [...DEFAULT_MODELS],
      baseUrl: DEFAULT_BASE_URL,
      timeoutMs: 35_000,
      rateLimit: { max: 30, windowMs: 600_000 },
      trustProxy: 0,
      maxConcurrentScans: 8,
    })
    expect(DEFAULT_MODELS).toEqual(['nvidia/nemotron-3.5-super-vl-120b-a12b', 'google/gemma-4-31b-it', 'meta/llama-3.2-90b-vision-instruct'])
  })

  it('reads every variable', () => {
    expect(
      loadConfig({
        NVIDIA_API_KEY: '  nvapi-abc123DEF  ',
        NVIDIA_MODEL: 'a/b, c/d ,a/b,, e/f',
        NVIDIA_BASE_URL: 'https://example.test/v1///',
        NVIDIA_TIMEOUT_MS: '15000',
        RATE_LIMIT_MAX: '5',
        RATE_LIMIT_WINDOW_MS: '60_000',
        TRUST_PROXY: '1',
        MAX_CONCURRENT_SCANS: '4',
      }),
    ).toEqual({
      apiKey: 'nvapi-abc123DEF',
      models: ['a/b', 'c/d', 'e/f'],
      baseUrl: 'https://example.test/v1',
      timeoutMs: 15_000,
      rateLimit: { max: 5, windowMs: 60_000 },
      trustProxy: 1,
      maxConcurrentScans: 4,
    })
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

  it('caps one attempt at the whole scan budget', () => {
    expect(loadConfig({ NVIDIA_TIMEOUT_MS: '99999999' }).timeoutMs).toBe(SCAN_BUDGET_MS)
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
