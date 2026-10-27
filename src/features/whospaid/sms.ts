/**
 * Bank SMS pasted in bulk ("select all, copy" in the messages app): split into alerts and read each
 * on the phone with the existing SMS reader. Only money received from a person is kept — not
 * refunds, not spending.
 */
import { parseSms } from '../sharein/sms/parseSms'
import type { Credit } from './match'

/** The most text read from one paste (a long inbox). */
export const MAX_PASTE_CHARS = 50_000

/** Starts of a new bank alert, for pastes without blank lines between messages. */
const NEW_ALERT = /^(?:dear (?:customer|user|sir)|(?:rs\.?|inr|₹)\s?[\d,]+|a\/c|acct|your (?:a\/c|account|upi)|money received|received|credited|[a-z]{2}-[a-z0-9]{6}\b)/i

/** One alert per piece: blank lines first; one long block is split where a new alert starts. */
export function splitMessages(text: string): string[] {
  const clean = text.slice(0, MAX_PASTE_CHARS).replace(/\r\n?/g, '\n')
  const blocks = clean.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  const out: string[] = []
  for (const block of blocks) {
    const lines = block.split('\n')
    if (lines.length === 1 || block.length < 400) {
      out.push(block)
      continue
    }
    let current: string[] = []
    for (const line of lines) {
      if (current.length > 0 && NEW_ALERT.test(line.trim())) {
        out.push(current.join(' '))
        current = []
      }
      current.push(line.trim())
    }
    if (current.length > 0) out.push(current.join(' '))
  }
  return out
}

let counter = 0

/** Money received, from a paste of bank SMS. `today` is YYYY-MM-DD. */
export function creditsFromSms(text: string, today: string): { credits: Credit[]; read: number } {
  const credits: Credit[] = []
  const messages = splitMessages(text)
  for (const message of messages) {
    const parsed = parseSms(message, { today })
    if (parsed.kind !== 'txn' || parsed.dir !== 'credit' || parsed.refund) continue
    credits.push({
      id: `sms${++counter}`,
      source: 'sms',
      amount: parsed.amount,
      date: parsed.date,
      name: parsed.name,
      vpa: parsed.vpa,
      utr: parsed.ref && /^\d{12}$/.test(parsed.ref) ? parsed.ref : null,
      status: 'success',
      sure: true,
    })
  }
  return { credits, read: messages.length }
}
