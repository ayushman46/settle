import { useState } from 'react'
import { ShieldCheck, Zap } from 'lucide-react'
import { Button, Card } from '../../components'
import { useT } from '../../i18n'
import { inAndroidApp } from '../../lib/nativeApp'
import { AutoSettleSheet } from '../autosettle/AutoSettleCard'
import { useAutoSettleStatus } from '../autosettle/useAutoSettle'
import auto from '../autosettle/AutoSettle.module.css'

/**
 * Auto-settle's place on "Stuck money" (the Android app only): the same notification access that
 * ticks friends off now also catches failed payments and refunds, and closes them when the money
 * comes back. Turn it on, or see that it's on. On the web it shows nothing.
 */
export function StuckAlertsCard() {
  const t = useT()
  const { status, refresh } = useAutoSettleStatus()
  const [open, setOpen] = useState(false)
  if (!status.available || !inAndroidApp()) return null

  return (
    <>
      {status.granted ? (
        <Card className={auto.on}>
          <span className={auto.icon} aria-hidden="true">
            <ShieldCheck />
          </span>
          <div className={auto.text}>
            <h2 className={auto.title}>{t('stuck.alerts.on.title')}</h2>
            <p className={auto.body}>{t('stuck.alerts.on.text')}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
            {t('autosettle.manage')}
          </Button>
        </Card>
      ) : (
        <Card className={auto.offer}>
          <div className={auto.head}>
            <span className={auto.icon} aria-hidden="true">
              <Zap />
            </span>
            <div className={auto.text}>
              <h2 className={auto.title}>{t('stuck.alerts.offer.title')}</h2>
              <p className={auto.body}>{t('stuck.alerts.offer.text')}</p>
            </div>
          </div>
          <Button block onClick={() => setOpen(true)}>
            {t('autosettle.offer.cta')}
          </Button>
        </Card>
      )}
      <AutoSettleSheet open={open} onClose={() => setOpen(false)} status={status} onChanged={refresh} />
    </>
  )
}
