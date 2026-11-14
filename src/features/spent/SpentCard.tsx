import { useMemo, useState } from 'react'
import { BellRing } from 'lucide-react'
import { navigate } from '../../app/router'
import { Button, Card, useToast } from '../../components'
import { setSplitPrefill, useExpenses, useGroups } from '../../data'
import { ME_ID, type Group } from '../../domain/types'
import { categoryFromText } from '../../engine/categories'
import { addDays, toIsoDate, today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { relativeDateLabel } from '../../kit/dateLabel'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { dropSpend, useSpends, type Spend } from './spent'
import styles from './Spent.module.css'

/** A group counts as "the one you're in" when something was added to it this recently. */
const ACTIVE_DAYS = 3

/** The group you're most likely spending with right now: the one with the newest expense, if it's recent. */
export function activeGroup(groups: readonly Group[], expenses: ReadonlyArray<{ groupId: string | null; date: string }>, today: string): Group | null {
  const since = addDays(today, -ACTIVE_DAYS)
  let best: { group: Group; date: string } | null = null
  for (const e of expenses) {
    if (!e.groupId || e.date < since || e.date > today) continue
    const group = groups.find((g) => g.id === e.groupId && !g.archived && g.currency === 'INR')
    if (group && (!best || e.date > best.date)) best = { group, date: e.date }
  }
  return best?.group ?? null
}

/**
 * Home's "Split this?" card: a payment the phone saw you make, ready to split in one tap (with
 * the group you're spending with, when there is one). Nothing to show, nothing rendered.
 */
export function SpentCard() {
  const t = useT()
  const toast = useToast()
  const spends = useSpends()
  const groups = useGroups()
  const expenses = useExpenses()
  const [all, setAll] = useState(false)
  const today = todayIso()
  const group = useMemo(() => activeGroup(groups, expenses, today), [groups, expenses, today])
  if (spends.length === 0) return null
  const shown = all ? spends : spends.slice(0, 1)
  const money = (paise: number): string => formatMoney(paise, 'INR', { trimZeros: true })

  const split = (spend: Spend, into: Group | null): void => {
    const title = spend.to ?? t('spent.title.fallback')
    setSplitPrefill({
      title,
      category: categoryFromText(title) ?? 'other',
      total: spend.amount,
      currency: 'INR',
      date: toIsoDate(new Date(spend.at)),
      payerId: ME_ID,
      mode: 'equal',
      participants: (into ? into.memberIds : [ME_ID]).map((friendId) => ({ friendId, input: null })),
      groupId: into?.id ?? null,
      source: 'sms',
      banner: { icon: 'wallet', title: t('spent.banner.title'), body: t('spent.banner.body') },
    })
    dropSpend(spend.id)
    haptic('tap')
    navigate(`/app/split/new?from=sms${into ? `&group=${encodeURIComponent(into.id)}` : ''}`)
  }

  const mine = (spend: Spend): void => {
    const undo = dropSpend(spend.id)
    toast(t('spent.mine.toast'), { action: { label: t('common.action.undo'), onAction: undo } })
  }

  return (
    <Card className={styles.card} aria-label={t('spent.aria')}>
      <p className={styles.eyebrow}>
        <BellRing aria-hidden="true" />
        {t('spent.eyebrow')}
      </p>
      <ul className={styles.list}>
        {shown.map((spend) => (
          <li key={spend.id} className={styles.item}>
            <p className={styles.title}>{spend.to ? t('spent.line', { amount: money(spend.amount), name: spend.to }) : t('spent.line.noName', { amount: money(spend.amount) })}</p>
            <p className={styles.fine}>{t('spent.when', { date: relativeDateLabel(toIsoDate(new Date(spend.at)), today) })}</p>
            <div className={styles.actions}>
              {group ? (
                <>
                  <Button size="sm" onClick={() => split(spend, group)}>
                    {t('spent.split.group', { group: group.name })}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => split(spend, null)}>
                    {t('spent.split.other')}
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => split(spend, null)}>
                  {t('spent.split')}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => mine(spend)}>
                {t('spent.mine')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {spends.length > 1 && !all && (
        <Button size="sm" variant="ghost" onClick={() => setAll(true)}>
          {t('spent.more', { count: spends.length - 1 })}
        </Button>
      )}
    </Card>
  )
}
