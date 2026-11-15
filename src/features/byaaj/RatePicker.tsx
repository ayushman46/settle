import { useState } from 'react'
import { Button, Chip, SegmentedControl, TextField } from '../../components'
import { useT } from '../../i18n'
import { parsePercent, percentText, RATE_CHOICES, sameRate, type Rate, type RatePer } from './engine'
import { rateLabel } from './byaajText'
import styles from './Byaaj.module.css'

export interface RatePickerProps {
  /** The rate set now, or null when none is yet. */
  value: Rate | null
  onPick: (rate: Rate) => void
  /**
   * Setting interest for the first time: "Other" is set only by its button (or Enter), because the
   * screen changes the moment a rate exists and "a month / a year" must be chosen first. Once a
   * rate exists, what is typed is also kept when the field is left.
   */
  explicit?: boolean
}

/**
 * The rate chips: 1% a month, 2% a month, 12% a year, Other. One tap sets a rate. "Other" opens a
 * percent field with "a month / a year" and a button; a rate that can't be set changes nothing
 * and says what is wrong.
 */
export function RatePicker({ value, onPick, explicit = false }: RatePickerProps) {
  const t = useT()
  const custom = value !== null && !RATE_CHOICES.some((choice) => sameRate(choice, value))
  const [other, setOther] = useState(custom)
  const [text, setText] = useState(custom ? percentText(value.bp) : '')
  const [per, setPer] = useState<RatePer>(custom ? value.per : 'month')
  const [tried, setTried] = useState(false)
  const showOther = other || custom

  const pick = (rate: Rate): void => {
    setOther(false)
    setTried(false)
    if (value === null || !sameRate(rate, value)) onPick(rate)
  }

  const commit = (strict: boolean, withPer: RatePer = per): void => {
    const bp = parsePercent(text)
    if (bp === null) {
      if (strict) setTried(true)
      return
    }
    setTried(false)
    const rate: Rate = { bp, per: withPer }
    if (value === null || !sameRate(rate, value)) onPick(rate)
  }

  return (
    <div className={styles.picker}>
      <div className={styles.chips} role="radiogroup" aria-label={t('byaaj.rate.pick.aria')}>
        {RATE_CHOICES.map((choice) => (
          <Chip key={`${choice.bp}-${choice.per}`} size="lg" role="radio" selected={!showOther && value !== null && sameRate(choice, value)} onClick={() => pick(choice)}>
            {rateLabel(choice)}
          </Chip>
        ))}
        <Chip size="lg" role="radio" selected={showOther} onClick={() => setOther(true)}>
          {custom ? t('byaaj.rate.other.set', { rate: rateLabel(value) }) : t('byaaj.rate.other')}
        </Chip>
      </div>
      {showOther && (
        <div className={styles.other}>
          <TextField
            label={t('byaaj.rate.other.label')}
            value={text}
            inputMode="decimal"
            placeholder="1.5"
            maxLength={6}
            enterKeyHint="done"
            onChange={(event) => setText(event.target.value)}
            onBlur={() => {
              if (!explicit) commit(false)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault()
                commit(true)
              }
            }}
            error={tried && parsePercent(text) === null ? t('byaaj.rate.other.error') : undefined}
          />
          <SegmentedControl
            ariaLabel={t('byaaj.rate.other.per.aria')}
            value={per}
            onChange={(next) => {
              setPer(next)
              // A rate already typed follows the switch at once; an empty field waits for its number.
              if (!explicit && parsePercent(text) !== null) commit(false, next)
            }}
            options={[
              { value: 'month', label: t('byaaj.rate.per.month') },
              { value: 'year', label: t('byaaj.rate.per.year') },
            ]}
          />
          <Button size="md" variant="secondary" onClick={() => commit(true)}>
            {t('byaaj.rate.other.save')}
          </Button>
        </div>
      )}
    </div>
  )
}
