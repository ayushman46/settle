import { useState } from 'react'
import { CircleCheck } from 'lucide-react'
import { AmountInput, BottomSheet, Button } from '../../components'
import type { Minor } from '../../domain/types'
import { useT } from '../../i18n'
import { formatMoney, parseMoneyInput } from '../../lib/money'
import styles from './RepaySheet.module.css'

export interface RepaySheetProps {
  open: boolean
  onClose: () => void
  /** I lent it (they return some) or borrowed it (I pay some back). */
  mine: boolean
  /** The other person's name. */
  name: string
  /** What's still open, in minor units. */
  total: Minor
  currency: string
  /** Called with 1 … total − 1. */
  onSave: (amount: Minor) => void
}

/** "How much did Riya return?" — part of an open 1:1 entry comes back; the rest stays open. */
export function RepaySheet({ open, onClose, mine, name, total, currency, onSave }: RepaySheetProps) {
  const t = useT()
  const [text, setText] = useState('')
  const [tried, setTried] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setText('')
      setTried(false)
    }
  }
  const money = (minor: Minor) => formatMoney(minor, currency, { trimZeros: true })
  const amount = parseMoneyInput(text, currency)
  const whole = amount !== null && amount >= total
  const valid = amount !== null && amount > 0 && amount < total
  const error =
    tried || whole
      ? whole
        ? t(mine ? 'lend.repay.error.lent.whole' : 'lend.repay.error.borrowed.whole', { amount: money(total) })
        : valid
          ? undefined
          : t('lend.repay.error.empty')
      : undefined

  const save = (): void => {
    setTried(true)
    if (valid && amount !== null) onSave(amount)
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={mine ? t('lend.repay.lent.title', { name }) : t('lend.repay.borrowed.title')}
      description={t('lend.repay.description', { amount: money(total) })}
      footer={
        <Button block iconStart={<CircleCheck />} onClick={save} disabled={whole}>
          {t('lend.repay.save.cta')}
        </Button>
      }
    >
      <div className={styles.body}>
        <AmountInput
          size="field"
          label={t('lend.repay.amount.label')}
          currency={currency}
          value={text}
          onChange={setText}
          autoFocus
          enterKeyHint="done"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              save()
            }
          }}
          error={error}
        />
      </div>
    </BottomSheet>
  )
}
