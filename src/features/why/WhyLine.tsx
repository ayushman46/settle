import { useId, useMemo, useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { BottomSheet, Button } from '../../components'
import { useFriendsById } from '../../data'
import type { Transfer } from '../../engine/balances'
import { useT } from '../../i18n'
import { FriendAvatar, friendLabel, friendObjectLabel } from '../../kit/index-a'
import { cx } from '../../lib/cx'
import { formatMoney } from '../../lib/money'
import { explainTransfer, type SettlePlan, type WhyMode } from './engine'
import { whyText, whyTitle, type WhyNames } from './whyText'
import styles from './Why.module.css'

export interface WhyLineProps {
  /** From `useSettlePlan` (or `settlePlan`) for the group this payment is in. */
  plan: SettlePlan
  /** One line of Settle up, as shown. */
  transfer: Transfer
  /** Which list it is from: the fewest payments, or only people who directly owe each other. */
  mode: WhyMode
  currency: string
  /** Shown over the sheet's title. */
  groupName?: string
  className?: string
}

/**
 * The small "Why?" under a Settle up payment, and the sheet it opens: what each side had and
 * paid, and why the money goes between these two. Null when there is nothing true to explain.
 */
export function WhyLine({ plan, transfer, mode, currency, groupName, className }: WhyLineProps) {
  const t = useT()
  const baseId = useId()
  const friendsById = useFriendsById()
  const [open, setOpen] = useState(false)
  const explanation = useMemo(() => explainTransfer(plan, transfer, mode), [plan, transfer, mode])
  const names = useMemo<WhyNames>(
    () => ({
      label: (id) => friendLabel(id, friendsById[id] ?? null),
      object: (id) => friendObjectLabel(id, friendsById[id] ?? null),
      money: (minor) => formatMoney(minor, currency, { trimZeros: true }),
    }),
    [friendsById, currency],
  )
  // Written out on each render, so the words follow the app's language.
  const text = explanation && open ? whyText(explanation, names) : null
  if (!explanation) return null
  const title = whyTitle(transfer.fromId, transfer.toId, transfer.amount, names)

  return (
    <div className={cx(styles.line, className)}>
      <Button variant="ghost" size="md" iconStart={<HelpCircle />} aria-label={title} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {t('why.button')}
      </Button>
      <BottomSheet open={open} onClose={() => setOpen(false)} eyebrow={groupName} title={title}>
        {text && (
          <div className={styles.body}>
            {text.sections.map((section) => (
              <section key={section.id} className={styles.section} aria-labelledby={`${baseId}-${section.id}`}>
                <h3 id={`${baseId}-${section.id}`} className={styles.heading}>
                  {section.personId !== null && <FriendAvatar friendId={section.personId} size="sm" />}
                  <span>{section.heading}</span>
                </h3>
                {section.lines.map((line, index) => (
                  <p key={index} className={styles.text}>
                    {line}
                  </p>
                ))}
              </section>
            ))}
            {text.bills && (
              <section className={styles.section} aria-labelledby={`${baseId}-bills`}>
                <h3 id={`${baseId}-bills`} className={styles.heading}>
                  <span>{text.bills.heading}</span>
                </h3>
                <ul className={styles.bills}>
                  {text.bills.rows.map((row) => (
                    <li key={row.key} className={styles.bill}>
                      <span className={styles.billTitle}>{row.title}</span>
                      <span className={styles.billAmount}>{row.amount}</span>
                    </li>
                  ))}
                  {text.bills.more !== null && <li className={styles.more}>{text.bills.more}</li>}
                </ul>
              </section>
            )}
            <p className={styles.note}>{text.note}</p>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
