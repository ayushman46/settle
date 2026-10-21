import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HEALTH_KEY, markScanningUnavailable, prefetchHealth, resetHealthForTests, useHealth } from './health'

const fetchMock = vi.fn<typeof fetch>()

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  resetHealthForTests()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  resetHealthForTests()
  vi.unstubAllGlobals()
})

describe('useHealth', () => {
  it('is loading, then the server answer', async () => {
    fetchMock.mockResolvedValue(json({ ok: true, configured: false, models: ['m'] }))
    const { result } = renderHook(() => useHealth())
    expect(result.current).toBe('loading')
    await waitFor(() => expect(result.current).toEqual({ ok: true, configured: false, models: ['m'] }))
  })

  it('fetches once per page load, shared by every caller', async () => {
    fetchMock.mockResolvedValue(json({ ok: true, configured: true, models: [] }))
    prefetchHealth()
    const a = renderHook(() => useHealth())
    const b = renderHook(() => useHealth())
    await waitFor(() => expect(a.result.current).not.toBe('loading'))
    await waitFor(() => expect(b.result.current).not.toBe('loading'))
    renderHook(() => useHealth())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('is null when unreachable, and retries when back online', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    const { result } = renderHook(() => useHealth())
    await waitFor(() => expect(result.current).toBeNull())
    fetchMock.mockResolvedValue(json({ ok: true, configured: true, models: ['m'] }))
    window.dispatchEvent(new Event('online'))
    await waitFor(() => expect(result.current).toEqual({ ok: true, configured: true, models: ['m'] }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('remembers "scanning is off" for the next page load, until a check says otherwise', async () => {
    fetchMock.mockResolvedValue(json({ ok: true, configured: false, models: ['m'] }))
    const first = renderHook(() => useHealth())
    await waitFor(() => expect(first.result.current).toEqual({ ok: true, configured: false, models: ['m'] }))
    first.unmount()

    // Next page load: off from the first paint, while the live check is on its way.
    resetHealthForTests()
    let answer: (response: Response) => void = () => {}
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => (answer = resolve)))
    const second = renderHook(() => useHealth())
    expect(second.result.current).toEqual({ ok: true, configured: false, models: [] })

    // The server can scan again: that wins, and is what the next load starts from.
    await act(async () => answer(json({ ok: true, configured: true, models: ['m'] })))
    expect(second.result.current).toEqual({ ok: true, configured: true, models: ['m'] })
    second.unmount()
    resetHealthForTests()
    expect(renderHook(() => useHealth()).result.current).toBe('loading')
  })

  it('ignores a garbled remembered answer', () => {
    window.localStorage.setItem(HEALTH_KEY, '{oops')
    resetHealthForTests()
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}))
    expect(renderHook(() => useHealth()).result.current).toBe('loading')
  })

  it('markScanningUnavailable switches scanning off now, over a check already on its way', async () => {
    let answer: (response: Response) => void = () => {}
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => (answer = resolve)))
    const { result } = renderHook(() => useHealth())
    expect(result.current).toBe('loading')

    act(() => markScanningUnavailable())
    expect(result.current).toEqual({ ok: true, configured: false, models: [] })
    await act(async () => answer(json({ ok: true, configured: true, models: ['m'] })))
    expect(result.current).toEqual({ ok: true, configured: false, models: [] })
    expect(JSON.parse(window.localStorage.getItem(HEALTH_KEY) ?? 'null')).toEqual({ configured: false })
  })
})
