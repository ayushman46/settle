import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ClipboardPaste, Copy, MessageCircle, MoreVertical, Pencil, Plus, Share2, Trash2, Lock, LockOpen } from 'lucide-react'
import { goBack, navigate, Redirect, useRoute, useSearchParams } from '../../app/router'
import {
  ActionBar,
  Badge,
  Banner,
  BottomSheet,
  Button,
  Card,
  IconButton,
  List,
  ListRow,
  PageTitle,
  ProgressRing,
  Screen,
  SectionHeader,
  TextField,
  TopBar,
  useToast,
} from '../../components'
import { updateProfile, useFriendsById, usePool, useProfile } from '../../data'
import { addContribution, deletePool, removeContribution, restorePool, setPoolClosed } from '../../data/pools'
import { ME_ID, type Pool } from '../../domain/types'
import { today } from '../../engine/dates'
import { poolProgress } from '../../engine/pools'
import { useT } from '../../i18n'
import { FriendAvatar } from '../../kit/FriendAvatar'
import { UpiIdForm } from '../../kit/UpiIdForm'
import { haptic } from '../../lib/haptics'
import { copyText, shareResult } from '../../lib/share'
import { fragmentOf } from '../../share/fragment'
import { whatsappUrl } from '../../share/links'
import { outsideName } from '../../share/names'
import { encodePoolLink, poolLinkFromPool, POOL_REPLY_PATH } from '../../share/pool'
import { poolShareText } from '../../share/poolNudge'
import { ContributionSheet, type ContributionSheetState } from './ContributionSheet'
import { POOLS_ENABLED } from './enabled'
import { POOLS_PATH, poolEditPath } from './paths'
import { PoolReminderSheet, type PoolReminderTarget } from './PoolReminderSheet'
import { DeadlineChip, PoolEmoji } from './PoolRow'
import { money, poolPeople, progressView, type PersonRow } from './poolView'
import styles from './PoolDetailScreen.module.css'

const ROUTES = ['/app/pools/:id'] as const
const UPI_NAG_KEY = 'settle.v4.pools-upi-nag'

/**
 * `/app/pools/:id` — the organiser's view of one collection: progress against the goal, the link
 * to share (re-made whenever anything changes, so a re-share carries the latest numbers), each
 * person with Tick / Remind, guests who chipped in, and ⋮ Edit / Close / Delete.
 */
export function PoolDetailScreen() {
  if (!POOLS_ENABLED) return <Redirect to="/app" />
  return <DetailRoute />
}

function DetailRoute() {
  const t = useT()
  const { params } = useRoute(ROUTES)
  const pool = usePool(params.id ?? null)
  if (!pool) {
    return (
      <Screen header={<TopBar onBack={() => goBack(POOLS_PATH)} />}>
        <PageTitle title={t('pools.detail.gone')} subtitle={t('pools.detail.gone.text')} />
        <Button onClick={() => navigate(POOLS_PATH, { replace: true })}>{t('pools.detail.gone.action')}</Button>
      </Screen>
    )
  }
  return <Detail pool={pool} />
}

function readNagged(): boolean {
  try {
    return window.localStorage.getItem(UPI_NAG_KEY) === '1'
  } catch {
    return false
  }
}

/** The pool's link, re-encoded whenever the pool (or your name / UPI ID) changes. */
function usePoolLink(pool: Pool): string | null {
  const friendsById = useFriendsById()
  const profile = useProfile()
  const payload = useMemo(() => poolLinkFromPool(pool, friendsById, profile), [pool, friendsById, profile])
  const json = JSON.stringify(payload)
  const [link, setLink] = useState<{ json: string; url: string } | null>(null)
  useEffect(() => {
    let live = true
    void encodePoolLink(payload).then((url) => {
      if (live) setLink({ json, url })
    })
    return () => {
      live = false
    }
    // `json` captures every change to the payload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [json])
  return link?.json === json ? link.url : (link?.url ?? null)
}

function Detail({ pool }: { pool: Pool }) {
  const t = useT()
  const toast = useToast()
  const profile = useProfile()
  const friendsById = useFriendsById()
  const query = useSearchParams()
  const day = today()
  const link = usePoolLink(pool)
  const progress = poolProgress(pool)
  const view = progressView(pool, progress)
  const { members, others } = poolPeople(pool, friendsById)
  const unpaid = members.filter((m) => m.state !== 'paid')
  const closed = pool.closedAt !== null
  const inr = pool.currency === 'INR'
  const organiser = outsideName(ME_ID, friendsById, profile, t('pools.remind.there'))

  const [menu, setMenu] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [reminder, setReminder] = useState<PoolReminderTarget | null>(null)
  const [contribution, setContribution] = useState<ContributionSheetState | null>(null)
  const [pasting, setPasting] = useState(false)
  const [upiOpen, setUpiOpen] = useState(false)
  const [nagged, setNagged] = useState(readNagged)
  const shareRef = useRef<HTMLHeadingElement>(null)
  const freshShare = query.get('share') === '1'

  useEffect(() => {
    if (!freshShare) return
    const heading = shareRef.current
    heading?.scrollIntoView?.({ block: 'center' })
    heading?.focus({ preventScroll: true })
  }, [freshShare])

  const shareText = link
    ? poolShareText({
        title: pool.title,
        emoji: pool.emoji,
        currency: pool.currency,
        mode: pool.mode,
        perPerson: pool.perPerson,
        goal: progress.goal,
        collected: progress.collected,
        deadline: pool.deadline,
        link,
      })
    : ''

  const tick = (row: PersonRow): void => {
    if (!row.friendId) return
    const added = addContribution(pool.id, {
      friendId: row.friendId,
      name: row.name,
      amount: row.left > 0 ? row.left : (pool.perPerson ?? 0),
      date: day,
      method: 'upi',
      via: 'tick',
      replyId: null,
    })
    haptic('success')
    toast(t('pools.detail.ticked', { name: row.name }), {
      tone: 'success',
      action: { label: t('pools.detail.undo'), onAction: () => removeContribution(pool.id, added.id) },
    })
  }

  const remove = (): void => {
    setMenu(false)
    const removed = deletePool(pool.id)
    if (removed) {
      toast(t('pools.detail.deleted', { title: removed.title }), {
        action: { label: t('pools.detail.undo'), onAction: () => restorePool(removed) },
      })
    }
    navigate(POOLS_PATH, { replace: true })
  }

  const copyLink = async (): Promise<void> => {
    if (!link) return
    if (await copyText(link)) {
      haptic('success')
      toast(t('pools.detail.share.copied'), { tone: 'success' })
    } else {
      toast(t('pools.detail.share.copyFailed'), { tone: 'error' })
    }
  }

  const dismissNag = (): void => {
    setNagged(true)
    try {
      window.localStorage.setItem(UPI_NAG_KEY, '1')
    } catch {
      // Private mode: it nags again next time, which is fine.
    }
  }

  const collectingTo = t('pools.detail.collectingTo', { name: organiser })

  return (
    <Screen
      header={
        <TopBar
          onBack={() => goBack(POOLS_PATH)}
          right={
            <IconButton label={t('pools.detail.menu')} onClick={() => setMenu(true)}>
              <MoreVertical />
            </IconButton>
          }
        />
      }
      contentClassName={styles.content}
    >
      <header className={styles.hero}>
        <PoolEmoji emoji={pool.emoji} size="lg" />
        <h1 className={styles.title} tabIndex={-1}>
          {pool.title}
        </h1>
        {pool.note && <p className={styles.note}>{pool.note}</p>}
        <p className={styles.meta}>
          <span>{collectingTo}</span>
          {pool.deadline && !closed && <DeadlineChip deadline={pool.deadline} today={day} />}
          {closed && <Badge>{t('pools.detail.closedBadge')}</Badge>}
        </p>
      </header>

      {closed && (
        <Banner
          tone="info"
          icon={<Lock />}
          action={{ label: t('pools.detail.menu.reopen'), onAction: () => setPoolClosed(pool.id, false) }}
        >
          {t('pools.detail.closedBanner')}
        </Banner>
      )}
      {inr && !profile.upiId && !nagged && (
        <Banner
          tone="warning"
          title={t('pools.detail.noUpi')}
          onDismiss={dismissNag}
          action={{ label: t('pools.detail.noUpi'), onAction: () => setUpiOpen(true) }}
        >
          {t('pools.detail.noUpi.text')}
        </Banner>
      )}

      <Card className={styles.progress}>
        {view.percentLabel !== null && (
          <ProgressRing value={view.fraction} size={96} stroke={8} label={t('pools.progress.label')}>
            <span className={styles.percent}>{view.percentLabel}</span>
          </ProgressRing>
        )}
        <div className={styles.progressText}>
          <p className={styles.collected}>{view.collected}</p>
          <p className={styles.of}>{view.of}</p>
          {view.people && <p className={styles.people}>{view.people}</p>}
          {view.over && <p className={styles.over}>{view.over}</p>}
        </div>
      </Card>

      <section className={styles.share} aria-labelledby="pool-share">
        <h2 id="pool-share" ref={shareRef} tabIndex={-1} className={styles.shareTitle}>
          {t('pools.detail.share.title')}
        </h2>
        <p className={styles.shareText}>{t('pools.detail.share.text')}</p>
        <a
          className={styles.whatsapp}
          href={link ? whatsappUrl(shareText) : undefined}
          aria-disabled={!link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => haptic('tap')}
        >
          <MessageCircle aria-hidden="true" strokeWidth={2.25} />
          {t('pools.detail.share.whatsapp')}
        </a>
        <div className={styles.shareMore}>
          <Button
            variant="secondary"
            size="md"
            iconStart={<Share2 />}
            disabled={!link}
            onClick={() => void shareResult(shareText, { title: t('pools.detail.shareTitle', { title: pool.title }) })}
          >
            {t('pools.detail.share.more')}
          </Button>
          <Button variant="secondary" size="md" iconStart={<Copy />} disabled={!link} onClick={() => void copyLink()}>
            {t('pools.detail.share.copy')}
          </Button>
        </div>
      </section>

      {members.length > 0 && (
        <section className={styles.section} aria-labelledby="pool-people">
          <SectionHeader
            id="pool-people"
            title={t('pools.detail.people')}
            action={
              unpaid.length > 0
                ? {
                    label: t('pools.detail.remindAll'),
                    'aria-label': t('pools.detail.remindAllLabel'),
                    onClick: () => setReminder({ kind: 'all', names: unpaid.map((m) => m.name) }),
                  }
                : undefined
            }
          />
          <Card padding="none">
            <ul role="list" className={styles.people}>
              {members.map((row) => (
                <PersonListRow
                  key={row.key}
                  pool={pool}
                  row={row}
                  onOpen={() => {
                    const last = row.contributions[row.contributions.length - 1]
                    setContribution(last ? { mode: 'edit', contribution: last } : { mode: 'add', friendId: row.friendId })
                  }}
                  onRemind={() =>
                    setReminder({
                      kind: 'one',
                      name: row.name,
                      phone: row.friendId ? (friendsById[row.friendId]?.phone ?? null) : null,
                      amount: pool.mode === 'fixed' ? row.left : null,
                    })
                  }
                  onTick={() => tick(row)}
                />
              ))}
            </ul>
          </Card>
        </section>
      )}

      {(others.length > 0 || members.length === 0) && (
        <section className={styles.section} aria-labelledby="pool-others">
          <SectionHeader
            id="pool-others"
            title={members.length > 0 ? t('pools.detail.others') : t('pools.detail.contributors')}
            description={members.length > 0 ? t('pools.detail.othersText') : undefined}
          />
          {others.length > 0 ? (
            <Card padding="none">
              <ul role="list" className={styles.people}>
                {others.map((row) => (
                  <PersonListRow
                    key={row.key}
                    pool={pool}
                    row={row}
                    onOpen={() => {
                      const last = row.contributions[row.contributions.length - 1]
                      if (last) setContribution({ mode: 'edit', contribution: last })
                    }}
                  />
                ))}
              </ul>
            </Card>
          ) : (
            <p className={styles.nobody}>{t('pools.detail.nobody')}</p>
          )}
        </section>
      )}

      <div className={styles.actions}>
        <Button variant="ghost" iconStart={<Plus />} onClick={() => setContribution({ mode: 'add', friendId: null })}>
          {t('pools.detail.add')}
        </Button>
        <Button variant="ghost" iconStart={<ClipboardPaste />} onClick={() => setPasting(true)}>
          {t('pools.detail.paste')}
        </Button>
      </div>

      <BottomSheet open={menu} onClose={() => setMenu(false)} title={pool.title}>
        <List>
          <ListRow
            leading={<Pencil aria-hidden="true" />}
            title={t('pools.detail.menu.edit')}
            onClick={() => {
              setMenu(false)
              navigate(poolEditPath(pool.id))
            }}
          />
          {closed ? (
            <ListRow
              leading={<LockOpen aria-hidden="true" />}
              title={t('pools.detail.menu.reopen')}
              onClick={() => {
                setMenu(false)
                setPoolClosed(pool.id, false)
                toast(t('pools.detail.reopened'), { tone: 'success' })
              }}
            />
          ) : (
            <ListRow
              leading={<Lock aria-hidden="true" />}
              title={t('pools.detail.menu.close')}
              onClick={() => {
                setMenu(false)
                setConfirmClose(true)
              }}
            />
          )}
          <ListRow leading={<Trash2 aria-hidden="true" />} title={t('pools.detail.menu.delete')} onClick={remove} />
        </List>
      </BottomSheet>

      <BottomSheet
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title={t('pools.detail.close.title', { amount: money(progress.collected, pool.currency) })}
        description={t('pools.detail.close.text')}
        footer={
          <ActionBar>
            <Button
              block
              iconStart={<Check />}
              onClick={() => {
                setConfirmClose(false)
                setPoolClosed(pool.id, true)
                toast(t('pools.detail.closed'), { tone: 'success' })
              }}
            >
              {t('pools.detail.close.yes')}
            </Button>
            <Button variant="secondary" block onClick={() => setConfirmClose(false)}>
              {t('pools.detail.close.no')}
            </Button>
          </ActionBar>
        }
      />

      <PoolReminderSheet
        open={reminder !== null}
        onClose={() => setReminder(null)}
        pool={pool}
        target={reminder}
        inCount={progress.inCount}
        expected={progress.expected}
        link={link}
      />
      <ContributionSheet pool={pool} state={contribution} onClose={() => setContribution(null)} />
      <PasteReplySheet open={pasting} onClose={() => setPasting(false)} />
      <BottomSheet open={upiOpen} onClose={() => setUpiOpen(false)} title={t('pools.editor.upiSheet')} description={t('pools.editor.upiSheet.text')}>
        <UpiIdForm
          ownerId={ME_ID}
          ownerName={profile.name}
          autoFocus
          onSave={(upiId) => {
            updateProfile({ upiId })
            setUpiOpen(false)
          }}
        />
      </BottomSheet>
    </Screen>
  )
}

interface PersonListRowProps {
  pool: Pool
  row: PersonRow
  onOpen: () => void
  onRemind?: () => void
  onTick?: () => void
}

function PersonListRow({ pool, row, onOpen, onRemind, onTick }: PersonListRowProps) {
  const t = useT()
  const avatar = row.friendId ? <FriendAvatar friendId={row.friendId} size="md" /> : <GuestAvatar name={row.name} />
  const paid = row.state === 'paid'
  return (
    <li className={styles.personRow}>
      <button type="button" className={styles.personMain} onClick={onOpen}>
        {avatar}
        <span className={styles.personText}>
          <span className={styles.personName}>{row.name}</span>{' '}
          <span className={styles.line}>{row.line}</span>
        </span>
      </button>
      <span className={styles.personActions}>
        {paid && onRemind && (
          <Badge tone="positive" icon={<Check />}>
            {t('pools.detail.paid')}
          </Badge>
        )}
        {!paid && onRemind && (
          <Button variant="tonal" size="sm" onClick={onRemind} aria-label={t('pools.detail.remindLabel', { name: row.name })}>
            {t('pools.detail.remind')}
          </Button>
        )}
        {row.state === 'not_yet' && pool.mode === 'fixed' && onTick && (
          <Button variant="secondary" size="sm" iconStart={<Check />} onClick={onTick} aria-label={t('pools.detail.tickLabel', { name: row.name })}>
            {t('pools.detail.tick')}
          </Button>
        )}
      </span>
    </li>
  )
}

function GuestAvatar({ name }: { name: string }) {
  return (
    <span className={styles.guest} aria-hidden="true">
      {Array.from(name.trim())[0]?.toUpperCase() ?? '?'}
    </span>
  )
}

function PasteReplySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const [text, setText] = useState('')
  const [error, setError] = useState(false)
  const submit = (): void => {
    const fragment = fragmentOf(text)
    // A reply link (or its bare fragment) — not some other Settle link.
    const linkLike = text.includes('://') || text.includes('/')
    if (!fragment || (linkLike && !text.includes(POOL_REPLY_PATH))) {
      setError(true)
      return
    }
    onClose()
    setText('')
    navigate(`${POOL_REPLY_PATH}#${fragment}`)
  }
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('pools.paste.title')}
      description={t('pools.paste.text')}
      footer={
        <ActionBar>
          <Button block disabled={text.trim() === ''} onClick={submit}>
            {t('pools.paste.open')}
          </Button>
        </ActionBar>
      }
    >
      <TextField
        label={t('pools.paste.label')}
        value={text}
        error={error ? t('pools.paste.invalid') : undefined}
        autoFocus
        onChange={(event) => {
          setText(event.target.value)
          setError(false)
        }}
      />
    </BottomSheet>
  )
}
