import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, ReceiptIndianRupee, Share2, Wallet, Zap } from 'lucide-react'
import { goBack, navigate, Redirect, useRoute } from '../../app/router'
import { Banner, Button, Card, IconButton, List, ListRow, Money, PageTitle, Screen, TopBar, useToast } from '../../components'
import { useFriendsById, useProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { FriendAvatar, friendLabel } from '../../kit/index-a'
import { UpiPaySheet } from '../../kit/index-b'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { shareResult } from '../../lib/share'
import { bijliForRent } from '../bijli/paths'
import { RENT_ENABLED, RENT_PATH, rentEditPath, rentReceiptsPath } from './enabled'
import { monthName, nextMonth, shortMonthName } from './hra'
import { rentPayLink } from './rentLink'
import { useRent, type Rent } from './store'
import styles from './Rent.module.css'

const ROUTES = ['/app/rent/:id'] as const

/** The month before `month` (`YYYY-MM`). */
function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

/** `/app/rent/:id` — this month's rent link, your own share, the flatmates, and receipts. */
export function RentDetailScreen() {
  if (!RENT_ENABLED) return <Redirect to="/app" />
  return <DetailRoute />
}

function DetailRoute() {
  const t = useT()
  const { params } = useRoute(ROUTES)
  const rent = useRent(params.id ?? null)
  if (!rent) {
    return (
      <Screen header={<TopBar onBack={() => goBack(RENT_PATH)} />}>
        <PageTitle title={t('rent.editor.gone')} />
        <Button onClick={() => navigate(RENT_PATH, { replace: true })}>{t('rent.editor.gone.action')}</Button>
      </Screen>
    )
  }
  return <Detail rent={rent} />
}

function Detail({ rent }: { rent: Rent }) {
  const t = useT()
  const toast = useToast()
  const friendsById = useFriendsById()
  const profile = useProfile()
  const busy = useRef(false)
  const [month, setMonth] = useState(() => today().slice(0, 7))
  const [paying, setPaying] = useState(false)
  const mine = rent.tenants.find((tenant) => tenant.friendId === ME_ID) ?? null
  const money = (minor: number) => formatMoney(minor, 'INR', { trimZeros: true })

  const send = async () => {
    if (busy.current) return
    busy.current = true
    try {
      const link = await rentPayLink(rent, month, friendsById, profile)
      const text = `${t('rent.detail.message', { month: monthName(month), landlord: rent.landlordName })}\n${link}`
      const outcome = await shareResult(text, { title: t('rent.detail.share.title', { month: monthName(month) }) })
      if (outcome === 'shared' || outcome === 'copied') haptic('success')
      if (outcome === 'copied') toast(t('rent.detail.copied'), { tone: 'success' })
      if (outcome === 'failed') {
        haptic('error')
        toast(t('rent.detail.shareFailed'), { tone: 'error' })
      }
    } finally {
      busy.current = false
    }
  }

  return (
    <Screen
      header={
        <TopBar
          onBack={() => goBack(RENT_PATH)}
          right={
            <Button size="sm" variant="tonal" iconStart={<Pencil />} onClick={() => navigate(rentEditPath(rent.id))}>
              {t('rent.detail.edit')}
            </Button>
          }
        />
      }
      contentClassName={styles.content}
    >
      <PageTitle
        title={rent.name}
        subtitle={`${t('rent.detail.line', { amount: money(rent.monthly), day: rent.dueDay })} · ${t('rent.detail.landlord', { name: rent.landlordName })}`}
      />

      <Card>
        <div className={styles.section}>
          <div className={styles.month}>
            <IconButton label={t('rent.detail.month.prev')} size="sm" onClick={() => setMonth(previousMonth(month))}>
              <ChevronLeft />
            </IconButton>
            <span className={styles.monthName} aria-live="polite">
              {t('rent.detail.month.label', { month: monthName(month) })}
            </span>
            <IconButton label={t('rent.detail.month.next')} size="sm" onClick={() => setMonth(nextMonth(month))}>
              <ChevronRight />
            </IconButton>
          </div>
          {rent.landlordUpi ? (
            <>
              <p className={styles.lead}>{t('rent.detail.send.text', { landlord: rent.landlordName })}</p>
              <div className={styles.actions}>
                <Button block iconStart={<Share2 />} onClick={send}>
                  {t('rent.detail.send.cta')}
                </Button>
                {mine && (
                  <Button block variant="secondary" iconStart={<Wallet />} onClick={() => setPaying(true)}>
                    {t('rent.detail.payMine.cta', { amount: money(mine.share) })}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <Banner
              tone="info"
              title={t('rent.detail.noUpi.title', { landlord: rent.landlordName })}
              action={{ label: t('rent.detail.noUpi.cta'), onAction: () => navigate(rentEditPath(rent.id)) }}
            >
              {t('rent.detail.noUpi.text')}
            </Banner>
          )}
        </div>
      </Card>

      <section className={styles.section} aria-labelledby="rent-flatmates">
        <h2 id="rent-flatmates" className={styles.sectionTitle}>
          {t('rent.detail.people.title')}
        </h2>
        <Card padding="none">
          <List aria-labelledby="rent-flatmates">
            {rent.tenants.map((tenant) => (
              <ListRow
                key={tenant.friendId}
                leading={<FriendAvatar friendId={tenant.friendId} size="md" />}
                title={friendLabel(tenant.friendId, friendsById[tenant.friendId] ?? null)}
                subtitle={tenant.legalName}
                trailing={<Money value={tenant.share} currency="INR" trimZeros />}
              />
            ))}
          </List>
        </Card>
      </section>

      <Card>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('rent.detail.receipts.title')}</h2>
          <p className={styles.lead}>{t('rent.detail.receipts.text')}</p>
          <Button variant="tonal" iconStart={<ReceiptIndianRupee />} onClick={() => navigate(rentReceiptsPath(rent.id))}>
            {t('rent.detail.receipts.cta')}
          </Button>
        </div>
      </Card>

      <Card>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('rent.detail.bijli.title')}</h2>
          <p className={styles.lead}>{t('rent.detail.bijli.text')}</p>
          <Button variant="tonal" iconStart={<Zap />} onClick={() => navigate(bijliForRent(rent.id))}>
            {t('rent.detail.bijli.cta')}
          </Button>
        </div>
      </Card>

      {mine && rent.landlordUpi && (
        <UpiPaySheet
          open={paying}
          onClose={() => setPaying(false)}
          payee={{ name: rent.landlordName, upiId: rent.landlordUpi }}
          payer={{ id: ME_ID, name: friendLabel(ME_ID, friendsById[ME_ID] ?? null), color: friendsById[ME_ID]?.color ?? 0 }}
          amount={mine.share}
          currency="INR"
          note={`Rent ${shortMonthName(month)}`}
        />
      )}
    </Screen>
  )
}
