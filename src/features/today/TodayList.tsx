import { useEffect, useState } from 'react'
import { navigate } from '../../app/router'
import { Card, ListRow, Money, SectionHeader } from '../../components'
import { useExpenses, useGroups } from '../../data'
import { useT } from '../../i18n'
import type { TodayItem } from './types'
import styles from './Today.module.css'

type Source = () => Promise<(now: Date) => TodayItem[]>

/**
 * The tools that can need something from the person on a given day. Each is loaded after Home
 * has drawn (they are small, and already on the phone once the app has been opened once), and a
 * tool that fails to load is simply left out.
 */
const SOURCES: readonly Source[] = [
  () => import('../kist').then((m) => m.kistToday),
  () => import('../promise').then((m) => m.promiseToday),
  () => import('../settleday').then((m) => m.settledayToday),
  () => import('../payday').then((m) => m.paydayToday),
  () => import('../hold').then((m) => m.holdToday),
  () => import('../byaaj').then((m) => m.byaajToday),
  () => import('../tally').then((m) => m.tallyToday),
  () => import('../committee').then((m) => m.committeeToday),
  () => import('../help').then((m) => m.helpToday),
]

const SHOWN = 4

async function gather(now: Date): Promise<TodayItem[]> {
  const lists = await Promise.all(
    SOURCES.map(async (source) => {
      try {
        return (await source())(now)
      } catch {
        return []
      }
    }),
  )
  const seen = new Set<string>()
  return lists.flat().filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)))
}

/**
 * Home's Today list: what is due today across every tool (a part of a plan, a promise, a settle
 * day, payday), one row each, one tap to deal with it. Nothing due: nothing shown.
 */
export function TodayList() {
  const t = useT()
  // What is due follows the money: looked at again when an expense or a payment changes, and when the app comes back to the front.
  const expenses = useExpenses()
  const groups = useGroups()
  const [items, setItems] = useState<TodayItem[]>([])
  const [all, setAll] = useState(false)

  useEffect(() => {
    let live = true
    const look = (): void => {
      void gather(new Date()).then((found) => {
        if (live) setItems(found)
      })
    }
    look()
    const onShow = (): void => {
      if (document.visibilityState === 'visible') look()
    }
    document.addEventListener('visibilitychange', onShow)
    return () => {
      live = false
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [expenses, groups])

  if (items.length === 0) return null
  const shown = all ? items : items.slice(0, SHOWN)
  return (
    <section className={styles.section} aria-labelledby="home-today">
      <SectionHeader id="home-today" title={t('today.title')} description={t('today.subtitle', { count: items.length })} />
      <Card>
        <ul className={styles.list}>
          {shown.map((item) => (
            <li key={item.id}>
              <ListRow
                title={item.title}
                subtitle={item.body}
                trailing={item.amount !== undefined && item.amount > 0 ? <Money value={item.amount} currency={item.currency ?? 'INR'} strong trimZeros /> : undefined}
                onClick={() => navigate(item.path)}
                chevron
              />
            </li>
          ))}
        </ul>
        {items.length > SHOWN && (
          <button type="button" className={styles.more} onClick={() => setAll((v) => !v)} aria-expanded={all}>
            {all ? t('today.fewer') : t('today.all', { count: items.length })}
          </button>
        )}
      </Card>
    </section>
  )
}
