import { useMemo, useRef, useState, type MouseEvent } from 'react'
import { Undo2 } from 'lucide-react'
import { goBack, navigate, useSearchParams } from '../../app/router'
import { Button, Card, Chip, IconButton, PageTitle, Screen, SegmentedControl, TextField, TopBar, useToast } from '../../components'
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
 * (or Enter), again and again. The keyboard stays up, the fields clear, the function's count and
 * total shows, and the last few added each have Undo. A name already down at this function is saved
 * as a second envelope (nothing is ever lost to an unanswered question) and the screen offers, right
 * there, to add it to the earlier one instead. Done saves what's typed, or says what's missing.
 */
export function ShagunEntryScreen() {
  const t = useT()
  const toast = useToast()
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
  /** The envelope just saved as a second one for a name already down here, and that earlier one. */
  const [dup, setDup] = useState<{ row: Added; earlier: ShagunEntry } | null>(null)
  const [added, setAdded] = useState<Added[]>([])
  const nameRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  const picks = useMemo(() => matchNames(names, name, 4).filter((n) => nameKey(n) !== nameKey(name)), [names, name])
  // With a function: everything already written down at it (this way round), not only this visit's.
  const atFunction = fn ? book.entries.filter((e) => e.functionId === fn.id && e.direction === direction) : null
  const count = atFunction ? atFunction.length : added.length
  const total = (atFunction ?? added).reduce((sum, a) => sum + a.amount, 0)

  const edit = (set: (value: string) => void) => (value: string) => {
    set(value)
    setError(null)
  }

  /** Saves what's typed; null (and says what's missing) when it can't. */
  const save = (): { row: Added; gift: string | null; second: boolean } | null => {
    if (!name.trim()) {
      setError('name')
      nameRef.current?.focus()
      return null
    }
    const paise = amount.trim() ? parseMoneyInput(amount, 'INR') : 0
    if (paise === null || (paise === 0 && !gift.trim())) {
      setError('amount')
      amountRef.current?.focus()
      return null
    }
    const earlier = earlierInFunction(book.entries, fn?.id ?? null, name, direction, date)
    const saved = addEntry({ name, direction, amount: paise, gift: gift || null, functionId: fn?.id ?? null, date })
    if (!saved) {
      setError('full')
      return null
    }
    haptic('success')
    const row: Added = { id: saved.id, name: saved.name, amount: paise, before: null }
    setAdded((list) => [...list, row])
    setDup(earlier ? { row, earlier } : null)
    setName('')
    setAmount('')
    setGift('')
    setError(null)
    nameRef.current?.focus()
    return { row, gift: saved.gift, second: earlier !== null }
  }

  /** "Add it to the earlier one": the second envelope goes into the first. */
  const merge = () => {
    if (!dup) return
    const { row, earlier } = dup
    const before = addToEntry(earlier.id, row.amount)
    setDup(null)
    if (before === null) return
    deleteEntry(row.id)
    const into: Added = { id: earlier.id, name: earlier.name, amount: row.amount, before }
    setAdded((list) => list.map((a) => (a === row ? into : a)))
  }

  const undo = (row: Added) => {
    if (row.before === null) deleteEntry(row.id)
    else setEntryAmount(row.id, row.before)
    setAdded((list) => list.filter((a) => a !== row))
    if (dup?.row === row) setDup(null)
  }

  const paiseNow = amount.trim() ? (parseMoneyInput(amount, 'INR') ?? 0) : 0
  const recent = added.slice(-5).reverse()
  // Replace this screen, so Back from the function page goes to the book, not back here.
  const leave = () => navigate(fn ? shagunFunctionPath(fn.id) : SHAGUN_PATH, { replace: true })
  const finish = () => {
    if (name.trim() || amount.trim() || gift.trim()) {
      const done = save()
      if (!done) return
      const { row } = done
      const what = row.amount > 0 ? rupees(row.amount) : (done.gift ?? '')
      toast(t(done.second ? 'shagun.entry.saved.both' : 'shagun.entry.saved', { name: row.name, amount: what }), {
        tone: 'success',
        action: { label: t('common.action.undo'), onAction: () => void deleteEntry(row.id) },
      })
    }
    leave()
  }

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
        {t(fn ? 'shagun.entry.count.fn' : 'shagun.entry.count', { count, total: rupees(total) })}
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
                  size="lg"
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
            <Chip key={value} size="lg" onMouseDown={keepFocus} selected={paiseNow === value * 100} onClick={() => edit(setAmount)(String(value))}>
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
            <p className={styles.body}>
              {t('shagun.dup.text', {
                name: dup.earlier.name,
                earlier: dup.earlier.amount > 0 ? rupees(dup.earlier.amount) : (dup.earlier.gift ?? ''),
                amount: dup.row.amount > 0 ? rupees(dup.row.amount) : t('shagun.advice.gift.unnamed'),
              })}
            </p>
            <div className={styles.dupActions}>
              {dup.row.amount > 0 && dup.earlier.amount > 0 && (
                <Button variant="tonal" onMouseDown={keepFocus} onClick={merge}>
                  {t('shagun.dup.add', { total: rupees(dup.earlier.amount + dup.row.amount) })}
                </Button>
              )}
              <Button variant="ghost" onMouseDown={keepFocus} onClick={() => setDup(null)}>
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
