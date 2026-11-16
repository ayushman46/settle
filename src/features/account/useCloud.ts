import { useCallback, useEffect, useState } from 'react'
import { cloud } from './api'

/** How often an open screen asks again, so a friend's payment or confirmation shows up by itself. */
const POLL_MS = 10_000

export interface CloudData<T> {
  data: T | null
  error: { code: string; message: string } | null
  loading: boolean
  /** Ask again now (after a change this screen made). */
  reload: () => void
}

interface Loaded<T> {
  path: string | null
  data: T | null
  error: { code: string; message: string } | null
}

/** GETs `path`, again every few seconds while the page is visible and whenever it comes back into view. */
export function useCloudGet<T>(path: string | null): CloudData<T> {
  const [loaded, setLoaded] = useState<Loaded<T>>({ path: null, data: null, error: null })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (path === null) return
    let live = true
    const load = async () => {
      const res = await cloud<T>('GET', path)
      if (!live) return
      setLoaded((prev) => {
        const kept = prev.path === path ? prev.data : null
        return res.ok ? { path, data: res.data, error: null } : { path, data: kept, error: { code: res.code, message: res.message } }
      })
    }
    void load()
    const tick = () => {
      if (document.visibilityState === 'visible') void load()
    }
    const timer = window.setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      live = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [path, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const current = loaded.path === path
  return { data: current ? loaded.data : null, error: current ? loaded.error : null, loading: path !== null && !current, reload }
}
