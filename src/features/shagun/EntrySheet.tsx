import { useState } from 'react'
import { BottomSheet, Button, Chip, SegmentedControl, TextField } from '../../components'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { DateField } from '../../kit/DateField'
import { haptic } from '../../lib/haptics'
import { parseMoneyInput, toInputString } from '../../lib/money'
import { addEntry, shagunStore, updateEntry } from './store'
import { MAX_SHAGUN_GIFT, MAX_SHAGUN_NAME, MAX_SHAGUN_NOTE, type ShagunDirection, type ShagunEntry, type ShagunFunction } from './types'
import styles from './Shagun.module.css'

export interface EntrySheetProps {
  open: boolean
  onClose: () => void
  /** Change this one; without it, a new entry is added. */
  entry?: ShagunEntry | null
  /** The family, for a new entry. */
  name?: string
  /** For a new entry: this function, and its way round (yours: they gave; theirs: you gave). */
  fn?: ShagunFunction | null
  functions: readonly ShagunFunction[]
  onSaved?: (entry: ShagunEntry | null) => void
}

/** One entry, written down or changed: who, which way, how much (or a gift), at which function, when. */
export function EntrySheet({ open, onClose, entry = null, name: initialName = '', fn = null, functions, onSaved }: EntrySheetProps) {
  const t = useT()
  const [name, setName] = useState(entry?.name ?? initialName)
  const [direction, setDirection] = useState<ShagunDirection>(entry?.direction ?? (fn && !fn.mine ? 'given' : 'received'))
  const [amount, setAmount] = useState(entry && entry.amount > 0 ? toInputString(entry.amount, 'INR', { trimZeros: true }) : '')
  const [gift, setGift] = useState(entry?.gift ?? '')
  const [functionId, setFunctionId] = useState<string | null>(entry ? entry.functionId : (fn?.id ?? null))
  const [date, setDate] = useState(entry?.date ?? fn?.date ?? today())
  const [note, setNote] = useState(entry?.note ?? '')
  const [error, setError] = useState<'name' | 'amount' | null>(null)

  const pickFunction = (id: string | null) => {
    setFunctionId(id)
    const picked = functions.find((f) => f.id === id)
    if (picked && !entry) {
      setDate(picked.date)
      setDirection(picked.mine ? 'received' : 'given')
    }
  }

  const save = () => {
    const paise = amount.trim() ? parseMoneyInput(amount, 'INR') : 0
    if (!name.trim()) return setError('name')
    if (paise === null || (paise === 0 && !gift.trim())) return setError('amount')
    const input = { name, direction, amount: paise, gift: gift || null, functionId, date, note: note || null }
    if (entry) {
      if (!updateEntry(entry.id, input)) return setError('amount')
      onSaved?.(shagunStore.get().entries.find((e) => e.id === entry.id) ?? null)
    } else {
      const saved = addEntry(input)
      if (!saved) return setError('amount')
      onSaved?.(saved)
    }
    haptic('success')
    onClose()
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={entry ? t('shagun.esheet.edit') : t('shagun.esheet.add')}
      size="tall"
      footer={
        <Button block onClick={save}>
          {t('shagun.esheet.save')}
        </Button>
      }
    >
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <TextField
          label={t('shagun.entry.name')}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          maxLength={MAX_SHAGUN_NAME}
          autoComplete="off"
          error={error === 'name' ? t('shagun.entry.needName') : undefined}
        />
        <SegmentedControl
          ariaLabel={t('shagun.entry.direction.aria')}
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'received', label: t('shagun.entry.received') },
            { value: 'given', label: t('shagun.entry.given') },
          ]}
        />
        <TextField
          label={t('shagun.entry.amount')}
          value={amount}
          inputMode="decimal"
          startAdornment="₹"
          onChange={(e) => {
            setAmount(e.target.value)
            setError(null)
          }}
          autoComplete="off"
          error={error === 'amount' ? t('shagun.entry.needAmount') : undefined}
        />
        <TextField
          label={t('shagun.entry.gift')}
          placeholder={t('shagun.entry.gift.placeholder')}
          value={gift}
          onChange={(e) => {
            setGift(e.target.value)
            setError(null)
          }}
          maxLength={MAX_SHAGUN_GIFT}
          autoComplete="off"
        />
        {functions.length > 0 && (
          <div className={styles.field}>
            <p className={styles.fieldLabel} aria-hidden="true">
              {t('shagun.esheet.function')}
            </p>
            <div className={styles.chips} role="radiogroup" aria-label={t('shagun.esheet.function')}>
              <Chip role="radio" size="lg" selected={functionId === null} onClick={() => pickFunction(null)}>
                {t('shagun.esheet.noFunction')}
              </Chip>
              {functions.map((f) => (
                <Chip key={f.id} role="radio" size="lg" selected={functionId === f.id} onClick={() => pickFunction(f.id)}>
                  {f.name}
                </Chip>
              ))}
            </div>
          </div>
        )}
        <div className={styles.field}>
          <p className={styles.fieldLabel}>{t('shagun.esheet.date')}</p>
          <DateField value={date} onChange={setDate} label={t('shagun.esheet.date')} max={null} />
        </div>
        <TextField label={t('shagun.esheet.note')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={MAX_SHAGUN_NOTE} autoComplete="off" />
      </form>
    </BottomSheet>
  )
}
