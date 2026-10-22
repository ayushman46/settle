import { useState } from 'react'
import { ChartPie, Coins, FileText, KeyRound, Repeat, ShieldCheck, Users } from 'lucide-react'
import { navigate } from '../../app/router'
import { Badge, Card, List, ListRow, Screen, SuccessBurst, Switch, useToast } from '../../components'
import { updateProfile, useDueRecurring, useFriends, useProfile, useRecurring } from '../../data'
import { BRAND, type License } from '../../domain/types'
import { currencyName } from '../../lib/currencies'
import { currencySymbol } from '../../lib/money'
import { useHasFeature } from '../../pro'
import { CurrencySheet } from '../bill/CurrencySheet'
import { BrandMark } from '../landing/BrandMark'
import { PaywallHost } from '../pro/PaywallSheet'
import { passSummary } from '../pro/plans'
import { RedeemSheet } from '../pro/RedeemSheet'
import { AppearanceSettings } from './AppearanceSettings'
import { DataSettings } from './DataSettings'
import { ProCard } from './ProCard'
import { ProfileCard } from './ProfileCard'
import { SettingIcon } from './SettingIcon'
import { peopleLine, recurringLine } from './youLabels'
import settings from './Settings.module.css'
import styles from './YouScreen.module.css'

/**
 * `/app/you` — you and your settings: profile and UPI ID, Settle Pro, your people, recurring
 * splits and insights, currency and appearance, backups and exports, a Pro code to redeem, the
 * legal pages, and clearing everything off the phone.
 */
export function YouScreen() {
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [celebrate, setCelebrate] = useState<License | null>(null)

  return (
    <Screen contentClassName={styles.content}>
      <ProfileCard />
      <ProCard />
      <Shortcuts />
      <Preferences />
      <DataSettings />
      <About onRedeem={() => setRedeemOpen(true)} />
      <Footer />

      <RedeemSheet
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
        onRedeemed={(license) => {
          setRedeemOpen(false)
          setCelebrate(license)
        }}
      />
      {celebrate && <SuccessBurst title="Pro unlocked" subtitle={passSummary(celebrate)} onDone={() => setCelebrate(null)} />}
      <PaywallHost />
    </Screen>
  )
}

function Shortcuts() {
  const friends = useFriends()
  const recurring = useRecurring()
  const due = useDueRecurring()
  const recurringOn = useHasFeature('recurring')
  const insightsOn = useHasFeature('insights')

  return (
    <Card padding="none">
      <List aria-label="Shortcuts">
        <ListRow
          leading={
            <SettingIcon>
              <Users />
            </SettingIcon>
          }
          title="People"
          subtitle={peopleLine(friends)}
          onClick={() => navigate('/app/friends')}
          chevron
        />
        <ListRow
          leading={
            <SettingIcon>
              <Repeat />
            </SettingIcon>
          }
          title="Recurring splits"
          subtitle={recurringLine(recurring, due.length, recurringOn)}
          trailing={recurringOn ? undefined : <Badge tone="pro">Pro</Badge>}
          onClick={() => navigate('/app/recurring')}
          chevron
        />
        <ListRow
          leading={
            <SettingIcon>
              <ChartPie />
            </SettingIcon>
          }
          title="Insights"
          subtitle="Where your money goes, by category and month"
          trailing={insightsOn ? undefined : <Badge tone="pro">Pro</Badge>}
          onClick={() => navigate('/app/insights')}
          chevron
        />
      </List>
    </Card>
  )
}

function Preferences() {
  const profile = useProfile()
  const toast = useToast()
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const code = profile.currency
  const symbol = currencySymbol(code)

  return (
    <section className={settings.section} aria-labelledby="you-preferences">
      <h2 id="you-preferences" className={settings.sectionTitle}>
        Preferences
      </h2>
      <Card padding="none">
        <List>
          <ListRow
            leading={
              <SettingIcon>
                <Coins />
              </SettingIcon>
            }
            title="Default currency"
            subtitle={`${currencyName(code)} · ${code}`}
            trailing={
              symbol !== code ? (
                <span className={settings.symbol} aria-hidden="true">
                  {symbol}
                </span>
              ) : undefined
            }
            onClick={() => setCurrencyOpen(true)}
            chevron
          />
        </List>
        <div className={settings.divided}>
          <AppearanceSettings />
        </div>
        <div className={settings.divided}>
          <Switch
            className={settings.switch}
            checked={profile.haptics}
            onChange={(haptics) => updateProfile({ haptics })}
            label="Haptics"
            description="A light buzz as you tap and finish things, on phones that support it."
          />
        </div>
      </Card>
      <CurrencySheet
        open={currencyOpen}
        currency={code}
        title="Default currency"
        description="New splits start in this currency. Existing ones keep theirs."
        onClose={() => setCurrencyOpen(false)}
        onSelect={(next) => {
          setCurrencyOpen(false)
          if (next === code) return
          updateProfile({ currency: next })
          toast(`New splits will be in ${currencyName(next)}`, { tone: 'success' })
        }}
      />
    </section>
  )
}

function About({ onRedeem }: { onRedeem: () => void }) {
  return (
    <section className={settings.section} aria-labelledby="you-about">
      <h2 id="you-about" className={settings.sectionTitle}>
        About
      </h2>
      <Card padding="none">
        <List>
          <ListRow
            leading={
              <SettingIcon>
                <KeyRound />
              </SettingIcon>
            }
            title="Redeem a code"
            subtitle="A promo code, or Pro from your old phone"
            onClick={onRedeem}
            chevron
          />
          <ListRow
            leading={
              <SettingIcon>
                <ShieldCheck />
              </SettingIcon>
            }
            title="Privacy"
            subtitle="No account, no tracking — your data stays here"
            onClick={() => navigate('/privacy')}
            chevron
          />
          <ListRow
            leading={
              <SettingIcon>
                <FileText />
              </SettingIcon>
            }
            title="Terms"
            subtitle="The plain-English rules"
            onClick={() => navigate('/terms')}
            chevron
          />
        </List>
      </Card>
    </section>
  )
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <BrandMark size="sm" />
      <p className={styles.tagline}>{BRAND.tagline}</p>
      <p className={styles.small}>Made with care · no ads · no tracking</p>
    </footer>
  )
}
