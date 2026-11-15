/**
 * The Android app's payment alerts, for Payday: when one is your salary arriving, the day it came
 * is noted (the day only: not the amount, not the text). After two different months agree, Home
 * offers the payday to remember. Called from Auto-settle's reader with the alerts it just read.
 */
import { toIsoDate } from '../../engine/dates'
import { UPI_APPS } from '../autosettle/alerts'
import { isSalaryAlert, type PaydayGuess } from './salary'
import { noteSalary, openGuess, paydayStore } from './store'

/** The parts of an alert this reads (`RawAlert` in src/features/autosettle/alerts.ts fits). */
export interface SalaryAlert {
  /** The Android package that posted it. */
  app?: string
  title?: string
  text: string
  /** Epoch ms. */
  postedAt: number
}

/** Notes each salary alert's day. Returns the guess now on offer, if any. Never throws, never sets a payday. */
export function noteSalaryAlerts(alerts: readonly SalaryAlert[]): PaydayGuess | null {
  try {
    for (const alert of alerts) {
      if (!Number.isFinite(alert.postedAt) || alert.postedAt <= 0) continue
      // A UPI app's own alert is a person paying you, whatever note they wrote: a payroll comes through the bank.
      if (alert.app !== undefined && alert.app in UPI_APPS) continue
      if (isSalaryAlert(alert.title ? `${alert.title}\n${alert.text}` : alert.text)) noteSalary(toIsoDate(new Date(alert.postedAt)))
    }
    return openGuess(paydayStore.get())
  } catch {
    return null
  }
}
