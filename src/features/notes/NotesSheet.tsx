import { useState } from 'react'
import { AmountInput, BottomSheet, Button } from '../../components'
import type { Minor } from '../../domain/types'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { formatMoney, parseMoneyInput, toInputString } from '../../lib/money'
import { cashPlan, LARGEST_COIN, type Pile } from './engine'
import { noteLabel, pilesText, whoIsYou } from './notesText'
import styles from './Notes.module.css'

export interface NotesSheetProps {
  /** What is being paid in cash, in paise. */
  amount: Minor
  /** Rupees only: any other currency shows nothing. */
  currency: string
  /** As shown in the app ("You", "Sam"). Leave blank for plain wording ("Give ₹1,500"). */
  payerName?: string
  receiverName?: string
  open: boolean
  onClose: () => void
  /** Lets the person type the amount in the sheet (for opening it from Tools, with no payment in hand). */
  editable?: boolean
}

const money = (minor: Minor): string => formatMoney(minor, 'INR', { trimZeros: true })

/** A row of note tiles: "₹500 ×3". Read out as words ("three ₹500 notes"). */
function Piles({ piles, label }: { piles: readonly Pile[]; label: string }) {
  const t = useT()
  return (
    <>
      <span className="visually-hidden">{label}</span>
      <ul className={styles.piles} aria-hidden="true">
        {piles.map((pile) => (
          <li key={pile.value} className={cx(styles.pile, pile.value <= LARGEST_COIN && styles.coin)}>
            <span>{noteLabel(pile.value)}</span>
            {pile.count > 1 && <span className={styles.count}>{t('notes.pile.count', { count: pile.count })}</span>}
          </li>
        ))}
      </ul>
    </>
  )
}

/**
 * Paying in cash: which notes to hand over and the change to get back, so the fewest notes are
 * counted; the exact notes if the payer has them; and a round amount when that is simpler.
 * Rupees only. Nothing to show (another currency, no amount): renders nothing.
 */
export function NotesSheet({ amount, currency, payerName = '', receiverName = '', open, onClose, editable = false }: NotesSheetProps) {
  const t = useT()
  const [text, setText] = useState(() => (amount > 0 ? toInputString(amount, 'INR', { trimZeros: true }) : ''))
  // A new amount from outside (or opening again) starts the field from it.
  const [seen, setSeen] = useState({ amount, open })
  if (seen.amount !== amount || seen.open !== open) {
    setSeen({ amount, open })
    if (open) setText(amount > 0 ? toInputString(amount, 'INR', { trimZeros: true }) : '')
  }

  if (currency !== 'INR') return null
  const typed = editable ? (parseMoneyInput(text, 'INR') ?? 0) : amount
  const plan = cashPlan(typed, currency)
  if (!plan && !editable) return null

  const who = whoIsYou(payerName, receiverName)
  const names = { who, payer: payerName, receiver: receiverName }
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('notes.sheet.title')}
      eyebrow={plan ? t('notes.sheet.eyebrow', { ...names, amount: money(plan.amount) }) : undefined}
      description={t('notes.sheet.body')}
      footer={
        <Button block onClick={onClose}>
          {t('common.action.done')}
        </Button>
      }
    >
      <div className={styles.body}>
        {editable && (
          <AmountInput
            size="field"
            label={t('notes.amount.label')}
            currency="INR"
            value={text}
            onChange={setText}
            commaGroups
            enterKeyHint="done"
          />
        )}
        {plan ? (
          <>
            <div className={styles.plan} role="status">
              <section className={styles.step}>
                <p className={styles.stepTitle}>{t('notes.give', { ...names, amount: money(plan.give) })}</p>
                <Piles piles={plan.givePiles} label={pilesText(plan.givePiles)} />
              </section>
              {plan.change > 0 ? (
                <section className={styles.step}>
                  <p className={styles.stepTitle}>{t('notes.back', { ...names, amount: money(plan.change) })}</p>
                  <Piles piles={plan.changePiles} label={pilesText(plan.changePiles)} />
                </section>
              ) : (
                <p className={styles.fine}>{t('notes.noChange')}</p>
              )}
            </div>
            {plan.exact && <p className={styles.fine}>{t('notes.exact', { piles: pilesText(plan.exact), amount: money(plan.amount) })}</p>}
            {plan.round && (
              <p className={styles.round}>
                {plan.round.change > 0
                  ? t('notes.round', {
                      to: money(plan.round.to),
                      diff: money(plan.round.diff),
                      give: t('notes.round.give', { amount: money(plan.round.give), piles: pilesText(plan.round.givePiles) }),
                      back: t('notes.round.back', { amount: money(plan.round.change), piles: pilesText(plan.round.changePiles) }),
                    })
                  : t('notes.round.exact', {
                      to: money(plan.round.to),
                      diff: money(plan.round.diff),
                      give: t('notes.round.give', { amount: money(plan.round.give), piles: pilesText(plan.round.givePiles) }),
                    })}
              </p>
            )}
            {plan.fromPaise && <p className={styles.fine}>{t('notes.paise', { amount: money(plan.amount) })}</p>}
            <p className={styles.fine}>{t('notes.fine')}</p>
          </>
        ) : (
          <p className={styles.fine} role="status">
            {t('notes.amount.empty')}
          </p>
        )}
      </div>
    </BottomSheet>
  )
}
