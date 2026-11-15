import { useState } from 'react'
import { Dices } from 'lucide-react'
import { BottomSheet, Button, Chip } from '../../components'
import { useT } from '../../i18n'
import { DateField } from '../../kit/DateField'
import { cx } from '../../lib/cx'
import { HANDOVER_HOWS, type HandoverHow, type MonthView } from './engine'
import styles from './Committee.module.css'

export interface DrawSheetProps {
  open: boolean
  onClose: () => void
  /** "November". */
  month: string
  /** The month as it stands: once it has a draw, the sheet shows the result. */
  view: MonthView
  /** The hands in the hat, in the order shown, with their names. */
  hat: ReadonlyArray<{ id: string; name: string }>
  /** Every hand's name by id (for a draw already made). */
  handName: (handId: string) => string
  /** "You take" / "Riya takes" for the hand that came up. */
  takerLine: string
  onDraw: () => void
}

/**
 * The draw, done where everyone can watch: every chit in the hat is on screen, one tap picks one
 * with equal chance, and the chit that came up is marked among the others. The pick is kept in
 * the month's record.
 */
export function DrawSheet({ open, onClose, month, view, hat, handName, takerLine, onDraw }: DrawSheetProps) {
  const t = useT()
  const drawn = view.draw
  const chits = drawn ? drawn.among.map((id) => ({ id, name: handName(id) })) : hat
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('committee.draw.title', { month })}
      footer={
        drawn ? (
          <Button block onClick={onClose}>
            {t('committee.draw.done')}
          </Button>
        ) : (
          <Button block iconStart={<Dices />} onClick={onDraw} disabled={hat.length === 0}>
            {t('committee.draw.go')}
          </Button>
        )
      }
    >
      <div className={styles.section}>
        <p className={styles.body}>{t('committee.draw.body')}</p>
        <p className={styles.fieldLabel} id="committee-hat">
          {t('committee.draw.hat', { count: chits.length })}
        </p>
        <ul className={styles.hat} aria-labelledby="committee-hat">
          {chits.map((chit) => (
            <li key={chit.id} className={cx(styles.chit, drawn?.picked === chit.id && styles.chitPicked)}>
              {chit.name}
            </li>
          ))}
        </ul>
        {drawn && (
          <div className={styles.result} role="status">
            <p className={styles.potLine}>{takerLine}</p>
            <p className={styles.fine}>{t('committee.draw.record', { count: drawn.among.length })}</p>
            {view.draws > 1 && <p className={styles.fine}>{t('committee.month.how.redrawn', { count: view.draws })}</p>}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

export interface HandoverSheetProps {
  open: boolean
  onClose: () => void
  /** "₹50,000 to Riya". */
  description: string
  today: string
  onSave: (on: string, how: HandoverHow) => void
}

/** "Pot handed over": the day (today unless changed) and how it went. One tap when the defaults are right. */
export function HandoverSheet({ open, onClose, description, today, onSave }: HandoverSheetProps) {
  const t = useT()
  const [on, setOn] = useState(today)
  const [how, setHow] = useState<HandoverHow>('upi')
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('committee.handover.title')}
      description={description}
      footer={
        <Button
          block
          onClick={() => {
            onSave(on, how)
            onClose()
          }}
        >
          {t('committee.handover.save')}
        </Button>
      }
    >
      <div className={styles.form}>
        <div className={styles.field}>
          <p className={styles.fieldLabel}>{t('committee.handover.date')}</p>
          <DateField value={on} onChange={setOn} label={t('committee.handover.date')} max={today} />
        </div>
        <div className={styles.field}>
          <p className={styles.fieldLabel} aria-hidden="true">
            {t('committee.handover.how')}
          </p>
          <div className={styles.chips} role="radiogroup" aria-label={t('committee.handover.how')}>
            {HANDOVER_HOWS.map((value) => (
              <Chip key={value} role="radio" size="lg" selected={value === how} onClick={() => setHow(value)}>
                {t(`committee.handover.how.${value}`)}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </BottomSheet>
  )
}
