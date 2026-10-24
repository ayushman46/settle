import { ChartPie, FileSpreadsheet, Palette, Repeat, Sparkles, type LucideIcon } from 'lucide-react'
import { navigate } from '../../app/router'
import { Badge, Button } from '../../components'
import { BRAND } from '../../domain/types'
import { useT, type MessageKey } from '../../i18n'
import { useBillingConfig, usePro } from '../../pro'
import { cheapestPrice, endsInLabel, passDate, passSummary } from '../pro/plans'
import styles from './ProCard.module.css'

const PRO_PATH = '/app/pro'

/** The headline perks, shown as small pills on the free card. */
const HIGHLIGHTS: ReadonlyArray<{ icon: LucideIcon; label: MessageKey }> = [
  { icon: Sparkles, label: 'you.pro.perk.ai' },
  { icon: Repeat, label: 'you.pro.perk.recurring' },
  { icon: ChartPie, label: 'you.pro.perk.insights' },
  { icon: FileSpreadsheet, label: 'you.pro.perk.csv' },
  { icon: Palette, label: 'you.pro.perk.accents' },
]

/**
 * Settle Pro on the You tab — the premium dark card. Free: what Pro adds and its starting price.
 * Pro: the pass on this phone and when it ends. Ended: a calm nudge to renew (nothing was lost).
 */
export function ProCard() {
  const t = useT()
  const pro = usePro()
  const config = useBillingConfig()
  const from = cheapestPrice(config)
  const { license } = pro
  const ended = pro.status === 'expired' && pro.expiresAt !== null

  return (
    <section className={styles.card} aria-labelledby="you-pro">
      <div className={styles.head}>
        <span className={styles.gem} aria-hidden="true">
          <Sparkles strokeWidth={2.1} />
        </span>
        <h2 id="you-pro" className={styles.title}>
          {BRAND.name} <span className={styles.pro}>Pro</span>
        </h2>
        {pro.isPro && license ? (
          <Badge tone="accent" size="md">
            {license.exp === null ? t('pro.plan.lifetime') : t('you.pro.active')}
          </Badge>
        ) : ended && pro.expiresAt !== null ? (
          <Badge tone="warning" size="md">
            {t('you.pro.ended', { date: passDate(pro.expiresAt) })}
          </Badge>
        ) : null}
      </div>

      {pro.isPro && license ? (
        <>
          <div className={styles.body}>
            <p className={styles.lede}>{passSummary(license)}</p>
            {pro.expiresAt !== null && <p className={styles.small}>{endsInLabel(pro.expiresAt)}</p>}
          </div>
          <Button variant="tonal" size="md" className={styles.action} onClick={() => navigate(PRO_PATH)}>
            {t('you.pro.manage')}
          </Button>
        </>
      ) : (
        <>
          <p className={styles.lede}>
            {ended
              ? t('you.pro.ended.body')
              : t('you.pro.body')}
          </p>
          {!ended && (
            <ul className={styles.perks} aria-label={t('you.pro.includes')}>
              {HIGHLIGHTS.map(({ icon: Icon, label }) => (
                <li key={label} className={styles.perk}>
                  <Icon aria-hidden="true" strokeWidth={2.25} />
                  {t(label)}
                </li>
              ))}
            </ul>
          )}
          <div className={styles.cta}>
            <Button variant="accent" size="md" className={styles.action} onClick={() => navigate(PRO_PATH)}>
              {ended ? t('you.pro.renew') : t('you.pro.see')}
            </Button>
            {from && <span className={styles.small}>{t('you.pro.from', { price: from })}</span>}
          </div>
        </>
      )}
    </section>
  )
}
