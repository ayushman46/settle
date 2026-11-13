import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, MessageCircle, RefreshCw, Send, UserPlus, Wifi, WifiOff } from 'lucide-react'
import { Avatar, BottomSheet, Button, QrCode, useToast } from '../../components'
import { useExpenses, useFriendsById, useProfile } from '../../data'
import { BRAND, ME_ID, type Group } from '../../domain/types'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { copyText, shareResult } from '../../lib/share'
import { whatsappUrl } from '../../share/links'
import { shareGroup, syncLocal } from './local'
import { putShared, sharedFor, useShared, type SharedGroup } from './store'
import { onGroupNews, syncNow, useSyncState } from './sync'
import { inviteLink } from './transport'
import styles from './GroupSync.module.css'

/** A QR this long is still easy to scan from another phone's screen. */
const MAX_QR_LINK = 900

/**
 * A group's place in the world, on its own page: before it's shared, the invitation to share it;
 * after, whether everyone is in step ("Live"), who has joined, and the way to invite more people
 * (or, where the server keeps no copies, to send the latest as a link).
 */
export function GroupLive({ group }: { group: Group }) {
  const t = useT()
  const toast = useToast()
  const shared = useShared(group.id)
  const state = useSyncState(group.id)
  const [inviting, setInviting] = useState(false)

  // What the others changed, said once as it arrives.
  useEffect(
    () =>
      onGroupNews((groupId, news) => {
        if (groupId !== group.id) return
        const first = news.joined[0]
        const message = first
          ? t('groupsync.news.joined', { name: first })
          : news.added > 0
            ? t('groupsync.news.expenses', { count: news.added })
            : news.payments > 0
              ? t('groupsync.news.payments', { count: news.payments })
              : t('groupsync.news.changed')
        toast(message)
      }),
    [group.id, t, toast],
  )

  const invite = (): void => {
    haptic('tap')
    if (!shared) {
      shareGroup(group.id)
      void syncNow(group.id)
    }
    setInviting(true)
  }

  if (group.archived) return null
  if (!shared) {
    return (
      <section className={styles.card} aria-label={t('groupsync.card.title')}>
        <div className={styles.cardText}>
          <h2 className={styles.cardTitle}>{t('groupsync.card.title')}</h2>
          <p className={styles.cardBody}>{t('groupsync.card.body')}</p>
        </div>
        <Button size="md" variant="accent" iconStart={<UserPlus />} onClick={invite}>
          {t('groupsync.card.cta')}
        </Button>
        <InviteSheet group={group} open={inviting} onClose={() => setInviting(false)} />
      </section>
    )
  }

  const members = Object.values(shared.seen)
  const joined = members.filter((m) => m.j > 0).length
  const kind = state?.kind ?? 'syncing'
  const links = kind === 'links'
  const label =
    kind === 'live' ? t('groupsync.status.live') : kind === 'waiting' ? t('groupsync.status.waiting') : links ? t('groupsync.status.links') : t('groupsync.status.syncing')
  return (
    <section className={styles.bar} aria-label={label}>
      <span className={cx(styles.dot, kind === 'live' && styles.dotLive, kind === 'waiting' && styles.dotWaiting)} aria-hidden="true">
        {kind === 'waiting' ? <WifiOff /> : kind === 'syncing' ? <RefreshCw /> : <Wifi />}
      </span>
      <span className={styles.barText}>
        <span className={styles.barLabel} role="status">
          {label}
        </span>
        <span className={styles.barNote}>{t('groupsync.status.joined', { joined, count: Math.max(members.length, joined) })}</span>
      </span>
      <Button size="sm" variant="tonal" iconStart={links ? <Send /> : <UserPlus />} onClick={invite}>
        {links ? t('groupsync.status.update') : t('groupsync.status.invite')}
      </Button>
      <InviteSheet group={group} open={inviting} onClose={() => setInviting(false)} />
    </section>
  )
}

/** The link for the group as it stands now, made ahead of the tap (a share sheet needs a fresh tap). */
function useInviteLink(open: boolean, shared: SharedGroup | null, stamp: string, slim: boolean): { url: string; slim: boolean } | null {
  const [made, setMade] = useState<{ stamp: string; url: string; slim: boolean } | null>(null)
  useEffect(() => {
    if (!open || !shared) return
    let live = true
    const out = syncLocal(shared.groupId, null)
    if (!out) return
    // With the server keeping the group, the link only needs to say which group (short enough for a QR).
    void inviteLink(out.wire, shared.key, window.location.origin, slim).then((link) => {
      if (live) setMade({ stamp, ...link })
    })
    return () => {
      live = false
    }
    // `shared` is re-read on each change of `stamp`; depending on it would loop (making a link saves the record).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stamp])
  return made && made.stamp === stamp ? made : null
}

export function InviteSheet({ group, open, onClose }: { group: Group; open: boolean; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const shared = useShared(group.id)
  const state = useSyncState(group.id)
  const profile = useProfile()
  const friendsById = useFriendsById()
  const expenses = useExpenses({ groupId: group.id })
  const [copied, setCopied] = useState(false)
  // The group as a link changes when the group does.
  const stamp = useMemo(() => `${group.updatedAt}:${expenses.length}:${expenses.reduce((latest, e) => Math.max(latest, e.updatedAt), 0)}:${state?.kind ?? ''}:${shared?.id ?? ''}`, [group.updatedAt, expenses, state?.kind, shared?.id])
  // Only once the server is known to have the group can the link leave the expenses to it.
  const link = useInviteLink(open, shared, stamp, state?.kind === 'live')
  const links = state?.kind === 'links'

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2200)
    return () => window.clearTimeout(timer)
  }, [copied])

  const text = (url: string): string => t(links && shared?.sent ? 'groupsync.invite.update' : 'groupsync.invite.text', { name: group.name, brand: BRAND.name, link: url })
  const sent = (): void => {
    const latest = sharedFor(group.id)
    if (latest) putShared({ ...latest, sent: { at: Date.now(), hash: stamp } })
  }
  const whatsapp = (): void => {
    if (!link) return
    const win = window.open(whatsappUrl(text(link.url)), '_blank')
    if (win) win.opener = null
    haptic('success')
    sent()
  }
  const share = async (): Promise<void> => {
    if (!link) return
    const outcome = await shareResult(text(link.url), { title: group.name })
    if (outcome === 'cancelled') return
    haptic(outcome === 'failed' ? 'error' : 'success')
    if (outcome === 'copied') toast(t('groupsync.sheet.copied'), { tone: 'success' })
    if (outcome === 'failed') toast(t('groupsync.sheet.copyFailed'), { tone: 'error' })
    else sent()
  }
  const copy = async (): Promise<void> => {
    if (!link) return
    const ok = await copyText(link.url)
    haptic(ok ? 'success' : 'error')
    if (ok) {
      setCopied(true)
      sent()
    } else toast(t('groupsync.sheet.copyFailed'), { tone: 'error' })
  }

  const people = shared
    ? Object.entries(shared.seen).map(([mid, seen]) => {
        const friendId = shared.members[mid]
        const me = mid === shared.me
        return { mid, me, name: me ? profile.name : (friendsById[friendId ?? '']?.name ?? seen.n), color: friendsById[me ? ME_ID : (friendId ?? '')]?.color ?? seen.c, joined: seen.j > 0 }
      })
    : []

  return (
    <BottomSheet open={open} onClose={onClose} title={t('groupsync.sheet.title', { name: group.name })} description={links ? t('groupsync.sheet.body.links') : t('groupsync.sheet.body.live')}>
      <div className={styles.sheet}>
        <Button block iconStart={<MessageCircle />} disabled={!link} onClick={whatsapp}>
          {t('groupsync.sheet.whatsapp')}
        </Button>
        <div className={styles.sheetRow}>
          <Button block variant="secondary" iconStart={<Send />} disabled={!link} onClick={() => void share()}>
            {t('groupsync.sheet.share')}
          </Button>
          <Button block variant="secondary" iconStart={copied ? <Check /> : <Copy />} disabled={!link} onClick={() => void copy()}>
            {copied ? t('groupsync.sheet.copied') : t('groupsync.sheet.copy')}
          </Button>
        </div>
        {link && link.url.length <= MAX_QR_LINK && (
          <div className={styles.qr}>
            <QrCode value={link.url} size={196} label={t('groupsync.sheet.qr.aria', { name: group.name })} />
            <p className={styles.qrNote}>{t('groupsync.sheet.qr')}</p>
          </div>
        )}
        {people.length > 0 && (
          <section className={styles.block} aria-label={t('groupsync.sheet.people')}>
            <h3 className={styles.blockTitle}>{t('groupsync.sheet.people')}</h3>
            <ul role="list" className={styles.roster}>
              {people.map((p) => (
                <li key={p.mid} className={styles.rosterRow}>
                  <Avatar name={p.name} color={p.color} size="sm" />
                  <span className={styles.personName}>{p.me ? `${p.name} (${t('groupsync.sheet.you')})` : p.name}</span>
                  <span className={cx(styles.personNote, p.joined && styles.joinedNote)}>{p.joined ? t('groupsync.sheet.joined') : t('groupsync.sheet.notYet')}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className={styles.fine}>{t('groupsync.sheet.private')}</p>
      </div>
    </BottomSheet>
  )
}
