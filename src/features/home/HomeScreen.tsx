import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { navigate } from '../../app/router'
import { Screen, SearchPill } from '../../components'
import { DESCRIBE_EXAMPLES } from '../../ai'
import { useHasData, useSummary } from '../../data'
import { BalanceCard } from '../../kit/BalanceCard'
import { useT } from '../../i18n'
import { isSpeechSupported } from '../../lib/speech'
import { useAiQuota } from '../../pro/quota'
import { useHealth } from '../../state/health'
import { AiDescribeSheet } from './AiDescribeSheet'
import { BillDraftCard } from './BillDraftCard'
import { DueSplits } from './DueSplits'
import { HomeExtras } from './HomeExtras'
import { FirstRunCard } from './FirstRunCard'
import { HomeHeader } from './HomeHeader'
import { allowanceLabel, FRIENDS_PATH } from './homeLinks'
import { HomeQuickActions } from './HomeQuickActions'
import { MicButton } from './MicButton'
import { PeopleRow } from './PeopleRow'
import { RecentActivity } from './RecentActivity'
import { VOICE_ENABLED } from './voice.enabled'
import styles from './HomeScreen.module.css'

/**
 * `/app` — Home, built like a payments app: a greeting, the "Just say it" AI field, quick actions,
 * where you stand (the dark balance card), anything due, your people and the latest activity.
 * Before the first split it's an invitation instead, with the sample bill one tap away.
 */
export function HomeScreen() {
  const hasData = useHasData()
  const summary = useSummary()
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
            Just say it
          </span>
          <span className={styles.sayQuota}>{allowanceLabel(quota.remaining)}</span>
        </p>
        <div className={styles.sayRow}>
          <SearchPill
            asButton
            placeholder="Just say it…"
            label="Just say it: describe an expense for the AI to split"
            examples={DESCRIBE_EXAMPLES}
            onClick={() => setSaying('type')}
            className={styles.sayPill}
          />
          {showMic && <MicButton label={t('voice.mic.home.aria')} onClick={() => setSaying('voice')} />}
        </div>
      </div>

      <BillDraftCard />

      <HomeQuickActions />

      {hasData ? <BalanceCard summary={summary} onSettle={() => navigate(FRIENDS_PATH)} /> : <FirstRunCard />}

      <DueSplits />

      <HomeExtras />

      <PeopleRow />

      <RecentActivity />

      <p className={styles.trust}>
        <ShieldCheck aria-hidden="true" className={styles.trustIcon} />
        Private by design — your splits stay on this phone. No account, no ads.
      </p>

      <AiDescribeSheet open={saying !== false} startWith={saying === 'voice' ? 'voice' : undefined} onClose={() => setSaying(false)} />
    </Screen>
  )
}
