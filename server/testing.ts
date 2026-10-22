/**
 * Shared fixtures for the server tests (not imported by production code).
 */
import { createPublicKey, generateKeyPairSync } from 'node:crypto'
import { vi, type Mock } from 'vitest'
import type { Logger } from './app'
import type { BillingSettings, ServerConfig } from './config'
import { DEFAULT_PRICES } from './plans'
import { NO_LICENSE_KEYS, spkiBase64, type LicenseKeys } from './license'

export const TEST_KEY = 'nvapi-test-key-0123456789'
export const TEST_RAZORPAY = { keyId: 'rzp_test_AbCdEf12345678', keySecret: 'rzpTestSecret0123456789ab' } as const

/** A real Ed25519 key pair for the whole test run. */
const pair = generateKeyPairSync('ed25519')
export const TEST_LICENSE_KEYS: LicenseKeys = {
  privateKey: pair.privateKey,
  publicKey: pair.publicKey,
  publicKeySpki: spkiBase64(pair.publicKey),
}

/** Another server's keys: tokens they sign must not verify with ours. */
const otherPair = generateKeyPairSync('ed25519')
export const OTHER_LICENSE_KEYS: LicenseKeys = {
  privateKey: otherPair.privateKey,
  publicKey: createPublicKey(otherPair.privateKey),
  publicKeySpki: spkiBase64(otherPair.publicKey),
}

export function testBilling(overrides: Partial<BillingSettings> = {}): BillingSettings {
  return {
    razorpay: { ...TEST_RAZORPAY },
    razorpayBaseUrl: 'https://razorpay.test/v1',
    prices: { ...DEFAULT_PRICES },
    rateLimit: { max: 0, windowMs: 60_000 },
    ...overrides,
  }
}

/** AI and billing fully set up (with fakes), limits off. Billing off: `{ billing: testBilling({ razorpay: null }) }`. */
export function testConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    apiKey: TEST_KEY,
    models: ['nvidia/nemotron-test-vl', 'google/gemma-test'],
    textModels: ['nvidia/nemotron-test-text', 'meta/llama-test-text'],
    baseUrl: 'https://nvidia.test/v1',
    timeoutMs: 5_000,
    describeTimeoutMs: 5_000,
    rateLimit: { max: 0, windowMs: 60_000 },
    proAiPerDay: 0,
    trustProxy: 0,
    proxySecret: null,
    maxConcurrentScans: 0,
    billing: testBilling(),
    license: TEST_LICENSE_KEYS,
    warnings: [],
    ...overrides,
  }
}

export { NO_LICENSE_KEYS }

const base64 = (bytes: number[], filler = 64) => Buffer.from([...bytes, ...new Array<number>(filler).fill(0)]).toString('base64')

export const JPEG_DATA_URL = `data:image/jpeg;base64,${base64([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])}`
export const PNG_DATA_URL = `data:image/png;base64,${base64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])}`
export const WEBP_DATA_URL = `data:image/webp;base64,${base64([...Buffer.from('RIFF'), 0x24, 0, 0, 0, ...Buffer.from('WEBPVP8 ')])}`
export const GIF_BYTES_AS_PNG = `data:image/png;base64,${base64([...Buffer.from('GIF89a')])}`

export const BILL = {
  isBill: true,
  merchant: 'SAFFRON TABLE',
  date: '18/10/2026',
  currency: 'INR',
  items: [
    { name: 'PANEER TIKKA', quantity: 1, amount: 345 },
    { name: 'GARLIC NAAN', quantity: 4, amount: 300 },
  ],
  subtotal: 645,
  tax: 32.25,
  serviceCharge: null,
  discount: null,
  tip: null,
  total: 677,
}

export function chatResponse(content: unknown, init: ResponseInit = {}): Response {
  const text = typeof content === 'string' ? content : JSON.stringify(content)
  return new Response(JSON.stringify({ id: 'cmpl-1', choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

export function errorResponse(status: number, message: string, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error: { message } }), { status, headers: { 'content-type': 'application/json', ...headers } })
}

/** The `env` @hono/node-server hands the app: `getConnInfo` reads the socket's address from it. */
export function fromSocket(remoteAddress: string) {
  return { incoming: { socket: { remoteAddress, remotePort: 51234, remoteFamily: remoteAddress.includes(':') ? 'IPv6' : 'IPv4' } } }
}

/** A fetch that never answers, but rejects like the real one when its signal aborts. */
export function hangingFetch() {
  return (_input: unknown, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal
      const abort = () => reject(signal?.reason instanceof Error ? signal.reason : new DOMException('This operation was aborted', 'AbortError'))
      if (signal?.aborted) abort()
      signal?.addEventListener('abort', abort, { once: true })
    })
}

/** The parsed JSON body of the n-th fetch call. */
export function sentBody(fetchMock: { mock: { calls: unknown[][] } }, call = 0): Record<string, unknown> {
  const init = fetchMock.mock.calls[call]?.[1] as RequestInit | undefined
  return JSON.parse(String(init?.body)) as Record<string, unknown>
}

type LogMock = Mock<(message: string) => void>

/** A logger that records instead of printing. */
export function silentLogger(): Logger & { info: LogMock; warn: LogMock; error: LogMock } {
  return { info: vi.fn<(message: string) => void>(), warn: vi.fn<(message: string) => void>(), error: vi.fn<(message: string) => void>() }
}
