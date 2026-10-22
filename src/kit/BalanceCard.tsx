import { useEffect, useId, useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { AvatarStack, Button, Money, describePeople, type AvatarStackPerson } from '../components'
import { useFriendsById } from '../data'
import type { OverallSummary } from '../engine/balances'
import { cx } from '../lib/cx'
import { currencyDigits, formatMoney } from '../lib/money'
import { firstName } from '../share/text'
import { balanceHeadline, otherCurrenciesLine, peopleLine, topBalances } from './balanceLabels'
import { friendLabel } from './friendName'
import { useCountUp } from './motion'
import styles from './BalanceCard.module.css'

export interface BalanceCardProps {
  /** From `useSummary()`. */
  summary: OverallSummary
  /** The card's one action — e.g. open your people to settle with them. */
  onSettle: () => void
  /** Label for the action. Default "Settle up". */
  settleLabel?: string
  className?: string
}

/** Avatars on the card, at most (the last becomes "+N" when there are more). */
const MAX_FACES = 4

/** The headline counts up once per visit — not on every return to Home. */
let introPlayed = false

/**
 * The premium dark balance card: the one number that matters ("You're owed ₹2,450") counting up,
 * both totals when money flows both ways, the faces you're settling with and a lime "Settle up".
 * With nothing outstanding it becomes a calm "All settled up" (screens may hide it instead — see
 * `hasOutstanding`).
 */
export function BalanceCard({ summary, onSettle, settleLabel = 'Settle up', className }: BalanceCardProps) {
  const headingId = useId()
  const friendsById = useFriendsById()
  const headline = balanceHeadline(summary)
  const [intro] = useState(() => !introPlayed)
  useEffect(() => {
    introPlayed = true
  }, [])
  const shown = useCountUp(headline.amount, { intro, step: 10 ** currencyDigits(headline.currency) })
  const counting = shown !== headline.amount

  const other = otherCurrenciesLine(summary, headline.currency)
  // Per-person balances are only kept in the summary's own currency.
  const top = headline.currency === summary.currency ? topBalances(summary) : []
  const faces: AvatarStackPerson[] = top.map(({ friendId }) => {
    const friend = friendsById[friendId] ?? null
    return { id: friendId, name: friendLabel(friendId, friend), color: friend?.color ?? 0 }
  })
  const line = peopleLine(
    top,
    faces.map((f) => firstName(f.name)),
  )
  const money = (minor: number) => formatMoney(minor, headline.currency, { trimZeros: true })

  if (headline.mood === 'settled') {
    return (
      <section aria-labelledby={headingId} className={cx(styles.card, styles.calm, className)} data-mood="settled">
        <span className={styles.calmIcon} aria-hidden="true">
          <Check strokeWidth={3} />
        </span>
        <div className={styles.calmText}>
          <h2 id={headingId} className={styles.calmTitle}>
            All settled up
          </h2>
          <p className={styles.calmSub}>No one owes anyone right now.</p>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby={headingId} className={cx(styles.card, className)} data-mood={headline.mood}>
      <h2 id={headingId} className="visually-hidden">
        Your balance
      </h2>

      <div className={styles.top}>
        <p className={styles.label}>{headline.label}</p>
        {headline.mood !== 'even' && (
          <div className={styles.amountBox}>
            {/* While it counts up, screen readers get the final amount only. */}
            {counting && <span className="visually-hidden">{money(headline.amount)}</span>}
            <div aria-hidden={counting || undefined}>
              <Money
                value={shown}
                fitValue={headline.amount}
                currency={headline.currency}
                size="xl"
                trimZeros
                className={cx(styles.amount, headline.mood === 'owed' && styles.owedAmount)}
              />
            </div>
          </div>
        )}
      </div>

      {headline.mixed && (
        <dl className={styles.totals}>
          <div className={styles.total}>
            <dt className={styles.totalLabel}>
              <span className={cx(styles.dot, styles.dotOwed)} aria-hidden="true" />
              You're owed
            </dt>
            <dd className={styles.totalValue}>
              <Money value={headline.owedToMe} currency={headline.currency} size="inherit" trimZeros />
            </dd>
          </div>
          <div className={styles.total}>
            <dt className={styles.totalLabel}>
              <span className={cx(styles.dot, styles.dotOwe)} aria-hidden="true" />
              You owe
            </dt>
            <dd className={styles.totalValue}>
              <Money value={headline.iOwe} currency={headline.currency} size="inherit" trimZeros />
            </dd>
          </div>
        </dl>
      )}

      {other !== null && <p className={styles.other}>{other}</p>}

      <div className={styles.foot}>
        {faces.length > 0 && (
          <span className={styles.people}>
            <AvatarStack
              people={faces}
              max={MAX_FACES}
              size="sm"
              label={describePeople(
                faces.map((f) => f.name),
                3,
              )}
              className={styles.faces}
            />
            <span className={styles.peopleText}>{line}</span>
          </span>
        )}
        <Button variant="accent" size="md" onClick={onSettle} iconEnd={<ArrowRight />} className={styles.settle}>
          {settleLabel}
        </Button>
      </div>
    </section>
  )
}
