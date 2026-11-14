/**
 * Getting a chat's text out of whatever WhatsApp handed over: a `.txt` (Android), a `.zip` with
 * `_chat.txt` inside (iPhone, or Android "with media"), or a file shared straight into Settle.
 * Read on the phone; the file goes nowhere.
 */
import { unzip } from '../whospaid/xlsx'
import { MAX_CHAT_CHARS } from './parse'

export interface ChatSource {
  text: string
  /** The file's name ("WhatsApp Chat with Goa trip.txt"), where the group's name is. */
  name: string | null
}

/** The largest file opened (a chat with media zipped in can be big; only its text is read). */
export const MAX_CHAT_FILE_BYTES = 200 * 1024 * 1024

export const CHAT_PATH = '/app/chat'

export function chatPath(groupId?: string | null): string {
  return groupId ? `${CHAT_PATH}?group=${encodeURIComponent(groupId)}` : CHAT_PATH
}

const isZip = (bytes: Uint8Array): boolean => bytes[0] === 0x50 && bytes[1] === 0x4b

/** The chat in `file`, or null when it can't be read (too big, not text, a zip with no chat in it). */
export async function readChatFile(file: File): Promise<ChatSource | null> {
  if (file.size === 0 || file.size > MAX_CHAT_FILE_BYTES) return null
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!isZip(bytes)) return { text: new TextDecoder().decode(bytes).slice(-MAX_CHAT_CHARS), name: file.name || null }
    const texts = unzip(bytes, (name) => /\.txt$/i.test(name) && !name.startsWith('__MACOSX'))
    if (!texts || texts.size === 0) return null
    const [inner, data] = [...texts.entries()].sort((a, b) => Number(/_chat\.txt$/i.test(b[0])) - Number(/_chat\.txt$/i.test(a[0])) || b[1].length - a[1].length)[0] ?? []
    if (!data) return null
    // The zip's own name has the group's name on an iPhone; on Android the file inside does.
    const named = /whatsapp chat/i.test(file.name) ? file.name : (inner ?? file.name)
    return { text: new TextDecoder().decode(data).slice(-MAX_CHAT_CHARS), name: named || null }
  } catch {
    return null
  }
}

let shared: ChatSource | null = null

/** A chat another app shared into Settle, waiting for the chat screen to open. */
export function setSharedChat(source: ChatSource | null): void {
  shared = source
}

export function takeSharedChat(): ChatSource | null {
  const source = shared
  shared = null
  return source
}
