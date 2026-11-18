import { useEffect, useState } from 'react'
import { BellRing, Check, X } from 'lucide-react'
import { Button, Card, SectionHeader, useToast } from '../../components'
import { useT } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { answerPayRequest, enableNotifications, notifyState, NOTIFIED_EVENT, subscribeThisBrowser, type NotifyState, type PayRequests } from './payRequests'
import { useAccountPeek } from './store'
import { useCloudGet } from './useCloud'
import styles from './PayRequestsCard.module.css'

/**
 * Home, for someone signed in: what friends on Settle have asked them to pay ("Ayush split Dinner
 * with you · Pay ₹800"), with Pay (their UPI app, amount filled in), I've paid and Hide, and a way
 * to get these as phone notifications. Also tells the person splitting when someone in their new
 * split was asked. Nothing at all when there's nothing waiting.
 */
export function PayRequestsCard() {
  const t = useT()
  const toast = useToast()
  const account = useAccountPeek()
  const signedIn = account.status === 'signedIn'
  const { data, reload } = useCloudGet<PayRequests>(signedIn ? '/requests' : null)
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())
  const [notify, setNotify] = useState<NotifyState>(() => notifyState())

  // The person splitting hears that their friends on Settle were asked.
  useEffect(() => {
    const onSent = (event: Event) => {
      const count = (event as CustomEvent<number>).detail
      toast(count === 1 ? t('account.requests.sent.one') : t('account.requests.sent.many', { count }), { tone: 'success' })
    }
    window.addEventListener(NOTIFIED_EVENT, onSent)
    return () => window.removeEventListener(NOTIFIED_EVENT, onSent)
  }, [toast, t])

  // Already allowed: keep this browser's push subscription current.
  useEffect(() => {
    if (signedIn && notify === 'granted') void subscribeThisBrowser()
  }, [signedIn, notify])

  const requests = (data?.requests ?? []).filter((r) => !hidden.has(r.id))
  if (!signedIn || requests.length === 0) return null

  const answer = async (id: string, action: 'paid' | 'dismissed', name: string) => {
    setHidden((prev) => new Set(prev).add(id))
    const res = await answerPayRequest(id, action)
    if (!res.ok) {
      setHidden((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      toast(res.message, { tone: 'error' })
      return
    }
    if (action === 'paid') toast(t('account.requests.done', { name }), { tone: 'success' })
    reload()
  }

  return (
    <section aria-labelledby="pay-requests">
      <SectionHeader id="pay-requests" title={t('account.requests.title')} />
      <Card className={styles.card}>
        <ul className={styles.list} role="list">
          {requests.map((r) => {
            const amount = formatMoney(r.amount, r.currency, { trimZeros: true })
            return (
              <li key={r.id} className={styles.item}>
                <p className={styles.row}>
                  <span className={styles.what}>{t('account.requests.row', { name: r.fromName, title: r.title })}</span>
                  <span className={styles.amount}>{amount}</span>
                </p>
                {r.upiId ? <p className={styles.note}>{t('account.requests.upi', { upi: r.upiId })}</p> : <p className={styles.note}>{t('account.requests.noUpi', { name: r.fromName })}</p>}
                <div className={styles.actions}>
                  {r.upiUri && (
                    <a className={styles.pay} href={r.upiUri}>
                      {t('account.requests.pay', { amount })}
                    </a>
                  )}
                  <Button size="sm" variant="secondary" iconStart={<Check />} onClick={() => void answer(r.id, 'paid', r.fromName)}>
                    {t('account.requests.paid')}
                  </Button>
                  <Button size="sm" variant="ghost" iconStart={<X />} onClick={() => void answer(r.id, 'dismissed', r.fromName)}>
                    {t('account.requests.hide')}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
        {notify === 'default' && (
          <Button size="sm" variant="tonal" iconStart={<BellRing />} className={styles.notify} onClick={() => void enableNotifications().then(setNotify)}>
            {t('account.requests.notify.cta')}
          </Button>
        )}
        {notify === 'denied' && <p className={styles.note}>{t('account.requests.notify.denied')}</p>}
      </Card>
    </section>
  )
}
