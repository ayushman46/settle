import { useState } from 'react'
import { BellRing, EyeOff, ListChecks, ShieldCheck, Smartphone, Zap } from 'lucide-react'
import { navigate } from '../../app/router'
import { ActionBar, BottomSheet, Button, Card, Switch, useToast } from '../../components'
import { useStore } from '../../data'
import { autoSettleStore } from '../../data/stores'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { WHOS_PAID_PATH } from '../whospaid/paths'
import { openAutoSettleSettings, setAutoSettleSms, turnOnAutoSettle, useAutoSettleStatus, type AutoSettleStatus } from './useAutoSettle'
import styles from './AutoSettle.module.css'

/** "Who's paid?" on the payments Auto-settle wasn't sure of. */
export const PENDING_PATH = `${WHOS_PAID_PATH}?from=alerts`

/**
 * Auto-settle's place on "To collect" and "Who's paid?" (the Android app only): turn it on, see it's
 * on, and the payments it wasn't sure of, waiting for a tap. On the web it shows nothing.
 */
export function AutoSettleCard() {
  const t = useT()
  const { status, refresh } = useAutoSettleStatus()
  const pending = useStore(autoSettleStore, (s) => s.pending.length)
  const [open, setOpen] = useState(false)
  if (!status.available) return null

  return (
    <>
      {pending > 0 && (
        <Button variant="tonal" block iconStart={<ListChecks />} onClick={() => navigate(PENDING_PATH)}>
          {t('autosettle.pending', { count: pending })}
        </Button>
      )}
      {status.granted ? (
        <Card className={styles.on}>
          <span className={styles.icon} aria-hidden="true">
            <ShieldCheck />
          </span>
          <div className={styles.text}>
            <h2 className={styles.title}>{t('autosettle.on.title')}</h2>
            <p className={styles.body}>{t('autosettle.on.text')}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
            {t('autosettle.manage')}
          </Button>
        </Card>
      ) : (
        <Card className={styles.offer}>
          <div className={styles.head}>
            <span className={styles.icon} aria-hidden="true">
              <Zap />
            </span>
            <div className={styles.text}>
              <h2 className={styles.title}>{t('autosettle.offer.title')}</h2>
              <p className={styles.body}>{t('autosettle.offer.text')}</p>
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

/**
 * What Auto-settle reads and what it does with it, before Android is asked (Play's "prominent
 * disclosure"); later, where bank SMS alerts are switched and Auto-settle is turned off.
 */
export function AutoSettleSheet({ open, onClose, status, onChanged }: { open: boolean; onClose: () => void; status: AutoSettleStatus; onChanged: () => void }) {
  const t = useT()
  const toast = useToast()
  const [sms, setSms] = useState(status.sms)
  const [seen, setSeen] = useState(status.sms)
  // Follow the phone's setting when it changes (back from Android's settings).
  if (seen !== status.sms) {
    setSeen(status.sms)
    setSms(status.sms)
  }

  const allow = async () => {
    try {
      haptic('tap')
      await turnOnAutoSettle(sms)
      onClose()
    } catch {
      toast(t('autosettle.error'), { tone: 'error' })
    }
  }
  const save = async (next: boolean) => {
    setSms(next)
    try {
      await setAutoSettleSms(next)
      onChanged()
    } catch {
      toast(t('autosettle.error'), { tone: 'error' })
    }
  }
  const turnOff = async () => {
    try {
      await openAutoSettleSettings()
      onClose()
    } catch {
      toast(t('autosettle.error'), { tone: 'error' })
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('autosettle.sheet.title')}
      description={t('autosettle.sheet.description')}
      footer={
        <ActionBar>
          {status.granted ? (
            <div className={styles.actions}>
              <Button block onClick={onClose}>
                {t('autosettle.sheet.done')}
              </Button>
              <Button block variant="ghost" onClick={() => void turnOff()}>
                {t('autosettle.sheet.off')}
              </Button>
            </div>
          ) : (
            <div className={styles.actions}>
              <Button block onClick={() => void allow()}>
                {t('autosettle.sheet.allow')}
              </Button>
              <Button block variant="ghost" onClick={onClose}>
                {t('autosettle.sheet.later')}
              </Button>
            </div>
          )}
        </ActionBar>
      }
    >
      <ul className={styles.points}>
        <li>
          <BellRing aria-hidden="true" />
          <span>{t('autosettle.sheet.reads')}</span>
        </li>
        <li>
          <Zap aria-hidden="true" />
          <span>{t('autosettle.sheet.does')}</span>
        </li>
        <li>
          <EyeOff aria-hidden="true" />
          <span>{t('autosettle.sheet.private')}</span>
        </li>
        <li>
          <Smartphone aria-hidden="true" />
          <span>{t('autosettle.sheet.stop')}</span>
        </li>
      </ul>
      <Switch
        checked={sms}
        onChange={(next) => (status.granted ? void save(next) : setSms(next))}
        label={t('autosettle.sheet.sms.label')}
        description={t('autosettle.sheet.sms.description')}
      />
    </BottomSheet>
  )
}
