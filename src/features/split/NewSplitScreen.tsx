import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { CircleCheck, Copy, Info, Plane, Repeat, ScanLine, Sparkles, UsersRound } from 'lucide-react'
import { goBack, navigate, useBackClose, useLocation, useRoute, useSearchParams } from '../../app/router'
import {
  ActionBar,
  Banner,
  BottomSheet,
  Button,
  Card,
  Money,
  PageTitle,
  Screen,
  SectionHeader,
  SuccessBurst,
  TextField,
  TopBar,
  useToast,
} from '../../components'
import {
  duplicateExpenseDraft,
  ExpenseError,
  expenseDraftIssue,
  expenseErrorMessage,
  MAX_NOTE_LENGTH,
  MAX_TITLE_LENGTH,
  peekSplitPrefill,
  saveExpense,
  takeSplitPrefill,
  useExpense,
  useFriends,
  useFriendsById,
  useGroup,
  useGroups,
  useProfile,
} from '../../data'
import { BRAND, ME_ID, type Expense, type ExpenseSource, type Group } from '../../domain/types'
import { categoryFromText } from '../../engine/categories'
import { today } from '../../engine/dates'
import { AmountHero, CategoryPicker, DateField, friendLabel, PayerPicker, PeoplePicker, SplitEditor } from '../../kit/index-a'
import { haptic } from '../../lib/haptics'
import { CurrencySheet } from '../bill/CurrencySheet'
import { GroupPicker } from '../bill/GroupPicker'
import { openBill } from '../bill/launch'
import { NoteField } from './NoteField'
import {
  blankForm,
  changeCurrency,
  changesSavedMessage,
  formFromExpense,
  formShares,
  formToDraft,
  outcomeLine,
  payerCandidates,
  withFriend,
  withGroup,
  withPeople,
  withPrefill,
  withTemplate,
  type SplitForm,
} from './splitForm'
import { clearSplitDraft, loadSplitDraft, saveSplitDraft, type SplitOrigin } from './splitDraft'
import { titlePlaceholder } from './splitTemplates'
import styles from './NewSplitScreen.module.css'

const EDIT_ROUTES = ['/app/split/:id/edit'] as const

const expensePath = (id: string) => `/app/expense/${encodeURIComponent(id)}`

/**
 * `/app/split/new` and `/app/split/:id/edit` — split any amount, GPay-pay-screen style, on one
 * scrolling screen: the amount, what it was for (its category follows the title), the date and
 * group, who's in, how it's divided and who paid, and a note. Save stays disabled with the exact
 * reason until the split adds up, and says what saving will mean ("Riya will owe you ₹800").
 *
 * New splits start from the query (`group`, `friend`, `category` quick starts) and from a hand-off
 * (`from=describe|scan|recurring`, see `setSplitPrefill`) or a copy (`from=duplicate&of=<id>`).
 * Unsaved work is guarded on Back and survives a reload.
 */
export function NewSplitScreen() {
  const { params } = useRoute(EDIT_ROUTES)
  const location = useLocation()
  const editId = params.id ?? null
  const editing = useExpense(editId)

  if (editId !== null && editing === null) {
    return (
      <Screen header={<TopBar onBack={() => goBack('/app/activity')} />}>
        <PageTitle title="This expense is gone" subtitle="It may have been deleted — on this phone or in another tab." />
        <Button className={styles.gone} onClick={() => navigate('/app/activity', { replace: true })}>
          See activity
        </Button>
      </Screen>
    )
  }
  const url = location.path + location.search
  return <SplitScreen key={url} editing={editing} url={url} />
}

/* ------------------------------------------------------------------ where the form starts */

interface Start {
  form: SplitForm
  /** Unsaved work from the start (a hand-off or a copy): leaving always asks first. */
  prefilled: boolean
  origin: SplitOrigin
  /** The original's title, for a copy. */
  copyOf: string | null
}

interface StartContext {
  currency: string
  today: string
  friendIds: ReadonlySet<string>
  groups: readonly Group[]
}

const HAND_OFF_ORIGINS: Partial<Record<ExpenseSource, SplitOrigin>> = {
  describe: 'describe',
  scan: 'scan',
  recurring: 'recurring',
}

/** The form a fresh visit to `query` starts with (takes any waiting hand-off). */
function startFrom(editing: Expense | null, query: URLSearchParams, ctx: StartContext): Start {
  if (editing) return { form: formFromExpense(editing), prefilled: false, origin: 'edit', copyOf: null }

  let form = blankForm(ctx.currency, ctx.today)
  const group = ctx.groups.find((g) => g.id === query.get('group')) ?? null
  if (group) form = withGroup(form, group)
  const friend = query.get('friend')
  if (friend && friend !== ME_ID && ctx.friendIds.has(friend)) form = withFriend(form, friend)
  form = withTemplate(form, query.get('category'))

  const from = query.get('from')
  const of = query.get('of')
  if (from === 'duplicate' && of) {
    try {
      const copy = duplicateExpenseDraft(of)
      return { form: { ...formFromExpense(copy), date: ctx.today }, prefilled: true, origin: 'duplicate', copyOf: copy.title }
    } catch (error) {
      if (!(error instanceof ExpenseError)) throw error
      // The original is gone: start an empty split instead.
    }
  }
  if (from) {
    const prefill = takeSplitPrefill()
    if (prefill) {
      // Where it came from: the hand-off says, else the address does (`from=scan`).
      const said = prefill.source ? HAND_OFF_ORIGINS[prefill.source] : undefined
      const origin = said ?? (Object.hasOwn(HAND_OFF_ORIGINS, from) ? HAND_OFF_ORIGINS[from as ExpenseSource] : undefined) ?? 'new'
      return { form: withPrefill(form, prefill, ctx), prefilled: true, origin, copyOf: null }
    }
  }
  return { form, prefilled: false, origin: 'new', copyOf: null }
}

/** Serialized for "has anything changed?". */
const formKey = (form: SplitForm): string => JSON.stringify(form)

/* ------------------------------------------------------------------ the screen */

interface SplitScreenProps {
  editing: Expense | null
  url: string
}

function SplitScreen({ editing, url }: SplitScreenProps) {
  const toast = useToast()
  const profile = useProfile()
  const friends = useFriends()
  const friendsById = useFriendsById()
  const groups = useGroups()
  const query = useSearchParams()
  const day = today()
  const base = editing ? `${editing.id}@${editing.updatedAt}` : 'new'

  const [initial] = useState(() => {
    const handedOff = query.get('from') !== null && peekSplitPrefill() !== null
    const start = startFrom(editing, query, {
      currency: profile.currency,
      today: day,
      friendIds: new Set(friends.map((f) => f.id)),
      groups,
    })
    // A reload brings back what was being typed — unless a new hand-off is waiting.
    const draft = handedOff ? null : loadSplitDraft(url, base)
    const restored = draft
      ? { ...start, form: { ...draft.form, bill: start.form.bill }, prefilled: draft.prefilled, origin: draft.origin }
      : start
    return { ...restored, pristine: formKey(start.form), restored: draft !== null }
  })

  const [form, setForm] = useState<SplitForm>(initial.form)
  const [currencyOpen, setCurrencyOpen] = useState(false)
  /** The discard confirm, and what happens after Discard (null: go back). */
  const [confirm, setConfirm] = useState<{ open: boolean; then: (() => void) | null }>({ open: false, then: null })
  const [leaving, setLeaving] = useState(false)
  const [saved, setSaved] = useState<Expense | null>(null)
  const [hidden, setHidden] = useState<ReadonlySet<'origin' | 'rent' | 'trip'>>(() => new Set())
  const saving = useRef(false)
  const opened = useRef(false)
  const categoriesRef = useRef<HTMLDivElement>(null)
  const peopleRef = useRef<HTMLElement>(null)

  const group = useGroup(form.groupId)
  const isNew = editing === null
  const itemized = form.bill !== null
  const dirty = !leaving && saved === null && (initial.prefilled || formKey(form) !== initial.pristine)
  const draft = formToDraft(form, editing?.id)
  const issue = expenseDraftIssue(draft)
  const nameOf = (id: string) => friendLabel(id, friendsById[id] ?? null)
  const peopleIds = form.participants.map((p) => p.friendId)
  const friendParam = query.get('friend')
  const fallback = editing
    ? expensePath(editing.id)
    : form.groupId
      ? `/app/groups/${encodeURIComponent(form.groupId)}`
      : friendParam
        ? `/app/friends/${encodeURIComponent(friendParam)}`
        : '/app'

  // Back with unsaved work asks first; Back again keeps editing.
  useBackClose(dirty, () => setConfirm({ open: true, then: null }))
  useBackClose(confirm.open, () => setConfirm({ open: false, then: null }))

  // What's typed survives a reload, and is forgotten once the screen closes.
  useEffect(() => {
    if (leaving || saved) return
    if (dirty) saveSplitDraft({ url, base, form, prefilled: initial.prefilled, origin: initial.origin })
    else clearSplitDraft()
  }, [url, base, form, dirty, leaving, saved, initial.prefilled, initial.origin])
  useEffect(() => clearSplitDraft, [])

  // A split with no category yet opens on the first categories, not scrolled to "Other" at the end.
  useLayoutEffect(() => {
    if (initial.form.category !== 'other' || initial.form.categoryPicked) return
    const row = categoriesRef.current?.querySelector<HTMLElement>('[role="radiogroup"]')
    if (row) row.scrollLeft = 0
  }, [initial.form.category, initial.form.categoryPicked])

  // Editing names the expense in the tab ("Edit Dinner at Toit · Settle").
  const editingTitle = editing?.title ?? null
  useEffect(() => {
    if (editingTitle !== null) document.title = `Edit ${editingTitle} · ${BRAND.name}`
  }, [editingTitle])

  const change = (patch: Partial<SplitForm>): void => setForm((current) => ({ ...current, ...patch }))

  /** Leaves the screen — after "Discard changes?" when there's unsaved work. */
  const leave = (then: (() => void) | null = null): void => {
    if (dirty) {
      setConfirm({ open: true, then })
      return
    }
    setLeaving(true)
    if (then) then()
    else goBack(fallback)
  }

  const discard = (): void => {
    const then = confirm.then
    setConfirm({ open: false, then: null })
    setLeaving(true)
    clearSplitDraft()
    if (then) then()
    else goBack(fallback)
  }

  const pickCurrency = (code: string): void => {
    setCurrencyOpen(false)
    if (code === form.currency) return
    const before = form
    setForm(changeCurrency(form, code))
    toast(`Now in ${code}`, { action: { label: 'Undo', onAction: () => setForm(before) } })
  }

  const pickGroup = (groupId: string | null): void => {
    setForm((current) => withGroup(current, groups.find((g) => g.id === groupId) ?? null))
  }

  const save = (): void => {
    if (issue !== null || saving.current) return
    saving.current = true
    let expense: Expense
    try {
      expense = saveExpense(draft)
    } catch (error) {
      saving.current = false
      if (!(error instanceof ExpenseError)) throw error
      haptic('error')
      toast(expenseErrorMessage(error.code), { tone: 'error' })
      return
    }
    clearSplitDraft()
    if (editing) {
      setLeaving(true)
      toast(changesSavedMessage(editing, expense, nameOf), { tone: 'success' })
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

  // Back during the success moment just finishes it (the split is already saved).
  useBackClose(saved !== null, openSaved)

  const shares = issue === null ? formShares(form) : null
  const outcome = shares ? outcomeLine({ payerId: form.payerId, currency: form.currency, shares }, nameOf) : null
  const hint: ReactNode = issue ? (
    expenseErrorMessage(issue)
  ) : outcome ? (
    <span className={styles.outcome}>
      <CircleCheck aria-hidden="true" className={styles.outcomeIcon} strokeWidth={2.5} />
      {outcome}
    </span>
  ) : undefined

  const suggested = categoryFromText(form.title)
  const showRentTip =
    !itemized && !hidden.has('rent') && form.category === 'rent' && form.mode === 'equal' && form.participants.length >= 2
  const showTripTip = isNew && !itemized && !hidden.has('trip') && form.category === 'travel' && form.groupId === null
  const groupCurrencyNote = group && !itemized && group.currency !== form.currency ? group : null
  const hide = (what: 'origin' | 'rent' | 'trip') => setHidden((current) => new Set(current).add(what))
  const title = isNew ? 'New split' : 'Edit split'

  return (
    <Screen
      header={<TopBar onBack={() => leave()} title={title} />}
      footer={
        <ActionBar hint={hint}>
          <Button block iconStart={<CircleCheck />} disabled={issue !== null} onClick={save}>
            {isNew ? 'Save split' : 'Save changes'}
          </Button>
        </ActionBar>
      }
      contentClassName={styles.content}
    >
      <h1 className="visually-hidden" tabIndex={-1}>
        {isNew ? 'New split' : `Edit ${editing.title}`}
      </h1>

      {!hidden.has('origin') && <OriginBanner origin={initial.origin} copyOf={initial.copyOf} title={form.title} onDismiss={() => hide('origin')} />}

      <AmountHero
        value={form.total}
        currency={form.currency}
        onChange={(total) => change({ total })}
        onCurrencyClick={itemized ? undefined : () => setCurrencyOpen(true)}
        label={itemized ? 'Total paid' : 'Amount'}
        hint={itemized ? 'Tax, tips and discounts are spread over the items again.' : undefined}
        autoFocus={isNew && form.total === null && !initial.restored}
      />

      <div className={styles.details}>
        <TextField
          label="What's it for?"
          value={form.title}
          placeholder={titlePlaceholder(form.category)}
          maxLength={MAX_TITLE_LENGTH}
          autoCapitalize="sentences"
          autoComplete="off"
          enterKeyHint="next"
          onChange={(event) => {
            const text = event.target.value
            change(form.categoryPicked ? { title: text } : { title: text, category: categoryFromText(text) ?? 'other' })
          }}
          onKeyDown={(event) => {
            // Enter moves on to who's in (the keyboard's "Next").
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
            const search = peopleRef.current?.querySelector<HTMLInputElement>('input')
            if (!search) return
            event.preventDefault()
            search.focus()
          }}
        />
        <div ref={categoriesRef}>
          <CategoryPicker
            value={form.category}
            suggested={suggested}
            onChange={(category) => change({ category, categoryPicked: true })}
          />
        </div>
        <div className={styles.chips}>
          <DateField value={form.date} onChange={(date) => change({ date })} max={form.date > day ? form.date : undefined} />
          <GroupPicker value={form.groupId} onChange={pickGroup} />
        </div>
        {groupCurrencyNote && (
          <p className={styles.note}>
            <Info aria-hidden="true" className={styles.noteIcon} />
            In {form.currency}, so it’s settled person to person — not in {groupCurrencyNote.name}’s {groupCurrencyNote.currency} balances.
          </p>
        )}
      </div>

      {showTripTip && (
        <Card className={styles.tip}>
          <span className={styles.tipIcon} aria-hidden="true">
            <Plane />
          </span>
          <div className={styles.tipText}>
            <p className={styles.tipTitle}>Splitting a whole trip?</p>
            <p className={styles.tipBody}>
              Put it in a group: every expense adds up, and {BRAND.name} works out the fewest payments at the end.
            </p>
            <div className={styles.tipActions}>
              <Button size="sm" variant="accent" iconStart={<UsersRound />} onClick={() => leave(() => navigate('/app/groups?new=1'))}>
                Start a trip group
              </Button>
              <Button size="sm" variant="ghost" onClick={() => hide('trip')}>
                Just this once
              </Button>
            </div>
          </div>
        </Card>
      )}

      {itemized ? (
        <section className={styles.section} aria-labelledby="split-bill">
          <SectionHeader id="split-bill" title="Split item by item" />
          <BillCard
            form={form}
            editing={editing}
            onEditItems={editing ? () => leave(() => openBill({ kind: 'edit', expenseId: editing.id })) : undefined}
          />
          <PayerPicker
            className={styles.payer}
            value={form.payerId}
            onChange={(payerId) => change({ payerId })}
            candidates={payerCandidates(form)}
          />
        </section>
      ) : (
        <>
          <section ref={peopleRef} className={styles.section} aria-labelledby="split-people">
            <SectionHeader id="split-people" title="Split with" />
            <PeoplePicker
              selectedIds={peopleIds}
              onChange={(ids) => change({ participants: withPeople(form.participants, ids) })}
              groupMemberIds={group?.memberIds}
            />
          </section>

          <section className={styles.section} aria-labelledby="split-how">
            <SectionHeader id="split-how" title="How to split" />
            <PayerPicker
              className={styles.payer}
              value={form.payerId}
              onChange={(payerId) => change({ payerId })}
              candidates={payerCandidates(form)}
            />
            {showRentTip && (
              <Banner
                tone="info"
                icon={<Sparkles />}
                onDismiss={() => hide('rent')}
                action={{
                  label: 'Split by %',
                  onAction: () => {
                    haptic('select')
                    change({ mode: 'percent' })
                    hide('rent')
                  },
                }}
              >
                Rooms of different sizes? Rent is often fairer split by percentage.
              </Banner>
            )}
            <SplitEditor
              total={form.total}
              currency={form.currency}
              mode={form.mode}
              onModeChange={(mode) => change({ mode })}
              participants={form.participants}
              onParticipantsChange={(participants) => change({ participants })}
              payerId={form.payerId}
              roundToWhole={form.roundToWhole}
              onRoundToWholeChange={(roundToWhole) => change({ roundToWhole })}
            />
          </section>
        </>
      )}

      <NoteField value={form.note} onChange={(note) => change({ note })} maxLength={MAX_NOTE_LENGTH} />

      <CurrencySheet open={currencyOpen} currency={form.currency} onClose={() => setCurrencyOpen(false)} onSelect={pickCurrency} />

      <BottomSheet
        open={confirm.open}
        onClose={() => setConfirm({ open: false, then: null })}
        title={isNew ? 'Discard this split?' : 'Discard changes?'}
        description={isNew ? 'What you’ve entered won’t be saved.' : `Your changes to ${editing.title} won’t be saved.`}
        footer={
          <div className={styles.confirm}>
            <Button variant="danger" block onClick={discard}>
              Discard
            </Button>
            <Button variant="secondary" block onClick={() => setConfirm({ open: false, then: null })}>
              Keep editing
            </Button>
          </div>
        }
      />

      {saved && (
        <SuccessBurst
          title="Split saved"
          amount={<Money value={saved.total} currency={saved.currency} size="lg" trimZeros strong />}
          subtitle={outcomeLine(saved, nameOf, 'now')}
          onDone={openSaved}
        />
      )}
    </Screen>
  )
}

/* ------------------------------------------------------------------ pieces */

interface OriginBannerProps {
  origin: SplitOrigin
  copyOf: string | null
  title: string
  onDismiss: () => void
}

/** Where a prefilled split came from, so it gets a second look before saving. */
function OriginBanner({ origin, copyOf, title, onDismiss }: OriginBannerProps) {
  switch (origin) {
    case 'describe':
      return (
        <Banner tone="info" icon={<Sparkles />} title="Filled in from what you typed" onDismiss={onDismiss}>
          Check the amount and who’s in, then save.
        </Banner>
      )
    case 'scan':
      return (
        <Banner tone="info" icon={<ScanLine />} title="Filled in from your bill" onDismiss={onDismiss}>
          Check the amount — AI can misread a blurry photo.
        </Banner>
      )
    case 'recurring':
      return (
        <Banner tone="info" icon={<Repeat />} title={title ? `This month’s ${title}` : 'From a recurring split'} onDismiss={onDismiss}>
          Check it, then save to start collecting.
        </Banner>
      )
    case 'duplicate':
      return (
        <Banner tone="info" icon={<Copy />} title={copyOf ? `A copy of ${copyOf}` : 'A copy'} onDismiss={onDismiss}>
          Dated today, and nobody is marked as paid yet.
        </Banner>
      )
    default:
      return null
  }
}

interface BillCardProps {
  form: SplitForm
  editing: Expense | null
  /** Re-opens the bill to change who had what (only for a saved bill). */
  onEditItems?: () => void
}

/** An itemized bill keeps its items: what's on it, and the way back to the item-by-item flow. */
function BillCard({ form, editing, onEditItems }: BillCardProps) {
  const items = form.bill?.items.length ?? 0
  const people = form.participants.length
  return (
    <Card className={styles.bill}>
      <p className={styles.billLine}>
        {items === 1 ? '1 item' : `${items} items`} · {people === 1 ? '1 person' : `${people} people`}
      </p>
      <p className={styles.billBody}>
        {editing
          ? 'Who had what stays as it is. To change it, open the bill.'
          : 'The same items and people as the original — change who had what after saving.'}
      </p>
      {onEditItems && (
        <Button size="sm" variant="tonal" className={styles.billButton} onClick={onEditItems}>
          Change who had what
        </Button>
      )}
    </Card>
  )
}
