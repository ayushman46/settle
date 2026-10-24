import { useState } from 'react'
import { Copy, Infinity as InfinityIcon, KeyRound, Smartphone, Sparkles } from 'lucide-react'
import { goBack, Link, useLocation } from '../../app/router'
import {
  ActionBar,
  Badge,
  Banner,
  Button,
  Card,
  Screen,
  SectionHeader,
  SuccessBurst,
  TopBar,
  useToast,
} from '../../components'
import { BRAND, type License } from '../../domain/types'
import { tx, useT } from '../../i18n'
import { copyText } from '../../lib/share'
import { extractLicenseToken, licenseToken, usePro, type ProState } from '../../pro'
import { BuyButton, CheckoutNotice, TrustRow } from './OfferParts'
import { freeForever, proPerks } from './perks'
import { PerkList } from './PerkList'
import { PlanPicker } from './PlanPicker'
import { checkoutNote, endsInLabel, passDate, passSummary, priceLabel } from './plans'
import { RedeemSheet } from './RedeemSheet'
import { useProOffer, type ProOffer } from './useProOffer'
import styles from './UpgradeScreen.module.css'

/**
 * `/app/pro` — Settle Pro: what it adds, the one-time passes and checkout, "Redeem a code", and
 * for people who have it, their pass and how to take it to a new phone. A Pro code in the link
 * (`/app/pro#code=SETTLE1.…`) opens "Redeem a code" with it filled in.
 */
export function UpgradeScreen() {
  const t = useT()
  const pro = usePro()
  const { hash } = useLocation()
  const [celebrate, setCelebrate] = useState<License | null>(null)
  const [redeem, setRedeem] = useState(() => {
    const code = extractLicenseToken(hash)
    return { open: code !== null, code: code ?? '' }
  })
  const offer = useProOffer(setCelebrate)
  const perks = proPerks(offer.proAiPerDay)
  const openRedeem = (): void => setRedeem((current) => ({ ...current, open: true }))

  return (
    <Screen
      header={<TopBar onBack={() => goBack('/app/you')} />}
      footer={
        !pro.isPro ? (
          <ActionBar hint={offer.selected && !offer.checkoutOff ? checkoutNote(offer.selected) : undefined}>
            <BuyButton offer={offer} onRedeem={openRedeem} />
          </ActionBar>
        ) : undefined
      }
      contentClassName={styles.content}
    >
      <Hero pro={pro} />

      {pro.isPro ? (
        <>
          <section className={styles.section} aria-labelledby="pro-unlocked">
            <SectionHeader id="pro-unlocked" title={t('pro.upgrade.unlocked.title')} />
            <PerkList perks={perks} linked label={t('pro.upgrade.unlocked.title')} />
          </section>
          {pro.license && pro.license.exp !== null && <LifetimeCard offer={offer} />}
          <MovePhonesCard onRedeem={openRedeem} />
        </>
      ) : (
        <>
          {pro.status === 'expired' && <Plans offer={offer} onRedeem={openRedeem} />}
          <section className={styles.section} aria-labelledby="pro-perks">
            <SectionHeader id="pro-perks" title={t('pro.upgrade.perks.title')} />
            <PerkList perks={perks} />
          </section>
          {pro.status !== 'expired' && <Plans offer={offer} onRedeem={openRedeem} />}
          <Card tone="sunken" className={styles.freeCard}>
            <p className={styles.freeText}>{freeForever()}</p>
          </Card>
          <Card className={styles.redeemCard}>
            <span className={styles.cardIcon} aria-hidden="true">
              <KeyRound />
            </span>
            <div className={styles.cardText}>
              <h2 className={styles.cardTitle}>{t('pro.upgrade.have.title')}</h2>
              <p className={styles.cardBody}>{t('pro.upgrade.have.body')}</p>
              <Button variant="secondary" size="md" className={styles.cardAction} onClick={openRedeem}>
                {t('pro.redeem.cta')}
              </Button>
            </div>
          </Card>
          <p className={styles.legal}>
            {tx(
              'pro.upgrade.legal',
              {},
              {
                terms: (chunk) => <Link to="/terms">{chunk}</Link>,
                privacy: (chunk) => <Link to="/privacy">{chunk}</Link>,
              },
            )}
          </p>
        </>
      )}

      <RedeemSheet
        open={redeem.open}
        initialCode={redeem.code}
        onClose={() => setRedeem((current) => ({ ...current, open: false }))}
        onRedeemed={(license) => {
          setRedeem((current) => ({ ...current, open: false }))
          setCelebrate(license)
        }}
      />
      {celebrate && (
        <SuccessBurst title={t('pro.unlocked.title')} subtitle={passSummary(celebrate)} onDone={() => setCelebrate(null)} />
      )}
    </Screen>
  )
}

/** The premium dark card at the top: "Settle Pro", and the pass on this phone (if any). */
function Hero({ pro }: { pro: ProState }) {
  const t = useT()
  const { license } = pro
  return (
    <section className={styles.hero} aria-labelledby="pro-title">
      <span className={styles.gem} aria-hidden="true">
        <Sparkles strokeWidth={2.1} />
      </span>
      <h1 id="pro-title" className={styles.title} tabIndex={-1}>
        {BRAND.name} <span className={styles.gradientText}>Pro</span>{/* i18n-ignore: Pro stays Pro in every language */}
      </h1>
      {pro.isPro && license ? (
        <div className={styles.status}>
          <Badge tone="accent" size="md">
            {license.exp === null ? t('pro.pass.lifetime') : t('pro.pass.active')}
          </Badge>
          <p className={styles.lede}>{passSummary(license)}</p>
          {pro.expiresAt !== null && <p className={styles.small}>{endsInLabel(pro.expiresAt)}</p>}
        </div>
      ) : pro.status === 'expired' && pro.expiresAt !== null ? (
        <div className={styles.status}>
          <Badge tone="warning" size="md">
            {t('pro.pass.endedOn', { date: passDate(pro.expiresAt) })}
          </Badge>
          <p className={styles.lede}>{t('pro.upgrade.expired.body')}</p>
        </div>
      ) : (
        <p className={styles.lede}>{t('pro.upgrade.lede')}</p>
      )}
    </section>
  )
}

/** "Choose your pass": the plan cards, why checkout can't run (if it can't) and how paying works. */
function Plans({ offer, onRedeem }: { offer: ProOffer; onRedeem: () => void }) {
  const t = useT()
  return (
    <section className={styles.section} aria-labelledby="pro-plans">
      <SectionHeader id="pro-plans" title={t('pro.upgrade.plans.title')} description={t('pro.upgrade.plans.description')} />
      <PlanPicker
        options={offer.options}
        value={offer.selected?.id ?? null}
        onChange={offer.select}
        disabled={offer.checkout.phase.kind === 'busy'}
      />
      <CheckoutNotice offer={offer} onRedeem={onRedeem} />
      <TrustRow />
    </section>
  )
}

/** For a time-limited pass: an honest way to never think about renewing again. */
function LifetimeCard({ offer }: { offer: ProOffer }) {
  const t = useT()
  const lifetime = offer.options?.find((o) => o.lifetime) ?? null
  if (!lifetime || offer.checkoutOff) return null
  const busy = offer.checkout.phase.kind === 'busy'
  return (
    <Card className={styles.lifetimeCard}>
      <span className={styles.cardIcon} aria-hidden="true">
        <InfinityIcon />
      </span>
      <div className={styles.cardText}>
        <h2 className={styles.cardTitle}>{t('pro.lifetime.title')}</h2>
        <p className={styles.cardBody}>{t('pro.lifetime.body', { price: priceLabel(lifetime.amount, lifetime.currency) })}</p>
        {offer.checkout.phase.kind === 'failed' && (
          <Banner tone="error" onDismiss={offer.checkout.reset}>
            {offer.checkout.phase.message}
          </Banner>
        )}
        <Button
          variant="accent"
          size="md"
          className={styles.cardAction}
          loading={busy}
          onClick={() => void offer.checkout.buy(lifetime.id)}
        >
          {t('pro.lifetime.cta', { price: lifetime.price })}
        </Button>
      </div>
    </Card>
  )
}

/** Pro lives on this phone; this is how it moves to the next one. */
function MovePhonesCard({ onRedeem }: { onRedeem: () => void }) {
  const t = useT()
  const toast = useToast()
  const copy = async (): Promise<void> => {
    const token = licenseToken()
    if (token && (await copyText(token))) {
      toast(t('pro.move.copied.toast', { brand: BRAND.name }), { tone: 'success' })
    } else {
      toast(t('pro.move.copy.error'), { tone: 'error' })
    }
  }
  return (
    <Card className={styles.moveCard}>
      <span className={styles.cardIcon} aria-hidden="true">
        <Smartphone />
      </span>
      <div className={styles.cardText}>
        <h2 className={styles.cardTitle}>{t('pro.move.title')}</h2>
        <p className={styles.cardBody}>{t('pro.move.body')}</p>
        <div className={styles.cardActions}>
          <Button variant="secondary" size="md" iconStart={<Copy />} onClick={() => void copy()}>
            {t('pro.move.copy.cta')}
          </Button>
          <Button variant="ghost" size="md" onClick={onRedeem}>
            {t('pro.move.redeem.cta')}
          </Button>
        </div>
      </div>
    </Card>
  )
}
