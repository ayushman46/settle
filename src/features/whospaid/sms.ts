/**
 * Bank SMS pasted in bulk ("select all, copy" in the messages app): split into alerts and read each
 * on the phone with the existing SMS reader. Only money received from a person is kept — not
 * refunds, not spending.
 */
import { cleanSms, parseSms } from '../sharein/sms/parseSms'
import { splitAlerts } from '../sharein/sms/splitAlerts'
import type { Credit } from './match'

/** The most text read from one paste (a long inbox). */
export const MAX_PASTE_CHARS = 50_000

/**
 * One alert per piece: on blank lines, and before a line that starts a new alert — however short
 * the paste ("…from ARJUN MEHTA\nRs.6000 received from ROHIT VERMA…" is two). No cap on how many.
 */
export function splitMessages(text: string): string[] {
  return splitAlerts(cleanSms(typeof text === 'string' ? text.slice(0, MAX_PASTE_CHARS) : '', MAX_PASTE_CHARS))
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
