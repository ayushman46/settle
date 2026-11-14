import { useState } from 'react'
import { BottomSheet, Button, Chip, SegmentedControl, TextField } from '../../components'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { DateField } from '../../kit/DateField'
import { haptic } from '../../lib/haptics'
import { defaultFunctionName, kindLabel } from './labels'
import { addFunction, updateFunction } from './store'
import { MAX_FUNCTION_NAME, SHAGUN_KINDS, type ShagunFunction, type ShagunKind } from './types'
import styles from './Shagun.module.css'

export interface FunctionSheetProps {
  open: boolean
  onClose: () => void
  /** Change this one; without it, a new function is added. */
  fn?: ShagunFunction | null
  /** After saving (the new or changed function). */
  onSaved?: (fn: ShagunFunction) => void
}

/** Add or change a function: whose it is, what kind, when, and a name (made up for you when left empty). */
export function FunctionSheet({ open, onClose, fn = null, onSaved }: FunctionSheetProps) {
  const t = useT()
  const [mine, setMine] = useState(fn?.mine ?? true)
  const [kind, setKind] = useState<ShagunKind>(fn?.kind ?? 'wedding')
  const [date, setDate] = useState(fn?.date ?? today())
  const [name, setName] = useState(fn?.name ?? '')
  const [full, setFull] = useState(false)
  const fallback = defaultFunctionName(kind, mine, date)

  const save = () => {
    const input = { name: name.trim() || fallback, kind, date, mine }
    if (fn) {
      if (updateFunction(fn.id, input)) {
        onSaved?.({ ...fn, ...input, name: input.name.trim() })
        onClose()
      }
      return
    }
    const added = addFunction(input)
    if (!added) {
      setFull(true)
      return
    }
    haptic('success')
    onSaved?.(added)
    onClose()
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={fn ? t('shagun.fnsheet.edit') : t('shagun.fnsheet.add')}
      size="tall"
      footer={
        <Button block onClick={save}>
          {t('shagun.fnsheet.save')}
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
        <div className={styles.field}>
          <p className={styles.fieldLabel}>{t('shagun.fnsheet.whose')}</p>
          <SegmentedControl
            ariaLabel={t('shagun.fnsheet.whose')}
            value={mine ? 'mine' : 'theirs'}
            onChange={(value) => setMine(value === 'mine')}
            options={[
              { value: 'mine', label: t('shagun.fnsheet.mine') },
              { value: 'theirs', label: t('shagun.fnsheet.theirs') },
            ]}
          />
        </div>
        <div className={styles.field}>
          <p className={styles.fieldLabel} aria-hidden="true">
            {t('shagun.fnsheet.kind')}
          </p>
          <div className={styles.chips} role="radiogroup" aria-label={t('shagun.fnsheet.kind')}>
            {SHAGUN_KINDS.map((k) => (
              <Chip key={k} role="radio" selected={k === kind} onClick={() => setKind(k)}>
                {kindLabel(k)}
              </Chip>
            ))}
          </div>
        </div>
        <div className={styles.field}>
          <p className={styles.fieldLabel}>{t('shagun.fnsheet.date')}</p>
          <DateField value={date} onChange={setDate} label={t('shagun.fnsheet.date')} max={null} />
        </div>
        <TextField
          label={t('shagun.fnsheet.name')}
          value={name}
          placeholder={fallback}
          hint={name.trim() ? undefined : t('shagun.fnsheet.name.hint', { name: fallback })}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_FUNCTION_NAME}
          autoComplete="off"
        />
        {full && <p className={styles.fine}>{t('shagun.fnsheet.full')}</p>}
      </form>
    </BottomSheet>
  )
}
