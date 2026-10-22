import { useState } from 'react'
import { ArrowRight, Banknote, CircleEllipsis, Smartphone } from 'lucide-react'
import { BottomSheet, Button, SegmentedControl, type SegmentedOption } from '../../components'
import { useFriendsById } from '../../data'
import type { Minor, Settlement } from '../../domain/types'
import { today } from '../../engine/dates'
import type { Transfer } from '../../engine/balances'
import { AmountHero, DateField, FriendAvatar, friendLabel, friendObjectLabel } from '../../kit/index-a'
import { cx } from '../../lib/cx'
import { formatMoney } from '../../lib/money'
import { paymentSentence } from './groupView'
import styles from './RecordPaymentSheet.module.css'

export type PaymentMethod = Settlement['method']

const METHOD_OPTIONS: ReadonlyArray<SegmentedOption<PaymentMethod>> = [
  { value: 'upi', label: 'UPI', icon: <Smartphone /> },
  { value: 'cash', label: 'Cash', icon: <Banknote /> },
  { value: 'other', label: 'Other', icon: <CircleEllipsis /> },
]

export interface RecordedPayment {
  amount: Minor
  method: PaymentMethod
  date: string
}

export interface RecordPaymentSheetProps {
  /** The suggested payment to record; null closes the sheet. */
  transfer: Transfer | null
  currency: string
  onClose: () => void
  onRecord: (transfer: Transfer, payment: RecordedPayment) => void
}

interface Form {
  amount: Minor | null
  method: PaymentMethod
  date: string
}

function freshForm(transfer: Transfer, currency: string): Form {
  return { amount: transfer.amount, method: currency === 'INR' ? 'upi' : 'cash', date: today() }
}

/** How the typed amount compares with what's owed, in words (null for the full amount). */
function amountNote(amount: Minor | null, owed: Minor, currency: string): string | null {
  if (amount === null || amount <= 0) return 'Enter what was paid.'
  const money = (minor: Minor) => formatMoney(minor, currency, { trimZeros: true })
  if (amount < owed) return `Part payment — ${money(owed - amount)} still to go.`
  if (amount > owed) return `${money(amount - owed)} more than owed — that much will be owed back.`
  return null
}

/**
 * "Sam paid Riya" — records money that changed hands for a settle-up payment: the amount (the
 * full one to start with; less for a part payment), how it was paid and when.
 */
export function RecordPaymentSheet({ transfer, currency, onClose, onRecord }: RecordPaymentSheetProps) {
  const friendsById = useFriendsById()
  // Keeps the last payment on show while the sheet slides away; a new one starts a fresh form.
  const [shown, setShown] = useState<Transfer | null>(transfer)
  const [form, setForm] = useState<Form>(() => (transfer ? freshForm(transfer, currency) : { amount: null, method: 'upi', date: today() }))
  if (transfer && transfer !== shown) {
    setShown(transfer)
    setForm(freshForm(transfer, currency))
  }
  const t = transfer ?? shown
  if (!t) return null

  const from = friendsById[t.fromId] ?? null
  const to = friendsById[t.toId] ?? null
  const sentence = paymentSentence(t.fromId, t.toId, friendLabel(t.fromId, from), friendObjectLabel(t.toId, to), 'present')
  const note = amountNote(form.amount, t.amount, currency)
  const ready = form.amount !== null && form.amount > 0

  const submit = (): void => {
    if (!ready || form.amount === null) return
    onRecord(t, { amount: form.amount, method: form.method, date: form.date })
  }

  return (
    <BottomSheet
      open={transfer !== null}
      onClose={onClose}
      eyebrow={`${sentence} ${formatMoney(t.amount, currency, { trimZeros: true })}`}
      title="Record a payment"
      footer={
        <Button block disabled={!ready} onClick={submit}>
          {ready && form.amount !== null ? `Record ${formatMoney(form.amount, currency, { trimZeros: true })}` : 'Record payment'}
        </Button>
      }
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <div className={styles.faces} aria-hidden="true">
          <FriendAvatar friend={from} friendId={t.fromId} size="lg" showName />
          <span className={styles.arrow}>
            <ArrowRight strokeWidth={2.5} />
          </span>
          <FriendAvatar friend={to} friendId={t.toId} size="lg" showName />
        </div>
        <AmountHero
          value={form.amount}
          currency={currency}
          label="Amount paid"
          onChange={(amount) => setForm((f) => ({ ...f, amount }))}
        />
        <p className={cx(styles.note, note && styles.noteShown)} aria-live="polite">
          {note ?? 'The full amount.'}
        </p>
        <div className={styles.row}>
          <span className={styles.rowLabel}>
            How
          </span>
          <SegmentedControl
            options={METHOD_OPTIONS}
            value={form.method}
            onChange={(method) => setForm((f) => ({ ...f, method }))}
            ariaLabel="How it was paid"
            size="sm"
            className={styles.methods}
          />
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>When</span>
          <DateField label="Paid on" value={form.date} onChange={(date) => setForm((f) => ({ ...f, date }))} />
        </div>
      </form>
    </BottomSheet>
  )
}
