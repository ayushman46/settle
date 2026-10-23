/**
 * What the "Just say it" confirm card shows for an AI draft: the title, amount, who paid, how it's
 * split and each person's share — worked out exactly as the split screen will, without saving
 * anything (new people get stand-in ids until "Looks right" adds them for real).
 */
import { describedToPrefill, missingPeople } from '../../ai/prefill'
import type { CategoryId, DescribedSplit, Friend, Minor, SplitMode } from '../../domain/types'
import { CATEGORY_META } from '../../engine/categories'
import { splitAmount } from '../../engine/split'
import { t } from '../../i18n'
import { formatBps } from '../../kit/splitInputs'
import { formatMoney } from '../../lib/money'
import { nameKey, normalizeName } from '../../lib/people'
import { AVATAR_COLORS } from '../../types'

/** Stand-in ids for people the draft names who aren't in your people yet. */
const NEW_PREFIX = 'new-person:'

export interface DescribePerson {
  /** A friend id, or a stand-in for someone new. */
  id: string
  /** As shown: "You" for the owner. */
  name: string
  /** The name their avatar's initials come from (the owner's own name, not "You"). */
  avatarName: string
  color: number
  isMe: boolean
  /** Not in your people yet — added when the draft is used. */
  isNew: boolean
  /** Their share of the total, when the total is known and the split adds up. */
  share: Minor | null
  /** The split's own number for them: "40%" or "×2" (null for equal and exact splits). */
  detail: string | null
}

export interface DescribeView {
  title: string
  category: CategoryId
  currency: string
  /** Null when the text named no amount. */
  total: Minor | null
  /** YYYY-MM-DD; null means today. */
  date: string | null
  mode: Exclude<SplitMode, 'items'>
  /** "Split equally", "Exact amounts", "By percentage", "By shares". */
  modeLabel: string
  /** Who paid — the friend id, or the owner when the text didn't say. */
  payerId: string
  payerName: string
  /** False when the text didn't say who paid (the owner is assumed). */
  payerSaid: boolean
  people: DescribePerson[]
  /** People the text counted but didn't name ("Netflix 649 for 4"). */
  missing: number
  /** True when the amounts given add up to the total (or there's nothing to add up yet). */
  addsUp: boolean
}

export interface DescribeViewContext {
  /** Your people, the owner included. */
  friends: readonly Friend[]
  meId: string
  /** Your default currency (used when the text named none). */
  currency: string
}

const MODE_LABELS: Readonly<Record<Exclude<SplitMode, 'items'>, string>> = {
  equal: 'Split equally',
  exact: 'Exact amounts',
  percent: 'By percentage',
  shares: 'By shares',
}

/** The people a draft names (and the payer) as a dry run of `describedToPrefill`: nobody is saved. */
function dryRun(d: DescribedSplit, ctx: DescribeViewContext) {
  const newPeople = new Map<string, Friend>()
  const prefill = describedToPrefill(d, {
    friends: ctx.friends,
    meId: ctx.meId,
    currency: ctx.currency,
    addFriend: (raw) => {
      const name = normalizeName(raw)
      const key = nameKey(name)
      const existing = newPeople.get(key)
      if (existing) return existing
      const friend: Friend = {
        id: `${NEW_PREFIX}${newPeople.size}`,
        name,
        color: (ctx.friends.length + newPeople.size) % AVATAR_COLORS,
        upiId: null,
        phone: null,
        createdAt: 0,
        lastUsedAt: 0,
      }
      newPeople.set(key, friend)
      return friend
    },
  })
  const byId = new Map<string, Friend>()
  for (const friend of ctx.friends) byId.set(friend.id, friend)
  for (const friend of newPeople.values()) byId.set(friend.id, friend)
  return { prefill, byId }
}

function personName(id: string, meId: string, byId: ReadonlyMap<string, Friend>): string {
  if (id === meId) return 'You'
  return byId.get(id)?.name ?? 'Someone'
}

function detailFor(mode: DescribeView['mode'], input: number | null, sharesVary: boolean): string | null {
  if (input === null) return null
  if (mode === 'percent') return formatBps(input)
  if (mode === 'shares' && sharesVary) return `×${input}`
  return null
}

/** The confirm card for `d`. Pure: nothing is added to your people. */
export function describeView(d: DescribedSplit, ctx: DescribeViewContext): DescribeView {
  const { prefill, byId } = dryRun(d, ctx)
  const mode = prefill.mode ?? 'equal'
  const currency = prefill.currency ?? ctx.currency
  const total = prefill.total ?? null
  const participants = prefill.participants ?? []
  const payerId = prefill.payerId ?? ctx.meId

  const split =
    total !== null && participants.length > 0
      ? splitAmount({ total, currency, mode, participants, payerId })
      : null
  const addsUp = split === null || split.ok
  const sharesVary = mode === 'shares' && new Set(participants.map((p) => p.input ?? 1)).size > 1

  const people: DescribePerson[] = participants.map(({ friendId, input }) => ({
    id: friendId,
    name: personName(friendId, ctx.meId, byId),
    avatarName: byId.get(friendId)?.name ?? personName(friendId, ctx.meId, byId),
    color: byId.get(friendId)?.color ?? 0,
    isMe: friendId === ctx.meId,
    isNew: friendId.startsWith(NEW_PREFIX),
    share: split?.ok ? (split.shares[friendId] ?? 0) : null,
    detail: detailFor(mode, input, sharesVary),
  }))

  const category = prefill.category ?? 'other'
  return {
    title: prefill.title ?? CATEGORY_META[category].label,
    category,
    currency,
    total,
    date: prefill.date ?? null,
    mode,
    modeLabel: MODE_LABELS[mode],
    payerId,
    payerName: personName(payerId, ctx.meId, byId),
    payerSaid: prefill.payerId !== undefined,
    people,
    missing: missingPeople(d),
    addsUp,
  }
}

/** "You, Riya and Sam" — the people line under the amount. */
export function peopleSummary(people: readonly Pick<DescribePerson, 'name'>[], missing: number): string {
  const names = people.map((p) => p.name)
  if (missing > 0) names.push(`${missing} more`)
  if (names.length === 0) return 'Pick who’s in on the next screen'
  if (names.length === 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`
}

/** A number phrase from a voice transcript that was turned into digits. */
export interface HeardNumber {
  /** As spoken ("ढाई हज़ार"). */
  text: string
  /** In major units ("sava sau" = 125; may end in .25/.5/.75). */
  value: number
}

/**
 * The chips under the field after speaking: `Heard “ढाई हज़ार” → ₹2,500` — with the currency
 * symbol and Indian grouping when your currency is INR, else just the grouped number.
 */
export function heardChips(heard: readonly HeardNumber[], currency: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const { text, value } of heard) {
    if (!Number.isFinite(value) || text.trim() === '') continue
    const amount =
      currency === 'INR'
        ? formatMoney(Math.round(value * 100), 'INR', { trimZeros: true })
        : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)
    const chip = t('voice.heard.chip', { phrase: text.trim(), amount })
    if (seen.has(chip)) continue
    seen.add(chip)
    out.push(chip)
  }
  return out
}
