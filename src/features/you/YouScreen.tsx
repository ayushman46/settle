import { useState } from 'react'
import { ChartPie, Coins, FileText, HandCoins, KeyRound, Languages, Repeat, ShieldCheck, Users } from 'lucide-react'
import { navigate } from '../../app/router'
import { Badge, Card, List, ListRow, Screen, SuccessBurst, Switch, useToast } from '../../components'
import { updateProfile, useDueRecurring, useFriends, usePools, useProfile, useRecurring } from '../../data'
import { BRAND, type License } from '../../domain/types'
import { currencyName } from '../../lib/currencies'
import { currencySymbol } from '../../lib/money'
import { languageInfo, useLang, useT } from '../../i18n'
import { useHasFeature } from '../../pro'
import { POOLS_ENABLED } from '../pools/enabled'
import { CurrencySheet } from '../bill/CurrencySheet'
import { BrandMark } from '../landing/BrandMark'
import { PaywallHost } from '../pro/PaywallSheet'
import { passSummary } from '../pro/plans'
import { RedeemSheet } from '../pro/RedeemSheet'
import { AppearanceSettings } from './AppearanceSettings'
import { DataSettings } from './DataSettings'
import { LanguageSheet } from './LanguageSheet'
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
  const t = useT()

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
      {celebrate && <SuccessBurst title={t('you.celebrate.title')} subtitle={passSummary(celebrate)} onDone={() => setCelebrate(null)} />}
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
  const t = useT()

  return (
    <Card padding="none">
      <List aria-label={t('you.shortcuts.label')}>
        <ListRow
          leading={
            <SettingIcon>
              <Users />
            </SettingIcon>
          }
          title={t('you.shortcuts.people.title')}
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
          title={t('you.shortcuts.recurring.title')}
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
          title={t('you.shortcuts.insights.title')}
          subtitle={t('you.shortcuts.insights.subtitle')}
          trailing={insightsOn ? undefined : <Badge tone="pro">Pro</Badge>}
          onClick={() => navigate('/app/insights')}
          chevron
        />
        {POOLS_ENABLED && <CollectionsRow />}
      </List>
    </Card>
  )
}

/** "Collections · 2 open" (or what they're for, before the first one). */
function CollectionsRow() {
  const t = useT()
  const open = usePools().filter((p) => p.closedAt === null).length
  return (
    <ListRow
      leading={
        <SettingIcon>
          <HandCoins />
        </SettingIcon>
      }
      title={t('you.shortcuts.collections.title')}
      subtitle={open > 0 ? t('you.shortcuts.collections.subtitle.open', { count: open }) : t('you.shortcuts.collections.subtitle.none')}
      onClick={() => navigate('/app/pools')}
      chevron
    />
  )
}

function Preferences() {
  const profile = useProfile()
  const toast = useToast()
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const t = useT()
  const lang = useLang()
  const code = profile.currency
  const symbol = currencySymbol(code)

  return (
    <section className={settings.section} aria-labelledby="you-preferences">
      <h2 id="you-preferences" className={settings.sectionTitle}>
        {t('you.pref.title')}
      </h2>
      <Card padding="none">
        <List>
          <ListRow
            leading={
              <SettingIcon>
                <Languages />
              </SettingIcon>
            }
            title={t('common.language.label')}
            subtitle={languageInfo(lang).native}
            onClick={() => setLanguageOpen(true)}
            chevron
          />
          <ListRow
            leading={
              <SettingIcon>
                <Coins />
              </SettingIcon>
            }
            title={t('you.pref.currency.title')}
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
            label={t('you.pref.haptics.title')}
            description={t('you.pref.haptics.description')}
          />
        </div>
      </Card>
      <LanguageSheet open={languageOpen} saved={profile.language ?? null} onClose={() => setLanguageOpen(false)} />
      <CurrencySheet
        open={currencyOpen}
        currency={code}
        title={t('you.pref.currency.title')}
        description={t('you.pref.currency.description')}
        onClose={() => setCurrencyOpen(false)}
        onSelect={(next) => {
          setCurrencyOpen(false)
          if (next === code) return
          updateProfile({ currency: next })
          toast(t('you.pref.currency.toast', { currency: currencyName(next) }), { tone: 'success' })
        }}
      />
    </section>
  )
}

function About({ onRedeem }: { onRedeem: () => void }) {
  const t = useT()
  return (
    <section className={settings.section} aria-labelledby="you-about">
      <h2 id="you-about" className={settings.sectionTitle}>
        {t('you.about.title')}
      </h2>
      <Card padding="none">
        <List>
          <ListRow
            leading={
              <SettingIcon>
                <KeyRound />
              </SettingIcon>
            }
            title={t('you.about.redeem.title')}
            subtitle={t('you.about.redeem.subtitle')}
            onClick={onRedeem}
            chevron
          />
          <ListRow
            leading={
              <SettingIcon>
                <ShieldCheck />
              </SettingIcon>
            }
            title={t('you.about.privacy.title')}
            subtitle={t('you.about.privacy.subtitle')}
            onClick={() => navigate('/privacy')}
            chevron
          />
          <ListRow
            leading={
              <SettingIcon>
                <FileText />
              </SettingIcon>
            }
            title={t('you.about.terms.title')}
            subtitle={t('you.about.terms.subtitle')}
            onClick={() => navigate('/terms')}
            chevron
          />
        </List>
      </Card>
    </section>
  )
}

function Footer() {
  const t = useT()
  return (
    <footer className={styles.footer}>
      <BrandMark size="sm" />
      <p className={styles.tagline}>{BRAND.tagline}</p>
      <p className={styles.small}>{t('you.footer.small')}</p>
    </footer>
  )
}
