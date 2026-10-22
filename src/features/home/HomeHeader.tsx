import { useState } from 'react'
import { Crown, Sparkles } from 'lucide-react'
import { Link } from '../../app/router'
import { Avatar, Badge } from '../../components'
import { useMe, useProfile } from '../../data'
import { usePro } from '../../pro/store'
import { currentHour, helloLine, timeOfDayGreeting } from './greeting'
import styles from './HomeScreen.module.css'

/**
 * The top of Home: a greeting with the owner's name (the screen's heading), their Pro status — a
 * gradient badge, or a quiet "Go Pro" — and their avatar, which opens You.
 */
export function HomeHeader() {
  const profile = useProfile()
  const me = useMe()
  const pro = usePro()
  // Fixed for the visit: the greeting shouldn't change under someone's thumb.
  const [hour] = useState(currentHour)

  return (
    <header className={styles.header}>
      <div className={styles.greeting}>
        <p className={styles.hello}>{timeOfDayGreeting(hour)}</p>
        <h1 className={styles.title} tabIndex={-1}>
          {helloLine(profile.name)}
        </h1>
      </div>
      <div className={styles.headerEnd}>
        {pro.isPro ? (
          <Link to="/app/pro" className={styles.proLink} aria-label="Settle Pro is on">
            <Badge tone="pro" size="md" icon={<Sparkles />}>
              Pro
            </Badge>
          </Link>
        ) : (
          <Link to="/app/pro" className={styles.goPro}>
            <Crown aria-hidden="true" className={styles.goProIcon} />
            {pro.status === 'expired' ? 'Renew Pro' : 'Go Pro'}
          </Link>
        )}
        <Link to="/app/you" className={styles.avatarLink} aria-label="You: profile and settings">
          <Avatar name={me.name} color={me.color} size="md" />
        </Link>
      </div>
    </header>
  )
}
