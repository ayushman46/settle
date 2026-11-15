import { useMemo, useState } from 'react'
import { Plus, Send, Trash2 } from 'lucide-react'
import { goBack, navigate, useSearchParams } from '../../app/router'
import { AmountInput, Banner, Button, Card, Chip, IconButton, Money, PageTitle, Screen, SegmentedControl, Stepper, TextField, TopBar, useToast } from '../../components'
import { useFriendsById, useGroup, useProfile } from '../../data'
import { ME_ID, type Group } from '../../domain/types'
import { useT } from '../../i18n'
import { FriendAvatar, friendLabel } from '../../kit/index-a'
import { PeoplePicker } from '../../kit/PeoplePicker'
import { commaIsDecimal, formatMoney, parseMoneyInput, toInputString } from '../../lib/money'
import { shareResult } from '../../lib/share'
import { personFallback } from '../../share/fallbacks'
import { outsideName } from '../../share/names'
import { RENT_ENABLED, RENT_PATH } from '../rent/enabled'
import { rentStore, useRents } from '../rent/store'
import {
  COMMON_MAX,
  COMMON_MIN,
  COMMON_STEP,
  FACTOR_MAX,
  FACTOR_STEP,
  MAX_PEOPLE,
  MAX_ROOMS,
  MAX_SQFT,
  ROOM_SIZES,
  TWEAK_MAX,
  TWEAK_STEP,
  fairRent,
  unplaced,
  type Factors,
  type Room,
} from './engine'
import { applyToRent, matchingRent, rentHasShares } from './rentBridge'
import { SOLO_KEY, newRoom, planFor, putPlan, removePlan, seedPlan, useFairPlan, type SavedPlan } from './store'
import { equalLine, joined, reasonLine, splitMessage } from './text'
import styles from './FairRent.module.css'

/**
 * `/app/fair-rent` (optional `?group=`): a flat's rent split by what each room is. The rent, who
 * lives there and a room each are filled in already; every change is kept as it is made, and the
 * answer is always on the page: each person's rent, why, and what an equal split would be.
 */
export function FairRentScreen() {
  const group = useGroup(useSearchParams().get('group'))
  const key = group ? group.id : SOLO_KEY
  return <Editor key={key} planKey={key} group={group} />
}

const upperFirst = (text: string): string => text.charAt(0).toLocaleUpperCase() + text.slice(1)
const EXTRAS = ['bath', 'balcony', 'ac'] as const

function Editor({ planKey, group }: { planKey: string; group: Group | null }) {
  const t = useT()
  const toast = useToast()
  const profile = useProfile()
  const friendsById = useFriendsById()
  const rents = useRents()
  const saved = useFairPlan(planKey)
  // What the page starts from when nothing is saved: the flatmates, a medium room each, and the rent from the app's own rent set-up when there is one.
  const [seed] = useState(() => {
    const people = group ? group.memberIds : [ME_ID]
    const currency = group?.currency ?? profile.currency
    const setup = currency === 'INR' ? matchingRent(rentStore.get(), people) : null
    return { plan: seedPlan(planKey, people, currency, setup?.monthly ?? 0), from: setup?.name ?? null }
  })
  const plan = saved ?? seed.plan
  const currency = plan.currency
  const textOf = (rent: number): string => toInputString(rent > 0 ? rent : null, currency, { trimZeros: true })
  const [rentText, setRentText] = useState(() => textOf(plan.rent))
  const [picking, setPicking] = useState(false)
  const [tuning, setTuning] = useState(false)

  const money = (value: number): string => formatMoney(value, currency, { trimZeros: true })
  const nameOf = (id: string): string => friendLabel(id, friendsById[id] ?? null)
  const sayName = (id: string): string => outsideName(id, friendsById, profile, personFallback(plan.people.indexOf(id) + 1))

  const result = useMemo(
    () => fairRent(plan, (id) => (id === ME_ID ? profile.name : (friendsById[id]?.name ?? ''))),
    [plan, friendsById, profile.name],
  )
  const loose = unplaced(plan.people, plan.rooms)

  const update = (patch: Partial<SavedPlan>): void => putPlan({ ...plan, ...patch, updatedAt: Date.now() })
  const updateRoom = (roomId: string, patch: Partial<Room>): void => update({ rooms: plan.rooms.map((r) => (r.id === roomId ? { ...r, ...patch } : r)) })

  const setRent = (text: string): void => {
    setRentText(text)
    const parsed = parseMoneyInput(text, currency)
    update({ rent: parsed !== null && parsed > 0 ? parsed : 0 })
  }

  /** Puts the person in this room (and so out of any other), or takes them out of it. */
  const togglePerson = (roomId: string, friendId: string): void =>
    update({
      rooms: plan.rooms.map((r) => {
        const without = r.people.filter((p) => p !== friendId)
        return r.id === roomId && !r.people.includes(friendId) ? { ...r, people: [...without, friendId] } : { ...r, people: without }
      }),
    })

  /** Someone new gets a medium room of their own, so the answer is there before anything is tapped. */
  const setPeople = (ids: string[]): void => {
    const people = ids.slice(0, MAX_PEOPLE)
    const added = people.filter((p) => !plan.people.includes(p))
    const rooms = [...plan.rooms]
    for (const p of added) if (rooms.length < MAX_ROOMS) rooms.push(newRoom([p]))
    update({ people, rooms })
  }

  const removeRoom = (room: Room, index: number): void => {
    update({ rooms: plan.rooms.filter((r) => r.id !== room.id) })
    toast(t('fairrent.toast.roomRemoved', { n: index + 1 }), {
      action: {
        label: t('common.action.undo'),
        onAction: () => {
          const now = planFor(planKey)
          if (!now || now.rooms.some((r) => r.id === room.id)) return
          // Back in its old place; anyone moved to another room since stays where they were put.
          const rooms = now.rooms.map((r) => ({ ...r, people: r.people.filter((p) => !room.people.includes(p)) }))
          rooms.splice(Math.min(index, rooms.length), 0, room)
          putPlan({ ...now, rooms, updatedAt: Date.now() })
        },
      },
    })
  }

  const reset = (): void => {
    const removed = removePlan(planKey)
    if (!removed) return
    setRentText(textOf(seed.plan.rent))
    toast(t('fairrent.reset.done'), {
      action: {
        label: t('common.action.undo'),
        onAction: () => {
          putPlan(removed)
          setRentText(textOf(removed.rent))
        },
      },
    })
  }

  const amounts = Object.fromEntries(result.people.map((p) => [p.friendId, p.amount]))
  const ready = result.total > 0 && result.people.length > 0
  const setup = ready && loose.length === 0 && currency === 'INR' ? matchingRent(rents, result.people.map((p) => p.friendId)) : null

  const putIntoRent = (): void => {
    if (!setup) return
    const undo = applyToRent(setup.id, amounts, result.total)
    if (!undo) {
      toast(t('fairrent.use.failed', { name: setup.name }), { tone: 'error' })
      return
    }
    toast(t('fairrent.use.done', { name: setup.name }), { tone: 'success', action: { label: t('common.action.undo'), onAction: undo } })
  }

  const share = async (): Promise<void> => {
    const text = splitMessage(plan, result, sayName)
    if (!text) return
    const outcome = await shareResult(text, { title: t('fairrent.share.title') })
    if (outcome === 'copied') toast(t('fairrent.share.copied'), { tone: 'success' })
    else if (outcome === 'failed') toast(t('fairrent.share.failed'), { tone: 'error' })
  }

  const pct = (n: number) => t('fairrent.method.pct', { n })
  const tweakLabel = (n: number) => (n === 0 ? t('fairrent.tweak.same') : n > 0 ? t('fairrent.tweak.up', { n }) : t('fairrent.tweak.down', { n: -n }))
  const setFactor = (which: keyof Factors, value: number): void => update({ factors: { ...plan.factors, [which]: value } })

  return (
    <Screen header={<TopBar onBack={() => goBack('/app')} />} contentClassName={styles.content}>
      <PageTitle title={t('fairrent.title')} subtitle={group ? t('fairrent.subtitle.group', { group: group.name }) : t('fairrent.subtitle')} />

      <AmountInput
        size="field"
        label={t('fairrent.rent.label')}
        value={rentText}
        onChange={setRent}
        currency={currency}
        commaGroups={!commaIsDecimal(currency)}
        hint={!saved && seed.from && plan.rent > 0 ? t('fairrent.rent.fromSetup', { name: seed.from }) : undefined}
      />

      <section className={styles.block} aria-labelledby="fairrent-people">
        <div className={styles.headRow}>
          <div className={styles.headText}>
            <h2 id="fairrent-people" className={styles.heading}>
              {t('fairrent.people.heading')}
            </h2>
            <p className={styles.body}>{plan.people.length > 0 ? joined(plan.people.map(nameOf)) : t('fairrent.people.none')}</p>
          </div>
          <Button variant="ghost" size="md" aria-expanded={picking} onClick={() => setPicking((open) => !open)}>
            {picking ? t('fairrent.people.done') : t('fairrent.people.change')}
          </Button>
        </div>
        {picking && (
          <PeoplePicker selectedIds={plan.people} onChange={setPeople} max={MAX_PEOPLE} groupMemberIds={group?.memberIds} label={t('fairrent.people.search')} />
        )}
      </section>

      <section className={styles.block} aria-labelledby="fairrent-rooms">
        <h2 id="fairrent-rooms" className={styles.heading}>
          {t('fairrent.rooms.heading')}
        </h2>
        <p className={styles.fine}>{t('fairrent.rooms.fine')}</p>
        <div className={styles.rooms}>
          {plan.rooms.map((room, index) => {
            const n = index + 1
            return (
              <Card key={room.id} className={styles.room}>
                <div className={styles.headRow}>
                  <h3 className={styles.roomName}>{t('fairrent.room.name', { n })}</h3>
                  {plan.rooms.length > 1 && (
                    <IconButton label={t('fairrent.room.remove.aria', { n })} onClick={() => removeRoom(room, index)}>
                      <Trash2 />
                    </IconButton>
                  )}
                </div>
                <SegmentedControl
                  ariaLabel={t('fairrent.room.size.aria', { n })}
                  value={room.size}
                  onChange={(size) => updateRoom(room.id, { size })}
                  options={ROOM_SIZES.map((size) => ({ value: size, label: t(`fairrent.size.${size}`) }))}
                />
                <TextField
                  label={t('fairrent.room.sqft')}
                  aria-label={t('fairrent.room.sqft.aria', { n })}
                  placeholder={t('fairrent.room.sqft.placeholder')}
                  inputMode="numeric"
                  autoComplete="off"
                  value={room.sqft === null ? '' : String(room.sqft)}
                  onChange={(e) => {
                    const typed = Number(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                    updateRoom(room.id, { sqft: typed > 0 ? Math.min(MAX_SQFT, typed) : null })
                  }}
                />
                <div className={styles.group}>
                  <span className={styles.label}>{t('fairrent.room.has')}</span>
                  <div className={styles.chips}>
                    {EXTRAS.map((extra) => (
                      <Chip
                        key={extra}
                        size="lg"
                        selected={room[extra]}
                        aria-label={t('fairrent.extra.aria', { n, extra: t(`fairrent.extra.${extra}`) })}
                        onClick={() => updateRoom(room.id, { [extra]: !room[extra] })}
                      >
                        {t(`fairrent.extra.${extra}`)}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div className={styles.fieldRow}>
                  <span className={styles.label}>{t('fairrent.room.tweak')}</span>
                  <Stepper
                    size="sm"
                    label={t('fairrent.room.tweak.aria', { n })}
                    value={room.tweak}
                    min={-TWEAK_MAX}
                    max={TWEAK_MAX}
                    step={TWEAK_STEP}
                    formatValue={tweakLabel}
                    onChange={(tweak) => updateRoom(room.id, { tweak })}
                  />
                </div>
                <div className={styles.group}>
                  <span className={styles.label}>{t('fairrent.room.who')}</span>
                  <div className={styles.chips}>
                    {plan.people.map((id) => (
                      <Chip
                        key={id}
                        size="lg"
                        selected={room.people.includes(id)}
                        aria-label={t('fairrent.room.who.aria', { name: nameOf(id), n })}
                        onClick={() => togglePerson(room.id, id)}
                      >
                        {nameOf(id)}
                      </Chip>
                    ))}
                  </div>
                  {room.people.length === 0 && <p className={styles.fine}>{t('fairrent.room.empty')}</p>}
                </div>
              </Card>
            )
          })}
        </div>
        {plan.rooms.length < MAX_ROOMS && (
          <Button variant="secondary" iconStart={<Plus />} onClick={() => update({ rooms: [...plan.rooms, newRoom()] })}>
            {t('fairrent.room.add')}
          </Button>
        )}
      </section>

      <section className={styles.block} aria-labelledby="fairrent-method">
        <h2 id="fairrent-method" className={styles.heading}>
          {t('fairrent.method.heading')}
        </h2>
        <Card className={styles.method}>
          <div className={styles.fieldRow}>
            <span className={styles.label}>{t('fairrent.method.common')}</span>
            <output className={styles.pct}>{pct(plan.commonPct)}</output>
          </div>
          <input
            type="range"
            className={styles.range}
            min={COMMON_MIN}
            max={COMMON_MAX}
            step={COMMON_STEP}
            value={plan.commonPct}
            aria-label={t('fairrent.method.common.aria')}
            aria-valuetext={pct(plan.commonPct)}
            onChange={(e) => update({ commonPct: Number(e.target.value) })}
          />
          <p className={styles.fine}>
            {t('fairrent.method.body', {
              common: plan.rent > 0 ? `${pct(plan.commonPct)} (${money(result.commonPool)})` : pct(plan.commonPct),
              rooms: plan.rent > 0 ? `${pct(100 - plan.commonPct)} (${money(result.roomPool)})` : pct(100 - plan.commonPct),
              count: Math.max(1, result.people.length),
              bath: plan.factors.bath,
              balcony: plan.factors.balcony,
              ac: plan.factors.ac,
            })}
          </p>
          {tuning &&
            EXTRAS.map((extra) => (
              <div key={extra} className={styles.fieldRow}>
                <span className={styles.label}>{t(`fairrent.factor.${extra}`)}</span>
                <Stepper
                  size="sm"
                  label={t(`fairrent.factor.${extra}`)}
                  value={plan.factors[extra]}
                  min={0}
                  max={FACTOR_MAX}
                  step={FACTOR_STEP}
                  formatValue={pct}
                  onChange={(value) => setFactor(extra, value)}
                />
              </div>
            ))}
          <Button variant="ghost" aria-expanded={tuning} onClick={() => setTuning((open) => !open)}>
            {tuning ? t('fairrent.method.hide') : t('fairrent.method.change')}
          </Button>
        </Card>
      </section>

      <section className={styles.block} aria-labelledby="fairrent-result">
        <h2 id="fairrent-result" className={styles.heading}>
          {t('fairrent.result.heading')}
        </h2>
        {loose.length > 0 && result.people.length > 0 && (
          <Banner tone="warning">{t('fairrent.result.unplaced', { names: joined(loose.map(nameOf)), count: loose.length })}</Banner>
        )}
        {!ready ? (
          <p className={styles.body} role="status">
            {result.people.length === 0 ? t('fairrent.result.needPeople') : t('fairrent.result.needRent')}
          </p>
        ) : (
          <Card padding="none">
            <ul className={styles.list} aria-labelledby="fairrent-result">
              {result.people.map((person) => (
                <li key={person.friendId} className={styles.person}>
                  <FriendAvatar friendId={person.friendId} size="sm" />
                  <span className={styles.personText}>
                    <span className={styles.personName}>{nameOf(person.friendId)}</span>
                    <span className={styles.fine}>{upperFirst(reasonLine(person, nameOf))}</span>
                    <span className={styles.fine}>{equalLine(person, currency)}</span>
                  </span>
                  <Money value={person.amount} currency={currency} trimZeros strong />
                </li>
              ))}
            </ul>
            <p className={styles.total} role="status">
              {t('fairrent.result.total', { amount: money(result.total) })}
            </p>
          </Card>
        )}
      </section>

      {ready && (
        <section className={styles.block}>
          {setup && !rentHasShares(setup, amounts, result.total) && <p className={styles.fine}>{t('fairrent.use.fine', { name: setup.name })}</p>}
          {setup && rentHasShares(setup, amounts, result.total) && <p className={styles.fine}>{t('fairrent.use.already', { name: setup.name })}</p>}
          {!setup && RENT_ENABLED && currency === 'INR' && loose.length === 0 && <p className={styles.fine}>{t('fairrent.use.none')}</p>}
          <div className={styles.actions}>
            {setup && !rentHasShares(setup, amounts, result.total) && <Button onClick={putIntoRent}>{t('fairrent.use.cta', { name: setup.name })}</Button>}
            <Button variant={setup && !rentHasShares(setup, amounts, result.total) ? 'secondary' : 'primary'} iconStart={<Send />} onClick={() => void share()}>
              {t('fairrent.share.cta')}
            </Button>
            {!setup && RENT_ENABLED && currency === 'INR' && loose.length === 0 && (
              <Button variant="ghost" onClick={() => navigate(RENT_PATH)}>
                {t('fairrent.use.setup')}
              </Button>
            )}
          </div>
        </section>
      )}

      {saved && (
        <Button variant="ghost" onClick={reset}>
          {t('fairrent.reset.cta')}
        </Button>
      )}
    </Screen>
  )
}
