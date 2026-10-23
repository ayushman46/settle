/**
 * Reminder messages ("nudges") for people who still owe — in three tones, a few wordings each.
 * The wording is picked deterministically from the inputs, so the same nudge previews and sends
 * identically; pass `variant` to offer "try another".
 */
import type { Minor } from '../domain/types'
import { t } from '../i18n'
import { formatMoney } from '../lib/money'
import { nameKey } from '../lib/people'
import { isValidUpiId, normalizeUpiId } from '../lib/upi'
import { cleanText, ellipsize, firstName, hashString } from './text'

export type NudgeTone = 'friendly' | 'funny' | 'firm'

export const NUDGE_TONES: ReadonlyArray<{ tone: NudgeTone; label: string; emoji: string }> = [
  { tone: 'friendly', label: 'Friendly', emoji: '🙂' },
  { tone: 'funny', label: 'Funny', emoji: '😜' },
  { tone: 'firm', label: 'Firm', emoji: '📌' },
]

export interface NudgeInput {
  tone: NudgeTone
  /** Who owes. Only their first name is used ("Neha Sharma" → "Neha"). */
  toName: string
  amount: Minor
  currency: string
  /** What it was for ("Dinner at Toit"). */
  title: string
  /** Who gets the money. The owner's own placeholder names ("You", "Me", "") read as first person. */
  payeeName: string
  /** Shown for INR only (UPI can't take other currencies). */
  payeeUpi: string | null
  /** A pay link; never shortened, always last. */
  link: string | null
  /** Pick a specific wording (any integer, wraps); by default it's derived from the inputs. */
  variant?: number
  /** 'loan': money you lent them (udhaar) — its own wordings ("the ₹500 I lent you"). */
  kind?: 'loan'
  /** When it was lent, already formatted ("21 Oct"); loan wordings that mention it need it. */
  date?: string | null
}

/** Longest a nudge may be, not counting the link (which can't be cut). */
export const NUDGE_MAX_LENGTH = 280

interface Words {
  to: string
  amount: string
  what: string
}

type Template = (w: Words) => string

interface LoanWords {
  to: string
  amount: string
  date: string
}

/** Udhaar reminders (spec 07 §2.5). Wordings that mention the date are used only when it's known. */
const LOAN_TEMPLATES: Readonly<Record<NudgeTone, ReadonlyArray<{ dated: boolean; text: (w: LoanWords) => string }>>> = {
  friendly: [
    { dated: false, text: (w) => t('lend.nudge.friendly.0', { to: w.to, amount: w.amount }) },
    { dated: true, text: (w) => t('lend.nudge.friendly.1', { to: w.to, amount: w.amount, date: w.date }) },
  ],
  funny: [
    { dated: false, text: (w) => t('lend.nudge.funny.0', { to: w.to, amount: w.amount }) },
    { dated: false, text: (w) => t('lend.nudge.funny.1', { to: w.to, amount: w.amount }) },
  ],
  firm: [{ dated: true, text: (w) => t('lend.nudge.firm.0', { to: w.to, amount: w.amount, date: w.date }) }],
}

function loanTemplates(tone: NudgeTone, date: string): Template[] {
  const usable = LOAN_TEMPLATES[tone].filter((x) => !x.dated || date !== '')
  const list: Template[] = usable.map((x) => (w: Words) => x.text({ to: w.to, amount: w.amount, date }))
  // Only the firm tone has nothing undated: it says the same without the day.
  return list.length > 0 ? list : [(w: Words) => t('lend.nudge.firm.undated', { to: w.to, amount: w.amount })]
}

function cleanDate(date: string | null | undefined): string {
  return typeof date === 'string' ? cleanText(date, 24) : ''
}

function templatesFor(tone: NudgeTone, kind: NudgeInput['kind'], date: string): readonly Template[] {
  return kind === 'loan' ? loanTemplates(tone, date) : TEMPLATES[tone]
}

const TEMPLATES: Readonly<Record<NudgeTone, readonly Template[]>> = {
  friendly: [
    (w) => `Hey ${w.to}! 👋 Just a gentle reminder: your share for ${w.what} is ${w.amount}. No rush!`,
    (w) => `Hi ${w.to} 🙂 Your share for ${w.what} comes to ${w.amount}. Settle whenever you get a sec!`,
    (w) => `Hey ${w.to}, hope you're doing well! Quick one: ${w.amount} for ${w.what}. Thanks a ton 🙏`,
    (w) => `${w.to}! A small nudge for ${w.what}: your bit is ${w.amount}. Thank you 😊`,
  ],
  funny: [
    (w) => `Knock knock, ${w.to} 🚪 Who's there? ${w.amount}. ${w.amount} who? ${w.amount} for ${w.what} 😄`,
    (w) => `Breaking news 📰 ${w.amount} for ${w.what} was last seen heading your way, ${w.to}. Help it find its way home 🏠`,
    (w) => `${w.to}, my wallet keeps asking about you 👀 ${w.amount} for ${w.what}, whenever you're ready!`,
    (w) => `Plot twist, ${w.to}: ${w.what} wasn't free 🍿 Your share is ${w.amount} 😅`,
  ],
  firm: [
    (w) => `Hi ${w.to}, a reminder that ${w.amount} for ${w.what} is still pending. Please settle it today.`,
    (w) => `Hi ${w.to}, your share of ${w.amount} for ${w.what} is due. Please pay at the earliest.`,
    (w) => `${w.to}, following up on ${w.amount} for ${w.what}. Could you clear it today, please?`,
  ],
}

const LINK_LABEL: Readonly<Record<NudgeTone, string>> = {
  friendly: 'Tap to pay',
  funny: "One tap and we're square",
  firm: 'Pay here',
}

const FIRST_PERSON = new Set(['', 'you', 'me', 'myself', 'i'])

/** How many wordings a tone has (a loan's depend on whether its date is known). */
export function nudgeVariantCount(tone: NudgeTone, kind?: NudgeInput['kind'], date?: string | null): number {
  return templatesFor(Object.hasOwn(TEMPLATES, tone) ? tone : 'friendly', kind, cleanDate(date)).length
}

function upiLine(input: NudgeInput): string | null {
  if (input.currency !== 'INR' || !input.payeeUpi || !isValidUpiId(input.payeeUpi)) return null
  const upi = normalizeUpiId(input.payeeUpi)
  const payee = firstName(cleanText(input.payeeName, 24))
  return FIRST_PERSON.has(nameKey(payee)) ? `My UPI: ${upi}` : `Pay ${payee} on UPI: ${upi}`
}

/**
 * A ready-to-send reminder: one warm line in the chosen tone, then the UPI ID (INR only) and the
 * pay link when there are any. At most `NUDGE_MAX_LENGTH` characters plus the link.
 */
export function nudgeText(input: NudgeInput): string {
  const tone: NudgeTone = Object.hasOwn(TEMPLATES, input.tone) ? input.tone : 'friendly'
  const kind = input.kind === 'loan' ? 'loan' : undefined
  const templates = templatesFor(tone, kind, cleanDate(input.date))
  const seed = hashString(`${tone}|${nameKey(input.toName)}|${input.amount}|${input.currency}|${nameKey(input.title)}${kind ? '|loan' : ''}`)
  const pick = input.variant !== undefined && Number.isInteger(input.variant) ? input.variant : seed
  const template = templates[((pick % templates.length) + templates.length) % templates.length] ?? templates[0]
  if (!template) return ''

  const to = ellipsize(firstName(cleanText(input.toName, 24)), 16, 24) || 'there'
  const amount = formatMoney(input.amount, input.currency, { trimZeros: true })
  const title = cleanText(input.title, 120)
  const link = input.link?.trim() || null
  const linkLine = link ? `\n${LINK_LABEL[tone]}: ` : ''
  const budget = NUDGE_MAX_LENGTH - linkLine.length

  // Shorten the title until it fits; an absurdly long UPI ID is dropped rather than the message.
  const upi = upiLine(input)
  let body = ''
  for (const line of upi ? [upi, null] : [null]) {
    for (const titleLength of [40, 24, 12]) {
      const what = title ? ellipsize(title, titleLength, titleLength * 2) : 'our split'
      const lead = template({ to, amount, what })
      body = line ? `${lead}\n${line}` : lead
      if (body.length <= budget) return link ? `${body}${linkLine}${link}` : body
    }
  }
  return link ? `${body}${linkLine}${link}` : body
}
