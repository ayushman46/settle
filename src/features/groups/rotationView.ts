/**
 * "Next round's on you" in words: what the group card and the rotation sheet say, and the
 * hand-off that logs the next round. Pure (names come in already resolved), so the copy and the
 * maths in `engine/rotation` are tested together to the paisa.
 */
import { useMemo } from 'react'
import { navigate } from '../../app/router'
import { setSplitPrefill, useFriendsById } from '../../data'
import type { PrefillBanner, SplitPrefill } from '../../data/handoff'
import { ME_ID, type Expense, type Group, type Minor } from '../../domain/types'
import { groupBalances, type Transfer } from '../../engine/balances'
import { outstanding, rotationPlan, suggestNextRound, usualRound, type NextRoundSuggestion, type RoundStep } from '../../engine/rotation'
import { t } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { ellipsize } from '../../share/text'
import { spendingExpenses } from './groupView'

/** Resolves a person's display name ("You" for the owner). */
export type NameOf = (id: string) => string

/** Most rounds the sheet plans before the finishing payments. */
export const MAX_PLANNED_ROUNDS = 6

/** A name short enough for the 80/160-character hand-off banner. */
const bannerName = (name: string) => ellipsize(name, 24, 48)

function moneyIn(currency: string): (minor: Minor) => string {
  return (minor) => formatMoney(minor, currency, { trimZeros: true })
}

/** "both of you" / "all 4 of you" — the owner's own sentences say "all 4". */
export function everyoneLabel(count: number, owner = false): string {
  return t(owner ? 'rotation.everyone.you' : 'rotation.everyone', { count })
}

/** The group's own-currency spending, newest first (what the usual round is the median of). */
export function roundTotals(group: Group, expenses: readonly Expense[]): Minor[] {
  return spendingExpenses(group, expenses)
    .slice()
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : b.createdAt - a.createdAt))
    .map((e) => e.total)
}

/** The automatic usual round (median of the last 10), ignoring any saved `roundSize`. */
export function automaticRound(group: Group, expenses: readonly Expense[]): Minor | null {
  return usualRound(roundTotals(group, expenses), group.currency)
}

/** The round the card and sheet use: the one saved in the sheet, else the automatic one. */
export function groupRound(group: Group, expenses: readonly Expense[]): Minor | null {
  return group.roundSize ?? automaticRound(group, expenses)
}

export interface RotationState {
  balances: Record<string, Minor>
  members: string[]
  usual: Minor | null
  /** Outstanding among current members only (the card shows when this is above 0). */
  membersOut: Minor
}

export function rotationState(group: Group, expenses: readonly Expense[]): RotationState {
  const balances = groupBalances(group, expenses)
  const members = [...group.memberIds]
  const mine: Record<string, Minor> = {}
  for (const id of members) mine[id] = balances[id] ?? 0
  return { balances, members, usual: groupRound(group, expenses), membersOut: outstanding(mine) }
}

/* ------------------------------------------------------------------ the card */

export type NextRoundCardView =
  | {
      kind: 'next'
      suggestion: NextRoundSuggestion
      title: string
      body: string
      /** "A usual round here is ₹2,400 — that settles ₹300 of the ₹1,500 the group is out." */
      usualLine: string | null
    }
  | { kind: 'left'; title: string; body: string }

/**
 * What the card says, or null when it's hidden: archived, fewer than 2 members, or the current
 * members are square. When only people who left are behind, it says to settle up instead.
 */
export function nextRoundCardView(group: Group, expenses: readonly Expense[], nameOf: NameOf): NextRoundCardView | null {
  if (group.archived || group.memberIds.length < 2) return null
  const state = rotationState(group, expenses)
  if (state.membersOut <= 0) return null
  const money = moneyIn(group.currency)
  const suggestion = suggestNextRound({
    balances: state.balances,
    candidateIds: state.members,
    sharerIds: state.members,
    currency: group.currency,
    usual: state.usual,
  })

  if (!suggestion) {
    const gone = Object.entries(state.balances).filter(([id, b]) => !group.memberIds.includes(id) && b < 0)
    if (gone.length === 0) return null
    const owed = gone.reduce((sum, [, b]) => sum - b, 0)
    const body =
      gone.length === 1
        ? t('rotation.card.left', { name: nameOf(gone[0]?.[0] ?? ''), amount: money(owed) })
        : t('rotation.card.left.many', { count: gone.length, amount: money(owed) })
    return { kind: 'left', title: t('rotation.card.left.title'), body }
  }

  const you = suggestion.payerId === ME_ID
  const name = nameOf(suggestion.payerId)
  const count = state.members.length
  const vars = {
    name,
    behind: money(suggestion.behind),
    squares: money(suggestion.squaresAt ?? suggestion.behind),
    everyone: everyoneLabel(count, you),
  }
  const fallback = suggestion.usual !== null && suggestion.usualStep === null
  const body = fallback
    ? t(you ? 'rotation.card.fallback.you' : 'rotation.card.fallback', { ...vars, everyone: everyoneLabel(count) })
    : t(you ? 'rotation.card.body.you' : 'rotation.card.body', vars)
  const step = suggestion.usualStep
  return {
    kind: 'next',
    suggestion,
    title: you ? t('rotation.card.title.you') : t('rotation.card.title', { name }),
    body,
    usualLine:
      step && suggestion.usual !== null
        ? t('rotation.card.usual', { usual: money(suggestion.usual), settles: money(step.settles), out: money(suggestion.groupOut) })
        : null,
  }
}

/** The banner on the new split: "Sam's round — Up to ₹1,600 squares Sam up. More than that and Sam is ahead." */
export function roundBanner(payerId: string, squares: Minor, currency: string, nameOf: NameOf): PrefillBanner {
  const amount = moneyIn(currency)(squares)
  if (payerId === ME_ID) {
    return { icon: 'rotate', title: t('rotation.banner.title.you'), body: t('rotation.banner.body.you', { amount }) }
  }
  const name = bannerName(nameOf(payerId))
  return { icon: 'rotate', title: t('rotation.banner.title', { name }), body: t('rotation.banner.body', { amount, name }) }
}

/** The hand-off that opens the new split for the next round: this payer, the group, everyone in, split equally. */
export function nextRoundPrefill(group: Group, payerId: string, squares: Minor, nameOf: NameOf): SplitPrefill {
  return {
    groupId: group.id,
    payerId,
    mode: 'equal',
    currency: group.currency,
    participants: group.memberIds.map((id) => ({ friendId: id, input: null })),
    source: 'manual',
    banner: roundBanner(payerId, squares, group.currency, nameOf),
  }
}

/** Where "Log the next round" goes. */
export function nextRoundPath(group: Group): string {
  return `/app/split/new?from=rotation&group=${encodeURIComponent(group.id)}`
}

/** Opens a new split for the next round: this payer, the group, everyone in, with the "Sam's round" banner. */
export function logNextRound(group: Group, payerId: string, squares: Minor, nameOf: NameOf): void {
  haptic('tap')
  setSplitPrefill(nextRoundPrefill(group, payerId, squares, nameOf))
  navigate(nextRoundPath(group))
}

/** "You" for the owner, the name you saved for everyone else (re-renders when people change). */
export function useNameOf(): NameOf {
  const friendsById = useFriendsById()
  return useMemo(() => (id: string) => friendLabel(id, friendsById[id] ?? null), [friendsById])
}

/* ------------------------------------------------------------------ the sheet */

export interface PlanRowView {
  key: string
  payerId: string
  title: string
  subtitle: string
  trailing: string
  aria: string
}

export type RotationPlanView =
  | {
      kind: 'plan'
      rows: PlanRowView[]
      /** "Everyone's square after round 2 🎉", or null when payments remain. */
      square: string | null
      /** "Then settle the last ₹900:" with the payments, when any remain. */
      leftoverLine: string | null
      finish: Transfer[]
      /** "Log round 1 with Sam paying". */
      logLabel: string
      first: RoundStep
      live: string
    }
  | { kind: 'empty'; title: string; body: string; live: string }

/** The sheet's plan for rounds of `amount` (current members share and pay; people who left settle by transfer). */
export function rotationPlanView(group: Group, expenses: readonly Expense[], amount: Minor, nameOf: NameOf): RotationPlanView {
  const money = moneyIn(group.currency)
  const state = rotationState(group, expenses)
  const plan = rotationPlan({
    balances: state.balances,
    candidateIds: state.members,
    sharerIds: state.members,
    amount,
    currency: group.currency,
    maxRounds: MAX_PLANNED_ROUNDS,
  })
  const first = plan.rounds[0]
  if (!first) {
    return {
      kind: 'empty',
      title: t('rotation.sheet.empty.title', { amount: money(amount) }),
      body: t('rotation.sheet.empty.body'),
      live: t('rotation.sheet.live.none'),
    }
  }
  const rows = plan.rounds.map((r, i): PlanRowView => {
    const n = i + 1
    const you = r.payerId === ME_ID
    const name = nameOf(r.payerId)
    const words = { n, name, before: money(r.before), after: money(r.after), amount: money(r.settles) }
    return {
      key: `${n}:${r.payerId}`,
      payerId: r.payerId,
      title: you ? t('rotation.sheet.round.title.you', { n }) : t('rotation.sheet.round.title', { n, name }),
      subtitle: t('rotation.sheet.round.subtitle', words),
      trailing: t('rotation.sheet.round.settles', { amount: money(r.settles) }),
      aria: you ? t('rotation.sheet.round.aria.you', words) : t('rotation.sheet.round.aria', words),
    }
  })
  return {
    kind: 'plan',
    rows,
    square: plan.leftover === 0 ? t('rotation.sheet.square', { n: plan.rounds.length }) : null,
    leftoverLine: plan.leftover === 0 ? null : t('rotation.sheet.leftover', { amount: money(plan.leftover) }),
    finish: plan.finish,
    logLabel: first.payerId === ME_ID ? t('rotation.sheet.log.cta.you') : t('rotation.sheet.log.cta', { name: nameOf(first.payerId) }),
    first,
    live: t('rotation.sheet.live', { count: plan.rounds.length }),
  }
}
