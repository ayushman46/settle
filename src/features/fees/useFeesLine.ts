import { useMemo } from 'react'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { useFees } from './store'
import { feesView, inr, statusLine } from './view'

/**
 * What Home and You say about Bank charges, by where things stand: charges to claim ("Your bank
 * owes you ₹590 · claim it back"), a claim due at the RBI Ombudsman, a claim with the bank (its 30
 * days), a charge that needs one answer — or nothing.
 */
export function useFeesLine(): { title: string; line: string; act: boolean } | null {
  const t = useT()
  const state = useFees((s) => s)
  const day = todayIso()
  return useMemo(() => {
    const view = feesView(state, day)
    if (view.owed <= 0 && view.asks.length === 0) return null
    const owedTitle = t('fees.home.owed', { amount: inr(view.owed) })
    if (view.groups.length > 0) return { title: owedTitle, line: t('fees.home.owedLine', { count: view.groups.reduce((s, g) => s + g.findings.length, 0) }), act: true }
    const live = view.claims.filter((c) => c.stage !== 'back' && c.stage !== 'dropped' && c.stage !== 'closed')
    // The claim that needs you soonest: the RBI Ombudsman's window, then one not sent yet, then one with the bank.
    const order = ['ombudsman', 'replied', 'ready', 'raised', 'ombudsmanRaised'] as const
    const next = [...live].sort((a, b) => order.indexOf(a.stage as (typeof order)[number]) - order.indexOf(b.stage as (typeof order)[number]))[0]
    if (next) {
      const waiting = next.stage === 'raised' || next.stage === 'ombudsmanRaised'
      // The amount this claim still waits for (other claims may be at other stages).
      const amount = inr(next.rest)
      const title =
        next.stage === 'raised'
          ? t('fees.home.raised', { amount })
          : next.stage === 'ombudsmanRaised'
            ? t('fees.home.ombudsmanRaised', { amount })
            : next.stage === 'ombudsman' || next.stage === 'replied'
              ? t('fees.home.ombudsmanDue', { amount })
              : t('fees.home.owed', { amount })
      return { title, line: statusLine(next, t), act: !waiting }
    }
    return { title: t('fees.home.ask', { count: view.asks.length }), line: t('fees.home.askLine'), act: true }
  }, [state, day, t])
}
