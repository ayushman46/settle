import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, HelpCircle, Link2Off } from 'lucide-react'
import { goBack, navigate, Redirect, useLocation } from '../../app/router'
import { ActionBar, Banner, Button, Card, Screen, Skeleton, Switch, TopBar, useToast } from '../../components'
import { useFriends, usePools } from '../../data'
import { applyPoolReply, contributionForReply, isPoolDeleted, removeContribution } from '../../data/pools'
import { ME_ID, type Friend, type Pool } from '../../domain/types'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { copyText } from '../../lib/share'
import { decodePoolReply, matchByName, verifyPoolReply, type PoolReplyPayload } from '../../share/pool'
import { POOLS_ENABLED } from './enabled'
import { POOLS_PATH, poolPath } from './paths'
import { PoolEmoji } from './PoolRow'
import { money } from './poolView'
import styles from './PoolReplyScreen.module.css'

type Decoded = { hash: string; reply: PoolReplyPayload | null }

/**
 * `/app/pools/in#…` — a friend's "I've chipped in" reply arrives: check the signature against the
 * collection's secret, say plainly what it is (new, a different amount, already ticked, not on this
 * phone, tampered, closed), and tick them off in one tap — with Undo.
 */
export function PoolReplyScreen() {
  if (!POOLS_ENABLED) return <Redirect to="/app" />
  return <Reply />
}

function useReply(hash: string): Decoded | 'loading' | 'empty' {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  const [decoded, setDecoded] = useState<Decoded | null>(null)
  useEffect(() => {
    if (!fragment) return
    let live = true
    void decodePoolReply(fragment).then((reply) => {
      if (live) setDecoded({ hash: fragment, reply })
    })
    return () => {
      live = false
    }
  }, [fragment])
  if (!fragment) return 'empty'
  if (!decoded || decoded.hash !== fragment) return 'loading'
  return decoded
}

function Reply() {
  const t = useT()
  const { hash } = useLocation()
  const state = useReply(hash)
  const pools = usePools()

  return (
    <Screen header={<TopBar onBack={() => goBack(POOLS_PATH)} title={t('pools.list.title')} />} contentClassName={styles.content}>
      {state === 'loading' && (
        <div className={styles.loading}>
          <p role="status" className="visually-hidden">
            {t('pools.reply.loading')}
          </p>
          <Skeleton shape="md" width={64} height={64} />
          <Skeleton width="70%" height={28} />
          <Skeleton width="50%" height={16} />
        </div>
      )}
      {state === 'empty' && (
        <Outcome icon={<Link2Off />} title={t('pools.reply.empty.title')} text={t('pools.reply.empty.text')}>
          <Button block onClick={() => navigate(POOLS_PATH, { replace: true })}>
            {t('pools.detail.gone.action')}
          </Button>
        </Outcome>
      )}
      {state !== 'loading' && state !== 'empty' && <ReplyState key={state.hash} reply={state.reply} pools={pools} />}
    </Screen>
  )
}

function Outcome({ icon, title, text, tone = 'neutral', children }: { icon: ReactNode; title: string; text?: string; tone?: 'neutral' | 'warning' | 'positive'; children?: ReactNode }) {
  return (
    <section className={styles.outcome} aria-labelledby="pool-reply-title">
      <span className={`${styles.outcomeIcon} ${styles[tone]}`} aria-hidden="true">
        {icon}
      </span>
      <h1 id="pool-reply-title" className={styles.title} tabIndex={-1}>
        {title}
      </h1>
      {text && <p className={styles.text}>{text}</p>}
      {children && <div className={styles.actions}>{children}</div>}
    </section>
  )
}

function ReplyState({ reply, pools }: { reply: PoolReplyPayload | null; pools: Pool[] }) {
  const t = useT()
  const pool = reply ? (pools.find((p) => p.id === reply.id) ?? null) : null
  if (!reply) {
    return (
      <Outcome icon={<AlertTriangle />} tone="warning" title={t('pools.reply.bad.title')} text={t('pools.reply.bad.someone')}>
        <Button block variant="secondary" onClick={() => navigate('/app', { replace: true })}>
          {t('pools.reply.home')}
        </Button>
      </Outcome>
    )
  }
  if (!pool) return <UnknownPool reply={reply} />
  if (!verifyPoolReply(pool.secret, reply)) {
    return (
      <Outcome icon={<AlertTriangle />} tone="warning" title={t('pools.reply.bad.title')} text={t('pools.reply.bad.text', { name: reply.n })}>
        <Button block variant="secondary" onClick={() => navigate('/app', { replace: true })}>
          {t('pools.reply.home')}
        </Button>
      </Outcome>
    )
  }
  return <NewReply reply={reply} pool={pool} />
}

function UnknownPool({ reply }: { reply: PoolReplyPayload }) {
  const t = useT()
  const toast = useToast()
  const deleted = isPoolDeleted(reply.id)
  return (
    <Outcome
      icon={<HelpCircle />}
      title={deleted ? t('pools.reply.deleted.title') : t('pools.reply.unknown.title')}
      text={deleted ? t('pools.reply.deleted.text') : t('pools.reply.unknown.text')}
    >
      {!deleted && (
        <Button
          block
          variant="secondary"
          onClick={async () => {
            const ok = await copyText(window.location.href)
            toast(ok ? t('pools.detail.share.copied') : t('pools.detail.share.copyFailed'), { tone: ok ? 'success' : 'error' })
          }}
        >
          {t('pools.reply.copy')}
        </Button>
      )}
      <Button block variant="ghost" onClick={() => navigate('/app', { replace: true })}>
        {t('pools.reply.home')}
      </Button>
    </Outcome>
  )
}

/** Who the reply is from among your people: a listed person by name, else (offered) one of your people. */
function useMatch(reply: PoolReplyPayload, pool: Pool): { member: Friend | null; friend: Friend | null } {
  const friends = useFriends()
  return useMemo(() => {
    const people = friends.filter((f) => f.id !== ME_ID)
    const members = people.filter((f) => pool.memberIds.includes(f.id))
    const member = matchByName(reply.n, members)
    return { member, friend: member ? null : matchByName(reply.n, people) }
  }, [friends, pool.memberIds, reply.n])
}

function NewReply({ reply, pool }: { reply: PoolReplyPayload; pool: Pool }) {
  const t = useT()
  const toast = useToast()
  const { member, friend } = useMatch(reply, pool)
  const [useFriend, setUseFriend] = useState(true)
  const [anyway, setAnyway] = useState(false)
  const already = contributionForReply(reply)
  const name = reply.n
  const amount = money(reply.a, pool.currency)

  if (already) {
    return (
      <Outcome icon={<CheckCircle2 />} tone="positive" title={t('pools.reply.duplicate.title')} text={t('pools.reply.duplicate.text', { name, amount: money(already.amount, pool.currency) })}>
        <Button block onClick={() => navigate(poolPath(pool.id), { replace: true })}>
          {t('pools.reply.open')}
        </Button>
      </Outcome>
    )
  }

  const closed = pool.closedAt !== null && !anyway
  const part = pool.mode === 'fixed' ? pool.perPerson : null
  const differs = part !== null && reply.a !== part
  const friendId = member?.id ?? (friend && useFriend ? friend.id : null)

  const tick = (): void => {
    const result = applyPoolReply(reply, { friendId })
    if (result.kind !== 'added') {
      navigate(poolPath(pool.id), { replace: true })
      return
    }
    haptic('success')
    toast(t('pools.detail.ticked', { name }), {
      tone: 'success',
      action: { label: t('pools.detail.undo'), onAction: () => removeContribution(pool.id, result.contribution.id) },
    })
    navigate(poolPath(pool.id), { replace: true })
  }

  return (
    <>
      <Card className={styles.pool}>
        <PoolEmoji emoji={pool.emoji} />
        <span className={styles.poolTitle}>{t('pools.reply.for', { title: pool.title })}</span>
      </Card>
      {closed ? (
        <Banner
          tone="warning"
          title={t('pools.reply.closed')}
          actions={
            <div className={styles.bannerActions}>
              <Button size="sm" onClick={() => setAnyway(true)}>
                {t('pools.reply.tickAnyway')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => navigate(poolPath(pool.id), { replace: true })}>
                {t('pools.reply.notNow')}
              </Button>
            </div>
          }
        />
      ) : null}
      <Outcome
        icon={<HelpCircle />}
        title={t('pools.reply.new.title', { name, amount })}
        text={differs && part !== null ? t('pools.reply.differs.text', { name, part: money(part, pool.currency), amount }) : t('pools.reply.new.text')}
      />
      {friend && (
        <Card padding="none">
          <Switch checked={useFriend} onChange={setUseFriend} label={t('pools.reply.match', { name: friend.name })} />
        </Card>
      )}
      {!closed && (
        <ActionBar>
          <Button block onClick={tick}>
            {differs ? t('pools.reply.differs.yes', { amount }) : t('pools.reply.new.yes', { name })}
          </Button>
          <Button block variant="secondary" onClick={() => navigate(poolPath(pool.id), { replace: true })}>
            {t('pools.reply.notYet')}
          </Button>
        </ActionBar>
      )}
    </>
  )
}
