import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, MessageCircle, Share2, Store, Undo2 } from 'lucide-react'
import { goBack, useRoute } from '../../app/router'
import { Avatar, Banner, BottomSheet, Button, Chip, Money, PageTitle, ProgressRing, QrCode, Screen, SuccessCheck, TopBar, useToast } from '../../components'
import { useExpense, useFriendsById, useProfile } from '../../data'
import { ME_ID, type Expense } from '../../domain/types'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { UpiRoutes } from '../../kit/UpiRoutes'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { copyText, shareResult } from '../../lib/share'
import { whatsappUrl } from '../../share/links'
import { encodePayLink } from '../../share/payLink'
import { useTouchFirst } from '../pay/useTouchFirst'
import { isPaid, useCounterMarks, type Marks } from './live'
import { ScanShop } from './ScanShop'
import { canPayAtCounter, COUNTER_PATH, counterPayload, counterPeople, type Shop, type ShopQr } from './shop'
import { closeCounter, hasPaidAtCounter, openCounter, paidAtCounterAt, tickAtCounter, useCounter, useShops, type CounterEntry } from './store'
import styles from './Counter.module.css'

const ROUTES = [`${COUNTER_PATH}/:id`] as const

/**
 * `/app/counter/:id` — a bill paid at the counter. First the shop's QR is read (or a shop paid
 * before is picked); then one link, or the QR on this screen, lets everyone pay the shop their own
 * share from their own phone, and the list here ticks itself as they do: the screen to show the
 * cashier.
 */
export function CounterScreen() {
  const t = useT()
  const { params } = useRoute(ROUTES)
  const expense = useExpense(params.id ?? null)
  const entry = useCounter(expense?.id)
  if (!expense || !canPayAtCounter(expense)) {
    return (
      <Screen header={<TopBar onBack={() => goBack('/app')} />}>
        <PageTitle title={t('counter.gone.title')} subtitle={t('counter.gone.body')} />
      </Screen>
    )
  }
  return entry ? <Live expense={expense} entry={entry} /> : <Setup expense={expense} />
}

/* ------------------------------------------------------------------ which shop */

function Setup({ expense }: { expense: Expense }) {
  const t = useT()
  const friendsById = useFriendsById()
  const shops = useShops()
  const [fixed, setFixed] = useState<ShopQr | null>(null)
  const people = counterPeople(expense)
  const money = (paise: number) => formatMoney(paise, 'INR', { trimZeros: true })

  const open = (shop: Shop): void => {
    haptic('success')
    openCounter(expense.id, shop)
  }
  const found = (qr: ShopQr): void => {
    // A QR made for one bill carries its amount: paying it in parts can confuse the shop's till.
    if (qr.amount !== null) setFixed(qr)
    else open({ vpa: qr.vpa, name: qr.name ?? expense.title, mc: qr.mc, merchant: qr.merchant })
  }

  return (
    <Screen header={<TopBar onBack={() => goBack(`/app/expense/${expense.id}`)} />} contentClassName={styles.content}>
      <PageTitle eyebrow={expense.title} title={t('counter.setup.title')} subtitle={t('counter.setup.body')} />

      <ul className={styles.people} aria-label={t('counter.people.aria')}>
        {people.map((id) => (
          <li key={id} className={styles.person}>
            <Avatar name={friendLabel(id, friendsById[id])} color={friendsById[id]?.color ?? 0} size="sm" />
            <span className={styles.name}>{friendLabel(id, friendsById[id])}</span>
            <Money value={expense.shares[id] ?? 0} currency="INR" trimZeros />
          </li>
        ))}
      </ul>

      {fixed ? (
        <Banner tone="warning" title={t('counter.fixed.title', { amount: money(fixed.amount ?? 0) })}>
          <p>{t('counter.fixed.body')}</p>
          <div className={styles.row}>
            <Button size="sm" variant="secondary" onClick={() => setFixed(null)}>
              {t('counter.fixed.again')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                open({ vpa: fixed.vpa, name: fixed.name ?? expense.title, mc: fixed.mc, merchant: fixed.merchant })
                setFixed(null)
              }}
            >
              {t('counter.fixed.use')}
            </Button>
          </div>
        </Banner>
      ) : (
        <ScanShop onFound={found} />
      )}

      {shops.length > 0 && !fixed && (
        <section className={styles.before} aria-labelledby="counter-before">
          <h2 id="counter-before" className={styles.heading}>
            {t('counter.before.title')}
          </h2>
          <div className={styles.chips}>
            {shops.map((shop) => (
              <Chip key={shop.vpa} onClick={() => open(shop)}>
                {shop.name}
              </Chip>
            ))}
          </div>
        </section>
      )}
    </Screen>
  )
}

/* ------------------------------------------------------------------ who has paid */

function Live({ expense, entry }: { expense: Expense; entry: CounterEntry }) {
  const t = useT()
  const toast = useToast()
  const friendsById = useFriendsById()
  const profile = useProfile()
  const phone = useTouchFirst()
  const [paying, setPaying] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const people = useMemo(() => counterPeople(expense), [expense])
  const money = (paise: number) => formatMoney(paise, 'INR', { trimZeros: true })
  const nameOf = (id: string): string => friendLabel(id, friendsById[id])

  const paid = useMemo(() => new Set(people.filter((id) => hasPaidAtCounter(expense, entry, id))), [people, expense, entry])
  // The link itself never says who has paid (the live list does), so it stays the same all evening.
  const stable = useMemo(() => counterPayload(expense, entry, entry.key, new Set(), friendsById, profile), [expense, entry, friendsById, profile])
  const stableKey = JSON.stringify(stable)
  useEffect(() => {
    let live = true
    void encodePayLink(JSON.parse(stableKey) as typeof stable).then((url) => {
      if (live) setLink(url)
    })
    return () => {
      live = false
    }
  }, [stableKey])

  // What this phone says to the live list: everyone ticked here, and every tick taken back here.
  const mine = useMemo(() => {
    const out: Record<string, { t: number; h: 'upi' | 'cash' | 'no' }> = {}
    people.forEach((id, i) => {
      const at = paidAtCounterAt(expense, entry, id)
      if (paid.has(id) && at !== null) out[String(i)] = { t: at, h: id === ME_ID ? (entry.mine?.how ?? 'upi') : 'upi' }
      else if (entry.undone[id] !== undefined) out[String(i)] = { t: entry.undone[id], h: 'no' }
    })
    return out as Marks
  }, [people, expense, entry, paid])
  const live = useCounterMarks(entry.key, mine)

  // The live list says someone paid (on their own phone): tick them here, once, and say so.
  const told = useRef(new Set<string>())
  useEffect(() => {
    people.forEach((id, i) => {
      const mark = live.marks[String(i)]
      if (!mark || !isPaid(mark) || paid.has(id) || mark.t <= (entry.undone[id] ?? 0)) return
      const tag = `${id}:${mark.t}`
      if (told.current.has(tag)) return
      told.current.add(tag)
      tickAtCounter(expense.id, id, true, mark.h === 'cash' ? 'cash' : 'upi')
      if (id === ME_ID) return
      haptic('success')
      toast(t('counter.live.ticked', { name: friendLabel(id, friendsById[id]), amount: formatMoney(expense.shares[id] ?? 0, 'INR', { trimZeros: true }) }), { tone: 'success' })
    })
  }, [live.marks, people, paid, entry.undone, expense.id, expense.shares, friendsById, t, toast])

  const total = people.reduce((sum, id) => sum + (expense.shares[id] ?? 0), 0)
  const collected = people.reduce((sum, id) => sum + (paid.has(id) ? (expense.shares[id] ?? 0) : 0), 0)
  const allPaid = people.length > 0 && paid.size === people.length
  const myShare = expense.shares[ME_ID] ?? 0
  const message = link ? t('counter.share.message', { title: expense.title, shop: entry.name, link }) : null

  const sendWhatsApp = (): void => {
    if (!message) return
    const win = window.open(whatsappUrl(message), '_blank')
    if (win) win.opener = null
    haptic('tap')
  }
  const shareElsewhere = async (): Promise<void> => {
    if (!message) return
    const outcome = await shareResult(message, { title: expense.title })
    if (outcome === 'copied') toast(t('counter.share.copied'), { tone: 'success' })
  }
  const copyLink = async (): Promise<void> => {
    if (!link) return
    const ok = await copyText(link)
    haptic(ok ? 'success' : 'error')
    setCopied(ok)
    if (ok) toast(t('counter.share.copied'), { tone: 'success' })
  }

  return (
    <Screen header={<TopBar onBack={() => goBack(`/app/expense/${expense.id}`)} />} contentClassName={styles.content}>
      <PageTitle
        eyebrow={expense.title}
        leading={allPaid ? <SuccessCheck size="md" /> : undefined}
        title={allPaid ? t('counter.live.done.title', { amount: money(total), shop: entry.name }) : t('counter.live.title', { shop: entry.name })}
        subtitle={allPaid ? t('counter.live.done.body') : t('counter.live.body')}
      />

      <section className={styles.card} aria-label={t('counter.live.progress.aria')}>
        <ProgressRing value={total > 0 ? collected / total : 0} size={56} stroke={6} />
        <div className={styles.cardText}>
          <p className={styles.count} role="status">
            {t('counter.live.count', { paid: paid.size, count: people.length })}
          </p>
          <p className={styles.fine}>{t('counter.live.collected', { collected: money(collected), total: money(total), shop: entry.name })}</p>
          <p className={styles.fine}>
            <Store aria-hidden="true" className={styles.inlineIcon} /> {entry.vpa}
          </p>
        </div>
      </section>

      {!allPaid && (
        <section className={styles.share} aria-labelledby="counter-share">
          <h2 id="counter-share" className={styles.heading}>
            {t('counter.share.title')}
          </h2>
          {link && <QrCode value={link} label={t('counter.share.qr.aria', { shop: entry.name })} size={200} ecc="L" className={styles.qr} />}
          <p className={styles.fine}>{t('counter.share.body')}</p>
          <div className={styles.row}>
            <Button size="md" variant="secondary" iconStart={<MessageCircle />} onClick={sendWhatsApp} disabled={!message}>
              WhatsApp{/* i18n-ignore: brand */}
            </Button>
            <Button size="md" variant="secondary" iconStart={<Share2 />} onClick={() => void shareElsewhere()} disabled={!message}>
              {t('counter.share.more')}
            </Button>
            <Button size="md" variant="secondary" iconStart={copied ? <Check /> : <Copy />} onClick={() => void copyLink()} disabled={!link}>
              {t('counter.share.copy')}
            </Button>
          </div>
        </section>
      )}

      <section aria-labelledby="counter-people">
        <h2 id="counter-people" className={styles.heading}>
          {t('counter.people.title')}
        </h2>
        <ul className={styles.people}>
          {people.map((id) => {
            const name = nameOf(id)
            const share = expense.shares[id] ?? 0
            const done = paid.has(id)
            return (
              <li key={id} className={styles.person} data-paid={done ? '' : undefined}>
                <Avatar name={name} color={friendsById[id]?.color ?? 0} size="sm" selected={done} />
                <span className={styles.name}>
                  {name}
                  <span className={styles.amount}>{money(share)}</span>
                </span>
                {done ? (
                  <>
                    <span className={styles.paid}>{t('counter.people.paid')}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      iconStart={<Undo2 />}
                      aria-label={t('counter.people.undo.aria', { name })}
                      onClick={() => {
                        haptic('tap')
                        tickAtCounter(expense.id, id, false)
                      }}
                    >
                      {t('counter.people.undo')}
                    </Button>
                  </>
                ) : id === ME_ID ? (
                  <Button size="sm" onClick={() => setPaying(true)}>
                    {t('counter.people.payMine', { amount: money(share) })}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={t('counter.people.tick.aria', { name })}
                    onClick={() => {
                      haptic('success')
                      tickAtCounter(expense.id, id, true, 'cash')
                    }}
                  >
                    {t('counter.people.tick')}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
        <p className={styles.fine} role="status">
          {live.state === 'live' ? t('counter.live.on') : live.state === 'off' ? t('counter.live.off') : ''}
        </p>
      </section>

      <Button
        variant="ghost"
        block
        onClick={() => {
          closeCounter(expense.id)
          toast(t('counter.stop.done'))
        }}
      >
        {t('counter.stop.cta')}
      </Button>

      <BottomSheet open={paying} onClose={() => setPaying(false)} title={t('counter.mine.title', { shop: entry.name })} description={t('counter.mine.body', { amount: money(myShare) })}>
        <UpiRoutes
          payeeName={entry.name}
          vpa={entry.vpa}
          amount={myShare}
          note={expense.title}
          color={people.length % 8}
          phone={phone}
          merchant={entry.merchant}
          mc={entry.mc}
          onPaid={() => {
            tickAtCounter(expense.id, ME_ID, true, 'upi')
            setPaying(false)
            toast(t('counter.mine.done', { amount: money(myShare), shop: entry.name }), { tone: 'success' })
          }}
        />
      </BottomSheet>
    </Screen>
  )
}
