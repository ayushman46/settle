import { memo, useMemo } from 'react'
import { ChevronRight, PiggyBank } from 'lucide-react'
import { useExpenses, useFriendsById, useGroup } from '../../data'
import { ME_ID, type Group } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/index-a'
import { formatMoney } from '../../lib/money'
import { kittyView } from './engine'
import { withoutFamilyPayments } from './family'
import { lastsLabel } from './kittyText'
import { useKittyConfig } from './store'
import styles from './Kitty.module.css'

/**
 * A running kitty, above the group's expenses: "Kitty with Riya: ₹2,600 left of ₹6,000 · lasts
 * till Sat", with a bar, turning to a warning when it runs out within a day. Tapping opens the
 * kitty. Null when the group has no kitty (or can't have one).
 */
export const KittyCard = memo(function KittyCard({ group: given, onOpen }: { group: Group; onOpen: () => void }) {
  const t = useT()
  const group = useGroup(given.id) ?? given
  const config = useKittyConfig(group.id)
  const expenses = useExpenses({ groupId: group.id })
  const friendsById = useFriendsById()
  const day = todayIso()
  const view = useMemo(() => (config ? kittyView(withoutFamilyPayments(group), expenses, config, day) : null), [config, group, expenses, day])
  if (!view || group.archived || group.memberIds.length < 2) return null

  const money = (paise: number): string => formatMoney(paise, group.currency, { trimZeros: true })
  const title = view.holderId === ME_ID ? t('kitty.card.title.you') : t('kitty.card.title', { name: friendLabel(view.holderId, friendsById[view.holderId] ?? null) })
  const low = view.daysLeft !== null && view.daysLeft <= 1
  const out = view.daysLeft === 0 && view.left === 0

  let line: string
  if (view.fromOthers === 0) {
    line = t('kitty.card.collecting', { done: view.doneCount, count: view.othersCount, amount: money(view.perHead) })
  } else {
    const parts = [t('kitty.card.left', { left: money(view.left), total: money(view.fromOthers) })]
    if (out) parts.push(t('kitty.card.out'))
    else if (view.runsOutOn !== null) {
      const label = lastsLabel(view.runsOutOn, day)
      parts.push(t('kitty.card.lasts', { date: view.daysLeft !== null && view.daysLeft <= 1 ? label.toLowerCase() : label }))
    }
    line = parts.join(' · ')
  }
  const share = view.fromOthers === 0 ? (view.othersCount > 0 ? view.doneCount / view.othersCount : 0) : Math.min(1, view.left / view.fromOthers)
  const percent = Math.round(share * 100)

  return (
    <button type="button" className={styles.card} data-low={low || undefined} onClick={onOpen} aria-label={`${title}: ${line}. ${t('kitty.card.open')}`}>
      <PiggyBank aria-hidden="true" className={styles.cardIcon} />
      <span className={styles.cardText}>
        <span className={styles.cardTitle}>{title}</span>
        <span className={styles.cardLine}>{line}</span>
        <span className={styles.meter} aria-hidden="true" data-percent={percent}>
          <span style={{ width: `${percent}%` }} />
        </span>
      </span>
      <ChevronRight aria-hidden="true" className={styles.chevron} />
    </button>
  )
})
