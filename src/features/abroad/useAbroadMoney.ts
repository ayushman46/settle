import { useMemo } from 'react'
import { useRate } from '../../api/rates'
import { useExpenses, useGroups, useProfile } from '../../data'
import { ME_ID, type Minor } from '../../domain/types'
import { today } from '../../engine/dates'
import { friendBalance } from '../friends/friendBalance'
import type { RateInfo } from './abroadText'
import { abroadView, type AbroadSetup, type AbroadView } from './engine'

/** Where the rate stands: not needed (same currency, or nothing owed), on its way, there, or why not. */
export type RateStatus = 'unneeded' | 'loading' | 'ok' | 'not_covered' | 'offline' | 'error'

export interface AbroadMoney {
  view: AbroadView
  rate: RateInfo | null
  rateStatus: RateStatus
  /** Money open between you in other currencies than the one shown. */
  others: Array<{ currency: string; amount: Minor }>
}

/**
 * What is open between you and a friend abroad, in the app's own balances, and in their currency
 * at today's reference rate (from the phone's saved rates when offline). Your own currency's due
 * is shown first; failing that, one already in theirs; failing that, whatever is open.
 */
export function useAbroadMoney(friendId: string, setup: AbroadSetup | null): AbroadMoney {
  const profile = useProfile()
  const expenses = useExpenses()
  const groups = useGroups()
  const totals = useMemo(
    () => (friendId === ME_ID ? [] : friendBalance(friendId, expenses, groups, profile.currency).totals),
    [friendId, expenses, groups, profile.currency],
  )
  const theirCurrency = setup?.currency ?? profile.currency
  const picked =
    totals.find((total) => total.currency === profile.currency) ?? totals.find((total) => total.currency === theirCurrency) ?? totals[0] ?? null
  const currency = picked?.currency ?? profile.currency
  const net = picked?.amount ?? 0
  const needed = setup !== null && net !== 0 && currency !== theirCurrency
  const state = useRate(needed ? currency : null, theirCurrency, today())

  return useMemo(() => {
    const rate: RateInfo | null = state?.status === 'ok' ? { rate: state.rate, rateDate: state.rateDate, stale: state.stale } : null
    const rateStatus: RateStatus = !needed
      ? 'unneeded'
      : state === null || state.status === 'loading'
        ? 'loading'
        : state.status === 'ok'
          ? 'ok'
          : state.reason === 'not_covered'
            ? 'not_covered'
            : state.reason === 'offline'
              ? 'offline'
              : 'error'
    return {
      view: abroadView(net, currency, theirCurrency, rate?.rate ?? null),
      rate,
      rateStatus,
      others: totals.filter((total) => total.currency !== currency).map((total) => ({ currency: total.currency, amount: Math.abs(total.amount) })),
    }
  }, [state, needed, net, currency, theirCurrency, totals])
}
