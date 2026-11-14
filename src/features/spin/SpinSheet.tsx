import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Plus, RotateCw } from 'lucide-react'
import { navigate } from '../../app/router'
import { BottomSheet, Button, SegmentedControl, avatarColorIndex } from '../../components'
import { setSplitPrefill, useExpenses, useFriendsById, useGroup } from '../../data'
import { ME_ID, type Group } from '../../domain/types'
import { useT } from '../../i18n'
import { FriendAvatar, friendLabel } from '../../kit/index-a'
import { useMediaQuery } from '../../kit/media'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { formFromUsual, usualLabel } from '../usual/engine'
import { getUsualSplit } from '../usual/store'
import { groupSpinSlices, percentText, spin, wheelLabels, type SpinMode, type SpinSlice } from './engine'
import styles from './Spin.module.css'

export interface SpinSheetProps {
  group: Group
  open: boolean
  onClose: () => void
}

/** How long the wheel spins (keep in step with `.wheel`'s transition in Spin.module.css). */
export const SPIN_MS = 3200
/** Whole turns before it settles. */
const TURNS = 5
/** A banner title is at most 80 characters. */
const MAX_BANNER_NAME = 50

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function canAnimate(reduced: boolean): boolean {
  return !reduced && typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}

/** The wheel's colours: each slice in the person's avatar colour, with a hairline between slices. */
function wheelGradient(slices: readonly SpinSlice[], colorOf: (id: string) => number): string {
  if (slices.length === 1) return `var(--avatar-${colorOf(slices[0]?.id ?? '')}-bg)`
  const stops = slices.map((s) => {
    const color = `var(--avatar-${colorOf(s.id)}-bg)`
    const gap = s.end - s.start > 2 ? 0.8 : 0
    return gap > 0 ? `${color} ${s.start}deg ${s.end - gap}deg, var(--surface) ${s.end - gap}deg ${s.end}deg` : `${color} ${s.start}deg ${s.end}deg`
  })
  return `conic-gradient(${stops.join(', ')})`
}

/**
 * "Who pays?": a wheel of the group's members that picks who gets this bill. Fair by default (who
 * is behind gets a bigger slice, everyone keeps one) or pure luck; tap someone to leave them out.
 * The result is announced, then one tap opens the new bill with them paying. Null for a group of
 * one or an archived group.
 */
export function SpinSheet({ group: given, open, onClose }: SpinSheetProps) {
  const t = useT()
  const group = useGroup(given.id) ?? given
  const friendsById = useFriendsById()
  const expenses = useExpenses({ groupId: group.id })
  const reduced = useMediaQuery(REDUCED_MOTION)
  const [mode, setMode] = useState<SpinMode>('fair')
  const [leftOut, setLeftOut] = useState<ReadonlySet<string>>(() => new Set())
  const [rotation, setRotation] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'done'>('idle')
  const [winner, setWinner] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const nameOf = useMemo(() => (id: string) => friendLabel(id, friendsById[id] ?? null), [friendsById])
  const colorOf = (id: string): number => avatarColorIndex(friendsById[id]?.color ?? 0)
  const slices = useMemo(() => groupSpinSlices(group, expenses, mode, leftOut, nameOf), [group, expenses, mode, leftOut, nameOf])
  const everyone = useMemo(() => groupSpinSlices(group, expenses, mode, new Set(), nameOf), [group, expenses, mode, nameOf])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  // A fresh wheel each time the sheet opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setLeftOut(new Set())
      setPhase('idle')
      setWinner(null)
    }
  }

  if (group.archived || group.memberIds.length < 2) return null

  const money = (paise: number): string => formatMoney(paise, group.currency, { trimZeros: true })
  const anyBehind = everyone.some((s) => s.behind > 0)
  const inBehind = slices.some((s) => s.behind > 0)
  // With fewer than two in, the only thing worth saying is that two are needed.
  const explain =
    slices.length < 2
      ? null
      : mode === 'luck'
        ? t('spin.explain.luck')
        : inBehind
          ? t('spin.explain.fair', { group: group.name })
          : t('spin.explain.fair.even', { group: group.name })
  const explainAhead = slices.length >= 2 && mode === 'fair' && inBehind && slices.some((s) => s.behind === 0) ? t('spin.explain.ahead') : null
  const canSpin = slices.length >= 2 && phase !== 'spinning'

  const finish = (id: string): void => {
    timer.current = null
    setWinner(id)
    setPhase('done')
    haptic('success')
  }

  const go = (): void => {
    if (!canSpin) return
    const result = spin(slices, Math.random)
    if (!result) return
    haptic('tap')
    // Turn the wheel so the landing point ends up under the pointer at the top, always forwards.
    const target = (360 - result.angle) % 360
    const now = ((rotation % 360) + 360) % 360
    setRotation(rotation + TURNS * 360 + ((target - now + 360) % 360))
    setWinner(null)
    if (canAnimate(reduced)) {
      setPhase('spinning')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => finish(result.id), SPIN_MS)
    } else {
      finish(result.id)
    }
  }

  const toggle = (id: string): void => {
    if (phase === 'spinning') return
    const next = new Set(leftOut)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setLeftOut(next)
    setPhase('idle')
    setWinner(null)
  }

  const addBill = (id: string): void => {
    const name = nameOf(id)
    const short = name.length > MAX_BANNER_NAME ? `${name.slice(0, MAX_BANNER_NAME - 1)}…` : name
    // Split the way every new expense in this group starts: its usual split, when it has one that fits.
    const usual = getUsualSplit(group.id)
    const usualForm = usual ? formFromUsual(usual, group.memberIds) : null
    setSplitPrefill({
      groupId: group.id,
      payerId: id,
      mode: usualForm ? usualForm.mode : 'equal',
      currency: group.currency,
      participants: usualForm ? usualForm.participants : group.memberIds.map((friendId) => ({ friendId, input: null })),
      source: 'manual',
      banner: {
        icon: 'sparkles',
        title: id === ME_ID ? t('spin.banner.title.you') : t('spin.banner.title', { name: short }),
        body: usual && usualForm ? t('spin.banner.body.usual', { label: usualLabel(usual, group.memberIds) }) : t('spin.banner.body'),
      },
    })
    haptic('tap')
    onClose()
    navigate(`/app/split/new?from=spin&group=${encodeURIComponent(group.id)}`)
  }

  const labels = wheelLabels(slices, nameOf, rotation)
  const status = phase === 'spinning' ? t('spin.spinning') : phase === 'done' && winner ? (winner === ME_ID ? t('spin.result.you') : t('spin.result', { name: nameOf(winner) })) : ''
  const wheelStyle: CSSProperties = { background: wheelGradient(slices, colorOf), transform: `rotate(${rotation}deg)` }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      eyebrow={`${group.emoji} ${group.name}`}
      title={t('spin.sheet.title')}
      description={t('spin.sheet.description')}
      size="tall"
      footer={
        phase === 'done' && winner ? (
          <div className={styles.actions}>
            <Button block iconStart={<Plus />} onClick={() => addBill(winner)}>
              {winner === ME_ID ? t('spin.add.you') : t('spin.add', { name: nameOf(winner) })}
            </Button>
            <Button block variant="secondary" iconStart={<RotateCw />} onClick={go} disabled={!canSpin}>
              {t('spin.again')}
            </Button>
          </div>
        ) : (
          <Button block size="lg" iconStart={<RotateCw />} onClick={go} disabled={!canSpin}>
            {phase === 'spinning' ? t('spin.spinning') : t('spin.cta')}
          </Button>
        )
      }
    >
      <div className={styles.sheet}>
        {anyBehind && (
          <SegmentedControl
            ariaLabel={t('spin.mode.aria')}
            value={mode}
            onChange={(next) => {
              if (phase === 'spinning') return
              setMode(next)
              setPhase('idle')
              setWinner(null)
            }}
            options={[
              { value: 'fair', label: t('spin.mode.fair') },
              { value: 'luck', label: t('spin.mode.luck') },
            ]}
          />
        )}
        {explain && <p className={styles.fine}>{explain}</p>}
        {explainAhead && <p className={styles.fine}>{explainAhead}</p>}

        <div className={styles.stage}>
          <span className={styles.pointer} aria-hidden="true" />
          <div
            className={styles.wheel}
            data-animate={canAnimate(reduced) || undefined}
            style={wheelStyle}
            role="img"
            aria-label={t('spin.wheel.aria', { chances: slices.map((s) => t('spin.wheel.chance', { name: nameOf(s.id), percent: percentText(s.percent) })).join(', ') })}
          >
            {labels.map((label) => (
              <span
                key={label.id}
                className={styles.label}
                style={{ transform: `rotate(${label.angle - 90}deg)`, color: `var(--avatar-${colorOf(label.id)}-ink)` }}
                aria-hidden="true"
                data-testid="spin-label"
              >
                <span className={styles.labelText} data-flip={label.flip || undefined}>
                  {label.text}
                </span>
              </span>
            ))}
          </div>
        </div>

        <p className={styles.status} role="status" aria-live="polite">
          {status}
        </p>
        {slices.length < 2 && <p className={styles.fine}>{t('spin.few')}</p>}

        <section className={styles.block} aria-labelledby="spin-people">
          <h3 id="spin-people" className={styles.heading}>
            {t('spin.people.title')}
          </h3>
          {leftOut.size > 0 && <p className={styles.fine}>{t('spin.leftOut.note')}</p>}
          <ul className={styles.people} aria-label={t('spin.people.aria')}>
            {everyone.map((s) => {
              const out = leftOut.has(s.id)
              const slice = slices.find((x) => x.id === s.id)
              const name = nameOf(s.id)
              const percent = percentText(slice?.percent ?? 0)
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className={styles.person}
                    data-out={out || undefined}
                    data-winner={(phase === 'done' && winner === s.id) || undefined}
                    aria-pressed={!out}
                    aria-label={out ? t('spin.person.aria.out', { name }) : t('spin.person.aria', { name, percent })}
                    onClick={() => toggle(s.id)}
                    disabled={phase === 'spinning'}
                  >
                    <span className={styles.swatch} style={{ background: `var(--avatar-${colorOf(s.id)}-bg)` }} aria-hidden="true" />
                    <FriendAvatar friendId={s.id} size="sm" />
                    <span className={styles.who} aria-hidden="true">
                      <span className={styles.name}>{name}</span>
                      {mode === 'fair' && s.behind > 0 && !out && <span className={styles.sub}>{t('spin.person.behind', { amount: money(s.behind) })}</span>}
                    </span>
                    <span className={styles.chance} aria-hidden="true">
                      {out ? t('spin.person.out') : t('spin.person.chance', { percent })}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </BottomSheet>
  )
}
