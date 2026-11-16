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
import { FeesCard } from '../fees/FeesCard'
import { useFeesLine } from '../fees/useFeesLine'
import { StuckCard } from '../stuck/StuckCard'
import { AiDescribeSheet } from './AiDescribeSheet'
import { BillDraftCard } from './BillDraftCard'
import { sayExamples } from './describeView'
import { DueSplits } from './DueSplits'
import { HomeExtras } from './HomeExtras'
import { FirstRunCard } from './FirstRunCard'
import { HomeHeader } from './HomeHeader'
import { allowanceLabel, FRIENDS_PATH } from './homeLinks'
import { AskBox } from '../ask/AskBox'
import { HoldHome } from '../hold/HoldCard'
import { PaydayCard } from '../payday/PaydayCard'
import { RefundedHome } from '../refund/RefundedCard'
import { PaydayGuessCard } from '../payday/PaydayGuessCard'
import { usePaydayDue } from '../payday/usePaydayDue'
import { QueueCard } from '../queue/QueueCard'
import { SpentCard } from '../spent/SpentCard'
import { SwapCard } from '../swap/SwapCard'
import { TodayList } from '../today/TodayList'
import { AccountGroupsCard } from '../account/AccountGroupsCard'
import { TripOverHome } from '../wrapped/TripOver'
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
  // Money your bank owes you, with something to do about it: near the top, like Stuck money's.
  const feesTop = useFeesLine()?.act === true
  const summary = useSummary()
  const paydayDue = usePaydayDue()
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

      {feesTop && <FeesCard compact />}

      <SpentCard />

      <PaydayGuessCard />

      <TripOverHome />

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

      <TodayList />

      <AccountGroupsCard />

      <AskBox />

      <PaydayCard />

      {/* On payday the card above already offers to clear everything. */}
      {!paydayDue && <QueueCard />}

      <SwapCard />

      <HoldHome />

      <RefundedHome />

      <DueSplits />

      <HomeExtras withoutStuck={stuck === 'top'} withoutFees={feesTop} />

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
