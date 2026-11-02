import { useMemo } from 'react'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { useFees } from './store'
import { feesView, inr } from './view'

/** What Home and You say about Bank charges: what the bank owes, what needs one answer, or nothing. */
export function useFeesLine(): { title: string; line: string; act: boolean } | null {
  const t = useT()
  const state = useFees((s) => s)
  const day = todayIso()
  return useMemo(() => {
    const view = feesView(state, day)
    if (view.owed > 0) {
      const waiting = view.groups.length === 0 && view.claims.some((c) => c.stage === 'raised')
      return {
        title: waiting ? t('fees.home.raised', { amount: inr(view.owed) }) : t('fees.home.owed', { amount: inr(view.owed) }),
        line: t('fees.home.owedLine', { count: view.owedCount }),
        act: !waiting,
      }
    }
    if (view.asks.length > 0) return { title: t('fees.home.ask', { count: view.asks.length }), line: t('fees.home.askLine'), act: true }
    return null
  }, [state, day, t])
}
