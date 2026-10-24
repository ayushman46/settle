import { useRef, useState, type KeyboardEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { ActionBar, AmountInput, BottomSheet, Button, Stepper, TextField } from '../../components'
import { formatQuantity } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { cleanAmountText, formatMoney, parseMoneyInput, toInputString } from '../../lib/money'
import { MAX_ITEM_NAME } from '../../state/reducer'
import { useT } from '../../i18n'
import type { BillItem, Minor } from '../../types'
import styles from './ItemEditorSheet.module.css'

/** What the editor hands back: a clean name, a quantity > 0 and a line amount. */
export interface ItemDraft {
  name: string
  quantity: number
  amount: Minor
}

export interface ItemEditorSheetProps {
  open: boolean
  /** The item being edited, or null to add a new one. Mount with a fresh `key` per opening. */
  item: BillItem | null
  currency: string
  onClose: () => void
  /** `addAnother`: the editor stays open with an empty form (new items only). */
  onSave: (draft: ItemDraft, addAnother: boolean) => void
  /** Shown for existing items. */
  onDelete?: () => void
}

/** Most units on one line the stepper offers. */
const MAX_QUANTITY = 99

/** Bottom-sheet form for one bill line: name, quantity and the price for the whole line. */
export function ItemEditorSheet({ open, item, currency, onClose, onSave, onDelete }: ItemEditorSheetProps) {
  const t = useT()
  const isNew = item === null
  const [name, setName] = useState(item?.name ?? '')
  const [quantity, setQuantity] = useState(item?.quantity ?? 1)
  const [amountText, setAmountText] = useState(item ? toInputString(item.amount, currency, { trimZeros: true }) : '')
  const [showErrors, setShowErrors] = useState(false)
  const [added, setAdded] = useState(0)
  const nameRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  const trimmed = name.trim()
  const amount = parseMoneyInput(amountText, currency)
  const valid = trimmed !== '' && amount !== null
  const touched = name !== '' || amountText !== ''

  const submit = (addAnother: boolean): void => {
    if (trimmed === '' || amount === null) {
      setShowErrors(true)
      haptic('warning')
      ;(trimmed === '' ? nameRef : amountRef).current?.focus()
      return
    }
    haptic('success')
    onSave({ name: trimmed, quantity, amount }, addAnother)
    if (addAnother) {
      // A fresh form slides in (new contentKey) and its name field takes focus.
      setName('')
      setQuantity(1)
      setAmountText('')
      setShowErrors(false)
      setAdded((n) => n + 1)
    }
  }

  const onNameKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    amountRef.current?.focus()
  }

  const onAmountKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    submit(false)
  }

  let unitHint: string | undefined
  if (amount !== null && quantity > 1) {
    const unit = Math.round(amount / quantity)
    const exact = unit * quantity === amount
    unitHint = t('bill.item.unit.hint', { exact: exact ? 'yes' : 'no', amount: formatMoney(unit, currency) })
  }

  let footerHint: string | undefined
  if (touched && !valid) footerHint = t(trimmed === '' ? 'bill.item.name.error' : 'bill.item.price.missing')

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t(isNew ? 'bill.item.new.title' : 'bill.item.edit.title')}
      eyebrow={isNew && added > 0 ? t('bill.item.added', { count: added }) : undefined}
      contentKey={added}
      footer={
        isNew ? (
          <ActionBar hint={footerHint}>
            <Button block disabled={!valid} onClick={() => submit(false)}>
              {t('bill.item.save.cta')}
            </Button>
            <Button block variant="ghost" size="md" iconStart={<Plus />} disabled={!valid} onClick={() => submit(true)}>
              {t('bill.item.saveAnother.cta')}
            </Button>
          </ActionBar>
        ) : (
          <ActionBar hint={footerHint} direction="row">
            <Button variant="danger" iconStart={<Trash2 />} onClick={onDelete}>
              {t('bill.item.delete.cta')}
            </Button>
            <Button disabled={!valid} onClick={() => submit(false)}>
              {t('bill.item.saveEdit.cta')}
            </Button>
          </ActionBar>
        )
      }
    >
      <div className={styles.form}>
        <TextField
          ref={nameRef}
          label={t('bill.item.name.label')}
          placeholder={t('bill.item.name.placeholder')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={onNameKeyDown}
          autoFocus={isNew}
          maxLength={MAX_ITEM_NAME}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="next"
          error={showErrors && trimmed === '' ? t('bill.item.name.error') : undefined}
        />
        <div className={styles.row}>
          <div className={styles.qty}>
            <span className={styles.qtyLabel} aria-hidden="true">
              {t('bill.item.qty.label')}
            </span>
            <div className={styles.qtyControl}>
              <Stepper
                label={t('bill.item.qty.aria')}
                size="md"
                value={quantity}
                min={Math.min(1, quantity)}
                max={Math.max(MAX_QUANTITY, quantity)}
                onChange={setQuantity}
                formatValue={formatQuantity}
              />
            </div>
          </div>
          <AmountInput
            ref={amountRef}
            size="field"
            label={t('bill.item.price.label')}
            currency={currency}
            value={amountText}
            onChange={(text) => setAmountText(cleanAmountText(text, currency))}
            onKeyDown={onAmountKeyDown}
            placeholder="0"
            enterKeyHint="done"
            hint={unitHint}
            error={showErrors && amount === null ? t('bill.item.price.error') : undefined}
            containerClassName={styles.amount}
          />
        </div>
      </div>
    </BottomSheet>
  )
}
