import { useEffect, useId, useState, type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { navigate, useLocation } from '../../app/router'
import { Avatar, Button, Chip, Skeleton, TextField } from '../../components'
import { completeOnboarding, updateProfile, useProfile } from '../../data'
import { BRAND } from '../../domain/types'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { nameKey, normalizeName } from '../../lib/people'
import { isValidUpiId, normalizeUpiId } from '../../lib/upi'
import { usePageMeta } from '../landing/pageMeta'
import { PublicProblem, PublicShell } from '../pay/PublicShell'
import { joinGroup, syncLocal } from './local'
import { sharedById } from './store'
import { syncNow } from './sync'
import { pull, readInvite, type Invite } from './transport'
import { mergeWire, type WireGroup } from './wire'
import styles from './GroupSync.module.css'

type Link = { status: 'loading' } | { status: 'invalid' } | { status: 'ok'; invite: Invite }

const OTHER = '+'
const groupPath = (id: string): string => `/app/groups/${id}`

/**
 * `/join#…` — what a friend sees when they open a group's invite: the group, "Which one is you?",
 * their name and (if they like) UPI ID, and Join. The group then lives on their phone and stays in
 * step with everyone else's. Opened on a phone that already has the group, the link just brings it
 * up to date and opens it.
 */
export function JoinPage() {
  const t = useT()
  const { hash } = useLocation()
  const [link, setLink] = useState<Link>({ status: 'loading' })

  useEffect(() => {
    let live = true
    void (async () => {
      const invite = await readInvite(hash)
      if (!live) return
      if (!invite) {
        setLink({ status: 'invalid' })
        return
      }
      // Already on this phone: bring it up to date and open it.
      const mine = sharedById(invite.wire.id)
      if (mine) {
        syncLocal(mine.groupId, invite.wire)
        void syncNow(mine.groupId)
        navigate(groupPath(mine.groupId), { replace: true })
        return
      }
      // A link that carries only the people: the rest is in the group's room.
      let wire: WireGroup = invite.wire
      if (invite.slim) {
        const pulled = await pull(invite.key, null)
        if (pulled.kind === 'copy' && pulled.wire.id === wire.id) wire = mergeWire(wire, pulled.wire)
      }
      if (live) setLink({ status: 'ok', invite: { ...invite, wire } })
    })()
    return () => {
      live = false
    }
  }, [hash])

  usePageMeta({
    title: link.status === 'ok' ? t('groupsync.join.meta', { name: link.invite.wire.n, brand: BRAND.name }) : t('groupsync.join.meta.empty', { brand: BRAND.name }),
    description: t('groupsync.card.body'),
    robots: 'noindex',
  })

  return (
    <PublicShell pitch={false}>
      {link.status === 'loading' && (
        <div className={styles.loading}>
          <p role="status" className="visually-hidden">
            {t('groupsync.join.loading')}
          </p>
          <Skeleton shape="md" width={64} height={64} />
          <Skeleton width="60%" height={28} />
          <Skeleton width="40%" height={14} />
        </div>
      )}
      {link.status === 'invalid' && <PublicProblem title={t('groupsync.join.problem.title')} text={t('groupsync.join.problem.body')} />}
      {link.status === 'ok' && <JoinForm invite={link.invite} />}
    </PublicShell>
  )
}

function JoinForm({ invite }: { invite: Invite }) {
  const t = useT()
  const profile = useProfile()
  const formId = useId()
  const { wire, key } = invite
  const known = profile.onboarded && nameKey(profile.name) !== '' && nameKey(profile.name) !== 'you'
  // Someone whose name is already on the list is most likely that person.
  const likely = known ? (wire.m.find((m) => m.j === 0 && nameKey(m.n) === nameKey(profile.name))?.i ?? null) : null
  const [pick, setPick] = useState<string | null>(likely)
  const [name, setName] = useState(known ? profile.name : '')
  const [upi, setUpi] = useState(profile.upiId ?? '')
  const [checked, setChecked] = useState(false)

  const picked = wire.m.find((m) => m.i === pick) ?? null
  // A new phone takes the name it picked; one that has a name keeps it.
  const finalName = normalizeName(name) || (picked ? picked.n : '')
  const upiOk = upi.trim() === '' || isValidUpiId(upi)
  const problem = pick === null ? t('groupsync.join.pick.error') : finalName === '' ? t('groupsync.join.name.error') : null

  const choose = (id: string): void => {
    haptic('tap')
    setPick(id)
    const member = wire.m.find((m) => m.i === id)
    if (!known && member) setName(member.n)
    if (!known && id === OTHER) setName('')
  }

  const join = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    setChecked(true)
    if (problem !== null || !upiOk) {
      haptic('warning')
      return
    }
    const upiId = upi.trim() === '' ? null : normalizeUpiId(upi)
    if (!profile.onboarded) completeOnboarding({ name: finalName, upiId })
    else updateProfile({ ...(known ? {} : { name: finalName }), ...(upiId && upiId !== profile.upiId ? { upiId } : {}) })
    const groupId = joinGroup(wire, key, pick === OTHER ? null : pick)
    haptic('success')
    void syncNow(groupId)
    navigate(`${groupPath(groupId)}?joined=1`, { replace: true })
  }

  return (
    <form id={formId} className={styles.join} noValidate onSubmit={join}>
      <header className={styles.joinHead}>
        <span className={styles.joinEmoji} aria-hidden="true">
          {wire.e}
        </span>
        <p className={styles.eyebrow}>{t('groupsync.join.eyebrow')}</p>
        <h1 className={styles.joinTitle}>{wire.n}</h1>
        <p className={styles.joinSummary}>{t('groupsync.join.summary', { people: wire.m.length, expenses: wire.x.length })}</p>
      </header>

      <section className={styles.block} aria-labelledby={`${formId}-who`}>
        <h2 id={`${formId}-who`} className={styles.blockTitle}>
          {t('groupsync.join.who')}
        </h2>
        <div role="radiogroup" aria-labelledby={`${formId}-who`} className={styles.people}>
          {wire.m.map((member) => (
            <button key={member.i} type="button" role="radio" aria-checked={pick === member.i} className={styles.person} data-selected={pick === member.i || undefined} onClick={() => choose(member.i)}>
              <Avatar name={member.n} color={member.c} size="md" />
              <span className={styles.personName}>{member.n}</span>
              {member.j > 0 && <span className={styles.personNote}>{t('groupsync.join.who.joined')}</span>}
            </button>
          ))}
        </div>
        <Chip role="radio" selected={pick === OTHER} onClick={() => choose(OTHER)}>
          {t('groupsync.join.other')}
        </Chip>
        {checked && pick === null && (
          <p className={styles.error} role="alert">
            {t('groupsync.join.pick.error')}
          </p>
        )}
      </section>

      {pick !== null && (
        <section className={styles.block}>
          {!known && (
            <TextField
              label={t('groupsync.join.name.label')}
              autoComplete="given-name"
              autoCapitalize="words"
              value={name}
              error={checked && finalName === '' ? t('groupsync.join.name.error') : undefined}
              onChange={(event) => setName(event.currentTarget.value)}
            />
          )}
          <TextField
            label={t('groupsync.join.upi.label')}
            hint={t('groupsync.join.upi.hint')}
            placeholder="name@bank"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={upi}
            error={checked && !upiOk ? t('groupsync.join.upi.error') : undefined}
            onChange={(event) => setUpi(event.currentTarget.value)}
          />
        </section>
      )}

      <Button block type="submit">
        {t('groupsync.join.cta', { name: wire.n })}
      </Button>
      <p className={styles.privacy}>
        <ShieldCheck aria-hidden="true" />
        <span>{t('groupsync.join.privacy')}</span>
      </p>
    </form>
  )
}
