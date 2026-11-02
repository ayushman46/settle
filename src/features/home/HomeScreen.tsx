import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { navigate } from '../../app/router'
import { Screen, SearchPill } from '../../components'
import { useHasData, useSummary } from '../../data'
import { BalanceCard } from '../../kit/BalanceCard'
import { useT } from '../../i18n'
import { isSpeechSupported } from '../../lib/speech'
import { useAiQuota } from '../../pro/quota'
import { useHealth } from '../../state/health'
import { COLLECT_PATH } from '../collect/paths'
import { StuckCard } from '../stuck/StuckCard'
import { AiDescribeSheet } from './AiDescribeSheet'
import { BillDraftCard } from './BillDraftCard'
import { sayExamples } from './describeView'
import { DueSplits } from './DueSplits'
import { HomeExtras } from './HomeExtras'
import { FirstRunCard } from './FirstRunCard'
import { HomeHeader } from './HomeHeader'
import { allowanceLabel, FRIENDS_PATH } from './homeLinks'
import { HomeQuickActions } from './HomeQuickActions'
import { InstallCard } from '../install'
import { MicButton } from './MicButton'
import { PeopleRow } from './PeopleRow'
import { RecentActivity } from './RecentActivity'
import { useStuckPlace } from './stuckFirst'
import { VOICE_ENABLED } from './voice.enabled'
import styles from './HomeScreen.module.css'

/**
 * `/app` — Home, built like a payments app: a greeting, the "Just say it" AI field, quick actions,
 * where you stand (the dark balance card), anything due, your people and the latest activity.
 * Before the first split it's an invitation instead, with the sample bill one tap away. Stuck
 * money that needs the person now comes before the balance (and before the invitation); while
 * it waits it sits lower down, and with nothing stuck the grid offers its tile instead.
 */
export function HomeScreen() {
  const hasData = useHasData()
  const stuck = useStuckPlace(hasData)
  const summary = useSummary()
  const onlyOwed = summary.owedToMe > 0 && summary.iOwe === 0
  const quota = useAiQuota()
  const health = useHealth()
  const t = useT()
  /** The sheet is open: typing (the pill) or listening (the mic). */
  const [saying, setSaying] = useState<false | 'type' | 'voice'>(false)
  const aiOff = health !== 'loading' && health !== null && !health.configured
  // The mic only where the browser turns speech into text, and while the AI is on.
  const showMic = VOICE_ENABLED && !aiOff && isSpeechSupported()

  return (
    <Screen contentClassName={styles.content}>
      <HomeHeader />

      <div className={styles.say}>
        <p className={styles.sayHead}>
          <span className={styles.sayTitle} aria-hidden="true">
            {t('home.say.title')}
          </span>
          <span className={styles.sayQuota}>{allowanceLabel(quota.remaining)}</span>
        </p>
        <div className={styles.sayRow}>
          <SearchPill
            asButton
            placeholder={t('home.say.placeholder')}
            label={t('home.say.label')}
            examples={sayExamples()}
            onClick={() => setSaying('type')}
            className={styles.sayPill}
          />
          {showMic && <MicButton label={t('voice.mic.home.aria')} onClick={() => setSaying('voice')} />}
        </div>
      </div>

      <BillDraftCard />

      <HomeQuickActions stuckCard={stuck !== null} />

      <InstallCard />

      {stuck === 'top' && <StuckCard compact />}

      {hasData ? (
        // Only owed money: the way forward is getting it back (everyone who owes you, each with a reminder).
        onlyOwed ? (
          <BalanceCard summary={summary} onSettle={() => navigate(COLLECT_PATH)} settleLabel={t('collect.home.cta')} />
        ) : (
          <BalanceCard summary={summary} onSettle={() => navigate(FRIENDS_PATH)} />
        )
      ) : (
        <FirstRunCard />
      )}

      <DueSplits />

      <HomeExtras withoutStuck={stuck === 'top'} />

      <PeopleRow />

      <RecentActivity />

      <p className={styles.trust}>
        <ShieldCheck aria-hidden="true" className={styles.trustIcon} />
        {t('home.trust')}
      </p>

      <AiDescribeSheet open={saying !== false} startWith={saying === 'voice' ? 'voice' : undefined} onClose={() => setSaying(false)} />
    </Screen>
  )
}
