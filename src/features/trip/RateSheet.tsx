import { useState } from 'react'
import { AmountInput, BottomSheet, Button, SegmentedControl, TextField } from '../../components'
import type { Minor } from '../../domain/types'
import { convertMinor, rateFromTotals } from '../../engine/fx'
import { useT } from '../../i18n'
import { cleanAmountText, currencySymbol, formatMoney, parseMoneyInput, toInputString } from '../../lib/money'
import type { ManualRate } from '../split/splitForm'
import { typedRate } from './fxView'
import styles from './RateSheet.module.css'

type Mode = 'rate' | 'bank'

export interface RateSheetProps {
  open: boolean
  onClose: () => void
  /** The currency paid in, and the one it settles in. */
  paid: string
  settle: string
  /** What was paid (minor units of `paid`); null while no amount is typed. */
  amount: Minor | null
  /** The rate in use now (prefilled), or null when there's none. */
  rate: string | null
  /** The typed rate or bank total in use, if any. */
  manual: ManualRate | null
  /** Offers "Use the ECB rate" (only when the ECB has one for the day). */
  ecbAvailable: boolean
  /** Saves a typed rate or the bank's total. */
  onSave: (manual: ManualRate) => void
  /** Back to the ECB rate. */
  onUseEcb: () => void
}

/** Up to 7 whole digits and 10 decimals; "2,4108" (comma decimal) reads as 2.4108. */
const RATE_INPUT = /^\d{0,7}(\.\d{0,10})?$/

/** The rate as typed, tidied ("2,41" → "2.41"), or null when it can't be one. */
function cleanRateText(text: string): string | null {
  const next = text.replace(/,/g, '.').replace(/[^\d.]/g, '')
  return RATE_INPUT.test(next) ? next : null
}

function initialMode(manual: ManualRate | null): Mode {
  return manual?.source === 'manual_total' ? 'bank' : 'rate'
}

/**
 * "Exchange rate": a rate typed by hand ("1 THB = ₹ 2.4108"), or what the bank actually charged
 * in rupees (forex markup and all) — exact, from the bank SMS.
 */
export function RateSheet({ open, onClose, paid, settle, amount, rate, manual, ecbAvailable, onSave, onUseEcb }: RateSheetProps) {
  const t = useT()
  const symbol = currencySymbol(settle)
  const prefillRate = manual?.source === 'manual_rate' ? manual.rate : (rate ?? '')
  const prefillBank = manual?.source === 'manual_total' ? toInputString(manual.total, settle, { trimZeros: false }) : ''
  const [mode, setMode] = useState<Mode>(() => initialMode(manual))
  const [rateText, setRateText] = useState(prefillRate)
  const [bankText, setBankText] = useState(prefillBank)
  const [tried, setTried] = useState(false)
  // A fresh form every time it opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setMode(initialMode(manual))
      setRateText(prefillRate)
      setBankText(prefillBank)
      setTried(false)
    }
  }

  const parsedRate = typedRate(rateText)
  const bank = parseMoneyInput(bankText, settle)
  const bankOk = bank !== null && bank > 0
  const valid = mode === 'rate' ? parsedRate !== null : bankOk
  const error = tried && !valid ? (mode === 'rate' ? t('trip.sheet.rateError') : t('trip.sheet.bankError')) : null

  const paidText = amount !== null && amount > 0 ? formatMoney(amount, paid, { trimZeros: true }) : null
  let preview: string | null = null
  if (paidText && mode === 'rate' && parsedRate) preview = t('trip.sheet.preview', { paid: paidText, amount: formatMoney(convertMinor(amount ?? 0, paid, settle, parsedRate), settle) })
  if (paidText && mode === 'bank' && bankOk && amount !== null && rateFromTotals(amount, paid, bank, settle)) {
    preview = t('trip.sheet.preview', { paid: paidText, amount: formatMoney(bank, settle) })
  }

  const save = (): void => {
    if (!valid) {
      setTried(true)
      return
    }
    if (mode === 'rate' && parsedRate) {
      // The ECB's own rate, untouched: nothing to save.
      if (!manual && parsedRate === rate) {
        onClose()
        return
      }
      onSave({ source: 'manual_rate', rate: parsedRate })
    } else if (mode === 'bank' && bank !== null) onSave({ source: 'manual_total', total: bank })
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('trip.sheet.title')}
      footer={
        <div className={styles.footer}>
          {ecbAvailable && (manual !== null || mode === 'bank') && (
            <Button variant="secondary" block onClick={onUseEcb}>
              {t('trip.sheet.useEcb')}
            </Button>
          )}
          <Button block onClick={save}>
            {t('trip.sheet.save')}
          </Button>
        </div>
      }
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <SegmentedControl<Mode>
          ariaLabel={t('trip.sheet.mode')}
          value={mode}
          onChange={(next) => {
            setMode(next)
            setTried(false)
          }}
          options={[
            { value: 'rate', label: t('trip.sheet.mode.rate') },
            { value: 'bank', label: t('trip.sheet.mode.bank') },
          ]}
        />
        {mode === 'rate' ? (
          <TextField
            label={t('trip.sheet.rateLabel', { from: paid })}
            value={rateText}
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            startAdornment={<span className={styles.symbol}>{symbol}</span>}
            placeholder="0.00"
            error={error ?? undefined}
            onChange={(event) => {
              const next = cleanRateText(event.target.value)
              if (next !== null) setRateText(next)
            }}
          />
        ) : (
          <div className={styles.bank}>
            <AmountInput
              size="field"
              label={t('trip.sheet.bankLabel')}
              currency={settle}
              value={bankText}
              placeholder="0"
              enterKeyHint="done"
              hint={settle === 'INR' ? t('trip.sheet.bankHint') : t('trip.sheet.bankHintOther')}
              error={error ?? undefined}
              onChange={(raw) => setBankText(cleanAmountText(raw, settle))}
            />
          </div>
        )}
        {preview && (
          <p className={styles.preview} aria-live="polite">
            {preview}
          </p>
        )}
      </form>
    </BottomSheet>
  )
}
