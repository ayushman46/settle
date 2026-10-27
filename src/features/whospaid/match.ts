/**
 * "Who's paid?": matching the payments a collector received (from their UPI app's history, bank
 * statement or SMS) to what people owe them — so one import ticks off everyone who paid.
 *
 * Every pair of payment × due is scored on evidence: a bank name confirmed before (+60), the
 * payer's UPI ID (+60, or +35 for a masked one ending in their phone's digits), their name
 * (+40 strong, "RIYA SHA" ~ Riya Sharma; +25 initials; −40 a different person), the amount (+40
 * to the paisa, +30 within ₹1), and being the only person who owes that much (+20). A strong name
 * on someone else who owes the same is −80. Pairs are assigned greedily, best first, one payment
 * to one due. 90+ with a clear margin is ticked for you; 60+ asks with one tap; the rest stays
 * unmatched. Names in bank records are bank (CBS) names, never nicknames: confirming one teaches
 * Settle that "KARAN MALHOTRA" is Bunty.
 */
import type { Minor } from '../../domain/types'

/** Money a payment may differ by and still be the same as what's owed: ₹1. */
export const AMOUNT_TOLERANCE: Minor = 100
/** Most of one person's dues tried together for "paid several splits at once". */
const MAX_SUBSET = 6
export const MATCHED_SCORE = 90
export const CHECK_SCORE = 60
const MARGIN = 30

export type CreditSource = 'screenshot' | 'statement' | 'sms' | 'alert'

/** One payment received, from any source. */
export interface Credit {
  id: string
  source: CreditSource
  /** Paise. */
  amount: Minor
  /** YYYY-MM-DD, or null when not printed. */
  date: string | null
  /** The payer as printed (a bank name, often in capitals). */
  name: string | null
  /** Other pieces of the record that may be the name (a narration's text parts), tried too. */
  otherNames?: readonly string[]
  /** The payer's UPI ID as printed, possibly masked ("******4821@ybl"). */
  vpa: string | null
  /** The 12-digit UPI reference, when printed. */
  utr: string | null
  status: 'success' | 'pending' | 'failed' | 'unknown'
  /** Received for sure: a word, sign or column said so (not just a colour). */
  sure: boolean
}

/** One thing someone owes the collector: what's left of their share of a split, or what they owe in a group. */
export interface Due {
  /** `${expenseId}:${friendId}`, or `group:${groupId}:${friendId}`. */
  id: string
  /** The split ('' for a group). */
  expenseId: string
  /** The group whose balances it is (settled by recording a payment there), or null for a split. */
  groupId: string | null
  friendId: string
  /** Paise. */
  amount: Minor
  title: string
  /** YYYY-MM-DD the split happened. */
  since: string
}

export interface Payer {
  friendId: string
  name: string
  upiId: string | null
  phone: string | null
  /** Bank names confirmed as this person before (`nameKey`s). */
  aliases: readonly string[]
}

export type NameFit = 'alias' | 'strong' | 'initials' | 'surname' | 'unknown' | 'conflict'
export type OptionKind = 'exact' | 'several' | 'part' | 'over'
export type Reason = 'alias' | 'upi' | 'upiMasked' | 'upiName' | 'name' | 'initials' | 'amount' | 'unique' | 'several' | 'part' | 'over'

/** One way to read a payment: who it's from and which of their dues it settles. */
export interface MatchOption {
  key: string
  friendId: string
  dues: Due[]
  kind: OptionKind
  score: number
  reasons: Reason[]
  /** The payment's printed name isn't known as this person yet: confirming it teaches Settle. */
  learnName: string | null
}

export type Tier = 'matched' | 'check' | 'unmatched' | 'unconfirmed' | 'known'

export interface Proposal {
  credit: Credit
  tier: Tier
  /** Best first. A matched row has its first option ticked; a check row asks which (or none). */
  options: MatchOption[]
}

export interface MatchResult {
  proposals: Proposal[]
  /** Payments that settled a due, ticked for you. */
  matched: number
}

/** Latin letters, lower case, as words: "R. SHARMA" → ["r", "sharma"]. Diacritics dropped. */
export function nameWords(text: string): string[] {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0)
}

/** How a printed name is remembered: its words, lower case. */
export function nameKey(text: string): string {
  return nameWords(text).join(' ')
}

const latin = (words: readonly string[]) => words.length > 0 && words.every((w) => /^[a-z]+$/.test(w))
const prefixed = (a: string, b: string) => a.startsWith(b) || b.startsWith(a)

/** How well a printed (bank) name fits a person. */
export function nameFit(printed: string | null, payer: Pick<Payer, 'name' | 'aliases'>): NameFit {
  if (printed === null) return 'unknown'
  const key = nameKey(printed)
  if (key === '') return 'unknown'
  if (payer.aliases.includes(key)) return 'alias'
  const a = nameWords(printed)
  const b = nameWords(payer.name)
  // Different scripts ("RIYA SHARMA" vs "रिया"): the names can't be compared.
  if (!latin(a) || !latin(b)) return 'unknown'
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  const firstA = a[0] ?? ''
  const firstB = b[0] ?? ''
  // "Riya" ~ "RIYA SHARMA"; "RIYA SHA" ~ "Riya Sharma" (banks cut names short).
  if (firstA.length >= 2 && firstB.length >= 2 && prefixed(firstA, firstB) && short.every((w) => long.some((u) => w === u || (Math.min(w.length, u.length) >= 2 && prefixed(w, u))))) {
    return 'strong'
  }
  // "R SHARMA" ~ "Riya Sharma".
  const initials = (x: string[], y: string[]) =>
    x.length >= 2 && (x[0] ?? '').length === 1 && (y[0] ?? '').startsWith(x[0] ?? '') && x.slice(1).every((w) => y.slice(1).some((u) => prefixed(w, u)))
  if (initials(a, b) || initials(b, a)) return 'initials'
  // Family pays: only a surname in common says nothing either way.
  if (a.some((w) => w.length >= 3 && b.includes(w))) return 'surname'
  return 'conflict'
}

const NAME_SCORE: Record<NameFit, number> = { alias: 60, strong: 40, initials: 25, surname: 0, unknown: 0, conflict: -40 }

/** "******4821@ybl" → { last4: "4821", handle: "ybl" }; null for an unmasked ID. */
function masked(vpa: string): { last4: string; handle: string } | null {
  const match = /^\*+(\d{4})@([a-z0-9.-]+)$/i.exec(vpa.trim())
  return match ? { last4: match[1] ?? '', handle: (match[2] ?? '').toLowerCase() } : null
}

/** How sure we are a payment is from `payer`, and why. */
export function identity(credit: Pick<Credit, 'name' | 'otherNames' | 'vpa'>, payer: Payer): { score: number; reasons: Reason[]; fit: NameFit } {
  // The best of the name and the record's other text pieces (a narration may list a note before the name).
  const candidates = [credit.name, ...(credit.otherNames ?? [])].filter((c): c is string => c !== null)
  const fits = candidates.length > 0 ? candidates.map((c) => nameFit(c, payer)) : ['unknown' as NameFit]
  const fit = fits.reduce((best, f) => (NAME_SCORE[f] > NAME_SCORE[best] ? f : best))
  let score = NAME_SCORE[fit]
  const reasons: Reason[] = fit === 'alias' ? ['alias'] : fit === 'strong' ? ['name'] : fit === 'initials' ? ['initials'] : []
  const vpa = credit.vpa?.trim().toLowerCase() ?? ''
  if (vpa !== '') {
    const hidden = masked(vpa)
    if (!hidden && payer.upiId && vpa === payer.upiId.trim().toLowerCase()) {
      score = Math.max(score, 60)
      reasons.unshift('upi')
    } else if (hidden) {
      const phone = (payer.phone ?? '').replace(/\D/g, '')
      const own = payer.upiId?.trim().toLowerCase() ?? ''
      const sameId = own.endsWith(`@${hidden.handle}`) && own.split('@')[0]?.replace(/\D/g, '').endsWith(hidden.last4)
      if ((phone.length >= 4 && phone.endsWith(hidden.last4)) || sameId) {
        score = Math.max(score, 35)
        reasons.unshift('upiMasked')
      }
    } else if (score < 25) {
      // "riya.s@okhdfcbank" for Riya: the ID's name part, when the bank's name isn't printed (ICICI).
      const local = nameWords(vpa.split('@')[0]?.replace(/[._\d-]+/g, ' ') ?? '')[0] ?? ''
      const first = nameWords(payer.name)[0] ?? ''
      if (local.length >= 3 && first.length >= 3 && prefixed(local, first)) {
        score = 25
        reasons.unshift('upiName')
      }
    }
  }
  return { score, reasons, fit }
}

/** Days from `a` to `b` (YYYY-MM-DD). */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/** Subsets of `dues` (2…MAX_SUBSET of them) adding up to `amount` within ₹1, smallest first. */
function subsetsFor(dues: readonly Due[], amount: Minor): Due[][] {
  const pool = dues.slice(0, MAX_SUBSET)
  const out: Due[][] = []
  for (let mask = 1; mask < 1 << pool.length; mask++) {
    const picked = pool.filter((_, i) => mask & (1 << i))
    if (picked.length < 2) continue
    const sum = picked.reduce((total, d) => total + d.amount, 0)
    if (Math.abs(sum - amount) <= AMOUNT_TOLERANCE) out.push(picked)
  }
  return out.sort((x, y) => x.length - y.length)
}

/** Every reading of `credit`, scored. */
function optionsFor(credit: Credit, dues: readonly Due[], payers: ReadonlyMap<string, Payer>): MatchOption[] {
  const usable = dues.filter((d) => credit.date === null || daysBetween(d.since, credit.date) >= -3)
  const ids = new Map<string, ReturnType<typeof identity>>()
  const who = (friendId: string) => {
    let id = ids.get(friendId)
    if (!id) {
      const payer = payers.get(friendId)
      id = payer ? identity(credit, payer) : { score: 0, reasons: [], fit: 'unknown' as NameFit }
      ids.set(friendId, id)
    }
    return id
  }
  const fits = (d: Due) => Math.abs(d.amount - credit.amount) <= AMOUNT_TOLERANCE
  const amountFits = usable.filter(fits)
  const options: MatchOption[] = []
  const learn = (friendId: string) => {
    const fit = who(friendId).fit
    return credit.name !== null && fit !== 'alias' && fit !== 'strong' && nameKey(credit.name) !== '' ? credit.name : null
  }

  // One due, the amount it is.
  for (const due of amountFits) {
    const id = who(due.friendId)
    const reasons: Reason[] = [...id.reasons, 'amount']
    let score = id.score + (due.amount === credit.amount ? 40 : 30)
    const others = amountFits.filter((d) => d.friendId !== due.friendId)
    if (others.every((d) => who(d.friendId).score < 0)) {
      score += 20
      reasons.push('unique')
    }
    if (id.score < 40 && others.some((d) => who(d.friendId).score >= 40)) score -= 80
    if (credit.date !== null) {
      const days = daysBetween(due.since, credit.date)
      if (days >= 0 && days <= 14) score += 5
    }
    options.push({ key: due.id, friendId: due.friendId, dues: [due], kind: 'exact', score, reasons, learnName: learn(due.friendId) })
  }

  // Several of one person's dues at once, or part of one, or a little more than one.
  const byFriend = new Map<string, Due[]>()
  for (const due of usable) byFriend.set(due.friendId, [...(byFriend.get(due.friendId) ?? []), due])
  for (const [friendId, theirs] of byFriend) {
    const id = who(friendId)
    if (id.score >= 40 && theirs.length >= 2) {
      const total = theirs.reduce((sum, d) => sum + d.amount, 0)
      for (const subset of subsetsFor(theirs, credit.amount).slice(0, 3)) {
        const all = subset.length === theirs.length || Math.abs(total - credit.amount) <= AMOUNT_TOLERANCE
        options.push({
          key: subset.map((d) => d.id).join('+'),
          friendId,
          dues: subset,
          kind: 'several',
          score: id.score + 30 + (all ? 20 : 0),
          reasons: [...id.reasons, 'several'],
          learnName: learn(friendId),
        })
      }
    }
    if (amountFits.some((d) => d.friendId === friendId)) continue
    const oldest = [...theirs].sort((x, y) => x.since.localeCompare(y.since))
    const under = oldest.find((d) => credit.amount < d.amount - AMOUNT_TOLERANCE)
    if (id.score >= 25 && under) {
      options.push({ key: `${under.id}~part`, friendId, dues: [under], kind: 'part', score: id.score + 20, reasons: [...id.reasons, 'part'], learnName: learn(friendId) })
    }
    const over = oldest.find((d) => credit.amount > d.amount + AMOUNT_TOLERANCE)
    if (id.score >= 40 && over && !options.some((o) => o.friendId === friendId && o.kind === 'several')) {
      options.push({ key: `${over.id}~over`, friendId, dues: [over], kind: 'over', score: id.score + 20, reasons: [...id.reasons, 'over'], learnName: learn(friendId) })
    }
  }
  return options.sort((x, y) => y.score - x.score || x.dues.length - y.dues.length)
}

/**
 * Matches `credits` to `dues`. `knownRefs` are UPI references already marked (they're skipped).
 * Each due is settled by at most one payment, each payment settles at most one option.
 */
export function matchPayments(credits: readonly Credit[], dues: readonly Due[], payers: readonly Payer[], knownRefs: ReadonlySet<string> = new Set()): MatchResult {
  const byId = new Map(payers.map((p) => [p.friendId, p]))
  const proposals = new Map<string, Proposal>()
  const seenRefs = new Set<string>()
  const live: Credit[] = []
  for (const credit of credits) {
    if (credit.utr && (knownRefs.has(credit.utr) || seenRefs.has(credit.utr))) {
      proposals.set(credit.id, { credit, tier: 'known', options: [] })
      continue
    }
    if (credit.utr) seenRefs.add(credit.utr)
    if (credit.status !== 'success') {
      proposals.set(credit.id, { credit, tier: 'unconfirmed', options: [] })
      continue
    }
    live.push(credit)
  }

  const all = new Map(live.map((c) => [c.id, optionsFor(c, dues, byId)]))
  // Best first across every payment; a due (or payment) goes to the first that claims it.
  const pairs = [...all].flatMap(([creditId, options]) => options.map((option) => ({ creditId, option })))
  pairs.sort((x, y) => y.option.score - x.option.score)
  const usedDues = new Set<string>()
  const chosen = new Map<string, MatchOption>()
  for (const { creditId, option } of pairs) {
    if (chosen.has(creditId) || option.dues.some((d) => usedDues.has(d.id)) || option.score < CHECK_SCORE) continue
    chosen.set(creditId, option)
    for (const due of option.dues) usedDues.add(due.id)
  }

  let matched = 0
  for (const credit of live) {
    const options = all.get(credit.id) ?? []
    const pick = chosen.get(credit.id)
    if (!pick) {
      // Unmatched — but say who it could be, when the amount fits someone who still owes.
      const hints = options.filter((o) => o.kind === 'exact' && !o.dues.some((d) => usedDues.has(d.id)) && o.score > 0).slice(0, 3)
      proposals.set(credit.id, { credit, tier: 'unmatched', options: hints })
      continue
    }
    const rivalForCredit = options.find((o) => o.key !== pick.key && o.friendId !== pick.friendId)?.score ?? Number.NEGATIVE_INFINITY
    const rivalForDue = Math.max(
      Number.NEGATIVE_INFINITY,
      ...[...all]
        .filter(([id]) => id !== credit.id)
        .flatMap(([, opts]) => opts.filter((o) => o.dues.some((d) => pick.dues.some((p) => p.id === d.id))).map((o) => o.score)),
    )
    const clear = pick.score - rivalForCredit >= MARGIN && pick.score - rivalForDue >= MARGIN
    const sure = credit.sure && pick.score >= MATCHED_SCORE && clear && (pick.kind === 'exact' || (pick.kind === 'several' && pick.score >= MATCHED_SCORE))
    // Alternatives for a check row: the pick first, then other people it could be.
    const alternatives = [pick, ...options.filter((o) => o.key !== pick.key && o.score > 0 && !o.dues.some((d) => usedDues.has(d.id)))].slice(0, 4)
    proposals.set(credit.id, { credit, tier: sure ? 'matched' : 'check', options: alternatives })
    if (sure) matched++
  }
  return { proposals: credits.map((c) => proposals.get(c.id)).filter((p): p is Proposal => p !== undefined), matched }
}
