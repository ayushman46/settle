/** The group summary card: its data from a group's books, and its PNG. */
import { BRAND, ME_ID, type Expense, type Friend, type Group, type Profile } from '../../domain/types'
import { groupBalances, simplifyDebts } from '../../engine/balances'
import { t } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { outsideName } from '../names'
import { GROUP_KIND_LABELS, layoutGroupCard, type GroupCardInput, type GroupCardPerson } from './groupLayout'
import { renderScene, type ShareCardOptions } from './render'

/**
 * The card's data for a group: what it spent (in the group's currency), and the fewest payments
 * that square everyone up — with names as friends know them.
 */
export function groupCardInputFromGroup(
  group: Group,
  expenses: readonly Expense[],
  friendsById: Readonly<Record<string, Friend>>,
  profile: Profile,
): GroupCardInput {
  const own = expenses.filter((e) => e.groupId === group.id && e.currency === group.currency)
  const person = (id: string): GroupCardPerson => ({
    name: outsideName(id, friendsById, profile, id === ME_ID ? t('share.card.me') : t('share.card.friend')),
    color: friendsById[id]?.color ?? 0,
  })
  return {
    name: group.name,
    emoji: group.emoji,
    kind: group.kind,
    currency: group.currency,
    total: own.reduce((sum, e) => sum + e.total, 0),
    expenseCount: own.length,
    memberCount: new Set(group.memberIds).size,
    transfers: simplifyDebts(groupBalances(group, expenses)).map((t) => ({ from: person(t.fromId), to: person(t.toId), amount: t.amount })),
  }
}

/** Every character the group card draws, once each (see `cardCharacters`). */
export function groupCardCharacters(input: GroupCardInput): string {
  const money = (minor: number) => formatMoney(minor, input.currency, { trimZeros: true })
  const text = [
    input.name,
    input.emoji,
    GROUP_KIND_LABELS[input.kind] ?? '',
    money(input.total),
    ...input.transfers.flatMap((t) => [t.from.name, t.to.name, money(t.amount)]),
    `Total spent To settle up Everyone's settled up No payments needed people expenses more pays ${BRAND.name} ${BRAND.tagline} 0123456789 +…·`,
    // The card's own words in the UI language (Geist fetches subsets by the characters it's asked for).
    t('share.card.totalSpent'),
    t('share.card.toSettle'),
    t('share.card.settled'),
    t('share.card.settled.body'),
    t('share.card.empty'),
    t('share.card.empty.body'),
    t('share.card.people', { count: 2 }),
    t('share.card.expenses', { count: 2 }),
    t('share.card.morePayments', { count: 2 }),
    t('share.card.pays', { from: '', to: '' }),
    t('share.card.madeWith', { brand: BRAND.name }),
  ].join(' ')
  return [...new Set(Array.from(text))].join('')
}

/**
 * A 1080×1350 PNG summary of a group — total spent and who pays whom — for the group chat.
 * Rejects with `ShareCardError` if the browser can't draw it.
 */
export async function renderGroupCard(input: GroupCardInput, opts: ShareCardOptions): Promise<Blob> {
  return renderScene(groupCardCharacters(input), opts, (layoutOpts, measure) => layoutGroupCard(input, layoutOpts, measure))
}
