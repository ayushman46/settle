import { useMemo, useRef, useState, type MouseEvent } from 'react'
import { Undo2 } from 'lucide-react'
import { goBack, navigate, useSearchParams } from '../../app/router'
import { Button, Card, Chip, IconButton, PageTitle, Screen, SegmentedControl, TextField, TopBar } from '../../components'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { parseMoneyInput } from '../../lib/money'
import { earlierInFunction, matchNames, nameKey } from './engine'
import { rupees } from './labels'
import { SHAGUN_PATH, shagunFunctionPath } from './paths'
import { addEntry, addToEntry, deleteEntry, setEntryAmount } from './store'
import { MAX_SHAGUN_GIFT, MAX_SHAGUN_NAME, type ShagunDirection, type ShagunEntry } from './types'
import { useShagun } from './useShagun'
import styles from './Shagun.module.css'

/** The amounts people actually put in envelopes (rupees). */
const QUICK_AMOUNTS = [101, 251, 501, 1101, 2101, 5101] as const

interface Added {
  id: string
  name: string
  /** Paise this envelope added. */
  amount: number
  /** Added onto an envelope already there: its amount before. */
  before: number | null
}

/** Keeps the keyboard up: a tap on these doesn't take focus from the field being typed in. */
const keepFocus = (e: MouseEvent) => e.preventDefault()

/**
 * `/app/shagun/add?function=<id>` — envelopes in hand, the day after: name, amount, Save & next
 * (or Enter), again and again. The keyboard stays up, the fields clear, a running count and total
 * shows, and the last few added each have Undo. A name already down at this function asks, right
 * there, whether to add to that envelope or keep both.
 */
export function ShagunEntryScreen() {
  const t = useT()
  const params = useSearchParams()
  const { book, names } = useShagun()
  const fn = book.functions.find((f) => f.id === params.get('function')) ?? null
  const [day] = useState(() => today())
  const [looseDirection, setLooseDirection] = useState<ShagunDirection>('received')
  const direction: ShagunDirection = fn ? (fn.mine ? 'received' : 'given') : looseDirection
  const date = fn?.date ?? day
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [gift, setGift] = useState('')
  const [error, setError] = useState<'name' | 'amount' | 'full' | null>(null)
  const [dup, setDup] = useState<ShagunEntry | null>(null)
  const [added, setAdded] = useState<Added[]>([])
  const nameRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  const picks = useMemo(() => matchNames(names, name, 4).filter((n) => nameKey(n) !== nameKey(name)), [names, name])
  const count = added.length
  const total = added.reduce((sum, a) => sum + a.amount, 0)

  const edit = (set: (value: string) => void) => (value: string) => {
    set(value)
    setError(null)
    setDup(null)
  }

  const save = (choice?: 'add' | 'both') => {
    if (!name.trim()) {
      setError('name')
      nameRef.current?.focus()
      return
    }
    const paise = amount.trim() ? parseMoneyInput(amount, 'INR') : 0
    if (paise === null || (paise === 0 && !gift.trim())) {
      setError('amount')
      amountRef.current?.focus()
      return
    }
    const earlier = earlierInFunction(book.entries, fn?.id ?? null, name, direction, date)
    if (!choice && earlier) {
      setDup(earlier)
      return
    }
    let row: Added | null = null
    if (choice === 'add' && earlier && paise > 0) {
      const before = addToEntry(earlier.id, paise)
      if (before !== null) row = { id: earlier.id, name: earlier.name, amount: paise, before }
    } else {
      const saved = addEntry({ name, direction, amount: paise, gift: gift || null, functionId: fn?.id ?? null, date })
      if (saved) row = { id: saved.id, name: saved.name, amount: paise, before: null }
    }
    if (!row) {
      setError('full')
      return
    }
    haptic('success')
    const done = row
    setAdded((list) => [...list, done])
    setName('')
    setAmount('')
    setGift('')
    setDup(null)
    setError(null)
    nameRef.current?.focus()
  }

  const undo = (row: Added) => {
    if (row.before === null) deleteEntry(row.id)
    else setEntryAmount(row.id, row.before)
    setAdded((list) => list.filter((a) => a !== row))
  }

  const paiseNow = amount.trim() ? (parseMoneyInput(amount, 'INR') ?? 0) : 0
  const recent = added.slice(-5).reverse()
  const finish = () => navigate(fn ? shagunFunctionPath(fn.id) : SHAGUN_PATH)

  return (
    <Screen
      header={<TopBar onBack={() => goBack(fn ? shagunFunctionPath(fn.id) : SHAGUN_PATH)} />}
      contentClassName={styles.content}
      footer={
        <Button block variant="secondary" onClick={finish}>
          {t('shagun.entry.done')}
        </Button>
      }
    >
      <PageTitle title={t('shagun.entry.title')} subtitle={fn ? fn.name : t('shagun.entry.loose')} />
      <p className={styles.status} role="status">
        {t('shagun.entry.count', { count, total: rupees(total) })}
      </p>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
        noValidate
      >
        {!fn && (
          <SegmentedControl
            ariaLabel={t('shagun.entry.direction.aria')}
            value={looseDirection}
            onChange={setLooseDirection}
            options={[
              { value: 'received', label: t('shagun.entry.received') },
              { value: 'given', label: t('shagun.entry.given') },
            ]}
          />
        )}
        <TextField
          ref={nameRef}
          label={t('shagun.entry.name')}
          placeholder={t('shagun.entry.name.placeholder')}
          value={name}
          onChange={(e) => edit(setName)(e.target.value)}
          maxLength={MAX_SHAGUN_NAME}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
          autoFocus
          error={error === 'name' ? t('shagun.entry.needName') : undefined}
        />
        {picks.length > 0 && (
          <ul className={styles.picks} aria-label={t('shagun.entry.names.aria')}>
            {picks.map((pick) => (
              <li key={pick}>
                <Chip
                  onMouseDown={keepFocus}
                  onClick={() => {
                    edit(setName)(pick)
                    amountRef.current?.focus()
                  }}
                >
                  {pick}
                </Chip>
              </li>
            ))}
          </ul>
        )}
        <TextField
          ref={amountRef}
          label={t('shagun.entry.amount')}
          value={amount}
          inputMode="decimal"
          startAdornment="₹"
          onChange={(e) => edit(setAmount)(e.target.value)}
          autoComplete="off"
          enterKeyHint="done"
          error={error === 'amount' ? t('shagun.entry.needAmount') : undefined}
        />
        <div className={styles.chips} role="group" aria-label={t('shagun.entry.chips.aria')}>
          {QUICK_AMOUNTS.map((value) => (
            <Chip key={value} onMouseDown={keepFocus} selected={paiseNow === value * 100} onClick={() => edit(setAmount)(String(value))}>
              {rupees(value * 100)}
            </Chip>
          ))}
        </div>
        <TextField
          label={t('shagun.entry.gift')}
          placeholder={t('shagun.entry.gift.placeholder')}
          value={gift}
          onChange={(e) => edit(setGift)(e.target.value)}
          maxLength={MAX_SHAGUN_GIFT}
          autoComplete="off"
          enterKeyHint="done"
        />
        {dup && (
          <div className={styles.dup} role="alert">
            <p className={styles.body}>{t('shagun.dup.text', { name: dup.name, amount: rupees(dup.amount) })}</p>
            <div className={styles.dupActions}>
              {paiseNow > 0 && dup.amount > 0 && (
                <Button size="sm" variant="tonal" onMouseDown={keepFocus} onClick={() => save('add')}>
                  {t('shagun.dup.add', { total: rupees(dup.amount + paiseNow) })}
                </Button>
              )}
              <Button size="sm" variant="ghost" onMouseDown={keepFocus} onClick={() => save('both')}>
                {t('shagun.dup.both')}
              </Button>
            </div>
          </div>
        )}
        {error === 'full' && <p className={styles.fine}>{t('shagun.entry.full')}</p>}
        <Button type="submit" block onMouseDown={keepFocus}>
          {t('shagun.entry.save')}
        </Button>
      </form>
      {recent.length > 0 && (
        <section className={styles.section} aria-label={t('shagun.entry.recent')}>
          <h2 className={styles.heading}>{t('shagun.entry.recent')}</h2>
          <Card padding="none">
            <ul className={styles.list}>
              {recent.map((row) => (
                <li key={`${row.id}:${row.before ?? 'new'}:${added.indexOf(row)}`} className={styles.row}>
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{row.name}</span>
                    {row.before !== null && <span className={styles.fine}>{t('shagun.entry.recent.merged')}</span>}
                  </span>
                  <span className={styles.received}>{row.amount > 0 ? rupees(row.amount) : ''}</span>
                  <IconButton label={t('shagun.entry.undo.aria', { name: row.name, amount: row.amount > 0 ? rupees(row.amount) : '' })} onClick={() => undo(row)}>
                    <Undo2 />
                  </IconButton>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </Screen>
  )
}
