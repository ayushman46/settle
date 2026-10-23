import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { CircleCheck, Copy, Info, MessageSquareText, Mic, Plane, Repeat, RotateCw, ScanLine, Sparkles, UsersRound, Wallet } from 'lucide-react'
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
  type PrefillBanner,
  type PrefillBannerIcon,
} from '../../data'
import { BRAND, ME_ID, type Expense, type ExpenseSource, type Group } from '../../domain/types'
import { categoryFromText } from '../../engine/categories'
import { today } from '../../engine/dates'
import { AmountHero, CategoryPicker, DateField, friendLabel, PayerPicker, PeoplePicker, SplitEditor } from '../../kit/index-a'
import { useRate } from '../../api/rates'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { currencySymbol } from '../../lib/money'
import { CurrencySheet } from '../bill/CurrencySheet'
import { GroupPicker } from '../bill/GroupPicker'
import { openBill } from '../bill/launch'
import { ConversionPanel } from '../trip/ConversionPanel'
import { TRIP_ENABLED } from '../trip/enabled'
import { RateSheet } from '../trip/RateSheet'
import { NoteField } from './NoteField'
import {
  blankForm,
  changeCurrency,
  changesSavedMessage,
  formFromExpense,
  formShares,
  formToDraft,
  isConverting,
  outcomeLine,
  payerCandidates,
  resolveConversion,
  settleCurrency,
  withConvert,
  withDate,
  withFriend,
  withGroup,
  withManualRate,
  withPeople,
  withPrefill,
  withTemplate,
  type SplitForm,
  type TripContext,
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
 * (`from=describe|scan|recurring|sms|voice|rotation`, see `setSplitPrefill`) or a copy
 * (`from=duplicate&of=<id>`). A hand-off may bring its own banner.
 * Unsaved work is guarded on Back and survives a reload.
 */
export function NewSplitScreen() {
  const t = useT()
  const { params } = useRoute(EDIT_ROUTES)
  const location = useLocation()
  const editId = params.id ?? null
  const editing = useExpense(editId)

  if (editId !== null && editing === null) {
    return (
      <Screen header={<TopBar onBack={() => goBack('/app/activity')} />}>
        <PageTitle title={t('split.gone.title')} subtitle={t('split.gone.subtitle')} />
        <Button className={styles.gone} onClick={() => navigate('/app/activity', { replace: true })}>
          {t('split.gone.cta')}
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
  /** The hand-off's own banner (shown instead of the origin's), or null. */
  banner: PrefillBanner | null
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
  sms: 'sms',
  voice: 'voice',
}

/** `from=…` in the address, for hand-offs that don't say where they came from. */
const FROM_ORIGINS: Readonly<Record<string, SplitOrigin>> = {
  describe: 'describe',
  scan: 'scan',
  recurring: 'recurring',
  sms: 'sms',
  voice: 'voice',
  rotation: 'rotation',
}

/** The form a fresh visit to `query` starts with (takes any waiting hand-off). */
function startFrom(editing: Expense | null, query: URLSearchParams, ctx: StartContext): Start {
  if (editing) {
    // Trip currency off: an expense paid abroad edits as its settled amount (its rate is let go).
    let form = formFromExpense(TRIP_ENABLED || !editing.fx ? editing : { ...editing, fx: null })
    // "Convert to ₹" on the expense page: start with "Settle in ₹" on.
    if (TRIP_ENABLED && query.get('convert') === '1') form = { ...form, conversion: { ...form.conversion, convert: true } }
    return { form, prefilled: false, origin: 'edit', copyOf: null, banner: null }
  }

  const trip: TripContext | undefined = TRIP_ENABLED ? { settle: ctx.currency, profileCurrency: ctx.currency } : undefined
  let form = blankForm(ctx.currency, ctx.today)
  const group = ctx.groups.find((g) => g.id === query.get('group')) ?? null
  if (group) form = withGroup(form, group, trip)
  const friend = query.get('friend')
  if (friend && friend !== ME_ID && ctx.friendIds.has(friend)) form = withFriend(form, friend)
  form = withTemplate(form, query.get('category'))

  const from = query.get('from')
  const of = query.get('of')
  if (from === 'duplicate' && of) {
    try {
      const copy = duplicateExpenseDraft(of)
      // Dated today: a rate frozen for the original's day is looked up again for today.
      const copied = formFromExpense(TRIP_ENABLED || !copy.fx ? copy : { ...copy, fx: null })
      return { form: withDate(copied, ctx.today), prefilled: true, origin: 'duplicate', copyOf: copy.title, banner: null }
    } catch (error) {
      if (!(error instanceof ExpenseError)) throw error
      // The original is gone: start an empty split instead.
    }
  }
  if (from) {
    const prefill = takeSplitPrefill()
    if (prefill) {
      // Where it came from: the address says for a rotation, else the hand-off, else the address (`from=scan`).
      const said = prefill.source ? HAND_OFF_ORIGINS[prefill.source] : undefined
      const fromAddress = Object.hasOwn(FROM_ORIGINS, from) ? FROM_ORIGINS[from] : undefined
      const origin = (fromAddress === 'rotation' ? fromAddress : (said ?? fromAddress)) ?? 'new'
      return { form: withPrefill(form, prefill, { ...ctx, trip }), prefilled: true, origin, copyOf: null, banner: prefill.banner ?? null }
    }
  }
  return { form, prefilled: false, origin: 'new', copyOf: null, banner: null }
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
      ? { ...start, form: { ...draft.form, bill: start.form.bill }, prefilled: draft.prefilled, origin: draft.origin, banner: draft.banner ?? null }
      : start
    return { ...restored, pristine: formKey(start.form), restored: draft !== null }
  })

  const [form, setForm] = useState<SplitForm>(initial.form)
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const [rateOpen, setRateOpen] = useState(false)
  /** The discard confirm, and what happens after Discard (null: go back). */
  const [confirm, setConfirm] = useState<{ open: boolean; then: (() => void) | null }>({ open: false, then: null })
  const [leaving, setLeaving] = useState(false)
  const [saved, setSaved] = useState<Expense | null>(null)
  const [hidden, setHidden] = useState<ReadonlySet<'origin' | 'rent' | 'trip'>>(() => new Set())
  const saving = useRef(false)
  const opened = useRef(false)
  const categoriesRef = useRef<HTMLDivElement>(null)
  const peopleRef = useRef<HTMLElement>(null)

  const t = useT()
  const group = useGroup(form.groupId)
  const isNew = editing === null
  const itemized = form.bill !== null
  const dirty = !leaving && saved === null && (initial.prefilled || formKey(form) !== initial.pristine)

  // Trip currency: paid in one currency (the amount's), settled in another (the group's or yours).
  const settle = TRIP_ENABLED ? settleCurrency(form, group, profile.currency) : form.currency
  const trip: TripContext | undefined = TRIP_ENABLED ? { settle, profileCurrency: profile.currency } : undefined
  const foreign = form.currency !== settle
  const converting = isConverting(form, settle)
  const live = useRate(converting ? form.currency : null, settle, form.date)
  const conversion = resolveConversion(form, settle, live)
  const settleSymbol = currencySymbol(settle)

  const draft = formToDraft(form, editing?.id, conversion)
  const issue = expenseDraftIssue(draft)
  const typedAmount = form.total !== null && form.total > 0
  const fxBlock =
    typedAmount && conversion.status === 'loading'
      ? t('trip.panel.loadingHint')
      : typedAmount && conversion.status === 'unavailable'
        ? t('trip.panel.saveHint', { symbol: settleSymbol })
        : null
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
    if (dirty) saveSplitDraft({ url, base, form, prefilled: initial.prefilled, origin: initial.origin, banner: initial.banner })
    else clearSplitDraft()
  }, [url, base, form, dirty, leaving, saved, initial.prefilled, initial.origin, initial.banner])
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
    if (editingTitle !== null) document.title = t('split.screen.edit.docTitle', { title: editingTitle, brand: BRAND.name })
  }, [editingTitle, t])

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
    setForm(changeCurrency(form, code, trip))
    toast(t('split.currency.toast', { code }), { action: { label: t('split.undo.cta'), onAction: () => setForm(before) } })
  }

  const pickGroup = (groupId: string | null): void => {
    setForm((current) => withGroup(current, groups.find((g) => g.id === groupId) ?? null, trip))
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

  const shares = issue === null ? formShares(form, conversion) : null
  const outcome = shares ? outcomeLine({ payerId: form.payerId, currency: draft.currency, shares }, nameOf) : null
  const hint: ReactNode = fxBlock ? (
    fxBlock
  ) : issue ? (
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
  const groupCurrencyNote = group && !itemized && group.currency !== form.currency && !converting ? group : null
  const sharesTotal = converting ? (conversion.status === 'ok' ? conversion.total : null) : form.total
  const sharesCurrency = converting ? settle : form.currency
  const hide = (what: 'origin' | 'rent' | 'trip') => setHidden((current) => new Set(current).add(what))
  const title = t(isNew ? 'split.screen.new.title' : 'split.screen.edit.title')

  return (
    <Screen
      header={<TopBar onBack={() => leave()} title={title} />}
      footer={
        <ActionBar hint={hint}>
          <Button block iconStart={<CircleCheck />} disabled={issue !== null} onClick={save}>
            {t(isNew ? 'split.save.new.cta' : 'split.save.cta')}
          </Button>
        </ActionBar>
      }
      contentClassName={styles.content}
    >
      <h1 className="visually-hidden" tabIndex={-1}>
        {isNew ? t('split.screen.new.title') : t('split.screen.edit.heading', { title: editing.title })}
      </h1>

      {!hidden.has('origin') && (
        <OriginBanner origin={initial.origin} banner={initial.banner} copyOf={initial.copyOf} title={form.title} onDismiss={() => hide('origin')} />
      )}

      <AmountHero
        value={form.total}
        currency={form.currency}
        onChange={(total) => change({ total })}
        onCurrencyClick={itemized ? undefined : () => setCurrencyOpen(true)}
        label={t(itemized ? 'split.amount.itemized.label' : 'split.amount.label')}
        hint={itemized ? t('split.amount.itemized.hint') : undefined}
        autoFocus={isNew && form.total === null && !initial.restored}
      />

      {TRIP_ENABLED && foreign && (
        <ConversionPanel
          conversion={conversion}
          paid={form.currency}
          settle={settle}
          date={form.date}
          converting={converting}
          onConvertChange={(on) => setForm((current) => withConvert(current, on, settle))}
          onChangeRate={() => setRateOpen(true)}
          onUseEcb={() => setForm((current) => withManualRate(current, null))}
        />
      )}

      <div className={styles.details}>
        <TextField
          label={t('split.title.label')}
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
          <DateField value={form.date} onChange={(date) => setForm((current) => withDate(current, date))} max={form.date > day ? form.date : undefined} />
          <GroupPicker value={form.groupId} onChange={pickGroup} />
        </div>
        {groupCurrencyNote && (
          <p className={styles.note}>
            <Info aria-hidden="true" className={styles.noteIcon} />
            {t('split.groupCurrency.note', { currency: form.currency, group: groupCurrencyNote.name, groupCurrency: groupCurrencyNote.currency })}
          </p>
        )}
      </div>

      {showTripTip && (
        <Card className={styles.tip}>
          <span className={styles.tipIcon} aria-hidden="true">
            <Plane />
          </span>
          <div className={styles.tipText}>
            <p className={styles.tipTitle}>{t('split.tip.trip.title')}</p>
            <p className={styles.tipBody}>{t('split.tip.trip.body', { brand: BRAND.name })}</p>
            <div className={styles.tipActions}>
              <Button size="sm" variant="accent" iconStart={<UsersRound />} onClick={() => leave(() => navigate('/app/groups?new=1'))}>
                {t('split.tip.trip.cta')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => hide('trip')}>
                {t('split.tip.trip.dismiss')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {itemized ? (
        <section className={styles.section} aria-labelledby="split-bill">
          <SectionHeader id="split-bill" title={t('split.section.items.title')} />
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
            <SectionHeader id="split-people" title={t('split.section.people.title')} />
            <PeoplePicker
              selectedIds={peopleIds}
              onChange={(ids) => change({ participants: withPeople(form.participants, ids) })}
              groupMemberIds={group?.memberIds}
            />
          </section>

          <section className={styles.section} aria-labelledby="split-how">
            <SectionHeader id="split-how" title={t('split.section.how.title')} />
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
                  label: t('split.tip.rent.cta'),
                  onAction: () => {
                    haptic('select')
                    change({ mode: 'percent' })
                    hide('rent')
                  },
                }}
              >
                {t('split.tip.rent.body')}
              </Banner>
            )}
            {converting && (
              <p className={styles.note}>
                <Info aria-hidden="true" className={styles.noteIcon} />
                {t('trip.panel.sharesNote', { symbol: settleSymbol })}
              </p>
            )}
            <SplitEditor
              total={sharesTotal}
              currency={sharesCurrency}
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

      {TRIP_ENABLED && (
        <RateSheet
          open={rateOpen && foreign}
          onClose={() => setRateOpen(false)}
          paid={form.currency}
          settle={settle}
          amount={form.total}
          rate={conversion.status === 'ok' && conversion.rate ? conversion.rate : null}
          manual={form.conversion.manual}
          ecbAvailable={live?.status === 'ok'}
          onSave={(manual) => {
            setRateOpen(false)
            setForm((current) => withManualRate(withConvert(current, true, settle), manual))
          }}
          onUseEcb={() => {
            setRateOpen(false)
            setForm((current) => withManualRate(current, null))
          }}
        />
      )}

      <BottomSheet
        open={confirm.open}
        onClose={() => setConfirm({ open: false, then: null })}
        title={t(isNew ? 'split.discard.new.title' : 'split.discard.title')}
        description={isNew ? t('split.discard.new.description') : t('split.discard.description', { title: editing.title })}
        footer={
          <div className={styles.confirm}>
            <Button variant="danger" block onClick={discard}>
              {t('split.discard.cta')}
            </Button>
            <Button variant="secondary" block onClick={() => setConfirm({ open: false, then: null })}>
              {t('split.keep.cta')}
            </Button>
          </div>
        }
      />

      {saved && (
        <SuccessBurst
          title={t('split.saved.title')}
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
  /** The hand-off's own banner, shown instead of the origin's. */
  banner: PrefillBanner | null
  copyOf: string | null
  title: string
  onDismiss: () => void
}

const BANNER_ICONS: Readonly<Record<PrefillBannerIcon, ReactNode>> = {
  sparkles: <Sparkles />,
  message: <MessageSquareText />,
  mic: <Mic />,
  scan: <ScanLine />,
  rotate: <RotateCw />,
  wallet: <Wallet />,
}

/** Where a prefilled split came from, so it gets a second look before saving. */
function OriginBanner({ origin, banner, copyOf, title, onDismiss }: OriginBannerProps) {
  const t = useT()
  if (banner) {
    return (
      <Banner tone="info" icon={BANNER_ICONS[banner.icon]} title={banner.title} onDismiss={onDismiss}>
        {banner.body}
      </Banner>
    )
  }
  switch (origin) {
    case 'describe':
      return (
        <Banner tone="info" icon={<Sparkles />} title={t('split.origin.describe.title')} onDismiss={onDismiss}>
          {t('split.origin.check.body')}
        </Banner>
      )
    case 'scan':
      return (
        <Banner tone="info" icon={<ScanLine />} title={t('split.origin.scan.title')} onDismiss={onDismiss}>
          {t('split.origin.scan.body')}
        </Banner>
      )
    case 'recurring':
      return (
        <Banner
          tone="info"
          icon={<Repeat />}
          title={title ? t('split.origin.recurring.title', { title }) : t('split.origin.recurring.untitled')}
          onDismiss={onDismiss}
        >
          {t('split.origin.recurring.body')}
        </Banner>
      )
    case 'duplicate':
      return (
        <Banner tone="info" icon={<Copy />} title={copyOf ? t('split.origin.duplicate.title', { title: copyOf }) : t('split.origin.duplicate.untitled')} onDismiss={onDismiss}>
          {t('split.origin.duplicate.body')}
        </Banner>
      )
    case 'sms':
      return (
        <Banner tone="info" icon={<MessageSquareText />} title={t('split.origin.sms.title')} onDismiss={onDismiss}>
          {t('split.origin.sms.body')}
        </Banner>
      )
    case 'voice':
      return (
        <Banner tone="info" icon={<Mic />} title={t('split.origin.voice.title')} onDismiss={onDismiss}>
          {t('split.origin.check.body')}
        </Banner>
      )
    case 'rotation':
      return (
        <Banner tone="info" icon={<RotateCw />} title={t('split.origin.rotation.title')} onDismiss={onDismiss}>
          {t('split.origin.check.body')}
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
  const t = useT()
  const items = form.bill?.items.length ?? 0
  const people = form.participants.length
  return (
    <Card className={styles.bill}>
      <p className={styles.billLine}>
        {t('split.bill.line', { items, people })}
      </p>
      <p className={styles.billBody}>
        {t(editing ? 'split.bill.editing.body' : 'split.bill.copy.body')}
      </p>
      {onEditItems && (
        <Button size="sm" variant="tonal" className={styles.billButton} onClick={onEditItems}>
          {t('split.bill.change.cta')}
        </Button>
      )}
    </Card>
  )
}
