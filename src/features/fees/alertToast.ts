/**
 * What the Android app says when it has just read a bank's SMS about a charge: that it breaks a
 * rule and can be claimed back, that one answer settles it, or that a charge was put back. A charge
 * that's allowed is kept quietly (it's in Bank charges, with the others).
 */
import type { useT } from '../../i18n'
import { bankName } from '../stuck/letters'
import { findingsOf } from './rules'
import { feesStore } from './store'
import type { TrackResult } from './track'
import { inr, kindLabel } from './view'

type Translate = ReturnType<typeof useT>

/** The toast for charges just read, or null when there's nothing worth saying. */
export function feeToastMessage(result: Pick<TrackResult, 'added' | 'reversed'>, t: Translate): { text: string; good: boolean } | null {
  const findings = findingsOf(feesStore.get())
  const flagged = result.added.map((c) => findings.find((f) => f.charge.id === c.id)).filter((f) => f !== undefined)
  if (flagged.length > 1) return { text: t('fees.alert.many', { count: flagged.length }), good: false }
  const [f] = flagged
  if (f) {
    const bank = bankName(f.charge.bank)
    const vars = { amount: inr(f.charge.amount + f.charge.gst), kind: kindLabel(f.charge.kind) }
    if (f.verdict === 'wrong') return { text: bank ? t('fees.alert.wrong', { ...vars, bank }) : t('fees.alert.wrongAny', vars), good: false }
    return { text: bank ? t('fees.alert.check', { ...vars, bank }) : t('fees.alert.checkAny', vars), good: false }
  }
  if (result.reversed > 0) {
    const last = feesStore.get().charges.filter((c) => c.reversed > 0).sort((a, b) => b.addedAt - a.addedAt)[0]
    return last ? { text: t('fees.alert.back', { amount: inr(last.reversed) }), good: true } : null
  }
  return null
}
