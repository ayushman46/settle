import { useMemo, useState } from 'react'
import { ArrowRight, RotateCw } from 'lucide-react'
import { navigate } from '../../app/router'
import { AmountInput, BottomSheet, Button, Card } from '../../components'
import { updateGroup } from '../../data'
import { isValidTotal } from '../../engine/split'
import type { Expense, Group } from '../../domain/types'
import { useT } from '../../i18n'
import { FriendAvatar } from '../../kit/index-a'
import { TransferRow } from '../../kit/index-b'
import { parseMoneyInput, toInputString } from '../../lib/money'

import { settleUpPath } from './paths'
import { automaticRound, everyoneLabel, groupRound, logNextRound, rotationPlanView, useNameOf } from './rotationView'
import styles from './RotationSheet.module.css'

export interface RotationSheetProps {
  group: Group
  /** The group's expenses (live: the plan follows them while the sheet is open). */
  expenses: readonly Expense[]
  open: boolean
  onClose: () => void
}

/**
 * "Pay it forward": the round size (saved for the group, or worked out from its recent spending),
 * then who should pay each of the next rounds and how much each settles, and the payments that
 * square whatever is left. Recomputes as you type; saves the round size when you leave the field.
 */
export function RotationSheet({ group, expenses, open, onClose }: RotationSheetProps) {
  const t = useT()
  const nameOf = useNameOf()
  const usual = groupRound(group, expenses)
  const [text, setText] = useState(() => toInputString(usual, group.currency, { trimZeros: true }))
  const [touched, setTouched] = useState(false)
  // Re-reads the saved/automatic round each time the sheet opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setText(toInputString(usual, group.currency, { trimZeros: true }))
      setTouched(false)
    }
  }

  const amount = parseMoneyInput(text, group.currency)
  const valid = amount !== null && isValidTotal(amount)
  const view = useMemo(() => (valid ? rotationPlanView(group, expenses, amount, nameOf) : null), [valid, group, expenses, amount, nameOf])
  const count = group.memberIds.length

  const save = (): void => {
    if (!valid || amount === (group.roundSize ?? null)) return
    if (group.roundSize === null || group.roundSize === undefined) {
      // Typing the automatic value back in keeps it automatic.
      if (amount === automaticRound(group, expenses)) return
    }
    updateGroup(group.id, { roundSize: amount })
  }

  const reset = (): void => {
    updateGroup(group.id, { roundSize: null })
    setText(toInputString(automaticRound(group, expenses), group.currency, { trimZeros: true }))
    setTouched(true)
  }

  const first = view?.kind === 'plan' ? view.first : null
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      eyebrow={group.name}
      title={t('rotation.sheet.title')}
      description={t('rotation.sheet.description', { everyone: everyoneLabel(count) })}
      size="tall"
      footer={
        first && view?.kind === 'plan' ? (
          <Button block iconStart={<RotateCw />} onClick={() => logNextRound(group, first.payerId, first.squaresAt ?? first.settles, nameOf)}>
            {view.logLabel}
          </Button>
        ) : undefined
      }
    >
      <div className={styles.body}>
        <div className={styles.field}>
          <AmountInput
            size="field"
            label={t('rotation.sheet.amount.label')}
            currency={group.currency}
            value={text}
            onChange={(next) => {
              setText(next)
              setTouched(true)
            }}
            onBlur={save}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) save()
            }}
            enterKeyHint="done"
            error={valid ? undefined : t('rotation.sheet.amount.error')}
          />
          {group.roundSize !== null && group.roundSize !== undefined && (
            <Button variant="ghost" size="sm" className={styles.reset} onClick={reset} aria-label={t('rotation.sheet.reset.aria')}>
              {t('rotation.sheet.reset.cta')}
            </Button>
          )}
        </div>

        <p className="visually-hidden" aria-live="polite">
          {touched && view ? view.live : ''}
        </p>

        {view?.kind === 'plan' && (
          <>
            <Card padding="none">
              <ol className={styles.rounds} aria-label={t('rotation.sheet.rounds.label')}>
                {view.rows.map((row) => (
                  <li key={row.key} className={styles.round} aria-label={row.aria}>
                    <FriendAvatar friendId={row.payerId} size="md" />
                    <span className={styles.roundText} aria-hidden="true">
                      <span className={styles.roundTitle}>{row.title}</span>
                      <span className={styles.roundSub}>{row.subtitle}</span>
                    </span>
                    <span className={styles.settles} aria-hidden="true">
                      {row.trailing}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
            {view.square ? (
              <p className={styles.square}>{view.square}</p>
            ) : (
              <section className={styles.finish} aria-label={view.leftoverLine ?? undefined}>
                <p className={styles.finishLine}>{view.leftoverLine}</p>
                <div className={styles.transfers}>
                  {view.finish.map((tr) => (
                    <TransferRow key={`${tr.fromId}>${tr.toId}`} transfer={tr} currency={group.currency} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {view?.kind === 'empty' && (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>{view.title}</p>
            <p className={styles.emptyBody}>{view.body}</p>
            <Button variant="secondary" size="md" iconEnd={<ArrowRight />} onClick={() => navigate(settleUpPath(group.id))}>
              {t('rotation.sheet.settle.cta')}
            </Button>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
