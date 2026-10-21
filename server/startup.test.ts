import { describe, expect, it } from 'vitest'
import { loadConfig } from './config'
import { NO_LICENSE_KEYS } from './license'
import { displayHost, readyLine, startupWarnings } from './startup'
import { TEST_KEY, TEST_LICENSE_KEYS, TEST_RAZORPAY, testBilling, testConfig } from './testing'

const BUILT = { clientDir: '/srv/settle/dist/client', clientBuilt: true }
const PUBLIC_ONLY = { privateKey: null, publicKey: TEST_LICENSE_KEYS.publicKey, publicKeySpki: TEST_LICENSE_KEYS.publicKeySpki }
const PRIVATE_KEY_B64 = TEST_LICENSE_KEYS.privateKey?.export({ type: 'pkcs8', format: 'der' }).toString('base64') ?? ''

describe('startupWarnings', () => {
  it('is quiet when AI, licensing and checkout are all set up', () => {
    expect(startupWarnings(testConfig(), BUILT)).toEqual([])
  })

  it('points at the build when the client is missing', () => {
    const notes = startupWarnings(testConfig(), { clientDir: '/srv/settle/dist/client', clientBuilt: false })
    expect(notes).toEqual(['No client build at /srv/settle/dist/client — run "npm run build". The API still works.'])
  })

  it('says AI is off without an NVIDIA key, and that everything else works', () => {
    const notes = startupWarnings(testConfig({ apiKey: null }), BUILT)
    expect(notes).toEqual(['NVIDIA_API_KEY is not set: AI (bill scanning, "Just say it") is off. Everything else works.'])
  })

  it('explains how to turn Pro on when there is no license key', () => {
    const notes = startupWarnings(testConfig({ license: NO_LICENSE_KEYS }), BUILT)
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatch(/^LICENSE_PRIVATE_KEY is not set: Pro checkout and redeem codes are off\./)
    expect(notes[0]).toContain('npm run license keygen')
  })

  it('says codes still work when only the public key is set', () => {
    const notes = startupWarnings(testConfig({ license: PUBLIC_ONLY }), BUILT)
    expect(notes).toEqual(['Only LICENSE_PUBLIC_KEY is set: codes can be redeemed, but checkout is off until LICENSE_PRIVATE_KEY is set to sign licenses.'])
  })

  it('says checkout is off (and redeeming still works) without Razorpay keys', () => {
    const notes = startupWarnings(testConfig({ billing: testBilling({ razorpay: null }) }), BUILT)
    expect(notes).toEqual(['Checkout is off (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set): the Pro page shows plans and "Redeem a code" still works.'])
  })

  it("doesn't repeat what loadConfig already said about a half-set Razorpay key", () => {
    const config = loadConfig({ NVIDIA_API_KEY: TEST_KEY, LICENSE_PRIVATE_KEY: PRIVATE_KEY_B64, RAZORPAY_KEY_ID: TEST_RAZORPAY.keyId })
    expect(startupWarnings(config, BUILT)).toEqual(['Razorpay checkout is off: RAZORPAY_KEY_SECRET is missing.'])
  })

  it('lists everything for a bare environment, most important first, without secrets', () => {
    const notes = startupWarnings(loadConfig({ RAZORPAY_KEY_SECRET: 'superSecretValue123', PRO_PRICES: 'pro_weekly=500' }), {
      clientDir: '/x',
      clientBuilt: false,
    })
    expect(notes.map((note) => note.split(/[ :]/)[0])).toEqual(['No', 'PRO_PRICES', 'Razorpay', 'NVIDIA_API_KEY', 'LICENSE_PRIVATE_KEY'])
    expect(notes.join('\n')).not.toContain('superSecretValue123')
  })

  it('passes config warnings through unchanged', () => {
    const notes = startupWarnings(testConfig({ warnings: ['PRO_PRICES: unknown plan "x".'] }), BUILT)
    expect(notes).toEqual(['PRO_PRICES: unknown plan "x".'])
  })
})

describe('readyLine', () => {
  it('names the address, the models and the checkout mode', () => {
    expect(readyLine(testConfig(), { port: 3000 })).toBe(
      'Ready on http://localhost:3000 · vision: nvidia/nemotron-test-vl, google/gemma-test · text: nvidia/nemotron-test-text, meta/llama-test-text · checkout: Razorpay test mode',
    )
  })

  it('tells live keys apart from test keys', () => {
    const live = testConfig({ billing: testBilling({ razorpay: { keyId: 'rzp_live_AbCdEf12345678', keySecret: 'x' } }) })
    expect(readyLine(live, { port: 8080 })).toMatch(/checkout: Razorpay live mode$/)
  })

  it('says what is off', () => {
    expect(readyLine(testConfig({ apiKey: null }), { port: 1 })).toContain(' · AI: off · ')
    expect(readyLine(testConfig({ billing: testBilling({ razorpay: null }) }), { port: 1 })).toMatch(/checkout: off \(codes only\)$/)
    expect(readyLine(testConfig({ license: PUBLIC_ONLY }), { port: 1 })).toMatch(/checkout: off \(codes only\)$/)
    expect(readyLine(testConfig({ license: NO_LICENSE_KEYS }), { port: 1 })).toMatch(/Pro: off$/)
  })

  it('never prints a secret', () => {
    const line = readyLine(testConfig(), { port: 3000 })
    expect(PRIVATE_KEY_B64).not.toBe('')
    for (const secret of [TEST_KEY, TEST_RAZORPAY.keySecret, PRIVATE_KEY_B64]) {
      expect(line).not.toContain(secret)
    }
  })
})

describe('displayHost', () => {
  it.each([
    [undefined, 'localhost'],
    ['', 'localhost'],
    ['0.0.0.0', 'localhost'],
    ['::', 'localhost'],
    ['127.0.0.1', '127.0.0.1'],
    ['settle.internal', 'settle.internal'],
    ['::1', '[::1]'],
  ])('%j → %s', (hostname, expected) => {
    expect(displayHost(hostname)).toBe(expected)
  })
})
