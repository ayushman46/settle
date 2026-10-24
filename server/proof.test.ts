import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiErrorBody, ProofResponse } from '../shared/api'
import { createApp } from './app'
import { buildProofBody, isProofReply, normalizeProof, normalizeStatus, normalizeUpi, normalizeUtr, PROOF_SCHEMA } from './proof'
import { forgetPromptOnlyModels } from './nvidia'
import { chatResponse, fromSocket, JPEG_DATA_URL, sentBody, silentLogger, testConfig } from './testing'

/* Realistic readings, as the vision model returns them for screenshots of the apps. */

/** Google Pay, "Money sent" success screen. */
const GPAY_SUCCESS = {
  is_payment: true,
  app: 'gpay',
  status: 'success',
  amount: 420,
  currency: 'INR',
  payer_name: 'Ayush Mehta',
  payee_name: 'Riya Sharma',
  payee_upi: 'Riya.Sharma@okicici',
  utr: '431287654321',
  date: '2026-10-23',
  time: '18:42',
}

/** PhonePe, still processing. */
const PHONEPE_PENDING = {
  is_payment: true,
  app: 'phonepe',
  status: 'pending',
  amount: 1250.5,
  currency: 'INR',
  payer_name: 'Ayush Mehta',
  payee_name: 'Sam D',
  payee_upi: 'sam.d@ybl',
  utr: '512345678901',
  date: '2026-10-23',
  time: '9:05',
}

/** Paytm, payment failed. */
const PAYTM_FAILED = {
  is_payment: true,
  app: 'paytm',
  status: 'failed',
  amount: 2100,
  currency: null,
  payer_name: null,
  payee_name: 'Asha',
  payee_upi: null,
  utr: null,
  date: null,
  time: null,
}

const NOT_A_PAYMENT = {
  is_payment: false,
  app: 'unknown',
  status: 'unknown',
  amount: null,
  currency: null,
  payer_name: null,
  payee_name: null,
  payee_upi: null,
  utr: null,
  date: null,
  time: null,
}

describe('normalizeProof', () => {
  it('reads a successful GPay screen into a payment', () => {
    expect(normalizeProof(GPAY_SUCCESS)).toEqual({
      kind: 'payment',
      proof: {
        app: 'gpay',
        status: 'success',
        amount: 420,
        currency: 'INR',
        payerName: 'Ayush Mehta',
        payeeName: 'Riya Sharma',
        payeeUpi: 'riya.sharma@okicici',
        utr: '431287654321',
        date: '2026-10-23',
        time: '18:42',
      },
    })
  })

  it('keeps pending and failed readings as they are, with missing values as null', () => {
    const pending = normalizeProof(PHONEPE_PENDING)
    expect(pending.kind === 'payment' && pending.proof.status).toBe('pending')
    expect(pending.kind === 'payment' && pending.proof.amount).toBe(1250.5)
    expect(pending.kind === 'payment' && pending.proof.time).toBe('09:05')
    const failed = normalizeProof(PAYTM_FAILED)
    expect(failed.kind === 'payment' && failed.proof).toMatchObject({ status: 'failed', amount: 2100, utr: null, payeeUpi: null, date: null })
  })

  it('says "not a payment" for anything else, and never invents a payment from a non-answer', () => {
    expect(normalizeProof(NOT_A_PAYMENT)).toEqual({ kind: 'not_a_payment' })
    expect(normalizeProof({ ...GPAY_SUCCESS, is_payment: 'yes' })).toEqual({ kind: 'not_a_payment' })
    expect(normalizeProof(null)).toEqual({ kind: 'not_a_payment' })
    expect(normalizeProof('a sentence')).toEqual({ kind: 'not_a_payment' })
  })

  it('drops amounts that are not positive numbers, and reads amounts written as text', () => {
    const zero = normalizeProof({ ...GPAY_SUCCESS, amount: 0 })
    expect(zero.kind === 'payment' && zero.proof.amount).toBeNull()
    const text = normalizeProof({ ...GPAY_SUCCESS, amount: '₹1,25,000.50' })
    expect(text.kind === 'payment' && text.proof.amount).toBe(125000.5)
  })

  it('treats an unknown app as unknown, and never reads an unknown status as success', () => {
    const odd = normalizeProof({ ...GPAY_SUCCESS, app: 'Super App', status: 'Verified!' })
    expect(odd.kind === 'payment' && odd.proof).toMatchObject({ app: 'unknown', status: 'unknown' })
  })
})

describe('normalizeStatus', () => {
  it('maps the wording apps use onto the four statuses', () => {
    expect(normalizeStatus('Paid')).toBe('success')
    expect(normalizeStatus('Money sent')).toBe('success')
    expect(normalizeStatus('Processing')).toBe('pending')
    expect(normalizeStatus('Payment unsuccessful')).toBe('failed')
    expect(normalizeStatus('declined')).toBe('failed')
    expect(normalizeStatus(undefined)).toBe('unknown')
    expect(normalizeStatus('maybe')).toBe('unknown')
  })
})

describe('normalizeUtr', () => {
  it('keeps the digits of a reference (spaces and dashes dropped), 10 to 22 long', () => {
    expect(normalizeUtr('4312 8765 4321')).toBe('431287654321')
    expect(normalizeUtr('UTR: 512-345-678901')).toBe('512345678901')
    expect(normalizeUtr(431287654321)).toBe('431287654321')
    expect(normalizeUtr('12345')).toBeNull()
    expect(normalizeUtr('ABCDEFGHIJKL')).toBeNull()
    expect(normalizeUtr(null)).toBeNull()
  })
})

describe('normalizeUpi', () => {
  it('accepts name@bank in lower case, nothing else', () => {
    expect(normalizeUpi(' Riya.Sharma@OKICICI ')).toBe('riya.sharma@okicici')
    expect(normalizeUpi('98765 43210')).toBeNull()
    expect(normalizeUpi('riya@')).toBeNull()
    expect(normalizeUpi(undefined)).toBeNull()
  })
})

describe('isProofReply', () => {
  it('accepts only an object that says whether it is a payment', () => {
    expect(isProofReply(GPAY_SUCCESS)).toBe(true)
    expect(isProofReply(NOT_A_PAYMENT)).toBe(true)
    expect(isProofReply({ is_payment: 'maybe' })).toBe(false)
    expect(isProofReply({ amount: 420 })).toBe(false)
    expect(isProofReply([])).toBe(false)
  })
})

describe('the request to the model', () => {
  it('sends the screenshot with the proof prompt and the strict schema', () => {
    const body = buildProofBody('nvidia/test-vl', JPEG_DATA_URL, true)
    const messages = body.messages as Array<{ content: unknown }>
    const user = messages[1]?.content as Array<{ type: string; text?: string; image_url?: { url: string } }>
    expect(user[1]?.image_url?.url).toBe(JPEG_DATA_URL)
    expect(user[0]?.text).toMatch(/UTR/)
    expect(body.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'payment', strict: true, schema: PROOF_SCHEMA } })
    expect(PROOF_SCHEMA.required).toHaveLength(Object.keys(PROOF_SCHEMA.properties).length)
  })
})

/* The endpoint itself, with NVIDIA mocked. */

const fetchMock = vi.fn<typeof fetch>()
let logger = silentLogger()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  logger = silentLogger()
  forgetPromptOnlyModels()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function postProof(app: ReturnType<typeof createApp>, body: unknown, socket = '198.51.100.7') {
  return app.request(
    '/api/proof',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) },
    fromSocket(socket),
  )
}

describe('POST /api/proof', () => {
  it('reads a payment screenshot and returns the reading with the model that read it', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse(GPAY_SUCCESS))
    const response = await postProof(createApp(testConfig(), { logger }), { image: JPEG_DATA_URL })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const body = (await response.json()) as ProofResponse
    expect(body).toMatchObject({ status: 'success', amount: 420, utr: '431287654321', payeeUpi: 'riya.sharma@okicici', model: 'nvidia/nemotron-test-vl' })
    expect(sentBody(fetchMock).model).toBe('nvidia/nemotron-test-vl')
  })

  it('answers 422 not_a_payment for a photo that is not a payment', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse(NOT_A_PAYMENT))
    const response = await postProof(createApp(testConfig(), { logger }), { image: JPEG_DATA_URL })
    expect(response.status).toBe(422)
    expect(((await response.json()) as ApiErrorBody).error.code).toBe('not_a_payment')
  })

  it('refuses a body that is not an image data URL, before any model is called', async () => {
    const response = await postProof(createApp(testConfig(), { logger }), { image: 'https://example.com/a.png' })
    expect(response.status).toBe(415)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('says it is not configured when there is no key, without calling anyone', async () => {
    const response = await postProof(createApp(testConfig({ apiKey: null }), { logger }), { image: JPEG_DATA_URL })
    expect(response.status).toBe(503)
    expect(((await response.json()) as ApiErrorBody).error.code).toBe('not_configured')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to the next model when the first one replies without JSON', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse('I cannot see a payment here, sorry.')).mockResolvedValueOnce(chatResponse(PHONEPE_PENDING))
    const response = await postProof(createApp(testConfig(), { logger }), { image: JPEG_DATA_URL })
    expect(response.status).toBe(200)
    expect(((await response.json()) as ProofResponse).status).toBe('pending')
  })
})
