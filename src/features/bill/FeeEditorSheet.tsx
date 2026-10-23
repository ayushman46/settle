import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { ListPlus, Trash2 } from 'lucide-react'
import { ActionBar, AmountInput, BottomSheet, Button, TextField } from '../../components'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { cleanAmountText, parseMoneyInput, toInputString } from '../../lib/money'
import { MAX_FEE_LABEL } from '../../state/reducer'
import type { BillFee, BillFeeKind, Minor } from '../../types'
import { BILL_FEE_KINDS, defaultFeeLabel, FEE_EMOJI, feeKindLabel } from './feeView'
import styles from './FeeEditorSheet.module.css'

/** What the sheet hands back: a name (never blank), a kind and an amount > 0. */
export interface FeeDraft {
  label: string
  kind: BillFeeKind
  amount: Minor
}

export interface FeeEditorSheetProps {
  open: boolean
  /** The fee being edited, or null to add one (kind "Other"). Mount with a fresh `key` per opening. */
  fee: BillFee | null
  currency: string
  onClose: () => void
  onSave: (draft: FeeDraft) => void
  /** Shown for existing fees ("Remove fee"). */
  onRemove?: () => void
  /** Shown for a tip: turns the fee into an item that can be given to one person. */
  onMakeItem?: (draft: FeeDraft) => void
}

/**
 * One delivery-app fee: its name as printed, what kind it is (a chip radio group with each kind's
 * emoji) and the amount. A tip can become an item instead, for when only one person is tipping.
 */
export function FeeEditorSheet({ open, fee, currency, onClose, onSave, onRemove, onMakeItem }: FeeEditorSheetProps) {
  const t = useT()
  const isNew = fee === null
  const [label, setLabel] = useState(fee?.label ?? '')
  const [kind, setKind] = useState<BillFeeKind>(fee?.kind ?? 'other')
  const [amountText, setAmountText] = useState(fee ? toInputString(fee.amount, currency, { trimZeros: true }) : '')
  const [showErrors, setShowErrors] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)
  const kindName = useId()
  const kindLegend = useId()

  const amount = parseMoneyInput(amountText, currency)
  const valid = amount !== null && amount > 0
  const draft = (): FeeDraft | null => {
    if (amount === null || amount <= 0) return null
    return { label: label.trim() || defaultFeeLabel(kind), kind, amount }
  }

  const submit = (): void => {
    const value = draft()
    if (!value) {
      setShowErrors(true)
      haptic('warning')
      amountRef.current?.focus()
      return
    }
    haptic('success')
    onSave(value)
  }

  const makeItem = (): void => {
    const value = draft()
    if (!value) {
      setShowErrors(true)
      amountRef.current?.focus()
      return
    }
    onMakeItem?.(value)
  }

  const onNameKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    amountRef.current?.focus()
  }

  const onAmountKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    submit()
  }

  const amountError = showErrors && !valid ? t('delivery.fee.amount.error') : undefined

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('delivery.fee.title')}
      footer={
        isNew ? (
          <ActionBar>
            <Button block disabled={!valid} onClick={submit}>
              {t('delivery.fee.add.cta')}
            </Button>
          </ActionBar>
        ) : (
          <ActionBar direction="row">
            <Button variant="danger" iconStart={<Trash2 />} onClick={onRemove}>
              {t('delivery.fee.remove.cta')}
            </Button>
            <Button disabled={!valid} onClick={submit}>
              {t('delivery.fee.save.cta')}
            </Button>
          </ActionBar>
        )
      }
    >
      <div className={styles.form}>
        <TextField
          label={t('delivery.fee.name.label')}
          placeholder={defaultFeeLabel(kind)}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={onNameKeyDown}
          maxLength={MAX_FEE_LABEL}
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="next"
        />

        <fieldset className={styles.kinds} aria-labelledby={kindLegend}>
          <legend id={kindLegend} className={styles.legend}>
            {t('delivery.fee.kind.label')}
          </legend>
          <div className={styles.kindList}>
            {BILL_FEE_KINDS.map((k) => (
              <label key={k} className={cx(styles.kind, k === kind && styles.kindOn)}>
                <input
                  type="radio"
                  name={kindName}
                  value={k}
                  checked={k === kind}
                  onChange={() => {
                    haptic('select')
                    setKind(k)
                  }}
                  className={styles.radio}
                />
                <span className={styles.emoji} aria-hidden="true">
                  {FEE_EMOJI[k]}
                </span>
                <span>{feeKindLabel(k)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <AmountInput
          ref={amountRef}
          size="field"
          label={t('delivery.fee.amount.label')}
          currency={currency}
          value={amountText}
          onChange={(text) => setAmountText(cleanAmountText(text, currency))}
          onKeyDown={onAmountKeyDown}
          placeholder="0"
          enterKeyHint="done"
          autoFocus={isNew}
          error={amountError}
        />

        {kind === 'tip' && onMakeItem && (
          <div className={styles.tip}>
            <p className={styles.tipText}>{t('delivery.fee.tip.hint')}</p>
            <Button size="sm" variant="secondary" iconStart={<ListPlus />} onClick={makeItem}>
              {t('delivery.fee.tip.cta')}
            </Button>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
