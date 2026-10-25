import { formatMoney } from '../../lib/money'
import { dayOf, type RentPaymentMode, type RentReceipt } from './hra'
import styles from './Rent.module.css'

/**
 * The printed receipt is always in English: it's a document for the landlord to sign and an
 * employer's HR team to file, and that's the language they process. (The screens around it are in
 * the user's language.)
 */
const DOC = {
  title: 'Rent Receipt',
  number: 'Receipt No.',
  received: 'Received with thanks from',
  sum: 'the sum of',
  towards: 'towards the rent of',
  period: 'for the period',
  paidBy: 'paid by',
  landlord: 'Landlord',
  pan: 'PAN of landlord',
  noPan: '____________',
  date: 'Date',
  signature: 'Signature of landlord',
  stamp: 'Revenue stamp ₹1',
  modes: { upi: 'UPI', bank: 'bank transfer', cash: 'cash', cheque: 'cheque' } satisfies Record<RentPaymentMode, string>,
} as const

export interface RentReceiptDocProps {
  receipt: RentReceipt
  tenantName: string
  /** The flat's address (or its name when no address was given). */
  property: string
  landlordName: string
  landlordPan: string | null
  mode: RentPaymentMode
  dueDay: number
}

/** `YYYY-MM-DD` → "05/04/2026" (Indian day-first order). */
function indianDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** One receipt, laid out like the paper ones landlords sign. */
export function RentReceiptDoc({ receipt, tenantName, property, landlordName, landlordPan, mode, dueDay }: RentReceiptDocProps) {
  const amount = formatMoney(receipt.amount, 'INR')
  return (
    <article className={styles.receipt} aria-label={`${DOC.title} ${receipt.number}`}>
      <header className={styles.receiptHead}>
        <span className={styles.receiptTitle}>{DOC.title}</span>
        <span className={styles.receiptNo}>
          {DOC.number} {receipt.number}
        </span>
      </header>
      <p className={styles.receiptBody}>
        {DOC.received} <strong>{tenantName}</strong> {DOC.sum} <strong>{amount}</strong> ({receipt.words}) {DOC.towards}{' '}
        <strong>{property}</strong> {DOC.period} <strong>{receipt.period}</strong>, {DOC.paidBy} {DOC.modes[mode]}.
      </p>
      <div className={styles.receiptMeta}>
        <span>
          {DOC.landlord}: <strong>{landlordName}</strong>
        </span>
        <span>
          {DOC.pan}: <strong>{landlordPan ?? DOC.noPan}</strong>
        </span>
        <span>
          {DOC.date}: <strong>{indianDate(dayOf(receipt.to, dueDay))}</strong>
        </span>
      </div>
      <div className={styles.receiptSign}>
        {receipt.stamp && <span className={styles.stamp}>{DOC.stamp}</span>}
        <span className={styles.signature}>
          <span className={styles.signatureLine} aria-hidden="true" />
          <span>{DOC.signature}</span>
        </span>
      </div>
    </article>
  )
}
