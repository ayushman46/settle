import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { AvatarStack, describePeople, Money, Receipt, ReceiptDivider, ReceiptRow, SectionHeader } from '../../components'
import { useFriendsById } from '../../data'
import type { Expense } from '../../domain/types'
import { friendLabel } from '../../kit/index-a'
import { useT } from '../../i18n'
import { formatQuantity } from '../../lib/format'
import { currencySymbol } from '../../lib/money'
import { billExtraLines, feesByPerson } from './expenseView'
import styles from './BillBreakdown.module.css'

export interface BillBreakdownProps {
  /** An itemized bill (`kind: 'bill'` with a bill snapshot); anything else renders nothing. */
  expense: Expense
}

/** Bills longer than this fold the rest of their items away behind "Show all". */
const FOLD_AFTER = 6

/**
 * The bill as it was printed, receipt style: every item with who had it, then tax, charges and
 * discounts, down to what was actually paid. Each person's own items are in the shares above.
 */
export function BillBreakdown({ expense }: BillBreakdownProps) {
  const headingId = useId()
  const listId = useId()
  const friendsById = useFriendsById()
  const t = useT()
  const [expanded, setExpanded] = useState(false)
  const bill = expense.bill
  if (expense.kind !== 'bill' || !bill || bill.items.length === 0) return null

  // Paid abroad and converted: the bill stays as printed (฿), the total it settled at is in ₹.
  const fx = expense.fx ?? null
  const printed = fx ? { total: fx.amount, currency: fx.currency, bill } : expense
  const extras = billExtraLines(printed)
  const itemsTotal = bill.items.reduce((sum, item) => sum + item.amount, 0)
  const folded = !expanded && bill.items.length > FOLD_AFTER + 1
  const items = folded ? bill.items.slice(0, FOLD_AFTER) : bill.items
  const money = (value: number, opts: { sign?: 'always' } = {}) => (
    <Money value={value} currency={printed.currency} trimZeros sign={opts.sign} />
  )
  const fees = feesByPerson({ bill, participants: expense.participants, total: printed.total })

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <SectionHeader id={headingId} title={t('expense.bill.title')} description={t('expense.bill.description', { count: bill.items.length })} />
      <Receipt padding="lg" className={styles.receipt}>
        <ul id={listId} role="list" className={styles.items} aria-label={t('expense.bill.items.aria')}>
          {items.map((item) => {
            const ids = Object.entries(bill.assignments[item.id] ?? {})
              .filter(([, weight]) => weight > 0)
              .map(([id]) => id)
            // Discs show each person's own initials (yours too); the label says "You".
            const who = ids.map((id) => ({ id, name: friendsById[id]?.name ?? '', color: friendsById[id]?.color ?? 0 }))
            const label = describePeople(ids.map((id) => friendLabel(id, friendsById[id] ?? null)), 3)
            return (
              <li key={item.id} className={styles.item}>
                <span className={styles.itemText}>
                  <span className={styles.itemName}>
                    {item.name}
                    {item.quantity !== 1 && <span className={styles.qty}> × {formatQuantity(item.quantity)}</span>}
                  </span>
                  {who.length > 0 ? (
                    <AvatarStack people={who} label={label} size="xs" max={5} className={styles.who} />
                  ) : (
                    <span className={styles.everyone}>{t('expense.bill.everyone')}</span>
                  )}
                </span>
                <span className={styles.itemAmount}>{money(item.amount)}</span>
              </li>
            )
          })}
        </ul>
        {folded && (
          <button type="button" className={styles.more} aria-expanded={false} aria-controls={listId} onClick={() => setExpanded(true)}>
            {t('expense.bill.showAll.cta', { count: bill.items.length })}
            <ChevronDown aria-hidden="true" strokeWidth={2.5} />
          </button>
        )}
        <ReceiptDivider />
        <div className={styles.totals}>
          <ReceiptRow label={t('expense.bill.items')} value={money(itemsTotal)} emphasis="muted" />
          {extras.map((line, i) => (
            <ReceiptRow key={`${line.key}-${i}`} label={line.label} value={money(line.amount, { sign: 'always' })} emphasis="muted" />
          ))}
        </div>
        <ReceiptDivider />
        <ReceiptRow label={t('expense.bill.totalPaid')} value={money(printed.total)} emphasis="strong" />
        {fx && (
          <ReceiptRow
            label={t('trip.bill.settled', { symbol: currencySymbol(expense.currency) })}
            value={<Money value={expense.total} currency={expense.currency} trimZeros />}
            emphasis="muted"
          />
        )}
        {fees.length > 0 && (
          <>
            <ReceiptDivider />
            <div className={styles.totals} role="group" aria-label={t(expense.bill?.feeSplit === 'equal' ? 'expense.bill.fees.equal.aria' : 'expense.bill.fees.proportional.aria')}>
              {fees.map(({ id, amount }) => (
                <ReceiptRow key={id} label={t('expense.bill.fees.person', { name: friendLabel(id, friendsById[id] ?? null) })} value={money(amount)} emphasis="muted" />
              ))}
            </div>
          </>
        )}
      </Receipt>
    </section>
  )
}

