import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiErrorBody, HistoryResponse } from '../shared/api'
import { createApp } from './app'
import { buildHistoryBody, HISTORY_SCHEMA, historyUserPrompt, isHistoryReply, normalizeHistory } from './history'
import { forgetPromptOnlyModels } from './nvidia'
import { chatResponse, fromSocket, JPEG_DATA_URL, sentBody, silentLogger, testConfig } from './testing'

/** Google Pay history, filtered to money received (as the model returns it). */
const GPAY_RECEIVED = {
  is_history: true,
  app: 'gpay',
  skipped_outgoing: 0,
  rows: [
    { name: 'RIYA SHARMA', handle: null, amount: 420, date: '2026-10-23', status: 'success', cue: 'plus_sign', utr: null, cut_off: false },
    { name: 'Sam Dsouza', handle: '******4821@YBL', amount: '1,250.50', date: '2026-10-22', status: 'Completed', cue: 'received_word', utr: '6296 1842 7311', cut_off: false },
    { name: 'Asha', handle: null, amount: 0, date: '2026-10-21', status: 'success', cue: 'plus_sign', utr: null, cut_off: false },
    { name: 'Neha', handle: null, amount: 300, date: '2027-01-01', status: 'pending', cue: 'pinkish', utr: '12', cut_off: true },
  ],
}

describe('normalizeHistory', () => {
  it('keeps received rows, tidies their fields, never trusts an odd value', () => {
    const outcome = normalizeHistory(GPAY_RECEIVED, '2026-10-27')
    expect(outcome).toEqual({
      kind: 'history',
      app: 'gpay',
      skippedOutgoing: 0,
      rows: [
        { name: 'RIYA SHARMA', handle: null, amount: 420, date: '2026-10-23', status: 'success', cue: 'plus_sign', utr: null, cutOff: false },
        { name: 'Sam Dsouza', handle: '******4821@ybl', amount: 1250.5, date: '2026-10-22', status: 'success', cue: 'received_word', utr: '629618427311', cutOff: false },
        // A date after today is no date; an unknown cue is colour only; a short reference is none.
        { name: 'Neha', handle: null, amount: 300, date: null, status: 'pending', cue: 'green_only', utr: null, cutOff: true },
      ],
    })
  })

  it('a screenshot that isn’t a list of payments says so', () => {
    expect(normalizeHistory({ is_history: false, rows: [] }, '2026-10-27')).toEqual({ kind: 'not_a_history' })
    expect(normalizeHistory(null, '2026-10-27')).toEqual({ kind: 'not_a_history' })
  })

  it('accepts only an answer that says whether it’s a history', () => {
    expect(isHistoryReply({ is_history: true })).toBe(true)
    expect(isHistoryReply({ rows: [] })).toBe(false)
  })

  it('tells the model today’s date and only to transcribe money received', () => {
    const prompt = historyUserPrompt('2026-10-27')
    expect(prompt).toMatch(/Today is 2026-10-27/)
    expect(prompt).toMatch(/skipped_outgoing/)
    const body = buildHistoryBody('nvidia/test-vl', JPEG_DATA_URL, '2026-10-27', true)
    expect(body.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'history', strict: true, schema: HISTORY_SCHEMA } })
    expect(HISTORY_SCHEMA.required).toHaveLength(Object.keys(HISTORY_SCHEMA.properties).length)
  })
})

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

function postHistory(app: ReturnType<typeof createApp>, body: unknown) {
  return app.request(
    '/api/history',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    fromSocket('198.51.100.9'),
  )
}

describe('POST /api/history', () => {
  it('reads a history screenshot: the rows received, the count sent, the model', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse(GPAY_RECEIVED))
    const response = await postHistory(createApp(testConfig(), { logger }), { image: JPEG_DATA_URL, today: new Date().toISOString().slice(0, 10) })
    expect(response.status).toBe(200)
    const body = (await response.json()) as HistoryResponse
    expect(body.rows.map((r) => r.amount)).toEqual([420, 1250.5, 300])
    expect(body.model).toBe('nvidia/nemotron-test-vl')
    expect(JSON.stringify(sentBody(fetchMock))).toMatch(/Today is \d{4}-\d{2}-\d{2}/)
  })

  it('answers 422 not_a_history for a screenshot that isn’t a list', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse({ is_history: false, app: 'unknown', skipped_outgoing: 0, rows: [] }))
    const response = await postHistory(createApp(testConfig(), { logger }), { image: JPEG_DATA_URL })
    expect(response.status).toBe(422)
    expect(((await response.json()) as ApiErrorBody).error.code).toBe('not_a_history')
  })

  it('never logs names or amounts', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse(GPAY_RECEIVED))
    await postHistory(createApp(testConfig(), { logger }), { image: JPEG_DATA_URL })
    const logged = [...logger.info.mock.calls, ...logger.warn.mock.calls, ...logger.error.mock.calls].flat().join('\n')
    expect(logged).toMatch(/\[history\] ok · .* · 3 received · 0 sent/)
    expect(logged).not.toMatch(/RIYA|1250|420/)
  })

  it('says it is not configured without a key', async () => {
    const response = await postHistory(createApp(testConfig({ apiKey: null }), { logger }), { image: JPEG_DATA_URL })
    expect(response.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
