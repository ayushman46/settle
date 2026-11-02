/**
 * Bank charges' place for the Android app's alerts: with Bank SMS on, Settle reads the bank's
 * messages about charges as they come (src/features/autosettle/useAutoSettle.ts). Says so, or
 * offers to turn it on. On the web it shows nothing.
 */
import { useState } from 'react'
import { MessageSquareText } from 'lucide-react'
import { Button, Card } from '../../components'
import { useT } from '../../i18n'
import { inAndroidApp } from '../../lib/nativeApp'
import { AutoSettleSheet } from '../autosettle/AutoSettleCard'
import { useAutoSettleStatus } from '../autosettle/useAutoSettle'
import auto from '../autosettle/AutoSettle.module.css'

export function FeeAlertsCard() {
  const t = useT()
  const { status, refresh } = useAutoSettleStatus()
  const [open, setOpen] = useState(false)
  if (!status.available || !inAndroidApp()) return null
  const on = status.granted && status.sms
  return (
    <>
      <Card className={on ? auto.on : auto.offer}>
        <span className={auto.icon} aria-hidden="true">
          <MessageSquareText />
        </span>
        <div className={auto.text}>
          <h2 className={auto.title}>{t('fees.android.title')}</h2>
          <p className={auto.body}>{on ? t('fees.android.on') : t('fees.android.text')}</p>
        </div>
        <Button size="sm" variant={on ? 'ghost' : 'secondary'} onClick={() => setOpen(true)}>
          {on ? t('autosettle.manage') : t('fees.android.cta')}
        </Button>
      </Card>
      <AutoSettleSheet open={open} onClose={() => setOpen(false)} status={status} onChanged={refresh} />
    </>
  )
}
