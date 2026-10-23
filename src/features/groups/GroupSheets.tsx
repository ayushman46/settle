import { useId, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Globe } from 'lucide-react'
import { BottomSheet, Button, Chip, describePeople, EmojiPicker, TextField, useToast } from '../../components'
import { createGroup, MAX_GROUP_NAME_LENGTH, updateGroup, useFriendsById, useProfile } from '../../data'
import { ME_ID, type Group, type GroupKind } from '../../domain/types'
import { friendLabel, PeoplePicker } from '../../kit/index-a'
import { currencyName } from '../../lib/currencies'
import { haptic } from '../../lib/haptics'
import { currencySymbol } from '../../lib/money'
import { useT } from '../../i18n'
import { CurrencySheet } from '../bill/CurrencySheet'
import { TRIP_ENABLED } from '../trip/enabled'
import { proseName } from '../trip/fxView'
import { TravelCurrencySheet } from '../trip/TravelCurrencySheet'
import { GroupEmoji } from './GroupEmoji'
import { GROUP_KIND_ORDER, kindMeta } from './groupView'
import styles from './GroupSheets.module.css'

interface Draft {
  name: string
  emoji: string
  /** Picked by hand — stop following the kind's default. */
  emojiPicked: boolean
  kind: GroupKind
  currency: string
  /** Everyone but you (you're always in). */
  memberIds: string[]
  /** "Spending in" (trip currency); null = the group's own currency. */
  travelCurrency: string | null
}

function others(ids: readonly string[]): string[] {
  return ids.filter((id) => id !== ME_ID)
}

/* ------------------------------------------------------------------ fields */

function NameAndEmoji({
  draft,
  onChange,
  onSubmit,
  autoFocus,
}: {
  draft: Draft
  onChange: (patch: Partial<Draft>) => void
  /** Enter in the name field (forms with several fields don't submit on Enter by themselves). */
  onSubmit: () => void
  autoFocus: boolean
}) {
  const [picking, setPicking] = useState(false)
  const pickerId = useId()
  const tileRef = useRef<HTMLButtonElement>(null)
  return (
    <div className={styles.identity}>
      <div className={styles.nameRow}>
        <button
          ref={tileRef}
          type="button"
          className={styles.emojiButton}
          aria-label={`Group icon: ${draft.emoji}. Change`}
          aria-expanded={picking}
          aria-controls={pickerId}
          onClick={() => {
            haptic('tap')
            setPicking((v) => !v)
          }}
        >
          <GroupEmoji emoji={draft.emoji} kind={draft.kind} size="md" />
          <span className={styles.emojiEdit} aria-hidden="true">
            <ChevronRight strokeWidth={2.75} />
          </span>
        </button>
        <TextField
          label="Group name"
          containerClassName={styles.nameField}
          value={draft.name}
          placeholder={kindMeta(draft.kind).placeholder}
          maxLength={MAX_GROUP_NAME_LENGTH}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
          onChange={(event) => onChange({ name: event.currentTarget.value })}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
            event.preventDefault()
            onSubmit()
          }}
        />
      </div>
      {picking && (
        <div id={pickerId} className={styles.picker}>
          <EmojiPicker
            label="Group icon"
            value={draft.emoji}
            onChange={(emoji) => {
              onChange({ emoji, emojiPicked: true })
              setPicking(false)
              tileRef.current?.focus()
            }}
          />
        </div>
      )}
    </div>
  )
}

function KindChips({ draft, onChange }: { draft: Draft; onChange: (patch: Partial<Draft>) => void }) {
  const labelId = useId()
  return (
    <section className={styles.field} aria-labelledby={labelId}>
      <p id={labelId} className={styles.overline}>
        What kind of group?
      </p>
      <div className={styles.kinds} role="group" aria-labelledby={labelId}>
        {GROUP_KIND_ORDER.map((kind) => {
          const meta = kindMeta(kind)
          return (
            <Chip
              key={kind}
              selected={draft.kind === kind}
              leading={<span className={styles.kindEmoji}>{meta.emoji}</span>}
              onClick={() => onChange(draft.emojiPicked ? { kind } : { kind, emoji: meta.emoji })}
            >
              {meta.label}
            </Chip>
          )
        })}
      </div>
    </section>
  )
}

function CurrencyRow({ currency, onPick, note }: { currency: string; onPick: () => void; note?: ReactNode }) {
  return (
    <div className={styles.field}>
      <button type="button" className={styles.currency} onClick={onPick} aria-label={`Currency: ${currencyName(currency)}. Change`}>
        <span className={styles.currencySymbol} aria-hidden="true">
          {currencySymbol(currency).length <= 3 ? currencySymbol(currency) : currency.slice(0, 1)}
        </span>
        <span className={styles.currencyText}>
          <span className={styles.currencyLabel}>Currency</span>
          <span className={styles.currencyName}>
            {currencyName(currency)} · {currency}
          </span>
        </span>
        <ChevronRight aria-hidden="true" className={styles.chevron} strokeWidth={2.25} />
      </button>
      {note != null && <p className={styles.note}>{note}</p>}
    </div>
  )
}

/** The trip currency, or null when it's the group's own (picking the group's currency turns it off). */
function travelOf(draft: Pick<Draft, 'currency' | 'travelCurrency'>): string | null {
  return draft.travelCurrency !== null && draft.travelCurrency !== draft.currency ? draft.travelCurrency : null
}

/** "Spending in · Thai baht · THB": the currency a trip pays in, converted into the group's. */
function SpendingRow({ draft, onPick }: { draft: Draft; onPick: () => void }) {
  const t = useT()
  const travel = travelOf(draft)
  const symbol = currencySymbol(draft.currency)
  const value = travel ? `${proseName(travel)} · ${travel}` : t('trip.group.same', { symbol })
  return (
    <div className={styles.field}>
      <button type="button" className={styles.currency} onClick={onPick} aria-label={t('trip.group.rowLabel', { value })}>
        <span className={styles.currencySymbol} aria-hidden="true">
          <Globe className={styles.globe} strokeWidth={2.25} />
        </span>
        <span className={styles.currencyText}>
          <span className={styles.currencyLabel}>{t('trip.group.label')}</span>
          <span className={styles.currencyName}>{value}</span>
        </span>
        <ChevronRight aria-hidden="true" className={styles.chevron} strokeWidth={2.25} />
      </button>
      <p className={styles.note}>{t('trip.group.note', { symbol })}</p>
    </div>
  )
}

/** Opens "Spending in" over a sheet and applies the pick. */
function useTravelPicker(draft: Draft, onPick: (code: string | null) => void) {
  const [open, setOpen] = useState(false)
  const sheet = TRIP_ENABLED ? (
    <TravelCurrencySheet
      open={open}
      groupCurrency={draft.currency}
      value={travelOf(draft)}
      onClose={() => setOpen(false)}
      onSelect={(code) => {
        onPick(code)
        setOpen(false)
      }}
    />
  ) : null
  return { openPicker: () => setOpen(true), sheet }
}

function Members({ draft, onChange }: { draft: Draft; onChange: (patch: Partial<Draft>) => void }) {
  const labelId = useId()
  return (
    <section className={styles.field} aria-labelledby={labelId}>
      <p id={labelId} className={styles.overline}>
        Who’s in?
      </p>
      <p className={styles.note}>You’re in already. Add friends now or any time later — they don’t need the app.</p>
      <PeoplePicker selectedIds={draft.memberIds} onChange={(memberIds) => onChange({ memberIds })} includeMe={false} label="Add people to the group" />
    </section>
  )
}

/** Opens the shared currency picker over a sheet and applies the pick; `description` says what picking does here. */
function useCurrencyPicker(currency: string, description: string, onPick: (code: string) => void) {
  const [open, setOpen] = useState(false)
  const sheet = (
    <CurrencySheet
      open={open}
      currency={currency}
      title="Group currency"
      description={description}
      onClose={() => setOpen(false)}
      onSelect={(code) => {
        onPick(code)
        setOpen(false)
      }}
    />
  )
  return { openPicker: () => setOpen(true), sheet }
}

/* ------------------------------------------------------------------ create */

export interface CreateGroupSheetProps {
  open: boolean
  onClose: () => void
  /** The new group, once saved. The sheet doesn't navigate by itself. */
  onCreated: (group: Group) => void
  /** The kind it starts as (e.g. from a "Trip" quick start). Default trip. */
  initialKind?: GroupKind
  /** After the sheet has left the screen. */
  onExited?: () => void
}

function blankDraft(kind: GroupKind, currency: string): Draft {
  return { name: '', emoji: kindMeta(kind).emoji, emojiPicked: false, kind, currency, memberIds: [], travelCurrency: null }
}

/**
 * A new group in one sheet: its name and icon, what kind it is (the icon follows until you pick
 * one), who's in (you always are) and its currency. "Create group" is ready as soon as it has a name.
 */
export function CreateGroupSheet({ open, onClose, onCreated, initialKind = 'trip', onExited }: CreateGroupSheetProps) {
  const profile = useProfile()
  const [draft, setDraft] = useState<Draft>(() => blankDraft(initialKind, profile.currency))
  // A fresh form every time it opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDraft(blankDraft(initialKind, profile.currency))
  }
  const patch = (next: Partial<Draft>) => setDraft((d) => ({ ...d, ...next }))
  const currency = useCurrencyPicker(draft.currency, 'The group’s expenses and settle-ups are in this currency.', (code) =>
    patch({ currency: code }),
  )
  const travel = useTravelPicker(draft, (code) => patch({ travelCurrency: code }))
  const ready = draft.name.trim() !== ''
  const showSpending = TRIP_ENABLED && (draft.kind === 'trip' || travelOf(draft) !== null)

  const create = (): void => {
    if (!ready) return
    const group = createGroup({
      name: draft.name,
      emoji: draft.emoji,
      kind: draft.kind,
      currency: draft.currency,
      memberIds: [ME_ID, ...draft.memberIds],
      ...(showSpending ? { travelCurrency: travelOf(draft) } : {}),
    })
    haptic('success')
    onCreated(group)
  }

  const count = draft.memberIds.length + 1
  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        onExited={onExited}
        size="tall"
        title="New group"
        description="Trips, flats, couples — add expenses as you go and Settle works out who pays whom."
        footer={
          <div className={styles.footer}>
            <p className={styles.footerHint} aria-live="polite">
              {ready ? `${count === 1 ? 'Just you for now' : `${count} people`} · ${draft.currency}` : 'Give the group a name to create it.'}
            </p>
            <Button block disabled={!ready} onClick={create}>
              Create group
            </Button>
          </div>
        }
      >
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            create()
          }}
        >
          <NameAndEmoji draft={draft} onChange={patch} onSubmit={create} autoFocus />
          <KindChips draft={draft} onChange={patch} />
          <Members draft={draft} onChange={patch} />
          <CurrencyRow currency={draft.currency} onPick={currency.openPicker} />
          {showSpending && <SpendingRow draft={draft} onPick={travel.openPicker} />}
        </form>
      </BottomSheet>
      {currency.sheet}
      {travel.sheet}
    </>
  )
}

/* ------------------------------------------------------------------ edit */

export type EditGroupSection = 'details' | 'members'

export interface EditGroupSheetProps {
  group: Group
  open: boolean
  onClose: () => void
  /** `details`: name, icon, kind and currency · `members`: who's in. */
  section: EditGroupSection
}

function draftOf(group: Group): Draft {
  return {
    name: group.name,
    emoji: group.emoji,
    emojiPicked: true,
    kind: group.kind,
    currency: group.currency,
    memberIds: others(group.memberIds),
    travelCurrency: group.travelCurrency ?? null,
  }
}

/**
 * Changes a group: its details (name, icon, kind, currency) or its members. People with money
 * still to settle stay in until they're square — the sheet says who, rather than failing.
 */
export function EditGroupSheet({ group, open, onClose, section }: EditGroupSheetProps) {
  const toast = useToast()
  const friendsById = useFriendsById()
  const [draft, setDraft] = useState<Draft>(() => draftOf(group))
  const [session, setSession] = useState({ open, section })
  // "Spending in" shows for trips and when set; any other group has it under "More".
  const [more, setMore] = useState(false)
  if (open !== session.open || (open && section !== session.section)) {
    setSession({ open, section })
    if (open) {
      setDraft(draftOf(group))
      setMore(false)
    }
  }
  const patch = (next: Partial<Draft>) => setDraft((d) => ({ ...d, ...next }))
  const currency = useCurrencyPicker(draft.currency, 'Its expenses and payments move to this currency — the numbers stay the same.', (code) =>
    patch({ currency: code }),
  )
  const travel = useTravelPicker(draft, (code) => patch({ travelCurrency: code }))
  const t = useT()
  const spendingShown = TRIP_ENABLED && (draft.kind === 'trip' || travelOf(draft) !== null || more)
  const details = section === 'details'
  const ready = !details || draft.name.trim() !== ''

  const save = (): void => {
    if (!ready) return
    try {
      if (details) {
        updateGroup(group.id, {
          name: draft.name,
          emoji: draft.emoji,
          kind: draft.kind,
          currency: draft.currency,
          ...(TRIP_ENABLED ? { travelCurrency: travelOf(draft) } : {}),
        })
        haptic('success')
        toast('Group updated', { tone: 'success' })
      } else {
        const saved = updateGroup(group.id, { memberIds: [ME_ID, ...draft.memberIds] })
        const kept = saved.memberIds.filter((id) => id !== ME_ID && !draft.memberIds.includes(id))
        haptic('success')
        if (kept.length > 0) {
          const names = describePeople(kept.map((id) => friendLabel(id, friendsById[id] ?? null)))
          toast(`${names} ${kept.length === 1 ? 'stays' : 'stay'} in until they’re settled up`, { tone: 'info' })
        } else {
          toast('Members updated', { tone: 'success' })
        }
      }
      onClose()
    } catch {
      haptic('error')
      toast('Couldn’t save that. The group may have been deleted.', { tone: 'error' })
      onClose()
    }
  }

  const currencyChanged = draft.currency !== group.currency
  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        size={details ? 'auto' : 'tall'}
        eyebrow={group.name}
        title={details ? 'Edit group' : 'Members'}
        description={details ? undefined : 'People with money still to settle stay in until they’re square.'}
        footer={
          <Button block disabled={!ready} onClick={save}>
            Save
          </Button>
        }
      >
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          {details ? (
            <>
              <NameAndEmoji draft={draft} onChange={patch} onSubmit={save} autoFocus={false} />
              <KindChips draft={draft} onChange={patch} />
              <CurrencyRow
                currency={draft.currency}
                onPick={currency.openPicker}
                note={currencyChanged ? 'Amounts keep their numbers — only the currency changes.' : undefined}
              />
              {spendingShown && <SpendingRow draft={draft} onPick={travel.openPicker} />}
              {TRIP_ENABLED && !spendingShown && (
                <button type="button" className={styles.more} aria-expanded={false} aria-label={t('trip.group.moreLabel')} onClick={() => setMore(true)}>
                  {t('trip.group.more')}
                  <ChevronDown aria-hidden="true" strokeWidth={2.5} />
                </button>
              )}
            </>
          ) : (
            <Members draft={draft} onChange={patch} />
          )}
        </form>
      </BottomSheet>
      {currency.sheet}
      {travel.sheet}
    </>
  )
}
