/**
 * The code and styles this page loaded before the service worker took over, fetched once more
 * through it so they're kept for offline (the browser's HTTP cache answers, so it costs nothing).
 * Re-importing a module that already ran never asks the network again, so without this a screen
 * opened on the first visit (the split screen, say) would be missing offline.
 */
export function keepLoadedAssets(): void {
  try {
    const paths = new Set<string>()
    for (const entry of performance.getEntriesByType('resource')) {
      const url = new URL(entry.name, window.location.href)
      if (url.origin === window.location.origin && url.pathname.startsWith('/assets/')) paths.add(url.pathname)
    }
    for (const path of paths) void fetch(path, { cache: 'force-cache' }).catch(() => undefined)
  } catch {
    // No resource timing: the screens are kept as they're next loaded.
  }
}

/**
 * On a page the worker didn't control when it opened (a first visit, or the first after an
 * update), keeps everything it loaded as soon as the worker takes over. Set up once per page, from
 * main.tsx: tied to a screen, it could miss the moment the worker takes over.
 */
const KEEP_AGAIN_MS = [3_000, 15_000]

export function keepAssetsOnTakeover(): void {
  const sw = navigator.serviceWorker
  if (sw.controller) return
  sw.addEventListener(
    'controllerchange',
    () => {
      keepLoadedAssets()
      // Code still downloading when the worker took over (Home's lists load theirs on arrival)
      // finished outside it: ask again once those are in. Files already kept answer from its cache.
      for (const delay of KEEP_AGAIN_MS) setTimeout(keepLoadedAssets, delay)
    },
    { once: true },
  )
}
