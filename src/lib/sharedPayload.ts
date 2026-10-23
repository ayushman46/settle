/**
 * What another app shared into Settle (Android share sheet → the manifest's share_target). The
 * service worker (public/sw.js) keeps it in Cache Storage and opens `/app/share?k=<id>`; this reads
 * it back once and deletes it.
 */

/** Must match public/sw.js. */
export const SHARE_CACHE = 'settle-share'
const SHARE_PATH = '/share-target'
const SHARE_ID = /^[A-Za-z0-9_-]{12}$/
const MAX_FILES = 4

export interface SharedPayload {
  title: string
  text: string
  url: string
  files: File[]
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Reads and deletes the share stored by the service worker; null when it's gone or unreadable. */
export async function readSharedPayload(id: string): Promise<SharedPayload | null> {
  if (typeof id !== 'string' || !SHARE_ID.test(id) || typeof caches === 'undefined') return null
  try {
    const cache = await caches.open(SHARE_CACHE)
    const metaKey = `${SHARE_PATH}/${id}/meta`
    const metaResponse = await cache.match(metaKey)
    if (!metaResponse) return null
    const meta = (await metaResponse.json()) as Record<string, unknown>
    const count = typeof meta.files === 'number' && Number.isInteger(meta.files) ? Math.min(Math.max(meta.files, 0), MAX_FILES) : 0
    const files: File[] = []
    for (let n = 0; n < count; n++) {
      const key = `${SHARE_PATH}/${id}/file-${n}`
      const response = await cache.match(key)
      if (!response) continue
      let name = 'shared'
      try {
        name = decodeURIComponent(response.headers.get('X-File-Name') ?? 'shared') || 'shared'
      } catch {
        // A mangled name: keep the default.
      }
      const bytes = await response.arrayBuffer()
      files.push(new File([bytes], name, { type: response.headers.get('Content-Type') ?? '' }))
      await cache.delete(key)
    }
    await cache.delete(metaKey)
    return { title: text(meta.title), text: text(meta.text), url: text(meta.url), files }
  } catch {
    return null
  }
}
