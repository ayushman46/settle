import { useId, useMemo } from 'react'
import { ArrowRight, RotateCw } from 'lucide-react'
import { navigate } from '../../app/router'
import { Button } from '../../components'
import type { Expense, Group } from '../../domain/types'
import { useT } from '../../i18n'
import { FriendAvatar } from '../../kit/index-a'
import { settleUpPath } from './paths'
import { logNextRound, nextRoundCardView, useNameOf } from './rotationView'
import styles from './NextRoundCard.module.css'

export interface NextRoundCardProps {
  group: Group
  /** The group's expenses (live). */
  expenses: readonly Expense[]
  /** Opens the rotation sheet. */
  onPlan: () => void
}

/**
 * "Next round's on Sam" — on a group with money outstanding, who should pay for everyone next
 * time, and the exact round at which they're square. Instead of transfers between friends who
 * meet anyway. Hidden when the members are square, the group is archived or has one member.
 */
export function NextRoundCard({ group, expenses, onPlan }: NextRoundCardProps) {
  const t = useT()
  const titleId = useId()
  const nameOf = useNameOf()
  const view = useMemo(() => nextRoundCardView(group, expenses, nameOf), [group, expenses, nameOf])
  if (!view) return null

  if (view.kind === 'left') {
    return (
      <section className={styles.card} aria-labelledby={titleId}>
        <div className={styles.head}>
          <span className={styles.icon} aria-hidden="true">
            <RotateCw strokeWidth={2.25} />
          </span>
          <div className={styles.text}>
            <h2 id={titleId} className={styles.title}>
              {view.title}
            </h2>
            <p className={styles.body}>{view.body}</p>
          </div>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" size="md" iconEnd={<ArrowRight />} onClick={() => navigate(settleUpPath(group.id))}>
            {t('rotation.card.settle.cta')}
          </Button>
        </div>
      </section>
    )
  }

  const { suggestion } = view
  const log = (): void => logNextRound(group, suggestion.payerId, suggestion.squaresAt ?? suggestion.behind, nameOf)
  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <div className={styles.head}>
        <span className={styles.who} aria-hidden="true">
          <FriendAvatar friendId={suggestion.payerId} size="md" />
          <span className={styles.badge}>
            <RotateCw strokeWidth={2.5} />
          </span>
        </span>
        <div className={styles.text}>
          <h2 id={titleId} className={styles.title}>
            {view.title}
          </h2>
          <p className={styles.body}>{view.body}</p>
          {view.usualLine && <p className={styles.usual}>{view.usualLine}</p>}
        </div>
      </div>
      <div className={styles.actions}>
        <Button size="md" iconStart={<RotateCw />} onClick={log}>
          {t('rotation.card.log.cta')}
        </Button>
        <Button variant="ghost" size="md" onClick={onPlan} aria-haspopup="dialog">
          {t('rotation.card.plan.cta')}
        </Button>
      </div>
    </section>
  )
}
