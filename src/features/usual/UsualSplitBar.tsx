/**
 * Under the split editor of a new expense in a group: the usual split it opened with ("Usual
 * split: 60 / 40 · Change"), the switch to make this one the usual, a way back to it, or a note
 * that it was made for different people. Nothing for a new expense outside a group, or an edit.
 */
import { useState } from 'react'
import { Repeat, UsersRound } from 'lucide-react'
import { Banner, Button, Card, Switch, useToast } from '../../components'
import { useFriendsById } from '../../data'
import type { Group, Participant } from '../../domain/types'
import { today } from '../../engine/dates'
import type { AmountSplitMode } from '../../engine/split'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { formFromStaleUsual, formFromUsual, matchesUsual, samePeople, usualFits, usualFromForm, usualLabel, usualParts, type UsualSplit } from './engine'
import { setUsualSplit, useUsualSplit } from './store'
import styles from './Usual.module.css'

export interface UsualSplitBarProps {
  form: { mode: AmountSplitMode; participants: readonly Participant[] }
  group: Pick<Group, 'id' | 'name' | 'memberIds'> | null
  /** A new expense (an edit never offers or applies it). */
  isNew: boolean
  onChange: (patch: { mode: AmountSplitMode; participants: Participant[] }) => void
}

export function UsualSplitBar({ form, group, isNew, onChange }: UsualSplitBarProps) {
  const t = useT()
  const toast = useToast()
  const friendsById = useFriendsById()
  const usual = useUsualSplit(group?.id)
  /** Set from this screen (what it replaced): shown as the switch, on, rather than the chip. */
  const [justSet, setJustSet] = useState<{ previous: UsualSplit | null } | null>(null)
  const [reseeded, setReseeded] = useState(false)
  /** "Set it again" for a changed group: who wasn't in the old split, and how it was cut. */
  const [newcomers, setNewcomers] = useState<{ ids: string[]; mode: UsualSplit['mode'] } | null>(null)
  /** "Stop using it" while this expense was split that way: it still is, until changed. */
  const [stopped, setStopped] = useState<UsualSplit | null>(null)

  if (!isNew || !group || group.memberIds.length < 2) return null
  const members = group.memberIds
  const nameOf = (id: string) => friendLabel(id, friendsById[id] ?? null)
  const label = (u: UsualSplit) => usualLabel(u, members)
  const matches = usual !== null && matchesUsual(form, usual)
  const fits = usual !== null && usualFits(usual, members)
  const offer = usualFromForm(form, members, today())

  // Newcomers still on the part "Set it again" gave them (0%, or one share), said out loud.
  const untouched = newcomers
    ? newcomers.ids.filter((id) => members.includes(id) && form.participants.some((p) => p.friendId === id && p.input === null))
    : []
  const newcomerNote =
    newcomers && untouched.length > 0 && form.mode === newcomers.mode ? (
      <p className={styles.fine} role="status">
        {t(newcomers.mode === 'percent' ? 'usual.stale.new.percent' : 'usual.stale.new.shares', {
          names: untouched.map(nameOf).join(', '),
          count: untouched.length,
        })}
      </p>
    ) : null
  const stoppedNote = !usual && stopped && matchesUsual(form, stopped) ? t('usual.stopped.body', { label: label(stopped) }) : null

  const stop = () => {
    if (!usual) return
    const before = usual
    setStopped(matches ? usual : null)
    setUsualSplit(group.id, null)
    setJustSet(null)
    toast(t('usual.stopped.toast', { group: group.name }), {
      action: { label: t('usual.undo'), onAction: () => setUsualSplit(group.id, before) },
    })
  }

  const parts = (u: UsualSplit) =>
    usualParts(u, members)
      .map(({ friendId, value }) =>
        u.mode === 'percent'
          ? t('usual.part.percent', { name: nameOf(friendId), value })
          : t('usual.part.shares', { name: nameOf(friendId), value: Number(value) }),
      )
      .join(' · ')

  // Opened with the usual split.
  if (usual && matches && !justSet) {
    return (
      <Card className={styles.chip}>
        <Repeat aria-hidden="true" className={styles.icon} />
        <div className={styles.text}>
          <p className={styles.title}>{t('usual.chip.title', { label: label(usual) })}</p>
          <p className={styles.fine}>{parts(usual)}</p>
        </div>
        <div className={styles.actions}>
          <Button
            size="md"
            variant="secondary"
            onClick={() => onChange({ mode: 'equal', participants: form.participants.map((p) => ({ friendId: p.friendId, input: null })) })}
          >
            {t('usual.chip.change')}
          </Button>
          <Button size="md" variant="ghost" onClick={stop}>
            {t('usual.stop')}
          </Button>
        </div>
      </Card>
    )
  }

  // Made for people who aren't the group any more.
  const stale = usual !== null && !fits && !reseeded && !justSet
  if (stale && usual) {
    return (
      <Banner
        tone="info"
        icon={<UsersRound />}
        title={t('usual.stale.title')}
        actions={
          <div className={styles.actions}>
            <Button
              size="md"
              variant="secondary"
              onClick={() => {
                setReseeded(true)
                setNewcomers({ ids: members.filter((id) => !Object.hasOwn(usual.inputs, id)), mode: usual.mode })
                onChange(formFromStaleUsual(usual, members))
              }}
            >
              {t('usual.stale.again')}
            </Button>
            <Button size="md" variant="ghost" onClick={stop}>
              {t('usual.stop')}
            </Button>
          </div>
        }
      >
        {t('usual.stale.body', { label: label(usual) })}
      </Banner>
    )
  }

  // This split could be the usual one.
  if (offer && (justSet || !matches)) {
    const on = justSet !== null && matches
    const replacing = usual !== null && fits && !matches && !justSet
    return (
      <>
        <Switch
          className={styles.offer}
          checked={on}
          label={t('usual.offer.label', { group: group.name })}
          description={replacing && usual ? t('usual.offer.replace', { label: label(usual) }) : (stoppedNote ?? t('usual.offer.body'))}
          onChange={(next) => {
            if (next) {
              setJustSet({ previous: justSet ? justSet.previous : usual })
              setUsualSplit(group.id, offer)
            } else {
              setUsualSplit(group.id, justSet?.previous ?? null)
              setJustSet(null)
            }
          }}
        />
        {newcomerNote}
      </>
    )
  }

  // Split some other way this time: the usual one is a tap away.
  if (usual && fits && !matches && samePeople(form.participants.map((p) => p.friendId), members)) {
    const back = formFromUsual(usual, members)
    if (!back) return null
    return (
      <Button
        size="md"
        variant="ghost"
        iconStart={<Repeat />}
        className={styles.use}
        onClick={() => {
          const order = form.participants.map((p) => p.friendId)
          const sameOrder = order.length === back.participants.length ? order : members
          onChange({ mode: back.mode, participants: sameOrder.map((id) => back.participants.find((p) => p.friendId === id) ?? { friendId: id, input: null }) })
        }}
      >
        {t('usual.use', { label: label(usual) })}
      </Button>
    )
  }

  return newcomerNote
}
