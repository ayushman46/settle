/**
 * Reads a WhatsApp chat as WhatsApp itself writes it out ("Export chat", or several messages
 * copied at once) into plain messages: who said what, on which day. Three layouts are known:
 *
 *   12/11/2026, 21:41 - Riya: paid 1200 for the cab          (Android export)
 *   [12/11/26, 9:41:22 PM] Riya: paid 1200 for the cab       (iPhone export)
 *   [9:41 pm, 12/11/2026] Riya: paid 1200 for the cab        (messages copied in the app)
 *
 * A line without that start belongs to the message above it. Lines with no "Name:" are WhatsApp's
 * own notes ("Riya added Sam"); they give the group's name and nothing else. Everything happens
 * on the phone: nothing here knows about the network.
 */

export interface ChatMessage {
  /** YYYY-MM-DD, as the phone that exported it saw the day. */
  date: string
  /** Minutes into that day. */
  minutes: number
  sender: string
  text: string
}

export interface ChatFile {
  messages: ChatMessage[]
  /** Everyone who wrote, in the order they first did. */
  senders: string[]
  /** The group's name, when the chat or the file's name says it. */
  name: string | null
}

/** The most text read from one chat (a year of a busy group is about 2 MB). */
export const MAX_CHAT_CHARS = 12_000_000
export const MAX_CHAT_MESSAGES = 60_000
const MAX_SENDER_LENGTH = 60
const MAX_MESSAGE_LENGTH = 4000

/** Marks WhatsApp adds around names and dates that nobody typed. */
const INVISIBLE = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g
const ODD_SPACES = /[\u00a0\u202f\u2007\u2009]/g

const DATE = String.raw`(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4})`
const TIME = String.raw`(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*([ap])?\.?\s?(?:m\b\.?)?`
const ANDROID = new RegExp(String.raw`^${DATE},?\s+${TIME}\s*[-–]\s(.*)$`, 'i')
const IPHONE = new RegExp(String.raw`^\[${DATE},?\s+${TIME}\]\s?(.*)$`, 'i')
const COPIED = new RegExp(String.raw`^\[${TIME},\s*${DATE}\]\s?(.*)$`, 'i')

interface RawLine {
  a: number
  b: number
  c: number
  hour: number
  minute: number
  half: string | undefined
  rest: string
}

function startOf(line: string): RawLine | null {
  const m = ANDROID.exec(line) ?? IPHONE.exec(line)
  if (m) return { a: Number(m[1]), b: Number(m[2]), c: Number(m[3]), hour: Number(m[4]), minute: Number(m[5]), half: m[6]?.toLowerCase(), rest: m[7] ?? '' }
  const copied = COPIED.exec(line)
  if (copied) return { a: Number(copied[4]), b: Number(copied[5]), c: Number(copied[6]), hour: Number(copied[1]), minute: Number(copied[2]), half: copied[3]?.toLowerCase(), rest: copied[7] ?? '' }
  return null
}

const pad = (n: number): string => String(n).padStart(2, '0')

function isoDate(year: number, month: number, day: number): string | null {
  const y = year < 100 ? 2000 + year : year
  if (y < 2009 || y > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const made = new Date(Date.UTC(y, month - 1, day))
  if (made.getUTCMonth() !== month - 1) return null
  return `${y}-${pad(month)}-${pad(day)}`
}

function minutesOf(raw: RawLine): number | null {
  let hour = raw.hour
  if (raw.minute > 59) return null
  if (raw.half) {
    if (hour < 1 || hour > 12) return null
    hour = (hour % 12) + (raw.half === 'p' ? 12 : 0)
  } else if (hour > 23) return null
  return hour * 60 + raw.minute
}

/** What WhatsApp writes in place of something that isn't text. */
const NOT_TEXT =
  /^(?:<[^<>]{0,40}omitted>|(?:image|video|audio|sticker|gif|document|contact card|poll) omitted|this message was deleted\.?|you deleted this message\.?|null|waiting for this message.*|missed (?:voice|video) call.*|<attached: [^>]*>)$/i
const EDITED = /\s*<this message was edited>\s*$/i

/** `WhatsApp Chat with Goa trip.txt` → "Goa trip". */
export function chatNameFromFile(fileName: string | null | undefined): string | null {
  if (!fileName) return null
  const bare = fileName.replace(/\.(?:txt|zip)$/i, '').replace(/[_\s]+/g, ' ').trim()
  const m = /^whatsapp chat (?:with|-)\s*(.+)$/i.exec(bare)
  const name = (m?.[1] ?? '').replace(/\s*\(\d+\)$/, '').trim()
  return name ? name.slice(0, 60) : null
}

const GROUP_NAMED = /(?:created (?:the )?group|changed the (?:subject|group name)(?: from ["“][^"”]*["”])? to)\s*["“]([^"”]{1,80})["”]/i

/**
 * The messages in a chat's text. `fileName` (optional) is where the group's name comes from when
 * the chat itself doesn't say it. Lines it can't place are dropped, never guessed at.
 */
export function parseChat(input: string, fileName?: string | null): ChatFile {
  const text = (input.length > MAX_CHAT_CHARS ? input.slice(input.length - MAX_CHAT_CHARS) : input).replace(/\r\n?/g, '\n').replace(INVISIBLE, '').replace(ODD_SPACES, ' ')
  const starts: Array<{ raw: RawLine; body: string[] }> = []
  for (const line of text.split('\n')) {
    const raw = startOf(line)
    if (raw) starts.push({ raw, body: [raw.rest] })
    else if (starts.length > 0 && line.trim() !== '') starts[starts.length - 1]?.body.push(line)
  }

  // Day first (India, and most of the world) unless the chat itself shows otherwise.
  const yearFirst = starts.some(({ raw }) => raw.a > 31)
  let monthFirst = false
  if (!yearFirst) {
    const dayAtA = starts.some(({ raw }) => raw.a > 12)
    const dayAtB = starts.some(({ raw }) => raw.b > 12)
    monthFirst = dayAtB && !dayAtA
  }

  const messages: ChatMessage[] = []
  const senders: string[] = []
  const seen = new Set<string>()
  let named: string | null = null
  const numbers = new Map<string, string>()
  for (const { raw, body } of starts.slice(-MAX_CHAT_MESSAGES)) {
    const date = yearFirst ? isoDate(raw.a, raw.b, raw.c) : monthFirst ? isoDate(raw.c, raw.a, raw.b) : isoDate(raw.c, raw.b, raw.a)
    const minutes = minutesOf(raw)
    if (!date || minutes === null) continue
    const first = body[0] ?? ''
    const colon = first.indexOf(': ')
    const endsWithColon = colon < 0 && first.endsWith(':')
    if (colon < 0 && !endsWithColon) {
      const group = GROUP_NAMED.exec(first)
      if (group?.[1]) named = group[1].trim()
      continue
    }
    let sender = first
      .slice(0, colon < 0 ? first.length - 1 : colon)
      .replace(/^~\s*/, '')
      .trim()
    if (!sender || sender.length > MAX_SENDER_LENGTH) continue
    // An unsaved number is one person however it is written ("+91 98765 43210", "+919876543210").
    if (/^\+?[\d\s()-]{7,}$/.test(sender)) {
      const digits = sender.replace(/\D/g, '').slice(-10)
      const known = numbers.get(digits)
      if (known) sender = known
      else numbers.set(digits, sender)
    }
    const said = [colon < 0 ? '' : first.slice(colon + 2), ...body.slice(1)].join('\n').replace(EDITED, '').trim()
    if (!seen.has(sender)) {
      seen.add(sender)
      senders.push(sender)
    }
    if (said === '' || NOT_TEXT.test(said)) continue
    messages.push({ date, minutes, sender, text: said.slice(0, MAX_MESSAGE_LENGTH) })
  }
  return { messages, senders, name: named ?? chatNameFromFile(fileName) }
}

/** Does this text look like a WhatsApp chat at all (at least two dated lines from someone)? */
export function looksLikeChat(input: string): boolean {
  let found = 0
  for (const line of input.slice(0, 20_000).replace(INVISIBLE, '').replace(ODD_SPACES, ' ').split(/\r?\n/)) {
    const raw = startOf(line)
    if (raw && /^[^:]{1,60}: /.test(raw.rest) && ++found >= 2) return true
  }
  return false
}
