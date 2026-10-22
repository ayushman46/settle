import { Component, Suspense, type ReactNode } from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { isChunkLoadError, lazyScreen, retryFailedScreens } from './lazyScreen'

function Hello() {
  return <h1>Hello screen</h1>
}

/** A module load the test settles by hand. */
function deferredModule() {
  let resolve: (module: { Hello: typeof Hello }) => void = () => undefined
  let reject: (error: unknown) => void = () => undefined
  const load = vi.fn(
    () =>
      new Promise<{ Hello: typeof Hello }>((res, rej) => {
        resolve = res
        reject = rej
      }),
  )
  return { load, resolve: (m = { Hello }) => resolve(m), reject: (e: unknown) => reject(e) }
}

class Boundary extends Component<{ children: ReactNode }, { error: unknown }> {
  override state = { error: null as unknown }
  static getDerivedStateFromError(error: unknown) {
    return { error }
  }
  override render(): ReactNode {
    if (this.state.error === null) return this.props.children
    return (
      <button
        type="button"
        onClick={() => {
          retryFailedScreens()
          this.setState({ error: null })
        }}
      >
        Try again
      </button>
    )
  }
}

function show(Screen: () => ReactNode) {
  return render(
    <Boundary>
      <Suspense fallback={<p>Loading…</p>}>
        <Screen />
      </Suspense>
    </Boundary>,
  )
}

describe('lazyScreen', () => {
  it('loads the code on first render, showing the fallback meanwhile', async () => {
    const mod = deferredModule()
    const Screen = lazyScreen('Hello', mod.load, (m) => m.Hello)
    expect(mod.load).not.toHaveBeenCalled()
    expect(Screen.loaded).toBe(false)
    expect(Screen.displayName).toBe('Lazy(Hello)')

    show(Screen)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    await act(async () => mod.resolve())
    expect(screen.getByRole('heading', { name: 'Hello screen' })).toBeInTheDocument()
    expect(Screen.loaded).toBe(true)
    expect(mod.load).toHaveBeenCalledTimes(1)
  })

  it('renders a preloaded screen straight away, without the fallback', async () => {
    const mod = deferredModule()
    const Screen = lazyScreen('Hello', mod.load, (m) => m.Hello)
    const preloaded = Screen.preload()
    mod.resolve()
    await preloaded

    show(Screen)
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hello screen' })).toBeInTheDocument()
  })

  it('loads the code once however often it is asked for', async () => {
    const mod = deferredModule()
    const Screen = lazyScreen('Hello', mod.load, (m) => m.Hello)
    const first = Screen.preload()
    const second = Screen.preload()
    mod.resolve()
    await Promise.all([first, second])
    show(Screen)
    expect(mod.load).toHaveBeenCalledTimes(1)
  })

  it('throws a failed load to the error boundary, then loads afresh on retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const mod = deferredModule()
    const Screen = lazyScreen('Hello', mod.load, (m) => m.Hello)
    show(Screen)
    await act(async () => mod.reject(new TypeError('Failed to fetch dynamically imported module')))
    const retry = screen.getByRole('button', { name: 'Try again' })
    expect(Screen.loaded).toBe(false)

    act(() => retry.click())
    expect(mod.load).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    await act(async () => mod.resolve())
    expect(screen.getByRole('heading', { name: 'Hello screen' })).toBeInTheDocument()
    vi.restoreAllMocks()
  })

  it('reports a failed preload, and a later preload tries again', async () => {
    const mod = deferredModule()
    const Screen = lazyScreen('Hello', mod.load, (m) => m.Hello)
    const failed = Screen.preload()
    mod.reject(new TypeError('offline'))
    await expect(failed).rejects.toThrow('offline')
    const again = Screen.preload()
    mod.resolve()
    await again
    expect(Screen.loaded).toBe(true)
    expect(mod.load).toHaveBeenCalledTimes(2)
  })
})

describe('isChunkLoadError', () => {
  it('knows each browser’s way of saying a chunk could not load', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/a.js'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: https://x/a.js'))).toBe(true)
    expect(isChunkLoadError(new Error('Failed to load module script: Expected a JavaScript module'))).toBe(true)
    const named = new Error('nope')
    named.name = 'ChunkLoadError'
    expect(isChunkLoadError(named)).toBe(true)
  })

  it('leaves every other error alone', () => {
    expect(isChunkLoadError(new Error('Boom'))).toBe(false)
    expect(isChunkLoadError(new TypeError('Failed to fetch'))).toBe(false)
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false)
    expect(isChunkLoadError(null)).toBe(false)
  })
})
