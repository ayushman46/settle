import { useId, useState } from 'react'
import { AmountInput, Button, Chip } from '../../components'
import type { Minor } from '../../domain/types'
import { useT } from '../../i18n'
import { formatMoney, parseMoneyInput, toInputString } from '../../lib/money'
import { isLimitAmount, limitChoices } from './engine'
import styles from './Limit.module.css'

export type LimitChoice = Minor | 'none' | 'everyone'

export interface LimitPickerProps {
  /** Names the group of chips: "Limit for Riya". */
  label: string
  /** What is set now: an amount, none, or (for a friend) the one for everyone. */
  value: LimitChoice
  currency: string
  /** The limit for everyone, when picking for one friend and there is one: offered as its own chip. */
  everyone?: Minor | null
  onPick: (choice: LimitChoice) => void
}

/**
 * The chips: ₹500, ₹1,000, ₹2,000, ₹5,000, Other, None (and "Same as everyone" for a friend when
 * there is a limit for everyone). One tap sets it. "Other" opens a field; what is typed there is
 * kept when the field is left (a valid amount is set, an empty one changes nothing).
 */
export function LimitPicker({ label, value, currency, everyone = null, onPick }: LimitPickerProps) {
  const t = useT()
  const fieldId = useId()
  const choices = limitChoices(currency)
  const custom = typeof value === 'number' && !choices.includes(value)
  const [other, setOther] = useState(custom)
  const [text, setText] = useState(custom ? toInputString(value, currency, { trimZeros: true }) : '')
  const [tried, setTried] = useState(false)
  const money = (minor: Minor): string => formatMoney(minor, currency, { trimZeros: true })
  const showOther = other || custom

  const pick = (choice: LimitChoice): void => {
    setOther(false)
    setTried(false)
    if (choice !== value) onPick(choice)
  }

  const typed = parseMoneyInput(text, currency)
  const commit = (strict: boolean): void => {
    if (typed !== null && isLimitAmount(typed)) {
      setTried(false)
      if (typed !== value) onPick(typed)
    } else if (strict) {
      setTried(true)
    }
  }

  return (
    <div className={styles.picker}>
      <div className={styles.chips} role="radiogroup" aria-label={label}>
        {choices.map((amount) => (
          <Chip key={amount} size="lg" role="radio" selected={!showOther && value === amount} onClick={() => pick(amount)}>
            {money(amount)}
          </Chip>
        ))}
        <Chip
          size="lg"
          role="radio"
          selected={showOther}
          onClick={() => {
            setOther(true)
            if (!custom) setText('')
          }}
        >
          {custom ? t('limit.pick.other.set', { amount: money(value) }) : t('limit.pick.other')}
        </Chip>
        {everyone !== null && (
          <Chip size="lg" role="radio" selected={!showOther && value === 'everyone'} onClick={() => pick('everyone')}>
            {t('limit.pick.everyone', { amount: money(everyone) })}
          </Chip>
        )}
        <Chip size="lg" role="radio" selected={!showOther && value === 'none'} onClick={() => pick('none')}>
          {t('limit.pick.none')}
        </Chip>
      </div>
      {showOther && (
        <div className={styles.other}>
          <AmountInput
            id={fieldId}
            size="field"
            label={t('limit.other.label')}
            currency={currency}
            value={text}
            onChange={setText}
            placeholder="3,000"
            enterKeyHint="done"
            onBlur={() => commit(false)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault()
                commit(true)
              }
            }}
            error={tried && (typed === null || !isLimitAmount(typed)) ? t('limit.other.error') : undefined}
          />
          <Button size="md" variant="secondary" onClick={() => commit(true)}>
            {t('limit.other.save')}
          </Button>
        </div>
      )}
    </div>
  )
}
