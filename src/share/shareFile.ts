/** Getting a file (the share card) out of the app: the native share sheet on phones, a download elsewhere. */

export type ShareFileOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed'

export interface ShareFileOptions {
  /**
   * `auto` (default): the share sheet on touch devices, a download on desktop.
   * `share`: the share sheet wherever it can take files. `download`: always download.
   */
  prefer?: 'auto' | 'share' | 'download'
  /** Title for the share sheet. */
  title?: string
}

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/json': 'json',
  'text/csv': 'csv',
  'text/plain': 'txt',
}

/** Keep the object URL alive long enough for slow browsers (Safari) to start the download. */
const REVOKE_AFTER_MS = 60_000

/** A filename that's safe everywhere, with the extension the file's type expects. */
export function safeFilename(filename: string, type: string): string {
  const ext = EXTENSIONS[type.split(';')[0]?.trim().toLowerCase() ?? '']
  const cleaned = filename
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}<>:"/\\|?*]+/gu, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.-]+|[\s.]+$/g, '')
  const name = cleaned || 'settle'
  const dot = name.lastIndexOf('.')
  const current = dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
  const hasExt = /^[a-z0-9]{1,4}$/.test(current)
  const stem = hasExt ? name.slice(0, dot) : name
  const matches = current === ext || (ext === 'jpg' && current === 'jpeg')
  const keep = ext ? (matches ? current : ext) : hasExt ? current : ''
  return keep ? `${clip(stem, 76)}.${keep}` : clip(stem, 80)
}

function clip(name: string, max: number): string {
  return Array.from(name).slice(0, max).join('').trimEnd()
}

function isTouchFirst(): boolean {
  try {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches
  } catch {
    return false
  }
}

function errorName(error: unknown): string | null {
  return typeof error === 'object' && error !== null && typeof (error as { name?: unknown }).name === 'string'
    ? (error as { name: string }).name
    : null
}

function toFile(blob: Blob, name: string): File | null {
  try {
    return typeof File === 'function' ? new File([blob], name, { type: blob.type, lastModified: Date.now() }) : null
  } catch {
    return null
  }
}

function canShareData(data: ShareData): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false
  try {
    return typeof navigator.canShare !== 'function' || navigator.canShare(data)
  } catch {
    return false
  }
}

function download(blob: Blob, name: string): boolean {
  try {
    if (typeof URL.createObjectURL !== 'function') return false
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.rel = 'noopener'
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS)
    return true
  } catch {
    return false
  }
}

/**
 * Shares `blob` as a file (with optional message text) through the system share sheet, or
 * downloads it. Falls back to a download when sharing isn't possible or isn't allowed (e.g. the
 * tap that started it was too long ago). Resolves to what happened; never throws.
 */
export async function shareFile(
  blob: Blob,
  filename: string,
  text?: string,
  opts: ShareFileOptions = {},
): Promise<ShareFileOutcome> {
  const name = safeFilename(filename, blob.type)
  const prefer = opts.prefer ?? 'auto'
  const wantsShare = prefer === 'share' || (prefer === 'auto' && isTouchFirst())
  const file = wantsShare ? toFile(blob, name) : null

  if (file) {
    const extras: Pick<ShareData, 'text' | 'title'> = {}
    if (text) extras.text = text
    if (opts.title) extras.title = opts.title
    // Some targets accept files but not files + text: try with, then without.
    const attempts: ShareData[] = [{ files: [file], ...extras }, { files: [file] }]
    const data = attempts.find(canShareData)
    if (data) {
      try {
        await navigator.share(data)
        return 'shared'
      } catch (error) {
        if (errorName(error) === 'AbortError') return 'cancelled'
        // NotAllowedError (no user activation), DataError… — download instead.
      }
    }
  }
  return download(blob, name) ? 'downloaded' : 'failed'
}
