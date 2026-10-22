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
import { copyText } from '../../lib/share'
import { extractLicenseToken, licenseToken, usePro, type ProState } from '../../pro'
import { BuyButton, CheckoutNotice, TrustRow } from './OfferParts'
import { FREE_FOREVER, proPerks } from './perks'
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
  const selling = !pro.isPro || celebrate !== null

  return (
    <Screen
      header={<TopBar onBack={() => goBack('/app/you')} />}
      footer={
        selling ? (
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
            <SectionHeader id="pro-unlocked" title="What you've unlocked" />
            <PerkList perks={perks} linked label="What you've unlocked" />
          </section>
          {pro.license && pro.license.exp !== null && <LifetimeCard offer={offer} />}
          <MovePhonesCard onRedeem={openRedeem} />
        </>
      ) : (
        <>
          {pro.status === 'expired' && <Plans offer={offer} onRedeem={openRedeem} />}
          <section className={styles.section} aria-labelledby="pro-perks">
            <SectionHeader id="pro-perks" title="Everything in Pro" />
            <PerkList perks={perks} />
          </section>
          {pro.status !== 'expired' && <Plans offer={offer} onRedeem={openRedeem} />}
          <Card tone="sunken" className={styles.freeCard}>
            <p className={styles.freeText}>{FREE_FOREVER}</p>
          </Card>
          <Card className={styles.redeemCard}>
            <span className={styles.cardIcon} aria-hidden="true">
              <KeyRound />
            </span>
            <div className={styles.cardText}>
              <h2 className={styles.cardTitle}>Already have Pro?</h2>
              <p className={styles.cardBody}>
                Your pass lives on the phone it was bought on — there's no account. Moving phones? Copy your Pro code on the
                old one and redeem it here. Promo codes work the same way.
              </p>
              <Button variant="secondary" size="md" className={styles.cardAction} onClick={openRedeem}>
                Redeem a code
              </Button>
            </div>
          </Card>
          <p className={styles.legal}>
            Payments are handled securely by Razorpay. By buying a pass you agree to the{' '}
            <Link to="/terms">Terms</Link>; see how we treat your data in the <Link to="/privacy">Privacy policy</Link>.
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
        <SuccessBurst title="Pro unlocked" subtitle={passSummary(celebrate)} onDone={() => setCelebrate(null)} />
      )}
    </Screen>
  )
}

/** The premium dark card at the top: "Settle Pro", and the pass on this phone (if any). */
function Hero({ pro }: { pro: ProState }) {
  const { license } = pro
  return (
    <section className={styles.hero} aria-labelledby="pro-title">
      <span className={styles.gem} aria-hidden="true">
        <Sparkles strokeWidth={2.1} />
      </span>
      <h1 id="pro-title" className={styles.title} tabIndex={-1}>
        {BRAND.name} <span className={styles.gradientText}>Pro</span>
      </h1>
      {pro.isPro && license ? (
        <div className={styles.status}>
          <Badge tone="accent" size="md">
            {license.exp === null ? 'Lifetime' : 'Active'}
          </Badge>
          <p className={styles.lede}>{passSummary(license)}</p>
          {pro.expiresAt !== null && <p className={styles.small}>{endsInLabel(pro.expiresAt)}</p>}
        </div>
      ) : pro.status === 'expired' && pro.expiresAt !== null ? (
        <div className={styles.status}>
          <Badge tone="warning" size="md">
            Ended {passDate(pro.expiresAt)}
          </Badge>
          <p className={styles.lede}>
            Your Pro pass has run out. Pick a pass to switch Pro back on — your recurring splits and settings are all still
            here.
          </p>
        </div>
      ) : (
        <p className={styles.lede}>Unlimited AI, recurring splits and insights. Pay once — nothing renews.</p>
      )}
    </section>
  )
}

/** "Choose your pass": the plan cards, why checkout can't run (if it can't) and how paying works. */
function Plans({ offer, onRedeem }: { offer: ProOffer; onRedeem: () => void }) {
  return (
    <section className={styles.section} aria-labelledby="pro-plans">
      <SectionHeader id="pro-plans" title="Choose your pass" description="One-time payments — nothing renews automatically." />
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
  const lifetime = offer.options?.find((o) => o.lifetime) ?? null
  if (!lifetime || offer.checkoutOff) return null
  const busy = offer.checkout.phase.kind === 'busy'
  return (
    <Card className={styles.lifetimeCard}>
      <span className={styles.cardIcon} aria-hidden="true">
        <InfinityIcon />
      </span>
      <div className={styles.cardText}>
        <h2 className={styles.cardTitle}>Make it lifetime</h2>
        <p className={styles.cardBody}>
          Pay {priceLabel(lifetime.amount, lifetime.currency)} once and never renew. It replaces your current pass from today —
          passes don't add up, so the days left on this one aren't carried over.
        </p>
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
          Go lifetime — {lifetime.price}
        </Button>
      </div>
    </Card>
  )
}

/** Pro lives on this phone; this is how it moves to the next one. */
function MovePhonesCard({ onRedeem }: { onRedeem: () => void }) {
  const toast = useToast()
  const copy = async (): Promise<void> => {
    const token = licenseToken()
    if (token && (await copyText(token))) {
      toast(`Pro code copied. Redeem it in ${BRAND.name} on your new phone.`, { tone: 'success' })
    } else {
      toast("Couldn't copy your Pro code. Please try again.", { tone: 'error' })
    }
  }
  return (
    <Card className={styles.moveCard}>
      <span className={styles.cardIcon} aria-hidden="true">
        <Smartphone />
      </span>
      <div className={styles.cardText}>
        <h2 className={styles.cardTitle}>Moving to a new phone?</h2>
        <p className={styles.cardBody}>
          Your pass lives on this phone — there's no account, and backups don't include it. Copy your Pro code and redeem it
          on the new phone. Keep it private: anyone with the code gets your Pro.
        </p>
        <div className={styles.cardActions}>
          <Button variant="secondary" size="md" iconStart={<Copy />} onClick={() => void copy()}>
            Copy your Pro code
          </Button>
          <Button variant="ghost" size="md" onClick={onRedeem}>
            Redeem another code
          </Button>
        </div>
      </div>
    </Card>
  )
}
