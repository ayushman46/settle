/** Renders the share card to a PNG: fonts first, then layout → paint on a canvas. */
import { BRAND, ME_ID, type Expense, type Friend, type Profile } from '../../domain/types'
import { outsideName } from '../names'
import { CARD_SIZE, layoutShareCard, type ShareCardInput } from './layout'
import { canvasMeasure, paintScene, type Ctx2D } from './paint'
import { FONT_FAMILY } from './textFit'

export class ShareCardError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShareCardError'
  }
}

/** How long we wait for Geist before drawing with the fallback font. */
const FONT_TIMEOUT_MS = 2_000

const FONT_WEIGHTS = [400, 500, 600] as const

/** Makes sure Geist is ready (the card uses weights the page may not have needed yet). Never throws. */
async function loadFonts(): Promise<void> {
  const fonts = typeof document === 'undefined' ? undefined : (document as Document & { fonts?: FontFaceSet }).fonts
  if (!fonts || typeof fonts.load !== 'function') return
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, FONT_TIMEOUT_MS)
  })
  const loads = FONT_WEIGHTS.map((weight) => fonts.load(`${weight} 32px ${FONT_FAMILY}`).catch(() => []))
  await Promise.race([Promise.all(loads).then(() => undefined), timeout])
  clearTimeout(timer)
}

interface Surface {
  ctx: Ctx2D
  toBlob(): Promise<Blob | null>
  release(): void
}

function domSurface(): Surface | null {
  if (typeof document === 'undefined') return null
  try {
    const canvas = document.createElement('canvas')
    canvas.width = CARD_SIZE.width
    canvas.height = CARD_SIZE.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    return {
      ctx,
      toBlob: () =>
        new Promise((resolve) => {
          try {
            canvas.toBlob((blob) => resolve(blob), 'image/png')
          } catch {
            resolve(null)
          }
        }),
      release: () => {
        // Frees the bitmap promptly (matters on phones).
        canvas.width = 0
        canvas.height = 0
      },
    }
  } catch {
    return null
  }
}

function offscreenSurface(): Surface | null {
  if (typeof OffscreenCanvas !== 'function') return null
  try {
    const canvas = new OffscreenCanvas(CARD_SIZE.width, CARD_SIZE.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    return {
      ctx,
      toBlob: () => canvas.convertToBlob({ type: 'image/png' }).catch(() => null),
      release: () => undefined,
    }
  } catch {
    return null
  }
}

/** The site's host for the footer ("settle.app"), or the tagline on local/dev hosts. */
export function defaultSiteLabel(where?: Pick<Location, 'hostname' | 'host'>): string {
  try {
    const { hostname, host } = where ?? window.location
    const local =
      !hostname ||
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.includes(':') ||
      hostname.startsWith('[') ||
      /^\d+(\.\d+){3}$/.test(hostname)
    return local ? BRAND.tagline : host.replace(/^www\./, '')
  } catch {
    return BRAND.tagline
  }
}

/**
 * A 1080×1350 PNG receipt of the split for the group chat. `watermark` adds the "Made with
 * Settle" footer (free plan). Rejects with `ShareCardError` if the browser can't draw it.
 */
export async function renderShareCard(
  input: ShareCardInput,
  opts: { watermark: boolean; theme: 'light' | 'dark' },
): Promise<Blob> {
  await loadFonts()
  const surface = domSurface() ?? offscreenSurface()
  if (!surface) throw new ShareCardError("This browser can't draw images")
  try {
    const scene = layoutShareCard(input, { ...opts, siteLabel: defaultSiteLabel() }, canvasMeasure(surface.ctx))
    paintScene(surface.ctx, scene)
    const blob = await surface.toBlob()
    if (!blob || blob.size === 0) throw new ShareCardError("Couldn't create the image")
    return blob
  } catch (error) {
    if (error instanceof ShareCardError) throw error
    throw new ShareCardError("Couldn't create the image")
  } finally {
    surface.release()
  }
}

/** The card's data for an expense: names as friends know them, payer first on the card. */
export function shareCardInputFromExpense(
  e: Expense,
  friendsById: Readonly<Record<string, Friend>>,
  profile: Profile,
): ShareCardInput {
  const ids: string[] = []
  for (const p of e.participants) if (!ids.includes(p.friendId)) ids.push(p.friendId)
  return {
    title: e.title,
    category: e.category,
    currency: e.currency,
    date: e.date,
    total: e.total,
    payerName: outsideName(e.payerId, friendsById, profile, 'Me'),
    people: ids.map((id) => ({
      name: outsideName(id, friendsById, profile, id === ME_ID ? 'Me' : 'Friend'),
      color: friendsById[id]?.color ?? 0,
      amount: e.shares[id] ?? 0,
      paid: id === e.payerId || e.paidBack[id] !== undefined,
      isPayer: id === e.payerId,
    })),
  }
}

/** "settle-dinner-at-toit.png" — ASCII, safe on every OS. */
export function shareCardFilename(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '')
  return `${BRAND.name.toLowerCase()}-${slug || 'split'}.png`
}
