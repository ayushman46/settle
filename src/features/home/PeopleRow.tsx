import { UserPlus } from 'lucide-react'
import { Link } from '../../app/router'
import { Avatar, SectionHeader } from '../../components'
import { useFriends, useSummary } from '../../data'
import { ME_ID, type Friend, type Minor } from '../../domain/types'
import { cx } from '../../lib/cx'
import { useT } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { firstName } from '../../share/text'
import { ADD_FRIEND_PATH, FRIENDS_PATH, friendPath, PEOPLE_SHOWN } from './homeLinks'
import styles from './HomeScreen.module.css'

/**
 * "Riya ₹540, owes you" / "Sam ₹120, you owe" / "Neha". The visible first name and amount come first, so the
 * accessible name contains what is on screen (WCAG 2.5.3).
 */
function spokenName(friend: Friend, balance: Minor, currency: string): string {
  if (balance === 0) return friend.name
  const amount = formatMoney(Math.abs(balance), currency, { trimZeros: true })
  const who = firstName(friend.name)
  return balance > 0 ? `${who} ${amount}, owes you` : `${who} ${amount}, you owe`
}

/**
 * The people you split with most, as a payments-app contact grid: a face, a first name and — when
 * money is out between you — the balance (green: they owe you; red: you owe them). "Add" opens
 * your people with the add sheet.
 */
export function PeopleRow() {
  const t = useT()
  const friends = useFriends()
  const summary = useSummary()
  const others = friends.filter((f) => f.id !== ME_ID)
  const shown = others.slice(0, PEOPLE_SHOWN)

  return (
    <section className={styles.section} aria-labelledby="home-people">
      <SectionHeader
        id="home-people"
        title="People"
        action={others.length > 0 ? { label: 'See all', href: FRIENDS_PATH, 'aria-label': 'See all people' } : undefined}
      />
      <ul role="list" className={styles.people}>
        {shown.map((friend) => {
          const balance = summary.byFriend[friend.id] ?? 0
          return (
            <li key={friend.id} className={styles.personCell}>
              <Link to={friendPath(friend.id)} className={styles.person} aria-label={spokenName(friend, balance, summary.currency)}>
                <Avatar name={friend.name} color={friend.color} size="lg" />
                <span className={styles.personName}>{firstName(friend.name)}</span>
                {balance !== 0 && (
                  <span className={cx(styles.personBalance, balance > 0 ? styles.owed : styles.owe)}>
                    {formatMoney(Math.abs(balance), summary.currency, { trimZeros: true })}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
        <li className={styles.personCell}>
          <Link to={ADD_FRIEND_PATH} className={styles.person} aria-label="Add a person">
            <span className={styles.addDisc} aria-hidden="true">
              <UserPlus strokeWidth={2.25} />
            </span>
            <span className={styles.personName}>{t('home.people.add')}</span>
          </Link>
        </li>
      </ul>
    </section>
  )
}
