import { useState } from 'react'
import { ArrowDown, ArrowUp, Shuffle } from 'lucide-react'
import { AmountInput, BottomSheet, Button, Chip, IconButton, SegmentedControl, TextField } from '../../components'
import { useFriendsById, useProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { addMonths, dateInPeriod, periodOf, today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { DateField } from '../../kit/DateField'
import { friendLabel } from '../../kit/friendName'
import { PeoplePicker } from '../../kit/PeoplePicker'
import { haptic } from '../../lib/haptics'
import { newId } from '../../lib/ids'
import { parseMoneyInput } from '../../lib/money'
import { buildCommittee, MAX_HANDS_EACH, MAX_MEMBERS, MAX_NAME, setupProblem, shuffled, type Committee, type SetupProblem, type TurnMode } from './engine'
import { next32 } from './random'
import { putCommittee } from './store'
import { money, monthLabel, ordinal } from './text'
import styles from './Committee.module.css'

export interface SetupSheetProps {
  open: boolean
  onClose: () => void
  /** After the committee is saved. */
  onSaved: (committee: Committee) => void
}

/** The 5th that is coming: early in the month, after salaries, when most committees collect. */
function comingFifth(today: string): string {
  const fifth = dateInPeriod(periodOf(today), 5)
  return fifth >= today ? fifth : dateInPeriod(addMonths(periodOf(today), 1), 5)
}

/**
 * Set up a committee in one sheet: a name, who is in (and who holds two hands), what each hand
 * puts in, the first payment date (its day is the day of every month), who collects, and how the
 * turn is decided. Everything has a default except the people and the amount; Start with
 * something missing says what, and keeps what was typed.
 */
export function SetupSheet({ open, onClose, onSaved }: SetupSheetProps) {
  const t = useT()
  const friendsById = useFriendsById()
  const profile = useProfile()
  const [day] = useState(() => todayIso())
  const [name, setName] = useState('')
  /** One entry per hand, in turn order: a person listed twice holds two hands. */
  const [seats, setSeats] = useState<string[]>([ME_ID])
  const [amountText, setAmountText] = useState('')
  const [firstDate, setFirstDate] = useState(() => comingFifth(day))
  const [organiser, setOrganiser] = useState<string | null>(null)
  const [mode, setMode] = useState<TurnMode>('order')
  const [problem, setProblem] = useState<SetupProblem | 'failed' | null>(null)

  const currency = profile.currency
  const people = [...new Set(seats)]
  const organiserId = organiser && people.includes(organiser) ? organiser : people.includes(ME_ID) ? ME_ID : (people[0] ?? ME_ID)
  const amount = parseMoneyInput(amountText, currency)
  const label = (id: string): string => friendLabel(id, friendsById[id] ?? null)
  const handsOf = (id: string): number => seats.filter((s) => s === id).length
  const monthAt = (index: number): string => monthLabel(addMonths(periodOf(firstDate), index), day)
  const dayOfMonth = Number(firstDate.slice(8, 10))

  const change = (next: () => void): void => {
    setProblem(null)
    next()
  }
  const onPeople = (ids: string[]): void => change(() => setSeats((prev) => [...prev.filter((id) => ids.includes(id)), ...ids.filter((id) => !prev.includes(id))]))
  const toggleTwo = (id: string): void =>
    change(() =>
      setSeats((prev) => {
        if (prev.filter((s) => s === id).length < MAX_HANDS_EACH) return [...prev, id]
        const last = prev.lastIndexOf(id)
        return prev.filter((_s, i) => i !== last)
      }),
    )
  const move = (index: number, by: number): void =>
    setSeats((prev) => {
      const to = index + by
      const a = prev[index]
      const b = prev[to]
      if (a === undefined || b === undefined) return prev
      const next = [...prev]
      next[index] = b
      next[to] = a
      return next
    })

  const save = (): void => {
    const input = { id: newId(), name: name.trim() || t('committee.setup.name.default'), currency, amount, firstDate, organiserId, mode, people: seats, createdAt: Date.now() }
    const missing = setupProblem(input)
    const committee = missing ? null : buildCommittee(input)
    if (!committee || !putCommittee(committee)) {
      haptic('error')
      setProblem(missing ?? 'failed')
      return
    }
    haptic('success')
    onSaved(committee)
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('committee.setup.title')}
      size="tall"
      footer={
        <Button block onClick={save}>
          {t('committee.setup.start')}
        </Button>
      }
    >
      <div className={styles.form}>
        <p className={styles.body}>{t('committee.setup.honest')}</p>
        <p className={styles.fine}>{t('committee.setup.kind')}</p>
        <TextField
          label={t('committee.setup.name')}
          value={name}
          placeholder={t('committee.setup.name.placeholder')}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME}
          autoComplete="off"
        />
        <div className={styles.field}>
          <p className={styles.fieldLabel}>{t('committee.setup.people')}</p>
          <PeoplePicker selectedIds={people} onChange={onPeople} max={MAX_MEMBERS} label={t('committee.setup.people.search')} />
        </div>
        {people.length > 0 && (
          <div className={styles.field}>
            <p className={styles.fieldLabel}>{t('committee.setup.hands')}</p>
            <ul className={styles.chips}>
              {people.map((id) => (
                <li key={id}>
                  <Chip type="button" size="lg" selected={handsOf(id) > 1} onClick={() => toggleTwo(id)} aria-label={t('committee.setup.hands.chip', { name: label(id) })}>
                    {label(id)}
                  </Chip>
                </li>
              ))}
            </ul>
            <p className={styles.fine}>{t('committee.setup.hands.hint')}</p>
          </div>
        )}
        <AmountInput
          size="field"
          currency={currency}
          label={t('committee.setup.amount')}
          value={amountText}
          onChange={(text) => change(() => setAmountText(text))}
          hint={
            amount !== null && amount > 0 && seats.length >= 2
              ? t('committee.setup.amount.pot', { pot: money(amount * seats.length, currency), count: seats.length })
              : t('committee.setup.amount.hint', { example: money(500_000, currency) })
          }
        />
        <div className={styles.field}>
          <p className={styles.fieldLabel}>{t('committee.setup.date')}</p>
          <DateField value={firstDate} onChange={(value) => change(() => setFirstDate(value))} label={t('committee.setup.date')} max={null} />
          <p className={styles.fine}>
            {t(dayOfMonth > 28 ? 'committee.setup.date.hint.end' : 'committee.setup.date.hint', { day: ordinal(dayOfMonth), month: monthAt(Math.max(0, seats.length - 1)) })}
          </p>
        </div>
        {people.length > 1 && (
          <div className={styles.field}>
            <p className={styles.fieldLabel} aria-hidden="true">
              {t('committee.setup.organiser')}
            </p>
            <div className={styles.chips} role="radiogroup" aria-label={t('committee.setup.organiser')}>
              {people.map((id) => (
                <Chip key={id} type="button" role="radio" size="lg" selected={id === organiserId} onClick={() => setOrganiser(id)}>
                  {label(id)}
                </Chip>
              ))}
            </div>
          </div>
        )}
        <div className={styles.field}>
          <p className={styles.fieldLabel}>{t('committee.setup.mode')}</p>
          <SegmentedControl
            ariaLabel={t('committee.setup.mode')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'order', label: t('committee.setup.mode.order') },
              { value: 'draw', label: t('committee.setup.mode.draw') },
            ]}
          />
          <p className={styles.fine}>{t(mode === 'order' ? 'committee.setup.order.hint' : 'committee.setup.draw.hint')}</p>
          {mode === 'order' && seats.length > 1 && (
            <>
              <ol className={styles.seats} aria-label={t('committee.setup.order.aria')}>
                {seats.map((id, i) => {
                  const vars = { month: monthAt(i), name: label(id) }
                  return (
                    // A person can sit twice, so the seat is known by its place in the order.
                    <li key={`${id}:${i}`} className={styles.seat}>
                      <p className={styles.seatName}>{t('committee.setup.order.row', vars)}</p>
                      <IconButton type="button" label={t('committee.setup.order.up', vars)} onClick={() => move(i, -1)} disabled={i === 0}>
                        <ArrowUp />
                      </IconButton>
                      <IconButton type="button" label={t('committee.setup.order.down', vars)} onClick={() => move(i, 1)} disabled={i === seats.length - 1}>
                        <ArrowDown />
                      </IconButton>
                    </li>
                  )
                })}
              </ol>
              <Button type="button" variant="secondary" iconStart={<Shuffle />} onClick={() => setSeats((prev) => shuffled(prev, next32))}>
                {t('committee.setup.shuffle')}
              </Button>
            </>
          )}
        </div>
        {problem && (
          <p className={styles.problem} role="alert">
            {t(`committee.setup.problem.${problem}`)}
          </p>
        )}
      </div>
    </BottomSheet>
  )
}
