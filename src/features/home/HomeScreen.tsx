import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { navigate } from '../../app/router'
import { Screen, SearchPill } from '../../components'
import { DESCRIBE_EXAMPLES } from '../../ai'
import { useHasData, useSummary } from '../../data'
import { BalanceCard } from '../../kit/BalanceCard'
import { AiDescribeSheet } from './AiDescribeSheet'
import { BillDraftCard } from './BillDraftCard'
import { DueSplits } from './DueSplits'
import { FirstRunCard } from './FirstRunCard'
import { HomeHeader } from './HomeHeader'
import { FRIENDS_PATH } from './homeLinks'
import { HomeQuickActions } from './HomeQuickActions'
import { PeopleRow } from './PeopleRow'
import { RecentActivity } from './RecentActivity'
import styles from './HomeScreen.module.css'

/**
 * `/app` — Home, built like a payments app: a greeting, the "Just say it" AI field, quick actions,
 * where you stand (the dark balance card), anything due, your people and the latest activity.
 * Before the first split it's an invitation instead, with the sample bill one tap away.
 */
export function HomeScreen() {
  const hasData = useHasData()
  const summary = useSummary()
  const [saying, setSaying] = useState(false)

  return (
    <Screen contentClassName={styles.content}>
      <HomeHeader />

      <SearchPill
        asButton
        placeholder="Just say it…"
        label="Just say it: describe an expense for the AI to split"
        examples={DESCRIBE_EXAMPLES}
        onClick={() => setSaying(true)}
        className={styles.say}
      />

      <BillDraftCard />

      <HomeQuickActions />

      {hasData ? <BalanceCard summary={summary} onSettle={() => navigate(FRIENDS_PATH)} /> : <FirstRunCard />}

      <DueSplits />

      <PeopleRow />

      <RecentActivity />

      <p className={styles.trust}>
        <ShieldCheck aria-hidden="true" className={styles.trustIcon} />
        Private by design — your splits stay on this phone. No account, no ads.
      </p>

      <AiDescribeSheet open={saying} onClose={() => setSaying(false)} />
    </Screen>
  )
}
