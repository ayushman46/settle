import { useLayoutEffect, useState, useSyncExternalStore } from 'react'
import { Check } from 'lucide-react'
import { navigate } from '../../app/router'
import { Badge, BottomSheet, Button, SuccessBurst } from '../../components'
import { BRAND, type License, type ProFeature } from '../../domain/types'
import { usePro } from '../../pro'
import { BuyButton, CheckoutNotice, TrustRow } from './OfferParts'
import { closePaywall, completePaywall, usePaywall } from './paywall'
import { featurePitch, FREE_FOREVER, proPerks } from './perks'
import { PlanPicker } from './PlanPicker'
import { passSummary } from './plans'
import { RedeemSheet } from './RedeemSheet'
import { useProOffer } from './useProOffer'
import styles from './PaywallSheet.module.css'

export interface PaywallSheetProps {
  open: boolean
  /** The feature that sent the person here (leads the pitch); null = Pro in general. */
  feature: ProFeature | null
  onClose: () => void
  /** Pro was unlocked here (after the celebration), or was already on and they tapped Continue. */
  onUnlocked: () => void
}

/** Most perks listed in the sheet (the upgrade screen has the full story). */
const SHEET_PERKS = 4

/**
 * The in-context upsell: what the locked feature does, what else Pro adds, the passes, and one
 * clear buy button — plus "Redeem a code". Buying or redeeming ends in a "Pro unlocked" moment,
 * then carries on with whatever the person was doing.
 */
export function PaywallSheet({ open, feature, onClose, onUnlocked }: PaywallSheetProps) {
  const pro = usePro()
  const [celebrate, setCelebrate] = useState<License | null>(null)
  const [redeemOpen, setRedeemOpen] = useState(false)
  const offer = useProOffer(setCelebrate)
  const pitch = featurePitch(feature, offer.proAiPerDay)
  const PitchIcon = pitch.icon
  const perks = proPerks(offer.proAiPerDay)
    .filter((perk) => perk.key !== feature && perk.key !== 'early')
    .slice(0, SHEET_PERKS)
  const alreadyPro = pro.isPro && celebrate === null
  const busy = offer.checkout.phase.kind === 'busy'

  const finish = (): void => {
    setCelebrate(null)
    onUnlocked()
  }

  return (
    <>
      <BottomSheet
        open={open}
        onClose={() => {
          if (!busy) onClose()
        }}
        dismissible={!busy}
        eyebrow={
          <Badge tone="pro" size="md" icon={<PitchIcon />}>
            {BRAND.name} Pro
          </Badge>
        }
        title={alreadyPro ? 'Pro is on' : pitch.title}
        description={alreadyPro && pro.license ? passSummary(pro.license) : pitch.text}
        footer={
          alreadyPro ? (
            <Button block onClick={onUnlocked}>
              Continue
            </Button>
          ) : (
            <div className={styles.footer}>
              <BuyButton offer={offer} onRedeem={() => setRedeemOpen(true)} />
              <div className={styles.links}>
                {!offer.checkoutOff && (
                  <Button variant="ghost" size="sm" onClick={() => setRedeemOpen(true)} disabled={busy}>
                    Redeem a code
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    onClose()
                    navigate('/app/pro')
                  }}
                >
                  See everything in Pro
                </Button>
              </div>
            </div>
          )
        }
      >
        {alreadyPro ? (
          <p className={styles.lead}>Everything in Pro is unlocked on this phone.</p>
        ) : (
          <div className={styles.body}>
            <ul role="list" className={styles.perks} aria-label="Also in Pro">
              {perks.map((perk) => (
                <li key={perk.key} className={styles.perk}>
                  <Check aria-hidden="true" className={styles.check} strokeWidth={3} />
                  {perk.title}
                </li>
              ))}
            </ul>
            <PlanPicker
              compact
              options={offer.options}
              value={offer.selected?.id ?? null}
              onChange={offer.select}
              disabled={busy}
            />
            <CheckoutNotice offer={offer} onRedeem={() => setRedeemOpen(true)} />
            <TrustRow />
            <p className={styles.free}>{FREE_FOREVER}</p>
          </div>
        )}
      </BottomSheet>
      <RedeemSheet
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
        onRedeemed={(license) => {
          setRedeemOpen(false)
          setCelebrate(license)
        }}
      />
      {celebrate && <SuccessBurst title="Pro unlocked" subtitle={passSummary(celebrate)} onDone={finish} />}
    </>
  )
}

/* ------------------------------------------------------------------ the one host */

const hosts: object[] = []
const hostListeners = new Set<() => void>()

function emitHosts(): void {
  for (const listener of hostListeners) listener()
}

function subscribeHosts(listener: () => void): () => void {
  hostListeners.add(listener)
  return () => {
    hostListeners.delete(listener)
  }
}

/** True for the first mounted host only, so the paywall never shows twice. */
function usePrimaryHost(): boolean {
  const [token] = useState(() => ({}))
  useLayoutEffect(() => {
    hosts.push(token)
    emitHosts()
    return () => {
      const index = hosts.indexOf(token)
      if (index >= 0) hosts.splice(index, 1)
      emitHosts()
    }
  }, [token])
  return useSyncExternalStore(
    subscribeHosts,
    () => hosts[0] === token,
    () => false,
  )
}

/**
 * Shows the paywall whenever a screen calls `openPaywall(…)`. Mount it once near the app root
 * (inside the ToastProvider); screens that rely on it may mount their own too — only the first
 * one mounted ever renders.
 */
export function PaywallHost() {
  const primary = usePrimaryHost()
  const { open, request } = usePaywall()
  if (!primary || !request) return null
  return (
    <PaywallSheet
      key={request.id}
      open={open}
      feature={request.feature}
      onClose={closePaywall}
      onUnlocked={completePaywall}
    />
  )
}
