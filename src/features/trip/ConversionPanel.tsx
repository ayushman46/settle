import { ArrowRightLeft, CircleAlert, RotateCcw } from 'lucide-react'
import { Button, Skeleton, Switch } from '../../components'
import { useT } from '../../i18n'
import { formatMoney } from '../../lib/money'
import type { Conversion } from '../split/splitForm'
import { convertedLabel, rateText, shortDate, sourceText, switchText, unavailableText } from './fxView'
import styles from './ConversionPanel.module.css'

export interface ConversionPanelProps {
  /** Where the conversion stands (`resolveConversion`); `none` with the switch off. */
  conversion: Conversion
  /** The currency paid in (the amount's). */
  paid: string
  /** The currency it settles in (the group's or the profile's). */
  settle: string
  /** The expense's date (for "No rate for THB on 21 Oct" and "Use the ECB rate for 21 Oct"). */
  date: string
  /** The "Settle in ₹" switch. */
  converting: boolean
  onConvertChange: (on: boolean) => void
  /** Opens the exchange rate sheet ("Change" / "Add rate"). */
  onChangeRate: () => void
  /** Drops a frozen rate for the ECB's on the expense's date (only offered for a frozen rate). */
  onUseEcb: () => void
}

/**
 * Under the amount when it's paid in another currency than the one it settles in: what it comes
 * to ("≈ ₹3,013.44"), the rate and where it's from ("1 THB = ₹2.4108 · ECB rate for 21 Oct"), a
 * way to change it, and the "Settle in ₹" switch. Says so plainly when there's no rate to be had.
 */
export function ConversionPanel({ conversion, paid, settle, date, converting, onConvertChange, onChangeRate, onUseEcb }: ConversionPanelProps) {
  const t = useT()
  const sw = switchText(settle)
  return (
    <section role="group" aria-label={t('trip.panel.label')} className={styles.panel}>
      {converting && conversion.status === 'loading' && (
        <div className={styles.loading} role="status">
          <Skeleton width="45%" height={28} shape="md" />
          <p className={styles.line}>{t('trip.panel.loading')}</p>
        </div>
      )}

      {converting && conversion.status === 'unavailable' && (
        <div className={styles.missing}>
          <p className={styles.missingText}>
            <CircleAlert aria-hidden="true" className={styles.missingIcon} />
            <span>{unavailableText(conversion.reason, paid, date)}</span>
          </p>
          <Button size="sm" variant="tonal" onClick={onChangeRate}>
            {t('trip.panel.addRate')}
          </Button>
        </div>
      )}

      {converting && conversion.status === 'ok' && (
        <div className={styles.ok}>
          <ConvertedAmount conversion={conversion} paid={paid} settle={settle} />
          <div className={styles.rateRow}>
            <p className={styles.line}>
              {conversion.rate && <span className={styles.rate}>{rateText(conversion.rate, paid, settle)}</span>}
              {conversion.rate && <span aria-hidden="true"> · </span>}
              <span>{sourceText(conversion)}</span>
            </p>
            <Button size="sm" variant="ghost" iconStart={<ArrowRightLeft />} className={styles.change} onClick={onChangeRate} aria-label={t('trip.panel.changeLabel')}>
              {t('trip.panel.change')}
            </Button>
          </div>
          {conversion.frozen && (
            <Button size="sm" variant="ghost" iconStart={<RotateCcw />} className={styles.useEcb} onClick={onUseEcb}>
              {t('trip.panel.useEcb', { date: shortDate(date) })}
            </Button>
          )}
        </div>
      )}

      <Switch className={styles.switch} checked={converting} onChange={onConvertChange} label={sw.label} description={sw.note} />
    </section>
  )
}

function ConvertedAmount({ conversion, paid, settle }: { conversion: Extract<Conversion, { status: 'ok' }>; paid: string; settle: string }) {
  const t = useT()
  if (conversion.total === null) {
    return (
      <p className={styles.converted} aria-hidden="true">
        {t('trip.panel.converted', { amount: formatMoney(0, settle, { trimZeros: true }) })}
      </p>
    )
  }
  const amount = formatMoney(conversion.total, settle)
  const label = conversion.rate ? convertedLabel(amount, conversion.rate, paid, settle) : t('trip.panel.converted', { amount })
  return (
    <p className={styles.converted} aria-label={label} role="note">
      <span aria-hidden="true">{t('trip.panel.converted', { amount })}</span>
    </p>
  )
}
