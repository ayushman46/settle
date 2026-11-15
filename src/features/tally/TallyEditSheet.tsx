import { useState } from 'react'
import { AmountInput, BottomSheet, Button, TextField, useToast } from '../../components'
import { cleanUpiId } from '../../data/schemas'
import { useT } from '../../i18n'
import { DateField } from '../../kit/index-a'
import { commaIsDecimal, parseMoneyInput, toInputString } from '../../lib/money'
import { mobileOf } from '../../lib/upiGuess'
import { rateOn, type Tally, type TallyVendor } from './engine'
import { dayName, rateLabel } from './labels'
import { MAX_VENDOR_NAME, putTally, setRate, setVendor } from './store'
import styles from './Tally.module.css'

export interface TallyEditSheetProps {
  tally: Tally
  /** The day the sheet was opened on: a new rate starts from it unless another date is picked. */
  today: string
  open: boolean
  onClose: () => void
}

/**
 * The rate from a date ("₹64 a litre from 1 Dec": the days before keep the old rate), and the
 * vendor, saved once: a name and a UPI ID or phone number.
 */
export function TallyEditSheet({ tally, today, open, onClose }: TallyEditSheetProps) {
  const t = useT()
  const toast = useToast()
  const [from, setFrom] = useState(today)
  const [rate, setRateText] = useState(() => toInputString(rateOn(tally, today), tally.currency))
  const [vendor, setVendorName] = useState(tally.vendor?.name ?? '')
  const [contact, setContact] = useState(tally.vendor?.upiId ?? tally.vendor?.phone ?? '')
  const [error, setError] = useState<{ field: 'rate' | 'vendor' | 'contact'; text: string } | null>(null)

  const save = () => {
    const paise = parseMoneyInput(rate, tally.currency)
    if (paise === null || paise <= 0) return setError({ field: 'rate', text: t('tally.new.error.rate') })
    const name = vendor.trim()
    const typed = contact.trim()
    const upiId = typed.includes('@') ? cleanUpiId(typed) : null
    const phone = upiId ? null : mobileOf(typed)
    if (typed && !upiId && !phone) return setError({ field: 'contact', text: t('tally.edit.vendor.upi.error') })
    if (typed && !name) return setError({ field: 'vendor', text: t('tally.edit.vendor.needName') })
    const next: TallyVendor | null = name ? { name, upiId, phone } : null

    const newRate = paise !== rateOn(tally, from)
    if (newRate && !setRate(tally.id, from, paise)) return setError({ field: 'rate', text: t('tally.edit.locked') })
    setVendor(tally.id, next)
    onClose()
    toast(newRate ? t('tally.edit.saved.rate', { rate: rateLabel(tally, paise), date: dayName(from) }) : t('tally.edit.saved'), {
      tone: 'success',
      action: { label: t('common.action.undo'), onAction: () => putTally(tally) },
    })
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('tally.edit.title', { name: tally.name })}
      footer={
        <Button block onClick={save}>
          {t('common.action.save')}
        </Button>
      }
    >
      <div className={styles.sheet}>
        <AmountInput
          size="field"
          label={t('tally.edit.rate', { per: t(`tally.per.${tally.unit}`) })}
          value={rate}
          onChange={(text) => {
            setRateText(text)
            setError(null)
          }}
          currency={tally.currency}
          commaGroups={!commaIsDecimal(tally.currency)}
          error={error?.field === 'rate' ? error.text : undefined}
        />
        <div className={styles.block}>
          <div className={styles.fieldRow}>
            <span className={styles.body}>{t('tally.edit.rate.from')}</span>
            <DateField
              label={t('tally.edit.rate.from')}
              value={from}
              min={tally.start}
              max={null}
              onChange={(value) => {
                setFrom(value)
                setError(null)
              }}
            />
          </div>
          <p className={styles.fine}>{t('tally.edit.rate.hint')}</p>
        </div>
        <TextField
          label={t('tally.edit.vendor')}
          placeholder={t('tally.edit.vendor.placeholder')}
          value={vendor}
          maxLength={MAX_VENDOR_NAME}
          onChange={(e) => {
            setVendorName(e.target.value)
            setError(null)
          }}
          error={error?.field === 'vendor' ? error.text : undefined}
          autoComplete="off"
        />
        <TextField
          label={t('tally.edit.vendor.upi')}
          placeholder={t('tally.edit.vendor.upi.placeholder')}
          value={contact}
          onChange={(e) => {
            setContact(e.target.value)
            setError(null)
          }}
          error={error?.field === 'contact' ? error.text : undefined}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
      </div>
    </BottomSheet>
  )
}
