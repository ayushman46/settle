/**
 * "Just say it": turns "Cab 840 with Riya and Sam, Sam pays double" into a split draft.
 *
 * The text model drafts; everything here decides what of the draft survives. A currency only
 * when the text names one, a payer only when the text says who paid, people only when the
 * text mentions them (spelled the way the user already knows them), percentages that add up,
 * whole-number shares, and "Me" whenever the speaker takes part.
 */
import { z } from 'zod'
import {
  DESCRIBE_BUDGET_MS,
  DESCRIBE_LIMITS,
  type AmountSplitMode,
  type CategoryId,
  type DescribedPerson,
  type DescribedSplit,
} from '../shared/api'
import { inferCategory, toCategory } from './category'
import type { ServerConfig } from './config'
import { buildDescribeBody, type DescribePromptInput } from './describePrompt'
import {
  daysBetween,
  detectCurrency,
  excludesSpeaker,
  fold,
  hasAmountCue,
  isIsoDate,
  isNobody,
  isSpeakerName,
  matchKnownName,
  mentionsPayer,
  payerFromText,
  resolveDate,
  speakerTakesPart,
  speaksInFirstPerson,
  textMentions,
} from './describeText'
import { completeJson, type CompletionOptions } from './nvidia'
import { cleanText, extractJson, isEchoedSchema, parseNumber, roundMoney } from './parse'

export type DescribeInput = DescribePromptInput

export const ME = 'Me'

/* ------------------------------------------------------------------ the request */

const RequestSchema = z.object({
  text: z.string(),
  currency: z.string().max(16).nullish(),
  people: z.array(z.string()).nullish(),
  today: z.string().max(32).nullish(),
})

export const REQUEST_MESSAGES = {
  malformed: 'Something went wrong sending that. Please try again.',
  empty: "Type what you spent — like 'Dinner 2400 with Riya and Sam'.",
  tooLong: `That's a bit long — keep it under ${DESCRIBE_LIMITS.maxTextChars} characters.`,
  tooManyPeople: `That's a lot of people — split with up to ${DESCRIBE_LIMITS.maxPeople} at a time.`,
} as const

export type RequestCheck = { ok: true; input: DescribeInput } | { ok: false; message: string }

/**
 * Validates a `POST /api/describe` body. Strict about shape and size; forgiving about hints —
 * an odd currency code, a bad date or an over-long known name is just not used.
 */
export function parseDescribeRequest(json: unknown, today: string): RequestCheck {
  const parsed = RequestSchema.safeParse(json)
  if (!parsed.success) return { ok: false, message: REQUEST_MESSAGES.malformed }
  const text = cleanText(parsed.data.text) ?? ''
  if (text === '') return { ok: false, message: REQUEST_MESSAGES.empty }
  if (Array.from(text).length > DESCRIBE_LIMITS.maxTextChars) return { ok: false, message: REQUEST_MESSAGES.tooLong }

  const rawPeople = parsed.data.people ?? []
  if (rawPeople.length > DESCRIBE_LIMITS.maxPeople) return { ok: false, message: REQUEST_MESSAGES.tooManyPeople }
  const people: string[] = []
  const seen = new Set<string>()
  for (const raw of rawPeople) {
    const name = cleanText(raw)
    if (name === null || Array.from(name).length > DESCRIBE_LIMITS.maxNameChars || isSpeakerName(name)) continue
    const key = fold(name)
    if (key === '' || seen.has(key)) continue
    seen.add(key)
    people.push(name)
  }

  const currency = /^[A-Za-z]{3}$/.test(parsed.data.currency?.trim() ?? '') ? (parsed.data.currency ?? '').trim().toUpperCase() : null
  const day = parsed.data.today?.trim() ?? ''
  return { ok: true, input: { text, currency, people, today: isIsoDate(day) ? day : today } }
}

/* ------------------------------------------------------------------ reading the model's answer */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '')

/** The first of `keys` (compared without case or punctuation) present in `record`. */
function pick(record: Record<string, unknown>, keys: readonly string[]): unknown {
  const byKey = new Map(Object.entries(record).map(([key, value]) => [normalizeKey(key), value]))
  for (const key of keys) if (byKey.has(key)) return byKey.get(key)
  return undefined
}

const FIELDS = {
  isExpense: ['isexpense', 'isasplit', 'issplit', 'expense', 'valid'],
  title: ['title', 'description', 'what', 'name', 'label'],
  category: ['category', 'type', 'kind'],
  amount: ['amount', 'total', 'totalamount', 'cost', 'price'],
  payer: ['payer', 'paidby', 'whopaid', 'paid'],
  mode: ['mode', 'splitmode', 'splittype', 'split', 'method'],
  people: ['people', 'participants', 'members', 'persons', 'friends', 'splitwith', 'shares'],
  headcount: ['headcount', 'count', 'peoplecount', 'numberofpeople', 'totalpeople'],
  date: ['date', 'day', 'when'],
} as const

const PERSON_VALUE_KEYS = ['value', 'amount', 'share', 'shares', 'weight', 'percent', 'percentage', 'pct', 'ratio']

/** The JSON object a describe answer lives in (not an echoed schema, not a stray item). */
export function looksLikeDescribe(value: Record<string, unknown>): boolean {
  if (isEchoedSchema(value)) return false
  const keys = Object.keys(value).map(normalizeKey)
  return keys.some((key) => ['isexpense', 'people', 'participants', 'mode', 'splitmode'].includes(key))
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (/^\s*(?:true|yes|y|1)\s*$/i.test(value)) return true
    if (/^\s*(?:false|no|n|0)\s*$/i.test(value)) return false
  }
  return null
}

function toMode(value: unknown): AmountSplitMode | null {
  if (typeof value !== 'string') return null
  const key = normalizeKey(value)
  if (/^(?:equal|equally|even|evenly|same|split|items?|itemi[sz]ed)$/.test(key)) return 'equal'
  if (/^(?:exact|exactamounts?|amounts?|fixed|custom|unequal)$/.test(key)) return 'exact'
  if (/^(?:percent|percents|percentage|percentages|pct)$/.test(key)) return 'percent'
  if (/^(?:shares?|weights?|weighted|ratio|ratios|parts?)$/.test(key)) return 'shares'
  return null
}

interface RawPerson {
  name: string
  value: number | null
}

/** People as the model wrote them: objects, plain names, or a { name: value } map. */
function rawPeople(value: unknown): RawPerson[] {
  const entries: Array<[unknown, unknown]> = Array.isArray(value)
    ? value.map((entry): [unknown, unknown] =>
        isRecord(entry) ? [pick(entry, ['name', 'person', 'who', 'friend']), pick(entry, PERSON_VALUE_KEYS)] : [entry, null],
      )
    : isRecord(value)
      ? Object.entries(value)
      : []
  const people: RawPerson[] = []
  for (const [name, raw] of entries.slice(0, DESCRIBE_LIMITS.maxPeople * 2)) {
    const text = cleanText(name)
    if (text === null) continue
    const parsed = parseNumber(raw)
    // "Riya and Sam" written as one person is two people.
    const parts = text.split(/\s*(?:,|&|\+|\band\b|\baur\b)\s*/i).filter((part) => part.trim() !== '')
    for (const part of parts) people.push({ name: part, value: parts.length === 1 ? parsed : null })
  }
  return people
}

const MAX_NAME_CHARS = DESCRIBE_LIMITS.maxNameChars
const MINOR_WORDS = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with', 'w'])

/** Capitalises words written all in lower case; leaves deliberate casing ("iPhone", "McD") alone. */
function capitalise(text: string, keepMinor: boolean): string {
  return text
    .split(' ')
    .map((word, index) => {
      if (word !== word.toLowerCase() || word === '') return word
      if (keepMinor && index > 0 && MINOR_WORDS.has(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

function truncate(text: string, max: number): string {
  const characters = Array.from(text)
  return characters.length > max ? characters.slice(0, max).join('').trimEnd() : text
}

/** "@riya's" → "Riya"; the speaker → "Me"; a known person → their known spelling; nobody → null. */
function canonicalName(raw: string, known: readonly string[]): string | null {
  const name = raw
    .replace(/^[\s@#•*\-–—:]+/, '')
    .replace(/['’]s$/i, '')
    .replace(/[\s.,;:!?)(\-–—]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (name === '') return null
  if (isSpeakerName(name)) return ME
  if (isNobody(name)) return null
  return matchKnownName(name, known) ?? truncate(capitalise(name, false), MAX_NAME_CHARS)
}

/* ------------------------------------------------------------------ splitting rules */

const greatestCommonDivisor = (a: number, b: number): number => (b === 0 ? a : greatestCommonDivisor(b, a % b))
const MAX_SHARE = 1000
const close = (a: number, b: number, tolerance = 0.005) => Math.abs(a - b) <= tolerance

/** Weights as small whole numbers: 1.5 : 1 → 3 : 2, 4 : 2 → 2 : 1; a missing or bad weight is 1. */
function wholeShares(values: Array<number | null>): number[] {
  const weights = values.map((value) => (value !== null && Number.isFinite(value) && value > 0 ? value : 1))
  const scale = [1, 2, 4, 10, 100].find((factor) => weights.every((weight) => close(weight * factor, Math.round(weight * factor), 1e-6))) ?? 100
  const scaled = weights.map((weight) => Math.max(1, Math.round(weight * scale)))
  const divisor = scaled.reduce((acc, weight) => greatestCommonDivisor(acc, weight))
  return scaled.map((weight) => Math.min(MAX_SHARE, weight / divisor))
}

interface Settled {
  mode: AmountSplitMode
  people: DescribedPerson[]
  amount: number | null
}

const equally = (people: readonly RawPerson[]): DescribedPerson[] => people.map(({ name }) => ({ name, value: null }))

/** Guesses the mode from the values when the model didn't name a usable one. */
function guessMode(values: Array<number | null>, amount: number | null): AmountSplitMode {
  const given = values.filter((value): value is number => value !== null)
  if (given.length === 0) return 'equal'
  const total = given.reduce((acc, value) => acc + value, 0)
  if (amount !== null && close(total, amount, 0.01)) return 'exact'
  if (close(total, 100, 0.01)) return 'percent'
  return given.every((value) => Number.isInteger(value) && value > 0 && value <= 10) ? 'shares' : 'equal'
}

/** Makes the values agree with the mode — or falls back to splitting equally. */
function settleValues(mode: AmountSplitMode, people: readonly RawPerson[], amount: number | null): Settled {
  const values = people.map((person) => person.value)
  switch (mode) {
    case 'equal':
      return { mode, people: equally(people), amount }

    case 'shares': {
      const weights = wholeShares(values)
      if (weights.every((weight) => weight === weights[0])) return { mode: 'equal', people: equally(people), amount }
      return { mode, people: people.map(({ name }, index) => ({ name, value: weights[index] ?? 1 })), amount }
    }

    case 'percent': {
      let percents = values.map((value) => (value !== null && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null))
      const given = percents.filter((value): value is number => value !== null)
      // 0.4 / 0.3 / 0.3 → 40 / 30 / 30
      if (given.length === percents.length && given.every((value) => value <= 1) && close(given.reduce((acc, v) => acc + v, 0), 1, 0.0005)) {
        percents = percents.map((value) => (value === null ? null : value * 100))
      }
      const missing = percents.filter((value) => value === null).length
      const sum = percents.reduce<number>((acc, value) => acc + (value ?? 0), 0)
      // "me 40% Aditya 30% Neha" — Neha has the remaining 30%.
      if (missing === 1 && sum > 0 && sum < 100) percents = percents.map((value) => value ?? 100 - sum)
      const rounded = percents.map((value) => (value === null ? null : roundMoney(value)))
      const total = rounded.reduce<number>((acc, value) => acc + (value ?? Number.NaN), 0)
      if (!close(total, 100, 0.0101)) return { mode: 'equal', people: equally(people), amount }
      if (rounded.every((value) => value === rounded[0])) return { mode: 'equal', people: equally(people), amount }
      return { mode, people: people.map(({ name }, index) => ({ name, value: rounded[index] ?? null })), amount }
    }

    case 'exact': {
      let amounts = values.map((value) => (value !== null && Number.isFinite(value) && value >= 0 ? roundMoney(value) : null))
      if (amounts.every((value) => value === null)) return { mode: 'equal', people: equally(people), amount }
      const missing = amounts.filter((value) => value === null).length
      const sum = roundMoney(amounts.reduce<number>((acc, value) => acc + (value ?? 0), 0))
      let total = amount
      // Everyone's amount but no total: the total is their sum.
      if (total === null && missing === 0) total = sum
      // "Dinner 2400: Riya 800, Sam 600, rest me" — the one without an amount has what's left.
      if (total !== null && missing === 1 && sum <= total) amounts = amounts.map((value) => value ?? roundMoney(total - sum))
      // Amounts that don't add up stay as they are: the editor shows the gap.
      return { mode, people: people.map(({ name }, index) => ({ name, value: amounts[index] ?? null })), amount: total }
    }
  }
}

/* ------------------------------------------------------------------ title, amount, date */

const CATEGORY_TITLES: Readonly<Record<CategoryId, string>> = {
  food: 'Food',
  groceries: 'Groceries',
  rent: 'Rent',
  utilities: 'Bills',
  travel: 'Trip',
  transport: 'Ride',
  shopping: 'Shopping',
  entertainment: 'Outing',
  subscription: 'Subscription',
  gift: 'Gift',
  health: 'Health',
  other: 'Expense',
}
const MAX_TITLE_CHARS = 60
const MAX_AMOUNT = 1_000_000_000

function tidyTitle(raw: unknown, amount: number | null): string | null {
  let title = cleanText(raw)
  if (title === null) return null
  title = title
    .replace(/\s+(?:with|w\/|w)\s+.*$/i, '') // "Dinner with Riya" → "Dinner"
    .replace(/[₹$€£]\s?\d[\d,.]*(?:\s?(?:k|l|lakh|lakhs))?/gi, ' ')
  // The amount isn't part of the name: "Cab 840" → "Cab", "Dinner 2.4k" → "Dinner" (but "Goa 2026" stays).
  title = title
    .split(' ')
    .filter((word) => {
      if (/^(?:rs\.?|inr)\d/i.test(word) || /^\d+(?:\.\d+)?\s?(?:k|l|lakhs?)$/i.test(word)) return false
      const value = parseNumber(word)
      return !(amount !== null && value === amount && /^[\d,.]+(?:\/-)?$/.test(word))
    })
    .join(' ')
  title = title.replace(/^[\s\-–—:,.]+|[\s\-–—:,.]+$/g, '').replace(/\s+/g, ' ')
  if (title === '' || !/\p{L}/u.test(title)) return null
  return truncate(capitalise(title, true), MAX_TITLE_CHARS)
}

function toAmount(value: unknown, text: string): number | null {
  if (!hasAmountCue(text)) return null
  const amount = parseNumber(value)
  if (amount === null || !(amount > 0) || amount > MAX_AMOUNT) return null
  return roundMoney(amount)
}

/** A date only when the text names a day; worked out here when we can, never in the future. */
function toDate(value: unknown, text: string, today: string): string | null {
  const resolved = resolveDate(text, today)
  if (resolved !== undefined) {
    if (resolved !== null) return resolved
    // The text names a day we couldn't pin down ("last week"): the model may have.
  } else return null
  const date = cleanText(value)
  if (date === null || !isIsoDate(date)) return null
  const age = daysBetween(date, today)
  return age >= 0 && age <= 400 ? date : null
}

/* ------------------------------------------------------------------ putting it together */

export type DescribeOutcome = { kind: 'split'; split: DescribedSplit } | { kind: 'not_a_split' }

const NOT_A_SPLIT: DescribeOutcome = { kind: 'not_a_split' }

/** The model's answer, checked against the text. Never throws. */
export function normalizeDescribed(raw: unknown, input: DescribeInput): DescribeOutcome {
  if (!isRecord(raw)) return NOT_A_SPLIT
  if (toBoolean(pick(raw, FIELDS.isExpense)) === false) return NOT_A_SPLIT
  const { text } = input

  // People: canonical names, only those the text mentions, each once.
  const people: RawPerson[] = []
  const seen = new Set<string>()
  for (const person of rawPeople(pick(raw, FIELDS.people))) {
    const name = canonicalName(person.name, input.people)
    if (name === null) continue
    if (name !== ME && !textMentions(text, person.name) && !textMentions(text, name)) continue
    const key = fold(name)
    if (seen.has(key)) {
      const existing = people.find((entry) => fold(entry.name) === key)
      if (existing && existing.value === null) existing.value = person.value
      continue
    }
    seen.add(key)
    people.push({ name, value: person.value })
  }

  // The speaker: in when they take part, out when they say so.
  const meIndex = () => people.findIndex((person) => person.name === ME)
  if (excludesSpeaker(text)) {
    if (meIndex() !== -1) people.splice(meIndex(), 1)
  } else if (meIndex() === -1 && (speakerTakesPart(text) || people.length === 0)) {
    people.unshift({ name: ME, value: null })
  }

  const headcountRaw = parseNumber(pick(raw, FIELDS.headcount))
  let headcount = headcountRaw !== null && Number.isInteger(headcountRaw) && headcountRaw >= 2 && headcountRaw <= 100 && hasAmountCue(text) ? headcountRaw : null
  // "Netflix 649 for 4" counts the speaker unless they're out.
  if (headcount !== null && meIndex() === -1 && !excludesSpeaker(text) && people.length < headcount) people.unshift({ name: ME, value: null })
  if (headcount !== null && headcount < people.length) headcount = null
  if (people.length > DESCRIBE_LIMITS.maxPeople) people.length = DESCRIBE_LIMITS.maxPeople

  const amount = toAmount(pick(raw, FIELDS.amount), text)
  const mode = toMode(pick(raw, FIELDS.mode)) ?? guessMode(people.map((person) => person.value), amount)
  const settled = settleValues(mode, people, amount)

  // Nothing to split: no amount, no amounts per person, nobody else and no count ("dinner").
  const nothingToSplit =
    settled.amount === null &&
    headcount === null &&
    settled.people.every((person) => person.value === null) &&
    settled.people.every((person) => person.name === ME)
  if (nothingToSplit) return NOT_A_SPLIT

  // Who paid: what the text plainly says ("Kabir covered it", "paid by me") beats the model;
  // otherwise the model's reading, but only when the text talks about paying, and only
  // someone it names.
  let payer = payerFromText(text, settled.people.map((person) => person.name))
  const payerRaw = cleanText(pick(raw, FIELDS.payer))
  if (payer === null && payerRaw !== null && mentionsPayer(text)) {
    const name = canonicalName(payerRaw, input.people)
    if (name === ME ? speaksInFirstPerson(text) : name !== null && (textMentions(text, payerRaw) || textMentions(text, name))) {
      payer = settled.people.find((person) => name !== null && fold(person.name) === fold(name))?.name ?? name
    }
  }

  const titleRaw = pick(raw, FIELDS.title)
  const category: CategoryId =
    toCategory(pick(raw, FIELDS.category)) ?? inferCategory(typeof titleRaw === 'string' ? titleRaw : null) ?? inferCategory(text) ?? 'other'

  return {
    kind: 'split',
    split: {
      title: tidyTitle(titleRaw, settled.amount) ?? CATEGORY_TITLES[category],
      category,
      amount: settled.amount,
      currency: detectCurrency(text, input.currency),
      mode: settled.mode,
      payer,
      people: settled.people,
      headcount,
      date: toDate(pick(raw, FIELDS.date), text, input.today),
    },
  }
}

/** A model's answer is good enough to stop when it's a usable split — or a confident "not an expense". */
export function isAcceptableDescribe(raw: unknown, input: DescribeInput): boolean {
  if (isRecord(raw) && toBoolean(pick(raw, FIELDS.isExpense)) === false) return true
  return normalizeDescribed(raw, input).kind === 'split'
}

/** With less time than this left, another text model won't finish: report what we have. */
const MIN_DESCRIBE_ATTEMPT_MS = 3_000

/**
 * Asks the text models (in order) to read `input`, within `DESCRIBE_BUDGET_MS`.
 * @throws UpstreamError when no model produced a parseable answer.
 */
export async function describeSplit(
  config: ServerConfig,
  input: DescribeInput,
  options: Omit<CompletionOptions, 'accept'> = {},
): Promise<{ outcome: DescribeOutcome; model: string }> {
  const result = await completeJson(
    config,
    {
      noun: 'split',
      models: config.textModels,
      timeoutMs: config.describeTimeoutMs,
      budgetMs: DESCRIBE_BUDGET_MS,
      minAttemptMs: MIN_DESCRIBE_ATTEMPT_MS,
      body: (model, structured) => buildDescribeBody(model, input, structured),
      parse: (content) => extractJson(content, looksLikeDescribe),
    },
    { ...options, accept: (raw) => isAcceptableDescribe(raw, input) },
  )
  return { outcome: normalizeDescribed(result.raw, input), model: result.model }
}
