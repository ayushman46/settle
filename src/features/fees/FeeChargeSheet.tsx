/**
 * One charge, close up: what it was, when, how much (and its GST, and anything put back), the
 * narration as the statement or SMS printed it, the balance around it, and why it breaks a rule —
 * or that it's allowed. "It's fine" leaves it out of your claim; "Remove" drops a line Settle read
 * wrong. Both with Undo.
 */
import { BottomSheet, Button, useToast } from '../../components'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { bankName } from '../stuck/letters'
import { dismissFinding, removeCharges } from './actions'
import { findingsOf } from './rules'
import { useFees, type FeeCharge } from './store'
import { dayLabel, inr, kindLabel, RULE_REFS, signedInr, whyLine } from './view'
import styles from './Fees.module.css'

export function FeeChargeSheet({ charge, onClose }: { charge: FeeCharge | null; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const state = useFees((s) => s)
  const current = charge ? (state.charges.find((c) => c.id === charge.id) ?? charge) : null
  const finding = current ? (findingsOf(state).find((f) => f.charge.id === current.id) ?? null) : null
  const fine = (): void => {
    if (!finding) return
    const undo = dismissFinding(finding.key)
    haptic('tap')
    toast(t('fees.charge.fine.toast'), { action: { label: t('common.action.undo'), onAction: undo } })
    onClose()
  }
  const remove = (): void => {
    if (!current) return
    const undo = removeCharges([current.id])
    haptic('tap')
    toast(t('fees.charge.removed'), { action: { label: t('common.action.undo'), onAction: undo } })
    onClose()
  }
  return (
    <BottomSheet
      open={current !== null}
      onClose={onClose}
      eyebrow={current ? [dayLabel(current.date), bankName(current.bank)].filter(Boolean).join(' · ') : undefined}
      title={current ? `${kindLabel(current.kind)} · ${inr(current.amount + current.gst)}` : ''}
      description={current ? t('fees.charge.from', { source: current.source }) : undefined}
      footer={
        current && (
          <div className={styles.sheetActions}>
            {finding && (
              <Button block variant="secondary" onClick={fine}>
                {t('fees.charge.fine')}
              </Button>
            )}
            <Button block variant="ghost" onClick={remove}>
              {t('fees.charge.remove')}
            </Button>
          </div>
        )
      }
    >
      {current && (
        <div className={styles.chargeBody}>
          <dl className={styles.facts}>
            <div>
              <dt>{t('fees.charge.label.amount')}</dt>
              <dd>{t('fees.charge.amount', { amount: inr(current.amount + current.gst), gst: current.gst > 0 ? inr(current.gst) : 'none' })}</dd>
            </div>
            {current.reversed > 0 && (
              <div>
                <dt>{t('fees.charge.label.back')}</dt>
                <dd>{t('fees.charge.back', { amount: inr(current.reversed) })}</dd>
              </div>
            )}
            {current.balanceAfter !== null && current.balanceBefore !== null && (
              <div>
                <dt>{t('fees.charge.label.balance')}</dt>
                <dd>{t('fees.charge.balance', { before: signedInr(current.balanceBefore), after: signedInr(current.balanceAfter) })}</dd>
              </div>
            )}
          </dl>
          {current.text && (
            <div className={styles.narration}>
              <p className={styles.fine}>{t('fees.charge.text')}</p>
              <p className={styles.mono} lang="en">
                {current.text}
              </p>
            </div>
          )}
          {finding ? (
            <div className={styles.verdict}>
              <p className={styles.why}>{whyLine(finding)}</p>
              {finding.also.map((a) => (
                <p key={a.rule} className={styles.why}>
                  {whyLine({ ...finding, rule: a.rule, facts: a.facts })}
                </p>
              ))}
              <p className={styles.ref}>{t('fees.rule.source', { ref: RULE_REFS[finding.rule] })}</p>
            </div>
          ) : (
            <p className={styles.fine}>{t('fees.charge.ok')}</p>
          )}
        </div>
      )}
    </BottomSheet>
  )
}
