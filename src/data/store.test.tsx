import { act, render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as z from 'zod/mini'
import {
  createStore,
  flushAllStores,
  memoizeLast,
  reloadAllStores,
  shallowArrayEqual,
  shallowRecordEqual,
  useStorageWritable,
  useStore,
  WRITE_DELAY_MS,
} from './store'

let n = 0
function makeStore(opts: { migrate?: (raw: unknown) => string[] | null; version?: number } = {}) {
  n += 1
  return createStore<string[]>({
    key: `test.store.${n}`,
    schema: z.array(z.string()),
    initial: () => ['initial'],
    version: opts.version ?? 2,
    migrate: opts.migrate,
  })
}

function saved(key: string): unknown {
  const raw = window.localStorage.getItem(key)
  return raw === null ? null : JSON.parse(raw)
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  reloadAllStores()
})

describe('createStore — loading', () => {
  it('starts from initial() and writes nothing until changed', () => {
    const store = makeStore()
    expect(store.get()).toEqual(['initial'])
    vi.advanceTimersByTime(1000)
    expect(window.localStorage.getItem(store.key)).toBeNull()
  })

  it('reads a saved envelope', () => {
    const store = makeStore()
    window.localStorage.setItem(store.key, JSON.stringify({ v: 2, data: ['a', 'b'] }))
    expect(store.get()).toEqual(['a', 'b'])
  })

  it('falls back to initial() for corrupt JSON or an invalid shape', () => {
    const corrupt = makeStore()
    window.localStorage.setItem(corrupt.key, '{oops')
    expect(corrupt.get()).toEqual(['initial'])
    const wrong = makeStore()
    window.localStorage.setItem(wrong.key, JSON.stringify({ v: 2, data: [1, 2] }))
    expect(wrong.get()).toEqual(['initial'])
  })

  it('reads data written by a newer version when it still fits', () => {
    const store = makeStore()
    window.localStorage.setItem(store.key, JSON.stringify({ v: 3, data: ['future'] }))
    expect(store.get()).toEqual(['future'])
  })

  it('migrates older formats and saves the upgrade', () => {
    const migrate = vi.fn((raw: unknown) => (Array.isArray(raw) ? raw.map(String) : null))
    const store = makeStore({ migrate })
    window.localStorage.setItem(store.key, JSON.stringify([1, 2]))
    expect(store.get()).toEqual(['1', '2'])
    expect(migrate).toHaveBeenCalledWith([1, 2])
    vi.advanceTimersByTime(WRITE_DELAY_MS)
    expect(saved(store.key)).toEqual({ v: 2, data: ['1', '2'] })
  })

  it('passes old envelopes to migrate, and survives migrate failing', () => {
    const old = makeStore({ migrate: (raw) => ((raw as { v: number }).v === 1 ? ['upgraded'] : null) })
    window.localStorage.setItem(old.key, JSON.stringify({ v: 1, data: 'x' }))
    expect(old.get()).toEqual(['upgraded'])
    const nope = makeStore({ migrate: () => null })
    window.localStorage.setItem(nope.key, JSON.stringify('???'))
    expect(nope.get()).toEqual(['initial'])
    const throws = makeStore({
      migrate: () => {
        throw new Error('bad')
      },
    })
    window.localStorage.setItem(throws.key, JSON.stringify('???'))
    expect(throws.get()).toEqual(['initial'])
  })

  it('never throws when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(makeStore().get()).toEqual(['initial'])
  })
})

describe('createStore — writing', () => {
  it('notifies subscribers at once and batches writes', () => {
    const store = makeStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    store.set(['a'])
    store.update((prev) => [...prev, 'b'])
    expect(listener).toHaveBeenCalledTimes(2)
    expect(store.get()).toEqual(['a', 'b'])
    expect(setItem).not.toHaveBeenCalled()
    vi.advanceTimersByTime(WRITE_DELAY_MS)
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(saved(store.key)).toEqual({ v: 2, data: ['a', 'b'] })
    unsubscribe()
    store.set(['c'])
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('writes at most WRITE_DELAY_MS after the first change, even while changes keep coming', () => {
    const store = makeStore()
    store.set(['1'])
    vi.advanceTimersByTime(WRITE_DELAY_MS - 50)
    store.set(['2'])
    vi.advanceTimersByTime(50)
    expect(saved(store.key)).toEqual({ v: 2, data: ['2'] })
  })

  it('ignores setting the same value', () => {
    const store = makeStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.set(store.get())
    expect(listener).not.toHaveBeenCalled()
  })

  it('flushes pending writes when the page is hidden or closed', () => {
    const store = makeStore()
    store.set(['hidden'])
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(saved(store.key)).toEqual({ v: 2, data: ['hidden'] })
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    store.set(['closed'])
    window.dispatchEvent(new Event('pagehide'))
    expect(saved(store.key)).toEqual({ v: 2, data: ['closed'] })
    store.set(['manual'])
    flushAllStores()
    expect(saved(store.key)).toEqual({ v: 2, data: ['manual'] })
  })

  it('reports failed saves and recovers', () => {
    const { result } = renderHook(() => useStorageWritable())
    expect(result.current).toBe(true)
    const store = makeStore()
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    act(() => {
      store.set(['too big'])
      vi.advanceTimersByTime(WRITE_DELAY_MS)
    })
    expect(result.current).toBe(false)
    expect(store.get()).toEqual(['too big'])
    setItem.mockRestore()
    act(() => {
      store.set(['fits'])
      vi.advanceTimersByTime(WRITE_DELAY_MS)
    })
    expect(result.current).toBe(true)
  })

  it('reload() drops memory and pending writes and re-reads storage', () => {
    const store = makeStore()
    store.set(['unsaved'])
    window.localStorage.setItem(store.key, JSON.stringify({ v: 2, data: ['on disk'] }))
    const listener = vi.fn()
    store.subscribe(listener)
    store.reload()
    expect(listener).toHaveBeenCalled()
    expect(store.get()).toEqual(['on disk'])
    vi.advanceTimersByTime(WRITE_DELAY_MS)
    expect(saved(store.key)).toEqual({ v: 2, data: ['on disk'] })
  })
})

describe('createStore — other tabs', () => {
  function fromOtherTab(key: string | null, value: unknown, area: Storage = window.localStorage) {
    const newValue = value === null ? null : JSON.stringify(value)
    if (key !== null) {
      if (newValue === null) window.localStorage.removeItem(key)
      else window.localStorage.setItem(key, newValue)
    }
    window.dispatchEvent(new StorageEvent('storage', { key, newValue, storageArea: area }))
  }

  it('follows changes made in another tab', () => {
    const store = makeStore()
    const listener = vi.fn()
    store.subscribe(listener)
    fromOtherTab(store.key, { v: 2, data: ['from tab 2'] })
    expect(store.get()).toEqual(['from tab 2'])
    expect(listener).toHaveBeenCalledTimes(1)
    fromOtherTab(store.key, null)
    expect(store.get()).toEqual(['initial'])
  })

  it('ignores other keys and sessionStorage, and resets when storage is cleared', () => {
    const store = makeStore()
    store.subscribe(() => {})
    store.set(['mine'])
    vi.advanceTimersByTime(WRITE_DELAY_MS)
    fromOtherTab('some.other.key', { v: 2, data: ['x'] })
    window.dispatchEvent(new StorageEvent('storage', { key: store.key, newValue: '{"v":2,"data":["s"]}', storageArea: window.sessionStorage }))
    expect(store.get()).toEqual(['mine'])
    window.localStorage.clear()
    window.dispatchEvent(new StorageEvent('storage', { key: null, newValue: null, storageArea: window.localStorage }))
    expect(store.get()).toEqual(['initial'])
  })

  it('keeps its own unsaved change over a remote one (and then wins)', () => {
    const store = makeStore()
    store.subscribe(() => {})
    store.set(['local edit'])
    fromOtherTab(store.key, { v: 2, data: ['remote'] })
    expect(store.get()).toEqual(['local edit'])
    vi.advanceTimersByTime(WRITE_DELAY_MS)
    expect(saved(store.key)).toEqual({ v: 2, data: ['local edit'] })
  })

  it('treats an invalid remote value like no data', () => {
    const store = makeStore()
    store.subscribe(() => {})
    fromOtherTab(store.key, { v: 2, data: 'nope' })
    expect(store.get()).toEqual(['initial'])
  })
})

describe('useStore', () => {
  it('re-renders on changes to the selection only', () => {
    const store = makeStore()
    let renders = 0
    const first = (s: string[]) => s[0] ?? null
    function Probe() {
      renders += 1
      return <p>{useStore(store, first)}</p>
    }
    const { container } = render(<Probe />)
    expect(container.textContent).toBe('initial')
    act(() => store.set(['initial', 'more']))
    expect(renders).toBe(1)
    act(() => store.set(['changed']))
    expect(container.textContent).toBe('changed')
    expect(renders).toBe(2)
  })

  it('keeps an equal derived selection referentially stable, even across selector changes', () => {
    const store = makeStore()
    store.set(['a', 'b'])
    const { result, rerender } = renderHook(
      ({ suffix }: { suffix: string }) => useStore(store, (s) => s.filter((x) => x !== suffix), shallowArrayEqual),
      { initialProps: { suffix: 'z' } },
    )
    const first = result.current
    expect(first).toEqual(['a', 'b'])
    rerender({ suffix: 'y' })
    expect(result.current).toBe(first)
    act(() => store.set([...store.get()]))
    expect(result.current).toBe(first)
    act(() => store.set(['a', 'b', 'c']))
    expect(result.current).toEqual(['a', 'b', 'c'])
    expect(result.current).not.toBe(first)
  })
})

describe('equality helpers', () => {
  it('compare arrays and records shallowly', () => {
    const x = { id: 1 }
    expect(shallowArrayEqual([x], [x])).toBe(true)
    expect(shallowArrayEqual([x], [{ id: 1 }])).toBe(false)
    expect(shallowArrayEqual([x], [x, x])).toBe(false)
    expect(shallowRecordEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    expect(shallowRecordEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(shallowRecordEqual({ a: 1 }, { b: 1 })).toBe(false)
    expect(shallowRecordEqual({ a: 1 }, { a: 1, b: 1 })).toBe(false)
  })

  it('memoizeLast recomputes only for a new argument', () => {
    const fn = vi.fn((xs: number[]) => xs.map((x) => x * 2))
    const memo = memoizeLast(fn)
    const input = [1, 2]
    expect(memo(input)).toBe(memo(input))
    expect(fn).toHaveBeenCalledTimes(1)
    memo([1, 2])
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
