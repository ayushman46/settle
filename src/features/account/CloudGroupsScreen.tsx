import { useState } from 'react'
import { Fingerprint, Plus, UsersRound } from 'lucide-react'
import { goBack, navigate } from '../../app/router'
import { Banner, List, BottomSheet, Button, Card, EmptyState, IconButton, ListRow, Money, PageTitle, Screen, SectionHeader, Spinner, TextField, TopBar, useToast } from '../../components'
import { useT } from '../../i18n'
import { cloud, type Dashboard } from './api'
import { CLOUD_PATH, cloudGroupPath } from './paths'
import { needsText } from './settlementText'
import { refreshAccount, useAccount } from './store'
import { useCloudGet } from './useCloud'
import styles from './Account.module.css'

/** `/app/cloud` — what you owe and are owed across account groups, what's waiting on you, and the groups. */
export function CloudGroupsScreen() {
  const t = useT()
  const account = useAccount()
  const signedIn = account.status === 'signedIn'
  const { data, error, reload } = useCloudGet<Dashboard>(signedIn ? '/dashboard' : null)
  const [creating, setCreating] = useState(false)

  const header = (
    <TopBar
      onBack={() => goBack('/app')}
      right={
        signedIn ? (
          <IconButton label={t('account.cloud.groups.new')} onClick={() => setCreating(true)}>
            <Plus />
          </IconButton>
        ) : undefined
      }
    />
  )

  if (account.status === 'signedOut') {
    return (
      <Screen header={header}>
        <PageTitle title={t('account.cloud.title')} subtitle={t('account.cloud.subtitle')} />
        <EmptyState
          icon={<Fingerprint />}
          title={t('account.cloud.signIn.title')}
          text={t('account.cloud.signIn.text')}
          action={<Button onClick={() => navigate(`/app/account?next=${encodeURIComponent(CLOUD_PATH)}`)}>{t('account.cloud.signIn.cta')}</Button>}
        />
      </Screen>
    )
  }
  if (account.status === 'unavailable') {
    return (
      <Screen header={header}>
        <PageTitle title={t('account.cloud.title')} />
        <EmptyState title={account.message ?? t('account.error.generic')} action={<Button onClick={() => void refreshAccount()}>{t('account.cloud.retry')}</Button>} />
      </Screen>
    )
  }
  if (!signedIn || !data) {
    return (
      <Screen header={header}>
        <PageTitle title={t('account.cloud.title')} />
        {error ? (
          <EmptyState title={error.message} action={<Button onClick={() => reload()}>{t('account.cloud.retry')}</Button>} />
        ) : (
          <div className={styles.stack} role="status" aria-label={t('app.loading.aria')}>
            <Spinner />
          </div>
        )}
      </Screen>
    )
  }

  const me = account.me!.id
  return (
    <Screen header={header}>
      <div className={styles.stack}>
        <PageTitle title={t('account.cloud.title')} subtitle={t('account.cloud.subtitle')} />
        {error && <Banner tone="warning">{error.message}</Banner>}
        <Card padding="md">
          <div className={styles.totals}>
            <div className={styles.total}>
              <span className={styles.totalLabel}>{t('account.cloud.youOwe')}</span>
              <Money value={data.owe} currency="INR" size="lg" tone={data.owe > 0 ? 'negative' : 'default'} strong />
            </div>
            <div className={styles.total}>
              <span className={styles.totalLabel}>{t('account.cloud.youAreOwed')}</span>
              <Money value={data.owed} currency="INR" size="lg" tone={data.owed > 0 ? 'positive' : 'default'} strong />
            </div>
          </div>
        </Card>

        {data.open.length > 0 && (
          <section>
            <SectionHeader title={t('account.cloud.needs.heading')} />
            <Card>
              <List aria-label={t('account.cloud.needs.heading')}>
                {data.open.map((s) => (
                  <li key={s.id}>
                    <ListRow title={needsText(s, me)} subtitle={s.groupName ?? undefined} onClick={() => navigate(cloudGroupPath(s.groupId))} chevron />
                  </li>
                ))}
              </List>
            </Card>
          </section>
        )}

        <section>
          <SectionHeader title={t('account.cloud.groups.heading')} action={data.groups.length > 0 ? { label: t('account.cloud.groups.new'), onClick: () => setCreating(true) } : undefined} />
          {data.groups.length === 0 ? (
            <EmptyState
              icon={<UsersRound />}
              title={t('account.cloud.groups.empty.title')}
              text={t('account.cloud.groups.empty.text')}
              action={
                <Button iconStart={<Plus />} onClick={() => setCreating(true)}>
                  {t('account.cloud.groups.new')}
                </Button>
              }
            />
          ) : (
            <Card>
              <List aria-label={t('account.cloud.groups.heading')}>
                {data.groups.map((g) => (
                  <li key={g.id}>
                    <ListRow
                      title={g.name}
                      subtitle={t('account.cloud.groups.members', { count: g.members })}
                      trailing={<Money value={Math.abs(g.net)} currency="INR" tone={g.net > 0 ? 'positive' : g.net < 0 ? 'negative' : 'default'} strong={g.net !== 0} />}
                      onClick={() => navigate(cloudGroupPath(g.id))}
                      chevron
                    />
                  </li>
                ))}
              </List>
            </Card>
          )}
        </section>
      </div>
      <NewGroupSheet open={creating} onClose={() => setCreating(false)} />
    </Screen>
  )
}

function NewGroupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const create = async () => {
    if (busy || !name.trim()) return
    setBusy(true)
    const res = await cloud<{ id: string }>('POST', '/groups', { name: name.trim() })
    setBusy(false)
    if (!res.ok) {
      toast(res.message, { tone: 'error' })
      return
    }
    setName('')
    onClose()
    navigate(cloudGroupPath(res.data.id))
  }
  return (
    <BottomSheet open={open} onClose={onClose} title={t('account.cloud.newGroup.title')}>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault()
          void create()
        }}
      >
        <TextField label={t('account.cloud.newGroup.name')} placeholder={t('account.cloud.newGroup.placeholder')} value={name} maxLength={60} onChange={(e) => setName(e.currentTarget.value)} />
        <Button type="submit" block loading={busy} disabled={!name.trim()}>
          {t('account.cloud.newGroup.cta')}
        </Button>
      </form>
    </BottomSheet>
  )
}
