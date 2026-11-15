/** Payday in words: "the 1st", "Last day", and the one-line hint for someone who owes you. */
import { isIsoDate } from '../../engine/dates'
import { t } from '../../i18n'
import { ordinal, shortDate } from '../recurring/recurringLabels'
import { bestAsk, type AskDay, type Payday } from './engine'

/** In a sentence: "the 7th", "the last day of the month", "the last working day of the month". */
export function paydayLabel(payday: Payday): string {
  if (payday === 'last') return t('payday.value.last')
  if (payday === 'lastWorking') return t('payday.value.lastWorking')
  return t('payday.value.day', { day: ordinal(payday) })
}

/** On a chip: "7th", "Last day", "Last working day". */
export function paydayChipLabel(payday: Payday): string {
  if (payday === 'last') return t('payday.chip.last')
  if (payday === 'lastWorking') return t('payday.chip.lastWorking')
  return ordinal(payday)
}

/** A date's day of the month in a sentence: `2026-12-02` → "the 2nd". */
export function dayOfMonthLabel(iso: string): string {
  return isIsoDate(iso) ? t('payday.value.day', { day: ordinal(Number(iso.slice(8, 10))) }) : iso
}

/**
 * The hint for a To collect row: "Gets paid on the 1st: best to ask on the 2nd", "Payday is
 * today: best to ask tomorrow", "Payday was yesterday: a good day to ask". Null when their payday
 * isn't known or the day to ask is more than 10 days away. The days are the real ones that month
 * (a payday on the 31st reads "the 30th" in November).
 */
export function askHint(payday: Payday | null | undefined, today: string): string | null {
  const ask = bestAsk(payday, today)
  if (!ask) return null
  if (ask.inDays === 0) return t('payday.hint.yesterday')
  if (ask.inDays === 1) return t('payday.hint.today')
  return t('payday.hint.upcoming', { payday: dayOfMonthLabel(ask.paidOn), ask: dayOfMonthLabel(ask.askOn) })
}

/** "Who to ask when", one person: the headline ("Ask on 2 Dec") and why ("Gets paid on the 1st"). */
export function askWords(ask: AskDay | null): { when: string; why: string } {
  if (!ask) return { when: t('payday.ask.unknown'), why: t('payday.ask.unknown.body') }
  if (ask.inDays === 0) return { when: t('payday.ask.today'), why: t('payday.ask.today.body') }
  if (ask.inDays === 1) return { when: t('payday.ask.tomorrow'), why: t('payday.ask.tomorrow.body') }
  return { when: t('payday.ask.on', { date: shortDate(ask.askOn) }), why: t('payday.ask.on.body', { payday: dayOfMonthLabel(ask.paidOn) }) }
}

/** "30 Oct and 30 Nov", "30 Sep, 30 Oct and 30 Nov". */
export function dayList(days: readonly string[]): string {
  const labels = days.map(shortDate)
  const last = labels.at(-1)
  if (last === undefined) return ''
  if (labels.length === 1) return last
  const first = labels.slice(0, -1).join(t('payday.guess.days.sep'))
  return t('payday.guess.days.and', { first, last })
}
