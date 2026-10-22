import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { AvatarStack, describePeople, Money, Receipt, ReceiptDivider, ReceiptRow, SectionHeader } from '../../components'
import { useFriendsById } from '../../data'
import type { Expense } from '../../domain/types'
import { friendLabel } from '../../kit/index-a'
import { formatQuantity } from '../../lib/format'
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
  const [expanded, setExpanded] = useState(false)
  const bill = expense.bill
  if (expense.kind !== 'bill' || !bill || bill.items.length === 0) return null

  const extras = billExtraLines(expense)
  const itemsTotal = bill.items.reduce((sum, item) => sum + item.amount, 0)
  const folded = !expanded && bill.items.length > FOLD_AFTER + 1
  const items = folded ? bill.items.slice(0, FOLD_AFTER) : bill.items
  const money = (value: number, opts: { sign?: 'always' } = {}) => (
    <Money value={value} currency={expense.currency} trimZeros sign={opts.sign} />
  )
  const fees = feesByPerson(expense)

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <SectionHeader id={headingId} title="The bill" description={`${bill.items.length} items · who had what`} />
      <Receipt padding="lg" className={styles.receipt}>
        <ul id={listId} role="list" className={styles.items} aria-label="Items">
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
                    <span className={styles.everyone}>Shared by everyone</span>
                  )}
                </span>
                <span className={styles.itemAmount}>{money(item.amount)}</span>
              </li>
            )
          })}
        </ul>
        {folded && (
          <button type="button" className={styles.more} aria-expanded={false} aria-controls={listId} onClick={() => setExpanded(true)}>
            Show all {bill.items.length} items
            <ChevronDown aria-hidden="true" strokeWidth={2.5} />
          </button>
        )}
        <ReceiptDivider />
        <div className={styles.totals}>
          <ReceiptRow label="Items" value={money(itemsTotal)} emphasis="muted" />
          {extras.map((line, i) => (
            <ReceiptRow key={`${line.key}-${i}`} label={line.label} value={money(line.amount, { sign: 'always' })} emphasis="muted" />
          ))}
        </div>
        <ReceiptDivider />
        <ReceiptRow label="Total paid" value={money(expense.total)} emphasis="strong" />
        {fees.length > 0 && (
          <>
            <ReceiptDivider />
            <div className={styles.totals} role="group" aria-label={expense.bill?.feeSplit === 'equal' ? 'Fees, shared equally' : 'Fees, by what each had'}>
              {fees.map(({ id, amount }) => (
                <ReceiptRow key={id} label={`Fees · ${friendLabel(id, friendsById[id] ?? null)}`} value={money(amount)} emphasis="muted" />
              ))}
            </div>
          </>
        )}
      </Receipt>
    </section>
  )
}

