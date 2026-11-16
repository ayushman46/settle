import { useEffect, useState } from 'react'
import { UsersRound } from 'lucide-react'
import { goBack, navigate, Redirect, useLocation } from '../../app/router'
import { Button, EmptyState, PageTitle, Screen, Spinner, TopBar, useToast } from '../../components'
import { useT } from '../../i18n'
import { cloud } from './api'
import { cloudGroupPath } from './paths'
import { useAccount } from './store'
import styles from './Account.module.css'

interface Peek {
  groupId: string
  groupName: string
  members: number
  alreadyIn: boolean
}

/**
 * `/app/cloud/join#<token>` — an invite link to an account group. The token stays in the
 * `#fragment`, so it never reaches a server log; signing in first comes back here.
 */
export function CloudJoinScreen() {
  const t = useT()
  const toast = useToast()
  const account = useAccount()
  const location = useLocation()
  const token = location.hash.replace(/^#/, '')
  const [peek, setPeek] = useState<Peek | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const signedIn = account.status === 'signedIn'

  useEffect(() => {
    if (!signedIn || !token) return
    let live = true
    void cloud<Peek>('POST', '/invites/peek', { token }).then((res) => {
      if (!live) return
      if (res.ok) setPeek(res.data)
      else setProblem(res.message)
    })
    return () => {
      live = false
    }
  }, [signedIn, token])

  const header = <TopBar onBack={() => goBack('/app/cloud')} />
  if (!token) {
    return (
      <Screen header={header}>
        <EmptyState icon={<UsersRound />} title={t('account.cloud.join.missing')} />
      </Screen>
    )
  }
  if (account.status === 'signedOut') return <Redirect to={`/app/account?next=${encodeURIComponent(`/app/cloud/join#${token}`)}`} />

  const join = async () => {
    if (busy || !peek) return
    setBusy(true)
    const res = await cloud<{ groupId: string }>('POST', '/invites/accept', { token })
    setBusy(false)
    if (!res.ok) {
      setProblem(res.message)
      return
    }
    toast(t('account.cloud.join.joined', { name: peek.groupName }), { tone: 'success' })
    navigate(cloudGroupPath(res.data.groupId), { replace: true })
  }

  return (
    <Screen header={header}>
      <div className={styles.stack}>
        <PageTitle title={t('account.cloud.join.title')} />
        {problem ? (
          <EmptyState icon={<UsersRound />} title={problem} />
        ) : !peek ? (
          <div className={styles.stack} role="status">
            <Spinner />
            <p className={styles.footnote}>{t('account.cloud.join.checking')}</p>
          </div>
        ) : (
          <EmptyState
            icon={<UsersRound />}
            title={t('account.cloud.join.group', { name: peek.groupName })}
            text={peek.alreadyIn ? t('account.cloud.join.already') : t('account.cloud.join.members', { count: peek.members })}
            action={
              peek.alreadyIn ? (
                <Button onClick={() => navigate(cloudGroupPath(peek.groupId), { replace: true })}>{t('account.cloud.join.open')}</Button>
              ) : (
                <Button loading={busy} onClick={() => void join()}>
                  {t('account.cloud.join.cta')}
                </Button>
              )
            }
          />
        )}
      </div>
    </Screen>
  )
}
