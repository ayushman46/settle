import { useId, useMemo, useState } from 'react'
import { ArrowRight, Trash2 } from 'lucide-react'
import { navigate } from '../../app/router'
import { BottomSheet, Button, Card, Chip, SegmentedControl, Switch, TextField, useToast } from '../../components'
import { useGroup } from '../../data'
import type { Group } from '../../domain/types'
import { useT } from '../../i18n'
import { FriendAvatar, friendLabel, friendObjectLabel } from '../../kit/index-a'
import { haptic } from '../../lib/haptics'
import { newId } from '../../lib/ids'
import {
  addHousehold,
  addToHousehold,
  emptyUnits,
  isEqualWeights,
  MAX_HOUSEHOLD_NAME,
  removeFromHousehold,
  removeHousehold,
  renameHousehold,
  resolveUnits,
  setChild,
  setPayer,
  unitsSummary,
  unitWeights,
  type ChildRule,
  type GroupUnits,
  type Unit,
  type UnitsBasis,
} from './engine'
import { householdsPath } from './paths'
import { getGroupUnits, setGroupUnits, useGroupUnits } from './store'
import { defaultUnitName, splitLine, unitLabel, type UnitPeople } from './unitText'
import { useUnitPeople } from './useUnits'
import styles from './Units.module.css'

export interface UnitsSheetProps {
  group: Group
  open: boolean
  onClose: () => void
  /** The link to the households page at the end. Default true; that page turns it off. */
  link?: boolean
}

/** Changes the group's households from what is stored right now, and says so with an Undo. */
type Change = (update: (current: GroupUnits) => GroupUnits, message: string) => void

const RULE_TOASTS = { full: 'units.toast.rule.full', half: 'units.toast.rule.half', free: 'units.toast.rule.free' } as const

/**
 * A group's households: tap people together into a family or a couple (everyone else stays on
 * their own), name it, mark the children, choose who pays, and choose how new expenses are
 * shared: per head or per family, children in full, at half or free. Every change is saved at
 * once and can be undone. Null for a group of one.
 */
export function UnitsSheet({ group: given, open, onClose, link = true }: UnitsSheetProps) {
  const t = useT()
  const toast = useToast()
  // The live group, so people added or removed elsewhere show at once (the prop may be a snapshot).
  const group = useGroup(given.id) ?? given
  const units = useGroupUnits(group.id)
  const people = useUnitPeople()
  /** The first person tapped for a new household, until a second makes it one. */
  const [picked, setPicked] = useState<string | null>(null)
  /** Names being typed, by household: saved on blur, on Enter and when the sheet closes. */
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open) setPicked(null)
  }
  const resolved = useMemo(() => resolveUnits(group, units), [group, units])
  const newHeadingId = useId()
  if (group.memberIds.length < 2) return null

  const households = resolved.filter((unit) => unit.household)
  const loose = resolved.filter((unit) => !unit.household).map((unit) => unit.id)
  const pickedId = picked !== null && loose.includes(picked) ? picked : null
  const nameOf = (id: string): string => friendLabel(id, people.friendsById[id] ?? null)

  const change: Change = (update, message) => {
    const before = getGroupUnits(group.id)
    const next = update(before ?? emptyUnits())
    setGroupUnits(group.id, next)
    haptic('tap')
    toast(message, { action: { label: t('common.action.undo'), onAction: () => setGroupUnits(group.id, before) } })
  }

  /** Saves every name still being typed (one change, one Undo). */
  const saveNames = (only?: string): void => {
    const dirty = households.filter((unit) => (only === undefined || unit.id === only) && drafts[unit.id] !== undefined && (drafts[unit.id] ?? '').trim() !== unit.name)
    setDrafts((current) => {
      const rest = { ...current }
      for (const unit of households) if (only === undefined || unit.id === only) delete rest[unit.id]
      return rest
    })
    if (dirty.length === 0) return
    const last = (drafts[dirty[dirty.length - 1]?.id ?? ''] ?? '').trim()
    change(
      (current) => dirty.reduce((next, unit) => renameHousehold(next, unit.id, drafts[unit.id] ?? ''), current),
      last ? t('units.toast.renamed', { name: last.slice(0, MAX_HOUSEHOLD_NAME) }) : t('units.toast.unnamed'),
    )
  }

  const close = (): void => {
    saveNames()
    onClose()
  }

  const pick = (id: string): void => {
    if (pickedId === null) return setPicked(id)
    if (pickedId === id) return setPicked(null)
    const householdId = newId()
    const members = [pickedId, id]
    setPicked(null)
    const made = resolveUnits(group, addHousehold(getGroupUnits(group.id), householdId, members)).find((unit) => unit.id === householdId)
    change((current) => addHousehold(current, householdId, members), t('units.toast.made', { name: made ? unitLabel(made, people) : '' }))
  }

  const weights = units ? unitWeights(group, units) : null
  const differs = weights !== null && !isEqualWeights(weights)
  const basis = units?.basis ?? 'head'
  const rule = units?.children ?? 'full'
  const anyChild = households.some((unit) => unit.childIds.length > 0)
  const line = differs ? splitLine(unitsSummary(group.memberIds, group, units), people) : ''

  return (
    <BottomSheet
      open={open}
      onClose={close}
      eyebrow={`${group.emoji} ${group.name}`}
      title={t('units.sheet.title')}
      size="tall"
      footer={
        <Button block onClick={close}>
          {t('units.sheet.done')}
        </Button>
      }
    >
      <div className={styles.sheet}>
        <p className={styles.body}>{t('units.sheet.body')}</p>

        {households.map((unit) => (
          <HouseholdCard
            key={unit.id}
            unit={unit}
            loose={loose}
            people={people}
            name={drafts[unit.id] ?? unit.name}
            onName={(name) => setDrafts((current) => ({ ...current, [unit.id]: name }))}
            onNameDone={() => saveNames(unit.id)}
            change={change}
          />
        ))}

        {loose.length >= 2 && (
          <section className={styles.block} aria-labelledby={newHeadingId}>
            <h3 id={newHeadingId} className={styles.label}>
              {t('units.sheet.new.title')}
            </h3>
            <p className={styles.fine} role="status">
              {pickedId ? t('units.sheet.new.one', { name: nameOf(pickedId) }) : t('units.sheet.new.body')}
            </p>
            <div className={styles.chips} role="group" aria-label={t('units.sheet.new.aria')}>
              {loose.map((id) => (
                <Chip key={id} size="lg" selected={id === pickedId} onClick={() => pick(id)} leading={<FriendAvatar friendId={id} size="xs" />}>
                  <span className={styles.chipName}>{nameOf(id)}</span>
                </Chip>
              ))}
            </div>
          </section>
        )}

        {units && households.length > 0 && (
          <>
            <section className={styles.block}>
              <h3 className={styles.label}>{t('units.sheet.basis.label')}</h3>
              <SegmentedControl<UnitsBasis>
                ariaLabel={t('units.sheet.basis.label')}
                value={basis}
                options={[
                  { value: 'head', label: t('units.sheet.basis.head') },
                  { value: 'family', label: t('units.sheet.basis.family') },
                ]}
                onChange={(next) => {
                  if (next !== basis) change((current) => ({ ...current, basis: next }), t(next === 'family' ? 'units.toast.basis.family' : 'units.toast.basis.head'))
                }}
              />
              <p className={styles.fine}>{t(basis === 'family' ? 'units.sheet.basis.family.hint' : 'units.sheet.basis.head.hint')}</p>
            </section>

            {anyChild && (
              <section className={styles.block}>
                <h3 className={styles.label}>{t('units.sheet.rule.label')}</h3>
                <SegmentedControl<ChildRule>
                  ariaLabel={t('units.sheet.rule.label')}
                  value={rule}
                  options={[
                    { value: 'full', label: t('units.sheet.rule.full') },
                    { value: 'half', label: t('units.sheet.rule.half') },
                    { value: 'free', label: t('units.sheet.rule.free') },
                  ]}
                  onChange={(next) => {
                    if (next !== rule) change((current) => ({ ...current, children: next }), t(RULE_TOASTS[next]))
                  }}
                />
              </section>
            )}

            {differs && (
              <>
                {line && (
                  <p className={styles.fine} role="status">
                    {line}
                  </p>
                )}
                <Switch
                  checked={units.auto}
                  label={t('units.sheet.auto.label')}
                  description={t('units.sheet.auto.body')}
                  onChange={(auto) => change((current) => ({ ...current, auto }), t(auto ? 'units.toast.auto.on' : 'units.toast.auto.off'))}
                />
              </>
            )}

            {link && (
              <Button
                variant="ghost"
                size="md"
                iconEnd={<ArrowRight />}
                className={styles.remove}
                onClick={() => {
                  saveNames()
                  navigate(householdsPath(group.id))
                }}
              >
                {t('units.sheet.open')}
              </Button>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  )
}

interface HouseholdCardProps {
  unit: Unit
  /** People in no household: they can be tapped into this one. */
  loose: readonly string[]
  people: UnitPeople
  name: string
  onName: (name: string) => void
  onNameDone: () => void
  change: Change
}

function HouseholdCard({ unit, loose, people, name, onName, onNameDone, change }: HouseholdCardProps) {
  const t = useT()
  const membersId = useId()
  const childrenId = useId()
  const payerId = useId()
  const label = unitLabel(unit, people)
  const nameOf = (id: string): string => friendLabel(id, people.friendsById[id] ?? null)
  const objectOf = (id: string): string => friendObjectLabel(id, people.friendsById[id] ?? null)
  const adults = unit.memberIds.filter((id) => !unit.childIds.includes(id))

  const toggleMember = (id: string): void => {
    if (!unit.memberIds.includes(id)) {
      change((current) => addToHousehold(current, unit.id, id), t('units.toast.added', { person: objectOf(id), name: label }))
    } else if (unit.memberIds.length <= 2) {
      // Two people less one is nobody's household: it goes.
      change((current) => removeFromHousehold(current, id), t('units.toast.removed', { name: label }))
    } else {
      change((current) => removeFromHousehold(current, id), t('units.toast.out', { person: objectOf(id), name: label }))
    }
  }

  const chip = (id: string, selected: boolean, onClick: () => void, disabled = false) => (
    <Chip key={id} size="lg" selected={selected} disabled={disabled} onClick={onClick} leading={<FriendAvatar friendId={id} size="xs" />}>
      <span className={styles.chipName}>{nameOf(id)}</span>
    </Chip>
  )

  return (
    <Card>
      <section className={styles.household} aria-label={t('units.sheet.household.aria', { name: label })}>
        <TextField
          label={t('units.sheet.name.label')}
          value={name}
          maxLength={MAX_HOUSEHOLD_NAME}
          placeholder={defaultUnitName(unit, people)}
          enterKeyHint="done"
          autoComplete="off"
          onChange={(event) => onName(event.target.value)}
          onBlur={onNameDone}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) onNameDone()
          }}
        />

        <div className={styles.block}>
          <h3 id={membersId} className={styles.label}>
            {t('units.sheet.members')}
          </h3>
          <div className={styles.chips} role="group" aria-labelledby={membersId}>
            {unit.memberIds.map((id) => chip(id, true, () => toggleMember(id)))}
            {loose.map((id) => chip(id, false, () => toggleMember(id)))}
          </div>
          <p className={styles.fine}>{t('units.sheet.members.hint')}</p>
        </div>

        <div className={styles.block}>
          <h3 id={childrenId} className={styles.label}>
            {t('units.sheet.children')}
          </h3>
          <div className={styles.chips} role="group" aria-labelledby={childrenId}>
            {unit.memberIds.map((id) => {
              const child = unit.childIds.includes(id)
              const lastAdult = !child && adults.length <= 1
              return chip(
                id,
                child,
                () => change((current) => setChild(current, id, !child), t(child ? 'units.toast.child.off' : 'units.toast.child.on', { person: objectOf(id) })),
                lastAdult,
              )
            })}
          </div>
          <p className={styles.fine}>{t('units.sheet.children.hint')}</p>
        </div>

        {adults.length >= 2 && (
          <div className={styles.block}>
            <h3 id={payerId} className={styles.label}>
              {t('units.sheet.payer')}
            </h3>
            <div className={styles.chips} role="group" aria-labelledby={payerId}>
              {adults.map((id) =>
                chip(id, id === unit.payerId, () => {
                  if (id !== unit.payerId) change((current) => setPayer(current, unit.id, id), t('units.toast.payer', { name: label, person: nameOf(id) }))
                }),
              )}
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="md"
          iconStart={<Trash2 />}
          className={styles.remove}
          onClick={() => change((current) => removeHousehold(current, unit.id), t('units.toast.removed', { name: label }))}
        >
          {t('units.sheet.remove')}
        </Button>
      </section>
    </Card>
  )
}
