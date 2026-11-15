import { CircleCheck, Wallet } from 'lucide-react'
import { AmountInput, BottomSheet, Button, Chip } from '../../components'
import type { Minor } from '../../domain/types'
import { useT } from '../../i18n'
import { DateField } from '../../kit/DateField'
import { formatMoney, parseMoneyInput, toInputString } from '../../lib/money'
import { payInterestFirst } from './engine'
import { earliestPaymentDate, statementOn, type LoanView } from './loans'
import styles from './Byaaj.module.css'

/** What is being typed on the sheet. Kept by the screen, so closing the sheet and opening it again loses nothing. */
export interface PaymentDraft {
  /** The amount as typed; null = not touched yet (the sheet then shows everything due that day). */
  text: string | null
  date: string
  /** Save was tried: show what is missing. */
  tried: boolean
}

export interface PaymentSheetProps {
  open: boolean
  onClose: () => void
  view: LoanView
  /** The other person's first name. */
  name: string
  today: string
  draft: PaymentDraft
  onDraft: (draft: PaymentDraft) => void
  /** Called with a payment that can be recorded (more than nothing, no more than was due that day). */
  onSave: (amount: Minor, date: string) => void
  /** For money you borrowed: opens the UPI sheet for this amount (recorded once you say it is paid). */
  onPayByUpi?: (amount: Minor, date: string) => void
}

/**
 * "Record a payment": what was paid and when. The amount starts at everything due that day; the
 * sheet shows, live, how it divides (interest first, then the amount lent) and what is left.
 */
export function PaymentSheet({ open, onClose, view, name, today, draft, onDraft, onSave, onPayByUpi }: PaymentSheetProps) {
  const t = useT()
  const { facts } = view
  const currency = facts.currency
  const money = (minor: Minor): string => formatMoney(minor, currency, { trimZeros: true })
  const on = statementOn(view, draft.date)
  const principalLeft = Math.min(on.principal, view.statement.principal)
  const due = principalLeft + on.interestDue
  const text = draft.text ?? toInputString(due, currency, { trimZeros: true })
  const amount = parseMoneyInput(text, currency)
  const parts = payInterestFirst(amount ?? 0, on.interestDue, principalLeft)
  const empty = amount === null || amount <= 0
  const tooMuch = !empty && parts.extra > 0
  const error = tooMuch ? t('byaaj.pay.error.tooMuch', { due: money(due) }) : draft.tried && empty ? t('byaaj.pay.error.empty') : undefined

  const submit = (then: (amount: Minor, date: string) => void): void => {
    if (empty || tooMuch || amount === null) {
      onDraft({ ...draft, tried: true })
      return
    }
    then(amount, draft.date)
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('byaaj.pay.title')}
      description={t(facts.lent ? 'byaaj.pay.description.lent' : 'byaaj.pay.description.borrowed', { name })}
      footer={
        <div className={styles.footer}>
          <Button block iconStart={<CircleCheck />} onClick={() => submit(onSave)}>
            {t('byaaj.pay.save')}
          </Button>
          {onPayByUpi && (
            <Button block variant="secondary" iconStart={<Wallet />} onClick={() => submit(onPayByUpi)}>
              {t('byaaj.pay.upi', { name })}
            </Button>
          )}
        </div>
      }
    >
      <div className={styles.sheet}>
        <AmountInput
          size="field"
          label={t('byaaj.pay.amount.label')}
          currency={currency}
          value={text}
          onChange={(next) => onDraft({ ...draft, text: next })}
          enterKeyHint="done"
          error={error}
        />
        <div className={styles.chips} role="group" aria-label={t('byaaj.pay.quick.aria')}>
          {on.interestDue > 0 && principalLeft > 0 && (
            <Chip size="lg" onClick={() => onDraft({ ...draft, text: toInputString(on.interestDue, currency, { trimZeros: true }) })}>
              {t('byaaj.pay.quick.interest', { amount: money(on.interestDue) })}
            </Chip>
          )}
          <Chip size="lg" onClick={() => onDraft({ ...draft, text: toInputString(due, currency, { trimZeros: true }) })}>
            {t('byaaj.pay.quick.all', { amount: money(due) })}
          </Chip>
        </div>
        <div className={styles.dateRow}>
          <span className={styles.label}>{t('byaaj.pay.date.label')}</span>
          <DateField label={t('byaaj.pay.date.label')} value={draft.date} min={earliestPaymentDate(view)} max={today} onChange={(date) => onDraft({ ...draft, date })} />
        </div>
        {!empty && !tooMuch && (
          <p className={styles.split} role="status">
            {t(parts.principal === principalLeft && parts.interest === on.interestDue ? 'byaaj.pay.split.cleared' : 'byaaj.pay.split', {
              interest: money(parts.interest),
              principal: money(parts.principal),
              left: money(due - parts.interest - parts.principal),
            })}
          </p>
        )}
      </div>
    </BottomSheet>
  )
}
