import { useState } from 'react'
import { Printer } from 'lucide-react'
import { goBack, navigate, Redirect, useRoute } from '../../app/router'
import { Banner, Button, Card, PageTitle, Screen, SegmentedControl, TextField, TopBar } from '../../components'
import { useFriendsById, useProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { today } from '../../engine/dates'
import { useT, type MessageKey } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { ChoiceChips } from './ChoiceChips'
import { RENT_ENABLED, RENT_PATH, rentEditPath, rentPath } from './enabled'
import { buildReceipts, financialYearOf, isMonth, monthsBetween, needsLandlordPan, RENT_PAYMENT_MODES, type RentPaymentMode } from './hra'
import { RentReceiptDoc } from './RentReceiptDoc'
import { tenantName } from './rentLink'
import { saveRent, useRent, type Rent } from './store'
import styles from './Rent.module.css'

const ROUTES = ['/app/rent/:id/receipts'] as const

type Period = 'this' | 'last' | 'custom'

const MODE_KEYS: Record<RentPaymentMode, MessageKey> = {
  upi: 'rent.mode.upi',
  bank: 'rent.mode.bank',
  cash: 'rent.mode.cash',
  cheque: 'rent.mode.cheque',
}

/** `/app/rent/:id/receipts` — HRA rent receipts for one flatmate's share, ready to print. */
export function RentReceiptsScreen() {
  if (!RENT_ENABLED) return <Redirect to="/app" />
  return <ReceiptsRoute />
}

function ReceiptsRoute() {
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
  return <Receipts rent={rent} />
}

function Receipts({ rent }: { rent: Rent }) {
  const t = useT()
  const friendsById = useFriendsById()
  const profile = useProfile()
  const thisMonth = today().slice(0, 7)
  const thisYear = financialYearOf(thisMonth)
  const lastYear = financialYearOf(`${Number(thisYear.from.slice(0, 4)) - 1}-04`)
  const defaultTenant = rent.tenants.find((tenant) => tenant.friendId === ME_ID) ?? rent.tenants[0]
  const [tenantId, setTenantId] = useState(defaultTenant?.friendId ?? ME_ID)
  const [period, setPeriod] = useState<Period>('this')
  const [from, setFrom] = useState(thisYear.from)
  const [to, setTo] = useState(thisMonth)
  const [per, setPer] = useState<'month' | 'quarter'>('month')
  const [mode, setMode] = useState<RentPaymentMode>(rent.mode)
  const tenantIndex = Math.max(0, rent.tenants.findIndex((tenant) => tenant.friendId === tenantId))
  const tenant = rent.tenants[tenantIndex] ?? rent.tenants[0]
  const shownName = (id: string, i: number) => tenantName(id, i, friendsById, profile)
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(rent.tenants.map((tn, i) => [tn.friendId, tn.legalName ?? shownName(tn.friendId, i)])),
  )
  if (!tenant) return null

  const range = period === 'this' ? thisYear : period === 'last' ? lastYear : { from, to }
  const months = isMonth(range.from) && isMonth(range.to) ? monthsBetween(range.from, range.to) : []
  const receipts = buildReceipts({ rentId: rent.id, tenantIndex, monthlyShare: tenant.share, months, per, mode })
  const total = receipts.reduce((sum, r) => sum + r.amount, 0)
  const legalName = (names[tenant.friendId] ?? '').trim() || shownName(tenant.friendId, tenantIndex)
  const panMissing = needsLandlordPan(tenant.share) && !rent.landlordPan

  /** Remembers the name typed for the receipts on the rent, for next time. */
  const rememberName = () => {
    const typed = (names[tenant.friendId] ?? '').trim()
    const current = tenant.legalName ?? shownName(tenant.friendId, tenantIndex)
    if (!typed || typed === current) return
    const { id, createdAt: _c, updatedAt: _u, ...rest } = rent
    saveRent({ ...rest, tenants: rent.tenants.map((tn) => (tn.friendId === tenant.friendId ? { ...tn, legalName: typed } : tn)) }, id)
  }

  return (
    <Screen header={<TopBar onBack={() => goBack(rentPath(rent.id))} />} contentClassName={styles.content}>
      <PageTitle title={t('rent.receipts.title')} subtitle={t('rent.receipts.subtitle')} />

      <Card>
        <div className={styles.fields}>
          {rent.tenants.length > 1 && (
            <ChoiceChips
              label={t('rent.receipts.who.label')}
              value={tenant.friendId}
              onChange={setTenantId}
              options={rent.tenants.map((tn, i) => ({ value: tn.friendId, label: shownName(tn.friendId, i) }))}
            />
          )}
          <TextField
            label={t('rent.receipts.name.label')}
            hint={t('rent.receipts.name.hint')}
            value={names[tenant.friendId] ?? ''}
            maxLength={120}
            onChange={(e) => setNames((n) => ({ ...n, [tenant.friendId]: e.target.value }))}
            onBlur={rememberName}
          />
          <ChoiceChips
            label={t('rent.receipts.period.label')}
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'this', label: t('rent.receipts.period.fy', { label: thisYear.label }) },
              { value: 'last', label: t('rent.receipts.period.fy', { label: lastYear.label }) },
              { value: 'custom', label: t('rent.receipts.period.custom') },
            ]}
          />
          {period === 'custom' && (
            <div className={styles.row}>
              <TextField type="month" label={t('rent.receipts.from.label')} value={from} onChange={(e) => setFrom(e.target.value)} />
              <TextField type="month" label={t('rent.receipts.to.label')} value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          )}
          <div className={styles.section}>
            <span className={styles.lead}>{t('rent.receipts.per.label')}</span>
            <SegmentedControl
              ariaLabel={t('rent.receipts.per.label')}
              size="sm"
              value={per}
              onChange={setPer}
              options={[
                { value: 'month', label: t('rent.receipts.per.month') },
                { value: 'quarter', label: t('rent.receipts.per.quarter') },
              ]}
            />
          </div>
          <ChoiceChips
            label={t('rent.receipts.mode.label')}
            value={mode}
            onChange={setMode}
            options={RENT_PAYMENT_MODES.map((m) => ({ value: m, label: t(MODE_KEYS[m]) }))}
          />
        </div>
      </Card>

      <Button block iconStart={<Printer />} disabled={receipts.length === 0} onClick={() => window.print()}>
        {t('rent.receipts.print')}
      </Button>

      {panMissing && (
        <Banner
          tone="warning"
          title={t('rent.receipts.pan.title', { landlord: rent.landlordName })}
          action={{ label: t('rent.receipts.pan.cta'), onAction: () => navigate(rentEditPath(rent.id)) }}
        >
          {t('rent.receipts.pan.text', { landlord: rent.landlordName })}
        </Banner>
      )}
      {receipts.some((r) => r.stamp) && (
        <Banner tone="info" title={t('rent.receipts.stamp.title')}>
          {t('rent.receipts.stamp.text')}
        </Banner>
      )}

      <section className={styles.section} aria-labelledby="rent-preview">
        <div className={styles.row}>
          <h2 id="rent-preview" className={styles.sectionTitle}>
            {t('rent.receipts.preview')}
          </h2>
          {receipts.length > 0 && (
            <span className={styles.total}>{t('rent.receipts.total', { count: receipts.length, amount: formatMoney(total, 'INR', { trimZeros: true }) })}</span>
          )}
        </div>
        {receipts.length === 0 ? (
          <p className={styles.lead}>{t('rent.receipts.empty')}</p>
        ) : (
          <div className={styles.printArea}>
            {receipts.map((receipt) => (
              <RentReceiptDoc
                key={receipt.number}
                receipt={receipt}
                tenantName={legalName}
                property={rent.address || rent.name}
                landlordName={rent.landlordName}
                landlordPan={rent.landlordPan}
                mode={mode}
                dueDay={rent.dueDay}
              />
            ))}
          </div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="rent-tips">
        <h2 id="rent-tips" className={styles.sectionTitle}>
          {t('rent.receipts.tips.title')}
        </h2>
        <ul className={styles.tips}>
          <li>{t('rent.receipts.tip.share')}</li>
          <li>{t('rent.receipts.tip.direct')}</li>
          <li>{t('rent.receipts.tip.small')}</li>
          <li>{t('rent.receipts.tip.advice')}</li>
        </ul>
      </section>
    </Screen>
  )
}
