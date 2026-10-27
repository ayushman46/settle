/**
 * A pay QR as a picture to keep: the code with a wide white quiet zone, and under it who it pays
 * and how much — so it scans from a phone's gallery ("Scan → Upload" in any UPI app) and still
 * makes sense in the camera roll a week later.
 */
import { encode } from 'uqr'

export interface QrPictureLine {
  text: string
  /** Font size in px at the picture's scale (about 720 px wide). */
  size: number
  bold?: boolean
}

/** Light modules around the code, and white space around everything. */
const QUIET_ZONE = 4
const PADDING = 40
/** The code's width in px (rounded down to whole modules). */
const CODE_PX = 640
const LINE_HEIGHT = 1.35
const GAP = 16

export interface QrPictureLayout {
  width: number
  height: number
  /** px per module. */
  scale: number
  /** The dark modules, as [x, y] in modules (quiet zone included). */
  modules: Array<readonly [number, number]>
  /** Where each line's top sits. */
  lineTops: number[]
}

/** Where everything goes; null when `value` can't be a QR code. */
export function qrPictureLayout(value: string, lines: readonly QrPictureLine[]): QrPictureLayout | null {
  let data: boolean[][]
  try {
    data = encode(value, { ecc: 'M', border: 0 }).data
  } catch {
    return null
  }
  const dimension = data.length + QUIET_ZONE * 2
  const scale = Math.max(4, Math.floor(CODE_PX / dimension))
  const width = dimension * scale + PADDING * 2
  const modules: Array<readonly [number, number]> = []
  data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) modules.push([x + QUIET_ZONE, y + QUIET_ZONE])
    }),
  )
  const lineTops: number[] = []
  let top = PADDING + dimension * scale + GAP
  for (const line of lines) {
    lineTops.push(top)
    top += Math.round(line.size * LINE_HEIGHT)
  }
  return { width, height: top + PADDING, scale, modules, lineTops }
}

/** The picture as a PNG; null where the browser can't draw one (or `value` can't be a QR code). */
export async function qrPicture(value: string, lines: readonly QrPictureLine[]): Promise<Blob | null> {
  const layout = qrPictureLayout(value, lines)
  if (!layout || typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = layout.width
  canvas.height = layout.height
  let ctx: CanvasRenderingContext2D | null = null
  try {
    ctx = canvas.getContext('2d')
  } catch {
    return null
  }
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, layout.width, layout.height)
  ctx.fillStyle = '#000000'
  for (const [x, y] of layout.modules) ctx.fillRect(PADDING + x * layout.scale, PADDING + y * layout.scale, layout.scale, layout.scale)
  ctx.fillStyle = '#111111'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  lines.forEach((line, i) => {
    ctx.font = `${line.bold ? 700 : 400} ${line.size}px system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif`
    ctx.fillText(line.text, layout.width / 2, layout.lineTops[i] ?? 0, layout.width - PADDING * 2)
  })
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    } catch {
      resolve(null)
    }
  })
}
