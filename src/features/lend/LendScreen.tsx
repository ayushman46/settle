import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { CircleCheck, UserPlus } from 'lucide-react'
import { goBack, navigate, Redirect, useBackClose, useRoute, useSearchParams } from '../../app/router'
import {
  ActionBar,
  BottomSheet,
  Button,
  Money,
  PageTitle,
  Screen,
  SectionHeader,
  SegmentedControl,
  SuccessBurst,
  TextField,
  TopBar,
  useToast,
  type SegmentedOption,
} from '../../components'
import { DataError, ExpenseError, expenseErrorMessage, MAX_NOTE_LENGTH, useExpense, useFriends, useFriendsById, useGroups, useProfile } from '../../data'
import { lendDraftFromExpense, LEND_WHAT, LEND_WHATS, MAX_LEND_TITLE_LENGTH, saveLoan, type LendDirection, type LendWhat } from '../../data/loans'
import type { Expense } from '../../domain/types'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { AmountHero, DateField, FriendAvatar, friendLabel, PeoplePicker } from '../../kit/index-a'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { rescaleMinor } from '../../lib/money'
import { CurrencySheet } from '../bill/CurrencySheet'
import { GroupPicker } from '../bill/GroupPicker'
import { NoteField } from '../split/NoteField'
import { LEND_ENABLED } from './enabled'
import {
  lendFormFromDraft,
  lendFormFromQuery,
  lendFormToDraft,
  lendGridPeople,
  lendIssue,
  lendIssueMessage,
  lendOutcome,
  whatLabel,
  type LendFormState,
} from './lendView'
import styles from './LendScreen.module.css'

const EDIT_ROUTES = ['/app/lend/:id/edit'] as const

const expensePath = (id: string) => `/app/expense/${encodeURIComponent(id)}`

/**
 * `/app/lend` and `/app/lend/:id/edit` — udhaar in two taps: I gave / I got, who (a tap on a
 * face), how much, what for (cash is a loan; an auto or chai is a 1:1 split with its category),
 * then Save. Deep links prefill it (`?dir=lent|borrowed&friend=<id>&amount=<paise>&what=<chip>`).
 * Editing something that isn't a 1:1 entry goes to the split editor instead.
 */
export function LendScreen() {
  if (!LEND_ENABLED) return <Redirect to="/app" />
  return <LendRoute />
}

function LendRoute() {
  const { params } = useRoute(EDIT_ROUTES)
  const id = params.id ?? null
  return id ? <EditLend id={id} /> : <NewLend />
}

function NewLend() {
  const query = useSearchParams()
  const profile = useProfile()
  const friendsById = useFriendsById()
  const [initial] = useState(() => lendFormFromQuery(query, profile.currency, (id) => Object.hasOwn(friendsById, id)))
  return <LendForm initial={initial} editing={null} />
}

function EditLend({ id }: { id: string }) {
  const t = useT()
  const expense = useExpense(id)
  // Keeps the form once loaded (a save rewrites the expense underneath it).
  const [loaded] = useState(() => (expense ? lendDraftFromExpense(expense) : null))
  if (!expense) {
    return (
      <Screen header={<TopBar onBack={() => goBack('/app/activity')} />}>
        <PageTitle title="This expense is gone" subtitle="It may have been deleted — on this phone or in another tab." />
        <Button className={styles.gone} onClick={() => navigate('/app/activity', { replace: true })}>
          {t('common.action.back')}
        </Button>
      </Screen>
    )
  }
  if (!loaded) return <Redirect to={`/app/split/${encodeURIComponent(id)}/edit`} />
  return <LendForm initial={lendFormFromDraft(loaded)} editing={expense} />
}

const WHAT_EMOJI: Readonly<Record<LendWhat, string>> = Object.fromEntries(LEND_WHATS.map((w) => [w, LEND_WHAT[w].emoji])) as Record<LendWhat, string>

interface LendFormProps {
  initial: LendFormState
  editing: Expense | null
}

function LendForm({ initial, editing }: LendFormProps) {
  const t = useT()
  const toast = useToast()
  const friends = useFriends()
  const friendsById = useFriendsById()
  const groups = useGroups()
  const amountId = useId()
  const [form, setForm] = useState<LendFormState>(initial)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const [saved, setSaved] = useState<Expense | null>(null)
  const saving = useRef(false)
  const opened = useRef(false)
  const titleRef = useRef<HTMLInputElement>(null)

  const change = (patch: Partial<LendFormState>): void => setForm((current) => ({ ...current, ...patch }))
  const nameOf = (id: string) => friendLabel(id, friendsById[id] ?? null)
  const issue = lendIssue(form)
  const people = lendGridPeople(friends, form.friendId)

  const focusAmount = (): void => {
    // After the tile's own click settles: the amount is the next tap.
    requestAnimationFrame(() => document.getElementById(amountId)?.focus())
  }

  const pick = (friendId: string): void => {
    haptic('select')
    change({ friendId })
    focusAmount()
  }

  const pickGroup = (groupId: string | null): void => {
    const group = groups.find((g) => g.id === groupId) ?? null
    setForm((current) => {
      if (!group || group.currency === current.currency) return { ...current, groupId }
      const amount = current.amount === null ? null : rescaleMinor(current.amount, current.currency, group.currency)
      return { ...current, groupId, currency: group.currency, amount }
    })
  }

  const pickCurrency = (code: string): void => {
    setCurrencyOpen(false)
    if (code === form.currency) return
    setForm((current) => ({ ...current, currency: code, amount: current.amount === null ? null : rescaleMinor(current.amount, current.currency, code) }))
  }

  const save = (): void => {
    const draft = lendFormToDraft(form, editing?.id)
    if (!draft || saving.current) return
    saving.current = true
    let expense: Expense
    try {
      expense = saveLoan(draft)
    } catch (error) {
      saving.current = false
      haptic('error')
      if (error instanceof ExpenseError) toast(expenseErrorMessage(error.code), { tone: 'error' })
      else if (error instanceof DataError) toast(error.message, { tone: 'error' })
      else throw error
      return
    }
    haptic('success')
    if (editing) {
      toast(t('lend.saved.toast'), { tone: 'success' })
      goBack(expensePath(expense.id))
      return
    }
    setSaved(expense)
  }

  const openSaved = (): void => {
    if (!saved || opened.current) return
    opened.current = true
    navigate(expensePath(saved.id), { replace: true })
  }

  // Back during the success moment just finishes it (the entry is already saved).
  useBackClose(saved !== null, openSaved)

  const onAmountKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    if (!(event.target instanceof HTMLInputElement) || event.target.id !== amountId) return
    event.preventDefault()
    if (issue === 'enterTitle') titleRef.current?.focus()
    else save()
  }

  const outcome =
    issue === null && form.friendId && form.amount !== null ? lendOutcome(form.direction, nameOf(form.friendId), form.amount, form.currency) : null
  const hint: ReactNode = issue ? (
    lendIssueMessage(issue)
  ) : outcome ? (
    <span className={styles.outcome}>
      <CircleCheck aria-hidden="true" className={styles.outcomeIcon} strokeWidth={2.5} />
      {outcome}
    </span>
  ) : undefined

  const directions: ReadonlyArray<SegmentedOption<LendDirection>> = [
    { value: 'lent', label: t('lend.direction.lent') },
    { value: 'borrowed', label: t('lend.direction.borrowed') },
  ]
  const heading = editing ? t('lend.screen.edit.title') : t('lend.screen.title')

  return (
    <Screen
      header={<TopBar onBack={() => goBack(editing ? expensePath(editing.id) : '/app')} />}
      footer={
        <ActionBar hint={hint}>
          <Button block iconStart={<CircleCheck />} disabled={issue !== null} onClick={save}>
            {editing ? t('lend.saveChanges.cta') : t('lend.save.cta')}
          </Button>
        </ActionBar>
      }
      contentClassName={styles.content}
    >
      <PageTitle title={heading} subtitle={t('lend.screen.subtitle')} />

      <SegmentedControl options={directions} value={form.direction} onChange={(direction) => change({ direction })} ariaLabel={t('lend.direction.label')} />

      <section className={styles.section} aria-labelledby="lend-who">
        <SectionHeader id="lend-who" title={t('lend.who.title')} />
        <PeopleGrid
          people={people.map((f) => ({ id: f.id, friend: f, name: nameOf(f.id) }))}
          selectedId={form.friendId}
          onPick={pick}
          onMore={() => setPickerOpen(true)}
          label={t('lend.who.title')}
          moreLabel={t('lend.who.other.cta')}
        />
      </section>

      <div onKeyDown={onAmountKey}>
        <AmountHero
          id={amountId}
          value={form.amount}
          currency={form.currency}
          onChange={(amount) => change({ amount })}
          onCurrencyClick={() => setCurrencyOpen(true)}
          label={t('lend.amount.label')}
          autoFocus={initial.friendId !== null && initial.amount === null}
        />
      </div>

      <section className={styles.section} aria-labelledby="lend-what">
        <SectionHeader id="lend-what" title={t('lend.what.title')} />
        <WhatChips
          value={form.what}
          onChange={(what) => {
            haptic('select')
            change({ what })
            if (what === 'other') requestAnimationFrame(() => titleRef.current?.focus())
          }}
          label={t('lend.what.label')}
        />
        {form.what === 'other' && (
          <TextField
            ref={titleRef}
            label={t('lend.what.other.label')}
            value={form.title}
            placeholder={t('lend.what.other.placeholder')}
            maxLength={MAX_LEND_TITLE_LENGTH}
            autoCapitalize="sentences"
            autoComplete="off"
            enterKeyHint="done"
            onChange={(event) => change({ title: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault()
                save()
              }
            }}
          />
        )}
      </section>

      <div className={styles.chips}>
        <DateField value={form.date} onChange={(date) => change({ date })} max={form.date > today() ? form.date : undefined} />
        <GroupPicker value={form.groupId} onChange={pickGroup} />
      </div>

      <NoteField value={form.note} onChange={(note) => change({ note })} maxLength={MAX_NOTE_LENGTH} />

      <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)} title={t('lend.who.sheet.title')} description={t('lend.who.sheet.description')} size="tall">
        <PeoplePicker
          selectedIds={[]}
          includeMe={false}
          max={1}
          autoFocus
          label={t('lend.who.search.label')}
          onChange={(ids) => {
            const id = ids[ids.length - 1]
            if (!id) return
            setPickerOpen(false)
            pick(id)
          }}
        />
      </BottomSheet>

      <CurrencySheet open={currencyOpen} currency={form.currency} onClose={() => setCurrencyOpen(false)} onSelect={pickCurrency} description={null} />

      {saved && (
        <SuccessBurst
          title={t('lend.saved.title')}
          amount={<Money value={saved.total} currency={saved.currency} size="lg" trimZeros strong />}
          subtitle={lendOutcome(form.direction, nameOf(form.friendId ?? ''), saved.total, saved.currency, 'now')}
          onDone={openSaved}
        />
      )}
    </Screen>
  )
}

/* ------------------------------------------------------------------ people */

interface GridPerson {
  id: string
  friend: Parameters<typeof FriendAvatar>[0]['friend']
  name: string
}

/** Faces as one radiogroup (arrow keys move and pick), with "Someone else" as the last tile. */
function PeopleGrid({
  people,
  selectedId,
  onPick,
  onMore,
  label,
  moreLabel,
}: {
  people: GridPerson[]
  selectedId: string | null
  onPick: (id: string) => void
  onMore: () => void
  label: string
  moreLabel: string
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const count = people.length + 1
  const selectedIndex = people.findIndex((p) => p.id === selectedId)
  const tabIndexAt = selectedIndex === -1 ? 0 : selectedIndex

  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    const jump = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : null
    if (step === 0 && jump === null) return
    event.preventDefault()
    const next = jump ?? (index + step + count) % count
    refs.current[next]?.focus()
    const person = people[next]
    if (person) onPick(person.id)
  }

  return (
    <div role="radiogroup" aria-label={label} className={styles.grid}>
      {people.map((p, i) => {
        const selected = p.id === selectedId
        return (
          <button
            key={p.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={i === tabIndexAt ? 0 : -1}
            className={cx(styles.person, selected && styles.selected)}
            onClick={() => onPick(p.id)}
            onKeyDown={(event) => onKey(event, i)}
          >
            <FriendAvatar friend={p.friend} friendId={p.id} size="lg" selected={selected} />
            <span className={styles.personName}>{p.name}</span>
          </button>
        )
      })}
      <button
        ref={(el) => {
          refs.current[people.length] = el
        }}
        type="button"
        role="radio"
        aria-checked={false}
        aria-haspopup="dialog"
        tabIndex={people.length === 0 ? 0 : -1}
        className={cx(styles.person, styles.more)}
        onClick={onMore}
        onKeyDown={(event) => onKey(event, people.length)}
      >
        <span className={styles.moreIcon} aria-hidden="true">
          <UserPlus strokeWidth={2.25} />
        </span>
        <span className={styles.personName}>{moreLabel}</span>
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ what for */

function WhatChips({ value, onChange, label }: { value: LendWhat; onChange: (what: LendWhat) => void; label: string }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const next = (index + step + LEND_WHATS.length) % LEND_WHATS.length
    refs.current[next]?.focus()
    const what = LEND_WHATS[next]
    if (what) onChange(what)
  }
  return (
    <div role="radiogroup" aria-label={label} className={styles.whats}>
      {LEND_WHATS.map((what, i) => {
        const selected = what === value
        return (
          <button
            key={what}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={cx(styles.what, selected && styles.whatSelected)}
            onClick={() => onChange(what)}
            onKeyDown={(event) => onKey(event, i)}
          >
            <span aria-hidden="true" className={styles.whatEmoji}>
              {WHAT_EMOJI[what]}
            </span>
            {whatLabel(what)}
          </button>
        )
      })}
    </div>
  )
}

