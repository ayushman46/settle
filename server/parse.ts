/**
 * Turns whatever the vision model wrote into a clean `ScanResponse`.
 *
 * Models are messy: JSON wrapped in prose or code fences, reasoning tags, numbers as
 * strings with currency symbols and local separators, tax lines listed as items, unit
 * prices where line totals belong... Everything here is defensive and never throws,
 * except `extractJson` (so the caller can fall back to another model when a reply has
 * no JSON at all).
 */
import { z } from 'zod'
import { SCANNED_FEE_KINDS, type CategoryId, type ScanResponse, type ScannedFee, type ScannedFeeKind, type ScannedItem, type ScannedTaxLine } from '../shared/api'
import { inferCategory, toCategory } from './category'

export class ParseError extends Error {
  override readonly name = 'ParseError'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** "Grand_Total" → "grandtotal", so alias lookups ignore case and punctuation. */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// ---------------------------------------------------------------------------
// 1. Field aliases (models sometimes rename keys, especially without a schema)
// ---------------------------------------------------------------------------

/** target field → accepted keys (normalised), most preferred first. */
type AliasTable = ReadonlyArray<readonly [target: string, keys: readonly string[]]>

const BILL_FIELDS: AliasTable = [
  ['isBill', ['isbill', 'isreceipt', 'isinvoice']],
  ['merchant', ['merchant', 'merchantname', 'restaurant', 'restaurantname', 'store', 'storename', 'shop', 'shopname', 'vendor', 'business', 'businessname']],
  ['category', ['category', 'billcategory', 'billtype', 'type', 'kind']],
  ['date', ['date', 'billdate', 'invoicedate', 'receiptdate', 'transactiondate']],
  ['currency', ['currency', 'currencycode']],
  ['items', ['items', 'lineitems', 'lines', 'products', 'orderitems']],
  ['subtotal', ['subtotal', 'itemtotal', 'itemstotal']],
  ['tax', ['tax', 'taxes', 'totaltax', 'taxtotal', 'taxamount']],
  ['taxLines', ['taxlines', 'taxbreakdown', 'taxdetails', 'taxlist']],
  ['serviceCharge', ['servicecharge', 'servicecharges', 'servicefee', 'fees']],
  // A list of delivery-app fees (a plain "fees" number still means serviceCharge, as before).
  ['fees', ['fees', 'fee', 'charges', 'deliveryfees', 'appfees']],
  ['discount', ['discount', 'discounts', 'totaldiscount', 'discountamount']],
  ['tip', ['tip', 'tips', 'gratuity', 'tipamount']],
  ['total', ['total', 'grandtotal', 'totalamount', 'amountdue', 'totalpayable', 'amountpayable', 'finaltotal', 'billtotal']],
  ['billOfSupply', ['billofsupply', 'isbillofsupply', 'compositionscheme']],
]

const ITEM_FIELDS: AliasTable = [
  ['name', ['name', 'itemname', 'item', 'description', 'title', 'product', 'dish']],
  ['quantity', ['quantity', 'qty', 'count', 'units']],
  // A line total beats a bare "price", which is often the unit price.
  ['amount', ['amount', 'linetotal', 'lineamount', 'totalprice', 'total', 'totalamount', 'price']],
  ['unitPrice', ['unitprice', 'rate', 'priceeach', 'unitcost', 'priceperunit', 'price']],
]

const BILL_KEYS = new Set(BILL_FIELDS.flatMap(([, keys]) => keys))
const ITEM_NAME_KEYS = new Set(ITEM_FIELDS[0]?.[1] ?? [])
/** Keys that only a bill (never a line item) would have. */
const STRONG_BILL_KEYS = new Set(['isbill', 'items', 'lineitems', 'merchant', 'merchantname', 'restaurant', 'restaurantname', 'currency'])
const TOTAL_KEYS = new Set(['total', 'grandtotal', 'subtotal', 'totalamount', 'amountdue'])

/** Maps alias keys ("grand_total", "qty") onto canonical ones, honouring preference order. */
function canonicalize(table: AliasTable) {
  return (value: unknown): Record<string, unknown> => {
    if (!isRecord(value)) return {}
    const byKey = new Map<string, unknown>()
    for (const [key, field] of Object.entries(value)) {
      const normalized = normalizeKey(key)
      if (!byKey.has(normalized)) byKey.set(normalized, field)
    }
    const out: Record<string, unknown> = {}
    for (const [target, keys] of table) {
      const key = keys.find((candidate) => byKey.has(candidate))
      if (key !== undefined) out[target] = byKey.get(key)
    }
    return out
  }
}

/** `{ "bill": {...} }` / `{ "data": {...} }` → the inner bill; `[bill]` → bill. */
function unwrapBill(value: unknown): unknown {
  if (Array.isArray(value)) return value.find(isRecord) ?? {}
  if (!isRecord(value)) return value
  if (Object.keys(value).some((key) => BILL_KEYS.has(normalizeKey(key)))) return value
  return Object.values(value).find((inner) => isRecord(inner) && Object.keys(inner).some((key) => BILL_KEYS.has(normalizeKey(key)))) ?? value
}

// ---------------------------------------------------------------------------
// 2. Finding the JSON object in a model reply
// ---------------------------------------------------------------------------

const REASONING_BLOCK = /<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi
const REASONING_CLOSE = /<\/(?:think|thinking|reasoning)>/gi
const CODE_FENCE = /```[\w-]*[^\S\n]*\n?([\s\S]*?)```/g
const SMART_DOUBLE_QUOTES = /[“”„‟″«»]/g
/** Upper bound on `{` positions we try, so a pathological reply can't make us quadratic. */
const MAX_OBJECT_STARTS = 64

/**
 * Pulls the answer's JSON object out of a model reply: strips `<think>` blocks and code
 * fences, finds the first balanced `{...}` (string-aware) that parses and `looksRight`
 * (by default: looks like a bill), and tolerates trailing commas, comments, smart quotes,
 * single quotes, unquoted keys and Python literals.
 * @throws ParseError when there is no such object.
 */
export function extractJson(text: string, looksRight: (value: Record<string, unknown>) => boolean = looksLikeBill): unknown {
  let source = String(text).replace(/^\uFEFF/, '').replace(REASONING_BLOCK, '')
  // A reasoning block whose opening tag lived in the chat template: keep what follows it.
  const lastClosing = [...source.matchAll(REASONING_CLOSE)].at(-1)
  if (lastClosing) source = source.slice(lastClosing.index + lastClosing[0].length)

  const candidates: string[] = []
  for (const fence of source.matchAll(CODE_FENCE)) {
    if (fence[1]?.includes('{')) candidates.push(fence[1])
  }
  candidates.push(source)

  for (const candidate of candidates) {
    const found = findObject(candidate, looksRight) ?? findObject(candidate.replace(SMART_DOUBLE_QUOTES, '"'), looksRight)
    if (found !== undefined) return found
  }
  throw new ParseError('The model reply contained no matching JSON object.')
}

function findObject(text: string, looksRight: (value: Record<string, unknown>) => boolean): Record<string, unknown> | undefined {
  let start = text.indexOf('{')
  for (let tries = 0; start !== -1 && tries < MAX_OBJECT_STARTS; tries++) {
    const end = matchingBrace(text, start)
    let next = start + 1
    if (end !== -1) {
      const parsed = parseLenient(text.slice(start, end + 1))
      if (isRecord(parsed)) {
        if (looksRight(parsed)) return parsed
        // Valid JSON that isn't the answer (e.g. the schema echoed back): skip over it whole.
        next = end + 1
      }
    }
    start = text.indexOf('{', next)
  }
  return undefined
}

/** An echoed JSON schema ("type": "object", "properties": {...}) is never the answer. */
export function isEchoedSchema(value: Record<string, unknown>): boolean {
  return value.type === 'object' && isRecord(value.properties)
}

function looksLikeBill(value: Record<string, unknown>): boolean {
  if (isEchoedSchema(value)) return false
  const keys = Object.keys(value).map(normalizeKey)
  if (keys.some((key) => STRONG_BILL_KEYS.has(key))) return true
  // `{name, qty, total}` is a line item (e.g. from a reply whose outer object is broken).
  if (keys.some((key) => ITEM_NAME_KEYS.has(key))) return false
  return keys.some((key) => TOTAL_KEYS.has(key)) || unwrapBill(value) !== value
}

/** Index of the `}` closing the object that opens at `start`, or -1 if it never closes. */
function matchingBrace(text: string, start: number): number {
  let depth = 0
  let quote: string | null = null
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (quote !== null) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = null
    } else if (char === '"' || (char === "'" && opensSingleQuoted(text, i))) quote = char
    else if (char === '{') depth++
    else if (char === '}' && --depth === 0) return i
  }
  return -1
}

/** A `'` starts a string only in value/key position (after `{ [ , :`), never inside a word. */
function opensSingleQuoted(text: string, index: number): boolean {
  for (let i = index - 1; i >= 0; i--) {
    const char = text[i] ?? ''
    if (/\s/.test(char)) continue
    return '{[,:'.includes(char)
  }
  return false
}

function parseLenient(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    try {
      return JSON.parse(repairJson(json))
    } catch {
      return undefined
    }
  }
}

/**
 * Fixes common near-JSON mistakes — trailing commas, comments, unquoted keys,
 * single-quoted strings, Python/JS literals — touching only text outside string literals.
 */
export function repairJson(json: string): string {
  let out = ''
  let segmentStart = 0
  let i = 0
  while (i < json.length) {
    const char = json[i]
    const isDouble = char === '"'
    const isSingle = char === "'" && opensSingleQuoted(json, i)
    if (!isDouble && !isSingle) {
      i++
      continue
    }
    out += repairSegment(json.slice(segmentStart, i))
    const contentStart = i + 1
    i = contentStart
    while (i < json.length && json[i] !== char) i += json[i] === '\\' ? 2 : 1
    const content = json.slice(contentStart, Math.min(i, json.length))
    out += isDouble ? `"${content}"` : toDoubleQuoted(content)
    i++
    segmentStart = i
  }
  return out + repairSegment(json.slice(segmentStart))
}

/** Body of a single-quoted string → a JSON double-quoted string. */
function toDoubleQuoted(content: string): string {
  let out = ''
  for (let i = 0; i < content.length; i++) {
    const char = content[i] ?? ''
    if (char === '\\') {
      const next = content[i + 1] ?? ''
      out += next === "'" ? "'" : char + next
      i++
    } else out += char === '"' ? '\\"' : char
  }
  return `"${out}"`
}

function repairSegment(segment: string): string {
  return segment
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n\r]*/g, '')
    .replace(/-?\bInfinity\b|\bNaN\b|\bundefined\b|\bNone\b/g, 'null')
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3')
    .replace(/,(\s*[}\]])/g, '$1')
}

// ---------------------------------------------------------------------------
// 3. Lenient coercion of values
// ---------------------------------------------------------------------------

/** Digits with grouping/decimal separators: `.` `,` apostrophes, (thin/no-break) spaces. */
const NUMBER_RUN = /\d(?:[\d.,'’ \u00a0\u2009\u202f]*\d)?/
const GROUPING_CHARS = /['’ \u00a0\u2009\u202f]/g
const MINUS = /[-−–]/

/**
 * Reads a number out of a messy string: "1,234.50", "₹ 420", "Rs.99", "(50.00)", "-50",
 * Indian "1,23,456.78", European "1.234,50" / "12,5". Returns null when there is no number.
 */
export function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const text = value.trim()
  const match = NUMBER_RUN.exec(text)
  if (!match) return null

  let digits = match[0]
  let start = match.index
  const end = start + digits.length
  // ".5" or "$.50" — a leading decimal point, unless it ends an abbreviation such as "Rs.".
  if (start > 0 && text[start - 1] === '.' && !/\p{L}/u.test(text[start - 2] ?? '')) {
    digits = `.${digits}`
    start--
  }
  const before = text.slice(0, start)
  const after = text.slice(end)
  const negative =
    MINUS.test(before) || MINUS.test(after.trimStart().charAt(0)) || (before.includes('(') && after.includes(')'))

  const magnitude = parseDigits(digits)
  if (magnitude === null) return null
  return negative && magnitude !== 0 ? -magnitude : magnitude
}

/** `digits` holds only digits, `.`, `,` and grouping spaces/apostrophes. */
function parseDigits(digits: string): number | null {
  const cleaned = digits.replace(GROUPING_CHARS, '')
  const lastDot = cleaned.lastIndexOf('.')
  const lastComma = cleaned.lastIndexOf(',')
  let normalized: string
  if (lastDot !== -1 && lastComma !== -1) {
    // Both separators: whichever comes last is the decimal separator.
    const [decimal, grouping] = lastDot > lastComma ? ['.', ','] : [',', '.']
    const parts = cleaned.split(decimal)
    if (parts.length > 2) return null
    normalized = `${(parts[0] ?? '').split(grouping).join('')}.${parts[1] ?? ''}`
  } else if (lastDot !== -1 || lastComma !== -1) {
    const separator = lastDot !== -1 ? '.' : ','
    const groups = cleaned.split(separator)
    const last = groups.at(-1) ?? ''
    if (groups.length === 2) {
      // One separator. A dot is a decimal point. A comma followed by exactly three digits
      // is a thousands separator ("1,234") unless the whole part is 0 ("0,500").
      const isGrouping = separator === ',' && last.length === 3 && groups[0] !== '0' && groups[0] !== ''
      normalized = isGrouping ? groups.join('') : groups.join('.')
    } else {
      // Repeated separator: grouping ("1,23,456" / "1.234.567"), unless the last group isn't
      // three digits long, in which case it is the decimal part.
      normalized = last.length === 3 ? groups.join('') : `${groups.slice(0, -1).join('')}.${last}`
    }
  } else {
    normalized = cleaned
  }
  if (!/^\d*\.?\d*$/.test(normalized) || !/\d/.test(normalized)) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const EMPTY_TEXT = /^(?:null|none|nil|n\/?a|unknown|not\s+(?:available|found|printed|visible|applicable)|-+|\?+)$/i

/** Trimmed single-line text, or null for blanks and placeholder words like "N/A". */
export function cleanText(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return null
  // eslint-disable-next-line no-control-regex -- deliberately stripping control characters
  const text = value.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim()
  return text === '' || EMPTY_TEXT.test(text) ? null : text
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return !/^\s*(?:false|no|n|0)\s*$/i.test(value)
  return true // missing or null: assume it is a bill and let the items decide
}

/** A yes only when the model said yes: missing, null or anything unclear is no. */
function toFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  return typeof value === 'string' && /^s*(?:true|yes|y)s*$/i.test(value)
}

const MAX_QUANTITY = 9999

function toQuantity(value: unknown): number {
  const quantity = parseNumber(value)
  if (quantity === null || !(quantity > 0) || quantity > MAX_QUANTITY) return 1
  return Math.round(quantity * 1000) / 1000
}

/** Rounds to 2 decimal places without float artefacts (1.005 → 1.01); never returns -0. */
export function roundMoney(value: number): number {
  const rounded = Math.round(Number((Math.abs(value) * 100).toFixed(6))) / 100
  return value < 0 && rounded !== 0 ? -rounded : rounded
}

// ---------------------------------------------------------------------------
// 4. The lenient extraction schema
// ---------------------------------------------------------------------------

const lenient = <T>(transform: (value: unknown) => T) => z.unknown().optional().transform(transform)

const ExtractedItemSchema = z.preprocess(
  canonicalize(ITEM_FIELDS),
  z.object({
    name: lenient(cleanText),
    quantity: lenient(toQuantity),
    amount: lenient(parseNumber),
    unitPrice: lenient(parseNumber),
  }),
)

const MAX_ITEMS = 200

export interface ExtractedItem {
  name: string | null
  quantity: number
  amount: number | null
}

function toItems(value: unknown): ExtractedItem[] {
  if (!Array.isArray(value)) return []
  const items: ExtractedItem[] = []
  for (const entry of value.slice(0, MAX_ITEMS * 2)) {
    if (!isRecord(entry)) continue
    const parsed = ExtractedItemSchema.safeParse(entry)
    if (!parsed.success) continue
    const { name, quantity, amount, unitPrice } = parsed.data
    items.push({ name, quantity, amount: amount ?? (unitPrice === null ? null : unitPrice * quantity) })
  }
  return items
}

/** Most fees kept from one scan, and the longest fee label. */
const MAX_FEES = 15
const MAX_FEE_LABEL = 40
const FEE_KINDS: ReadonlySet<unknown> = new Set(SCANNED_FEE_KINDS)

/** Delivery-app fees: a list of objects with a positive amount (labels tidied, kinds from the enum else 'other'). */
function toFees(value: unknown): ScannedFee[] {
  if (!Array.isArray(value)) return []
  const fees: ScannedFee[] = []
  for (const entry of value) {
    if (fees.length >= MAX_FEES) break
    if (!isRecord(entry)) continue
    const amount = parseNumber(entry.amount ?? entry.value ?? entry.price)
    if (amount === null || !(amount > 0)) continue
    const rawLabel = cleanText(entry.label ?? entry.name ?? entry.title) ?? ''
    const label = Array.from(rawLabel).slice(0, MAX_FEE_LABEL).join('').trim()
    const kind = typeof entry.kind === 'string' ? entry.kind.trim().toLowerCase().replace(/[\s-]+/g, '_') : ''
    fees.push({ label: label || 'Fee', kind: FEE_KINDS.has(kind) ? (kind as ScannedFeeKind) : 'other', amount: roundMoney(amount) })
  }
  return fees
}

/** Most tax lines kept from one scan, and the longest tax-line label. */
const MAX_TAX_LINES = 12
const MAX_TAX_LABEL = 40

/** Tax lines: a list of objects with a positive amount and a label (unlabelled lines are dropped). */
function toTaxLines(value: unknown): ScannedTaxLine[] {
  if (!Array.isArray(value)) return []
  const lines: ScannedTaxLine[] = []
  for (const entry of value) {
    if (lines.length >= MAX_TAX_LINES) break
    if (!isRecord(entry)) continue
    const amount = parseNumber(entry.amount ?? entry.value)
    const label = Array.from(cleanText(entry.label ?? entry.name ?? entry.title) ?? '').slice(0, MAX_TAX_LABEL).join('').trim()
    if (amount === null || !(amount > 0) || label === '') continue
    lines.push({ label, amount: roundMoney(amount) })
  }
  return lines
}

export const ExtractionSchema = z.preprocess(
  (value: unknown) => canonicalize(BILL_FIELDS)(unwrapBill(value)),
  z.object({
    isBill: lenient(toBoolean),
    merchant: lenient(cleanText),
    category: lenient(toCategory),
    date: lenient(cleanText),
    currency: lenient(cleanText),
    items: lenient(toItems),
    subtotal: lenient(parseNumber),
    tax: lenient(parseNumber),
    taxLines: lenient(toTaxLines),
    serviceCharge: lenient(parseNumber),
    fees: lenient(toFees),
    discount: lenient(parseNumber),
    tip: lenient(parseNumber),
    total: lenient(parseNumber),
    billOfSupply: lenient(toFlag),
  }),
)

export type Extraction = z.output<typeof ExtractionSchema>

/** Never throws: anything unusable becomes null / an empty item list. */
export function parseExtraction(raw: unknown): Extraction {
  const parsed = ExtractionSchema.safeParse(raw)
  if (parsed.success) return parsed.data
  return {
    isBill: true,
    merchant: null,
    category: null,
    date: null,
    currency: null,
    items: [],
    subtotal: null,
    tax: null,
    taxLines: [],
    serviceCharge: null,
    fees: [],
    discount: null,
    tip: null,
    total: null,
    billOfSupply: false,
  }
}

// ---------------------------------------------------------------------------
// 5. Summary lines models sometimes list as items
// ---------------------------------------------------------------------------

export type LineKind = 'total' | 'subtotal' | 'tax' | 'serviceCharge' | 'discount' | 'tip' | 'ignore'

const TOTAL_LINE =
  /^(?:grand\s*total|total(?:\s+(?:amount|amt|due|payable|bill|value|incl\.?\s*(?:of\s+)?(?:all\s+)?(?:taxes|tax|vat|gst)))?|net\s+(?:amount|amt|total|payable|bill)|(?:total\s+)?amount\s+(?:due|payable)|bill\s+(?:amount|total)|balance\s+(?:due|payable)|payable(?:\s+amount)?|to\s+pay)\s*:?$/i
/** Includes section totals such as "Food Total" / "Item Total". */
const SUBTOTAL_LINE =
  /^(?:net\s+)?sub[\s-]*total\b|^total\s+before\s+tax(?:es)?\b|^gross\s+(?:amount|total)\b|^taxable\s+(?:amount|value)\b|\btotal\s*:?$/i
const SERVICE_LINE =
  /^(?:service|svc|serv\.?)\s*(?:charges?|chg|fees?)\b|^(?:packaging|packing|package|container|parcel|carry\s*bag)\s*(?:charges?|chg|fees?|cost)?\s*(?:@.*|\(.*\)|\d+(?:[.,]\d+)?\s*%)?\s*:?$|^(?:delivery|convenience|platform|handling|booking|cover|corkage|small\s+order)\s*(?:partner\s+)?(?:charges?|chg|fees?)\b|\bsurcharge\b|^coperto\b/i
const DISCOUNT_LINE =
  /\bdiscounts?\b|\bdisc\b|^(?:less|minus)\s*[:-]|^(?:coupons?|promo(?:\s*code)?|vouchers?|offers?|loyalty|cashback|you\s+saved|savings|rewards?|happy\s+hours?\s+(?:offer|off))\b|\b\d+(?:[.,]\d+)?\s*%\s*off\b/i
const TIP_LINE = /^(?:tips?|gratuity)\b(?:\s*(?:\([^)]*\)|@.*|\d+(?:[.,]\d+)?\s*%))?\s*:?$|\bgratuity\b/i
const IGNORE_LINE =
  /^(?:round(?:ed|ing)?[\s-]*off|round(?:ing)?[\s-]*adj(?:ustment)?|rounding(?:\s+(?:amount|diff(?:erence)?))?\s*:?$|cash|card|change|upi|paid|tendered|amount\s+(?:tendered|paid|received)|balance|visa|mastercard|amex|rupay|paytm|gpay|phonepe|google\s+pay|credit\s+card|debit\s+card|payment|total\s+(?:qty|quantity|items?|no\.?\s+of\s+items)|no\.?\s+of\s+items|item\s+count)\b/i

function isTaxLine(name: string): boolean {
  if (/^(?:[csi]|ut)?[\s-]?gst\b|\bcess\b/i.test(name)) return true
  // "VAT 69" is a whisky, "Tax" alone is a tax: require a rate, an "on/@", or nothing else.
  if (/\b(?:tax|taxes|vat|mwst|tva|iva|hst|pst|qst)\b/i.test(name) && name.includes('%')) return true
  if (/\b(?:tax|taxes)\s*(?:\([^)]*\))?\s*:?$/i.test(name)) return true
  if (/^(?:vat|mwst|tva|iva|hst|pst|qst)\s*(?:\([^)]*\))?\s*:?$/i.test(name)) return true
  return /^(?:tax|taxes|vat|mwst|tva|iva)\s*(?:@|on\b|amount\b|amt\b|(?:&|and)\s*(?:fees?|charges?)\b)/i.test(name)
}

/** What a line that ended up among the items really is, or null for a genuine item. */
export function classifyLine(name: string): LineKind | null {
  if (TOTAL_LINE.test(name)) return 'total'
  if (SUBTOTAL_LINE.test(name)) return 'subtotal'
  if (isTaxLine(name)) return 'tax'
  if (SERVICE_LINE.test(name)) return 'serviceCharge'
  if (DISCOUNT_LINE.test(name)) return 'discount'
  if (TIP_LINE.test(name)) return 'tip'
  if (IGNORE_LINE.test(name)) return 'ignore'
  return null
}

// ---------------------------------------------------------------------------
// 6. Names, currency, dates
// ---------------------------------------------------------------------------

const ACRONYMS = new Set([
  'BBQ', 'BLT', 'IPA', 'XS', 'XL', 'XXL', 'XXXL', 'NY', 'USA', 'UK', 'KFC', 'LIIT', 'VIP', 'MRP', 'OG', 'PBJ', 'DIY', 'NV',
  // Utilities and services printed as acronyms on their bills.
  'BESCOM', 'BSES', 'TNEB', 'TANGEDCO', 'KSEB', 'MSEDCL', 'CESC', 'APSPDCL', 'TSSPDCL', 'BWSSB', 'DJB', 'IGL', 'MGL', 'BSNL', 'MTNL',
  'IRCTC', 'OYO', 'LPG', 'CNG', 'DTH', 'GST', 'PG', 'HP', 'BPCL', 'IOCL', 'HPCL',
])
const MINOR_WORDS = new Set(['a', 'an', 'and', 'or', 'of', 'with', 'in', 'on', 'the', 'to', 'for', 'per', 'n'])
const MAX_NAME_LENGTH = 80

function isShouting(text: string): boolean {
  const letters = text.match(/\p{Lu}|\p{Ll}/gu) ?? []
  return letters.length >= 2 && letters.every((letter) => letter === letter.toUpperCase())
}

function titleCase(text: string): string {
  return text
    .split(' ')
    .map((word, index) => {
      const bare = word.replace(/[^\p{L}\p{N}&]/gu, '')
      if (ACRONYMS.has(bare)) return word
      const lower = word.toLowerCase()
      if (/\d/.test(word)) return lower
      if (index > 0 && MINOR_WORDS.has(lower)) return lower
      return lower.replace(/(^|[(\-/"[])(\p{L})/gu, (_match, prefix: string, letter: string) => prefix + letter.toUpperCase())
    })
    .join(' ')
}

/** Item / merchant name clean-up: bullets and serial numbers off, ALL CAPS → Title Case, ≤ 80 chars. */
export function tidyName(value: string | null): string | null {
  if (value === null) return null
  let name = value
    .replace(/^[\s\-–—•*·>|:]+/, '')
    .replace(/^\d{1,3}[.)]\s+(?=\S)/, '')
    .replace(/[\s\-–—*|:]+$/, '')
    .trim()
  if (isShouting(name)) name = titleCase(name)
  const characters = Array.from(name)
  if (characters.length > MAX_NAME_LENGTH) name = characters.slice(0, MAX_NAME_LENGTH).join('').trimEnd()
  return name === '' ? null : name
}

const SYMBOL_CURRENCIES = new Map<string, string>([
  ['₹', 'INR'],
  ['₨', 'INR'],
  ['rs', 'INR'],
  ['rupee', 'INR'],
  ['rupees', 'INR'],
  ['$', 'USD'],
  ['us$', 'USD'],
  ['dollar', 'USD'],
  ['dollars', 'USD'],
  ['€', 'EUR'],
  ['euro', 'EUR'],
  ['euros', 'EUR'],
  ['£', 'GBP'],
  ['pound', 'GBP'],
  ['pounds', 'GBP'],
  ['¥', 'JPY'],
  ['yen', 'JPY'],
  ['円', 'JPY'],
  ['元', 'CNY'],
  ['rmb', 'CNY'],
  ['yuan', 'CNY'],
  ['د.إ', 'AED'],
  ['dhs', 'AED'],
  ['dirham', 'AED'],
  ['dirhams', 'AED'],
  ['s$', 'SGD'],
  ['a$', 'AUD'],
  ['au$', 'AUD'],
  ['c$', 'CAD'],
  ['ca$', 'CAD'],
  ['hk$', 'HKD'],
  ['nz$', 'NZD'],
  ['r$', 'BRL'],
  ['฿', 'THB'],
  ['baht', 'THB'],
  ['rm', 'MYR'],
  ['ringgit', 'MYR'],
  ['rp', 'IDR'],
  ['rupiah', 'IDR'],
  ['₩', 'KRW'],
  ['₱', 'PHP'],
  ['₫', 'VND'],
  ['₺', 'TRY'],
  ['₪', 'ILS'],
  ['₦', 'NGN'],
  ['৳', 'BDT'],
  ['zł', 'PLN'],
])

/** Symbols to look for inside longer strings, most specific first. */
const EMBEDDED_SYMBOLS: ReadonlyArray<readonly [string, string]> = [
  ['HK$', 'HKD'],
  ['NZ$', 'NZD'],
  ['US$', 'USD'],
  ['S$', 'SGD'],
  ['A$', 'AUD'],
  ['C$', 'CAD'],
  ['R$', 'BRL'],
  ['₹', 'INR'],
  ['€', 'EUR'],
  ['£', 'GBP'],
  ['¥', 'JPY'],
  ['฿', 'THB'],
  ['₩', 'KRW'],
  ['₱', 'PHP'],
  ['₫', 'VND'],
  ['د.إ', 'AED'],
  ['$', 'USD'],
]

let isoCurrencies: Set<string> | null = null

function isIsoCurrency(code: string): boolean {
  if (isoCurrencies === null) {
    try {
      isoCurrencies = new Set(Intl.supportedValuesOf('currency'))
    } catch {
      isoCurrencies = new Set()
    }
  }
  return isoCurrencies.size === 0 || isoCurrencies.has(code)
}

/** ISO 4217 code from a code, symbol or label ("inr", "₹", "Rs.", "S$", "INR (₹)"); else null. */
export function normalizeCurrency(value: string | null): string | null {
  if (value === null) return null
  const raw = value.trim()
  const upper = raw.toUpperCase()
  if (/^[A-Z]{3}$/.test(upper) && isIsoCurrency(upper)) return upper
  const symbol = SYMBOL_CURRENCIES.get(raw.replace(/\s+/g, '').replace(/\.$/, '').toLowerCase())
  if (symbol) return symbol
  for (const token of upper.match(/\b[A-Z]{3}\b/g) ?? []) {
    if (isIsoCurrency(token)) return token
  }
  if (/\brs\b/i.test(raw)) return 'INR'
  for (const [needle, code] of EMBEDDED_SYMBOLS) if (raw.includes(needle)) return code
  return null
}

const MAX_DATE_LENGTH = 40
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH_NAME = String.raw`(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?`
const DAY_MONTH_YEAR = new RegExp(String.raw`^(\d{1,2})(?:st|nd|rd|th)?[\s\-/.,]*${MONTH_NAME}[\s\-/.,]*(\d{4}|\d{2})(?![\d])`, 'i')
const MONTH_DAY_YEAR = new RegExp(String.raw`^${MONTH_NAME}[\s\-/.,]*(\d{1,2})(?:st|nd|rd|th)?[\s\-/.,]+(\d{4}|\d{2})(?![\d])`, 'i')
const NUMERIC_YMD = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?![\d])/
const NUMERIC_XYZ = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?![\d])/

function fullYear(year: string): number {
  const value = Number(year)
  return year.length === 2 ? (value < 70 ? 2000 + value : 1900 + value) : value
}

function isoDate(year: number, month: number, day: number): string | null {
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * YYYY-MM-DD when the printed date is unambiguous (ISO, a month name, or a day > 12),
 * dropping any time part. Ambiguous dates like 03/04/2026 are kept as printed.
 */
export function normalizeDate(value: string | null): string | null {
  if (value === null) return null
  const text = value.trim()
  let match = NUMERIC_YMD.exec(text)
  if (match) {
    const iso = isoDate(Number(match[1]), Number(match[2]), Number(match[3]))
    if (iso) return iso
  }
  match = DAY_MONTH_YEAR.exec(text)
  if (match) {
    const iso = isoDate(fullYear(match[3] ?? ''), MONTHS.indexOf((match[2] ?? '').toLowerCase()) + 1, Number(match[1]))
    if (iso) return iso
  }
  match = MONTH_DAY_YEAR.exec(text)
  if (match) {
    const iso = isoDate(fullYear(match[3] ?? ''), MONTHS.indexOf((match[1] ?? '').toLowerCase()) + 1, Number(match[2]))
    if (iso) return iso
  }
  match = NUMERIC_XYZ.exec(text)
  if (match) {
    const first = Number(match[1])
    const second = Number(match[2])
    const year = fullYear(match[3] ?? '')
    let iso: string | null = null
    if (first > 12 || first === second) iso = isoDate(year, second, first)
    else if (second > 12) iso = isoDate(year, first, second)
    if (iso) return iso
  }
  return Array.from(text).slice(0, MAX_DATE_LENGTH).join('').trim() || null
}

// ---------------------------------------------------------------------------
// 7. Normalising into the wire format
// ---------------------------------------------------------------------------

export const WARNINGS = {
  itemsMismatch: "The items don't add up to the bill's subtotal — give them a quick check.",
  noTotal: "We couldn't find the bill total — enter what you paid on the next step.",
} as const

interface Totals {
  subtotal: number | null
  tax: number | null
  serviceCharge: number | null
  discount: number | null
  tip: number | null
  total: number | null
}

const nonNegativeOrNull = (value: number | null) => (value === null || value < 0 ? null : roundMoney(value))
const sum = (values: readonly number[]) => roundMoney(values.reduce((acc, value) => acc + value, 0))

function predictedTotal(itemsSum: number, totals: Totals, feesSum = 0): number {
  return itemsSum + (totals.tax ?? 0) + (totals.serviceCharge ?? 0) + feesSum + (totals.tip ?? 0) - (totals.discount ?? 0)
}

/** What the items should add up to: the printed subtotal, else what the total implies. */
function expectedItemsTotal(totals: Totals, feesSum = 0): number | null {
  if (totals.subtotal !== null) return totals.subtotal
  if (totals.total === null) return null
  return roundMoney(totals.total - (totals.tax ?? 0) - (totals.serviceCharge ?? 0) - feesSum - (totals.tip ?? 0) + (totals.discount ?? 0))
}

/**
 * Fixes the commonest systematic misread: the model copied the Rate column (unit price)
 * instead of the Amount column for lines with qty > 1 — or multiplied a line total by
 * the quantity again. Only applied when it makes the items match the bill's own numbers.
 */
function reconcileQuantities(items: ScannedItem[], totals: Totals, feesSum = 0): ScannedItem[] {
  const target = expectedItemsTotal(totals, feesSum)
  if (target === null || target <= 0) return items
  const multi = items.filter((item) => item.quantity > 1 && Number.isInteger(item.quantity))
  if (multi.length === 0) return items
  const tolerance = Math.max(1, target * 0.005)
  const error = (candidate: ScannedItem[]) => Math.abs(sum(candidate.map((item) => item.amount)) - target)
  if (error(items) <= tolerance) return items

  const rescale = (factor: (quantity: number) => number) =>
    items.map((item) =>
      item.quantity > 1 && Number.isInteger(item.quantity) ? { ...item, amount: roundMoney(item.amount * factor(item.quantity)) } : item,
    )
  const options = [rescale((quantity) => quantity), rescale((quantity) => 1 / quantity)]
    .map((candidate) => ({ candidate, error: error(candidate) }))
    .filter((option) => option.error <= tolerance)
    .sort((a, b) => a.error - b.error)
  return options[0]?.candidate ?? items
}

type Charge = 'tax' | 'serviceCharge' | 'tip' | 'discount'
const CHARGES: readonly Charge[] = ['tax', 'serviceCharge', 'tip', 'discount']

/**
 * Folds amounts found among the items (a "CGST" line, a negative discount line...) into
 * their fields. When the bill total is known, only the folds that make the bill add up best
 * are made (ties: fold more). The model may already have counted a line in its field, and we
 * must not double it; and an "incl. VAT 19%" line on a bill whose items already make the
 * total is information, not a charge. The lines are weighed together, since a tax line can
 * look wrong on its own on a bill that also lists a discount.
 */
function settleExtras(totals: Totals, extras: Readonly<Record<Charge, number>>, itemsSum: number, feesSum = 0): Totals {
  const found = CHARGES.filter((key) => roundMoney(extras[key]) !== 0)
  const fold = (mask: number): Totals => {
    const next = { ...totals }
    found.forEach((key, bit) => {
      if (mask & (1 << bit)) next[key] = roundMoney((totals[key] ?? 0) + roundMoney(extras[key]))
    })
    return next
  }
  const all = (1 << found.length) - 1
  if (totals.total === null || found.length === 0) return fold(all)

  let best = { totals, error: Number.POSITIVE_INFINITY, folds: -1 }
  for (let mask = 0; mask <= all; mask++) {
    const candidate = fold(mask)
    const error = roundMoney(Math.abs(totals.total - predictedTotal(itemsSum, candidate, feesSum)))
    const folds = found.filter((_key, bit) => mask & (1 << bit)).length
    if (error < best.error || (error === best.error && folds > best.folds)) best = { totals: candidate, error, folds }
  }
  return best.totals
}

/** Cleans an extraction into the wire format (items, 2dp money, ISO currency, warnings). */
export function normalize(extraction: Extraction, model: string): ScanResponse {
  let items: ScannedItem[] = []
  const extras: Record<Charge, number> = { tax: 0, serviceCharge: 0, tip: 0, discount: 0 }
  const printedTotals: number[] = []
  const printedSubtotals: number[] = []
  // Tax lines the model listed as items: kept as tax lines when it gave none of its own.
  const taxItems: ScannedTaxLine[] = []

  for (const line of extraction.items) {
    const name = tidyName(line.name)
    if (name === null) continue
    const amount = roundMoney(line.amount ?? 0)
    const kind = classifyLine(name)
    if (kind === 'ignore') continue
    if (kind === 'total') printedTotals.push(Math.abs(amount))
    else if (kind === 'subtotal') printedSubtotals.push(Math.abs(amount))
    else if (kind === 'discount' || (kind === null && amount < 0)) extras.discount += Math.abs(amount)
    else if (kind !== null) {
      extras[kind] += Math.abs(amount)
      if (kind === 'tax' && amount !== 0) taxItems.push({ label: Array.from(name).slice(0, MAX_TAX_LABEL).join('').trim(), amount: Math.abs(amount) })
    }
    else if (items.length < MAX_ITEMS) items.push({ name, quantity: line.quantity, amount })
  }

  // Several subtotal-like lines are usually section totals ("Food Total"); the largest is the bill's.
  const printed: Totals = {
    subtotal: nonNegativeOrNull(extraction.subtotal) ?? (printedSubtotals.length > 0 ? Math.max(...printedSubtotals) : null),
    tax: nonNegativeOrNull(extraction.tax),
    serviceCharge: nonNegativeOrNull(extraction.serviceCharge),
    discount: extraction.discount === null ? null : roundMoney(Math.abs(extraction.discount)),
    tip: nonNegativeOrNull(extraction.tip),
    total: nonNegativeOrNull(extraction.total) ?? (printedTotals.length > 0 ? Math.max(...printedTotals) : null),
  }

  // Delivery-app fees: positive and never more than the bill. A model that also added them up into
  // serviceCharge counted them twice: the fees stay, the duplicate goes.
  const fees = extraction.fees.filter((fee) => fee.amount > 0 && (printed.total === null || fee.amount <= printed.total))
  const feesSum = sum(fees.map((fee) => fee.amount))
  if (fees.length > 0 && printed.serviceCharge !== null && roundMoney(printed.serviceCharge) === feesSum) printed.serviceCharge = null

  items = reconcileQuantities(items, printed, feesSum)
  const itemsSum = sum(items.map((item) => item.amount))
  const totals = settleExtras(printed, extras, itemsSum, feesSum)

  const warnings: string[] = []
  if (items.length > 0 && totals.subtotal !== null && Math.abs(itemsSum - totals.subtotal) > Math.max(1, totals.subtotal * 0.01)) {
    warnings.push(WARNINGS.itemsMismatch)
  }
  if (totals.total === null) warnings.push(WARNINGS.noTotal)

  // Tax lines: never more than the tax they add up to (a line the model invented is dropped).
  const taxCap = totals.tax === null ? 0 : totals.tax + 1
  const taxLines = (extraction.taxLines.length > 0 ? extraction.taxLines : taxItems).filter((line) => line.amount > 0 && line.amount <= taxCap)
  const merchant = tidyName(extraction.merchant)
  return {
    merchant,
    date: normalizeDate(extraction.date),
    currency: normalizeCurrency(extraction.currency),
    category: extraction.category ?? inferCategory(merchant) ?? inferCategory(items.map((item) => item.name).join(' · ')),
    items,
    ...totals,
    ...(taxLines.length > 0 ? { taxLines } : {}),
    ...(extraction.billOfSupply ? { billOfSupply: true } : {}),
    fees,
    warnings: warnings.slice(0, 2),
    model,
  }
}

/** Bills people order from item by item: a total alone means the model missed the items. */
const ITEMIZED_CATEGORIES: ReadonlySet<CategoryId> = new Set(['food', 'groceries', 'shopping'])

function hasItems(scan: ScanResponse): boolean {
  return scan.items.length > 0 && (scan.items.some((item) => item.amount > 0) || scan.total !== null)
}

function hasTotal(scan: ScanResponse): boolean {
  return scan.total !== null && scan.total > 0
}

/**
 * Whether a scan is worth showing: items with prices (or with a printed total), or just a
 * total — electricity, cab and hotel bills are split as an amount. A list of names with no
 * prices and no total is not a readable bill.
 */
export function isUsable(scan: ScanResponse): boolean {
  return hasItems(scan) || hasTotal(scan)
}

/**
 * True when a parsed model reply is good enough to stop trying other models. A total with no
 * items is enough for a service bill, but on a restaurant, grocery or shop bill (or one we
 * can't place) another model may read the items — the reply is still kept as a last resort.
 */
export function isAcceptableReply(raw: unknown): boolean {
  const extraction = parseExtraction(raw)
  if (!extraction.isBill) return true
  const scan = normalize(extraction, '')
  if (hasItems(scan)) return true
  return hasTotal(scan) && scan.category !== null && !ITEMIZED_CATEGORIES.has(scan.category)
}
