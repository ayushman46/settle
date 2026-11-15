import { useMemo, useState } from 'react'
import { BookOpenText } from 'lucide-react'
import { navigate } from '../../app/router'
import { ListRow } from '../../components'
import { useExpenses, useGroups, useProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { passbook } from './engine'
import { passbookPath } from './paths'
import styles from './Passbook.module.css'

export interface PassbookLinkProps {
  friendId: string
}

/**
 * The row on a person's page that opens their statement. Shows nothing until there is at least
 * one entry between the two of you (and never for yourself).
 */
export function PassbookLink({ friendId }: PassbookLinkProps) {
  const t = useT()
  const expenses = useExpenses()
  const groups = useGroups()
  const profile = useProfile()
  const [today] = useState(() => todayIso())
  const count = useMemo(
    () => (friendId === ME_ID || friendId === '' ? 0 : passbook({ friendId, expenses, groups, currency: profile.currency, today }).count),
    [friendId, expenses, groups, profile.currency, today],
  )
  if (count === 0) return null
  return (
    <ListRow
      leading={
        <span className={styles.linkIcon} aria-hidden="true">
          <BookOpenText />
        </span>
      }
      title={t('passbook.link.title')}
      subtitle={t('passbook.link.body', { count })}
      chevron
      onClick={() => navigate(passbookPath(friendId))}
    />
  )
}
