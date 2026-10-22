/**
 * Code-split screens on `React.lazy`, with two things it lacks:
 * - a screen whose code has already loaded (say, preloaded while the person was reading Home)
 *   renders straight away instead of suspending for a tick and flashing the fallback;
 * - a failed load (offline, or a deploy replaced the chunk) is thrown to the nearest error
 *   boundary, and after `retryFailedScreens()` (its "Try again", or opening the page anew) the
 *   code is fetched afresh instead of the old failure being rethrown.
 */
import { createElement, lazy, type ComponentType, type ReactNode } from 'react'

export interface LazyScreen {
  (): ReactNode
  /** Starts loading the code (once); resolves when the screen can render without waiting. */
  preload(): Promise<void>
  /** True once the code has loaded. */
  readonly loaded: boolean
  displayName: string
}

type LazyModule = { default: ComponentType }

/** Screens whose code failed to load, each with what gives it a fresh start. */
const failed = new Set<() => void>()

/** Lets every screen whose code failed to load try again the next time it renders. */
export function retryFailedScreens(): void {
  const resets = [...failed]
  failed.clear()
  for (const reset of resets) reset()
}

/**
 * A thenable that calls back synchronously. `React.lazy` checks its status right after calling
 * `then`, so an already-loaded screen counts as resolved on the spot (no suspense, no fallback).
 */
function settledNow(component: ComponentType): Promise<LazyModule> {
  const thenable: PromiseLike<LazyModule> = {
    then(onFulfilled) {
      onFulfilled?.({ default: component })
      return thenable as PromiseLike<never>
    },
  }
  return thenable as Promise<LazyModule>
}

/** A screen whose code is `load`ed on first use; `pick` takes the component from its module. */
export function lazyScreen<M>(name: string, load: () => Promise<M>, pick: (module: M) => ComponentType): LazyScreen {
  let component: ComponentType | null = null
  let pending: Promise<ComponentType> | null = null

  const start = (): Promise<ComponentType> => {
    pending ??= load().then(
      (module) => {
        component = pick(module)
        return component
      },
      (error: unknown) => {
        // Forget the failure so the next attempt fetches the code again (see retryFailedScreens).
        pending = null
        failed.add(reset)
        throw error
      },
    )
    return pending
  }

  // React.lazy remembers a failed load forever, so a retry swaps in a fresh one.
  const fresh = () => lazy(() => (component ? settledNow(component) : start().then((loaded) => ({ default: loaded }))))
  let current = fresh()
  const reset = (): void => {
    current = fresh()
  }

  function Lazy(): ReactNode {
    return createElement(current)
  }

  return Object.defineProperties(Lazy, {
    displayName: { value: `Lazy(${name})`, writable: true },
    loaded: { get: () => component !== null },
    preload: { value: () => start().then(() => undefined) },
  }) as LazyScreen
}

/** True for the errors browsers throw when a code-split chunk can't be fetched. */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.name === 'ChunkLoadError' ||
    /dynamically imported module|importing a module script failed|error loading dynamically imported module|failed to load module script/i.test(
      error.message,
    )
  )
}
