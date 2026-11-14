import { Footprints, Gauge, Info, ShieldCheck, Share2 } from 'lucide-react'
import { goBack, navigate } from '../../app/router'
import { Button, Card, EmptyState, PageTitle, Screen, TopBar, useToast } from '../../components'
import { useFriendsById, useGroups, useProfile } from '../../data'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { formatMoney } from '../../lib/money'
import { shareResult } from '../../lib/share'
import { friendPath, settleUpPath, YOU_PATH } from '../groups/paths'
import { BAND_KEYS } from './bands'
import { Dial } from './Dial'
import { FULL_HISTORY, WEIGHTS, type Factor } from './engine'
import { useScore } from './useScore'
import styles from './Score.module.css'

const FACTOR_KEYS = {
  speed: 'score.factor.speed',
  onTime: 'score.factor.onTime',
  overdue: 'score.factor.overdue',
  fronted: 'score.factor.fronted',
  history: 'score.factor.history',
} as const

const BAND_BODY_KEYS = { warming: 'score.band.warming.body', getting: 'score.band.getting.body', solid: 'score.band.solid.body', gold: 'score.band.gold.body' } as const

/**
 * `/app/score` — your Settle Score: the dial, what goes into it (each factor with a bar and one
 * sentence), the payment that would help most, how it's worked out, and Share. Worked out on this
 * phone from your own splits; it says plainly that it's a game, not a credit score.
 */
export function ScoreScreen() {
  const t = useT()
  const toast = useToast()
  const result = useScore()
  const profile = useProfile()
  const friendsById = useFriendsById()
  const groups = useGroups()
  const header = <TopBar onBack={() => goBack(YOU_PATH)} />

  const disclaimer = (
    <p className={styles.disclaimer}>
      <ShieldCheck aria-hidden="true" />
      {t('score.disclaimer')}
    </p>
  )

  if (!result.ready) {
    return (
      <Screen header={header} contentClassName={styles.content}>
        <PageTitle title={t('score.title')} subtitle={t('score.subtitle')} />
        <EmptyState icon={<Gauge />} title={t('score.empty.title')} text={t('score.empty.body')} />
        {disclaimer}
      </Screen>
    )
  }

  const band = t(BAND_KEYS[result.band])
  const money = (amount: number, currency: string): string => formatMoney(amount, currency, { trimZeros: true })

  const sentence = (f: Factor): string => {
    switch (f.id) {
      case 'speed':
        return f.medianDays === null ? t('score.factor.speed.none') : t('score.factor.speed.body', { days: Math.round(f.medianDays) })
      case 'onTime':
        return f.counted === 0 ? t('score.factor.onTime.none') : t('score.factor.onTime.body', { onTime: f.onTime, counted: f.counted })
      case 'overdue':
        if (f.count === 0) return t('score.factor.overdue.none')
        return f.amount > 0 ? t('score.factor.overdue.body', { amount: money(f.amount, profile.currency), days: f.oldestDays }) : t('score.factor.overdue.count', { count: f.count, days: f.oldestDays })
      case 'fronted':
        return t('score.factor.fronted.body', { count: f.bills })
      case 'history':
        return f.splits >= FULL_HISTORY ? t('score.factor.history.full', { count: f.splits }) : t('score.factor.history.body', { count: f.splits, full: FULL_HISTORY })
    }
  }

  const next = result.next
  const nextName = next?.kind === 'friend' ? friendLabel(next.friendId, friendsById[next.friendId]) : next?.kind === 'group' ? (groups.find((g) => g.id === next.groupId)?.name ?? '') : ''

  const share = async (): Promise<void> => {
    const outcome = await shareResult(t('score.share.text', { score: result.score, band }), { title: t('score.title') })
    if (outcome === 'copied') toast(t('score.share.copied'), { tone: 'success' })
  }

  return (
    <Screen header={header} contentClassName={styles.content}>
      <PageTitle title={t('score.title')} subtitle={t('score.subtitle')} />

      <Card className={styles.hero}>
        <Dial score={result.score} band={result.band} />
        <p className={styles.range}>{t('score.dial.range')}</p>
        <p className={styles.body}>{t(BAND_BODY_KEYS[result.band])}</p>
        <Button variant="secondary" iconStart={<Share2 />} onClick={() => void share()}>
          {t('score.share')}
        </Button>
      </Card>

      {disclaimer}

      <Card role="group" aria-labelledby="score-next" className={styles.block}>
        <p id="score-next" className={styles.eyebrow}>
          <Footprints aria-hidden="true" /> {t('score.next.title')}
        </p>
        {next ? (
          <>
            <p className={styles.big}>
              {next.kind === 'friend'
                ? t('score.next.friend', { name: nextName, amount: money(next.amount, next.currency) })
                : t('score.next.group', { group: nextName, amount: money(next.amount, next.currency) })}
            </p>
            <p className={next.gain > 0 ? styles.good : styles.fine}>{next.gain > 0 ? t('score.next.gain', { gain: next.gain }) : t('score.next.steady')}</p>
            <Button block onClick={() => navigate(next.kind === 'friend' ? friendPath(next.friendId) : settleUpPath(next.groupId))}>
              {next.kind === 'friend' ? t('score.next.friend.cta', { name: nextName }) : t('score.next.group.cta')}
            </Button>
          </>
        ) : (
          <p className={styles.body}>{t('score.next.none')}</p>
        )}
      </Card>

      <section aria-labelledby="score-factors">
        <h2 id="score-factors" className={styles.heading}>
          {t('score.factors.title')}
        </h2>
        <Card padding="none">
          <ul className={styles.factors}>
            {result.factors.map((f) => {
              const title = t(FACTOR_KEYS[f.id])
              return (
                <li key={f.id} className={styles.factor}>
                  <span className={styles.factorHead}>
                    <span className={styles.factorTitle}>{title}</span>
                    <span className={styles.fine}>{t('score.factor.weight', { weight: f.weight })}</span>
                  </span>
                  <span className={styles.bar} role="meter" aria-label={t('score.factor.bar', { title, sub: f.sub })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={f.sub}>
                    <span className={styles.barFill} style={{ width: `${f.sub}%` }} data-low={f.sub < 40 ? '' : undefined} />
                  </span>
                  <span className={styles.fine}>{sentence(f)}</span>
                </li>
              )
            })}
          </ul>
        </Card>
      </section>

      <Card role="group" aria-labelledby="score-how" className={styles.block}>
        <h2 id="score-how" className={styles.cardHeading}>
          <Info aria-hidden="true" /> {t('score.how.title')}
        </h2>
        <p className={styles.fine}>{t('score.how.counts')}</p>
        <p className={styles.fine}>{t('score.how.weights', { ...WEIGHTS })}</p>
        <p className={styles.fine}>{t('score.how.history', { full: FULL_HISTORY })}</p>
        <p className={styles.fine}>{t('score.how.promise')}</p>
      </Card>
    </Screen>
  )
}
