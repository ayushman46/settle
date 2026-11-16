import { UsersRound } from 'lucide-react'
import { navigate } from '../../app/router'
import { Card, List, ListRow, Money, SectionHeader } from '../../components'
import { useT } from '../../i18n'
import type { Dashboard } from './api'
import { CLOUD_PATH, cloudGroupPath } from './paths'
import { needsText } from './settlementText'
import { useAccountPeek } from './store'
import { useCloudGet } from './useCloud'

/**
 * Account groups where people look for groups (Home, Groups): what you owe or are owed in each, and
 * what's waiting on you. Shown only to someone signed in who is in at least one.
 */
export function AccountGroupsCard() {
  const t = useT()
  const account = useAccountPeek()
  const me = account.status === 'signedIn' ? account.me : null
  const { data } = useCloudGet<Dashboard>(me ? '/dashboard' : null)
  if (!me || !data || data.groups.length === 0) return null
  const waiting = data.open.filter((s) => s.receiverId === me.id && s.status === 'awaiting_confirmation')
  return (
    <section aria-labelledby="account-groups">
      <SectionHeader id="account-groups" title={t('account.cloud.title')} action={{ label: t('account.cloud.groups.all'), onClick: () => navigate(CLOUD_PATH) }} />
      <Card padding="none">
        <List aria-label={t('account.cloud.title')}>
          {waiting.map((s) => (
            <ListRow key={s.id} title={needsText(s, me.id)} subtitle={s.groupName ?? undefined} onClick={() => navigate(cloudGroupPath(s.groupId))} chevron />
          ))}
          {data.groups.slice(0, 4).map((g) => (
            <ListRow
              key={g.id}
              leading={<UsersRound aria-hidden="true" />}
              title={g.name}
              subtitle={g.net > 0 ? t('account.cloud.youAreOwed') : g.net < 0 ? t('account.cloud.youOwe') : t('account.cloud.net.square')}
              trailing={g.net !== 0 ? <Money value={Math.abs(g.net)} currency="INR" tone={g.net > 0 ? 'positive' : 'negative'} strong /> : undefined}
              onClick={() => navigate(cloudGroupPath(g.id))}
              chevron
            />
          ))}
        </List>
      </Card>
    </section>
  )
}
