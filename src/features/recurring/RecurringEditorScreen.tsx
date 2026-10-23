import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { goBack, navigate, useBackClose, useRoute, useSearchParams } from '../../app/router'
import {
  ActionBar,
  Banner,
  BottomSheet,
  Button,
  Card,
  IconButton,
  PageTitle,
  Screen,
  SectionHeader,
  Switch,
  TextField,
  TopBar,
  useToast,
} from '../../components'
import {
  deleteRecurring,
  ExpenseError,
  expenseDraftIssue,
  expenseErrorMessage,
  MAX_TITLE_LENGTH,
  restoreRecurring,
  saveRecurring,
  useDueRecurring,
  useGroup,
  useProfile,
  useRecurring,
  type ExpenseErrorCode,
} from '../../data'
import { ME_ID, type CategoryId, type Minor, type Participant, type RecurringTemplate } from '../../domain/types'
import { categoryFromText } from '../../engine/categories'
import { today } from '../../engine/dates'
import { nextRecurringPeriod } from '../../engine/recurring'
import type { AmountSplitMode } from '../../engine/split'
import { useT } from '../../i18n'
import { AmountHero, CategoryPicker, PayerPicker, PeoplePicker, SplitEditor } from '../../kit/index-a'
import { useHasFeature, usePro } from '../../pro'
import { PaywallHost } from '../pro/PaywallSheet'
import { ProLock } from '../pro/ProLock'
import { DayOfMonthPicker, LAST_DAY } from './DayOfMonthPicker'
import { presetById, type RecurringPreset } from './presets'
import { dueLabel, firstDueDate, monthName, shortDate } from './recurringLabels'
import { useSplitNow } from './useSplitNow'
import styles from './RecurringEditorScreen.module.css'

const ROUTES = ['/app/recurring/:id'] as const
const LIST = '/app/recurring'

/**
 * `/app/recurring/new` and `/app/recurring/:id` (Pro) — set up or change a recurring split: the
 * monthly amount, what it's for, the day it's due, who's in and how it's divided, who pays, and
 * whether it's on. Unsaved changes are guarded on Back; deleting can be undone.
 */
export function RecurringEditorScreen() {
  const t = useT()
  const { params } = useRoute(ROUTES)
  const query = useSearchParams()
  const id = params.id ?? 'new'
  const isNew = id === 'new'
  const templates = useRecurring()
  const unlocked = useHasFeature('recurring')
  const found = isNew ? null : (templates.find((tpl) => tpl.id === id) ?? null)
  // Keeps the form on screen while it leaves after a delete (the template is already gone).
  const [deleted, setDeleted] = useState<RecurringTemplate | null>(null)
  const template = found ?? (deleted?.id === id ? deleted : null)

  if (isNew && !unlocked) {
    return (
      <Screen header={<TopBar onBack={() => goBack(LIST)} />}>
        <PageTitle title={t('recurring.editor.new.title')} />
        <ProLock feature="recurring" />
      </Screen>
    )
  }
  if (!isNew && !template) {
    return (
      <Screen header={<TopBar onBack={() => goBack(LIST)} />}>
        <PageTitle title={t('recurring.editor.gone.title')} subtitle={t('recurring.editor.gone.subtitle')} />
        <Button className={styles.gone} onClick={() => navigate(LIST, { replace: true })}>
          {t('recurring.editor.gone.cta')}
        </Button>
      </Screen>
    )
  }
  return <Editor key={id} template={template} preset={isNew ? presetById(query.get('preset')) : null} onDeleting={setDeleted} />
}

/* ------------------------------------------------------------------ the form */

interface Form {
  title: string
  category: CategoryId
  /** Picked by hand — stop following the title's suggestion. */
  categoryPicked: boolean
  total: Minor | null
  currency: string
  participants: Participant[]
  mode: AmountSplitMode
  payerId: string
  dayOfMonth: number
  active: boolean
}

function initialForm(template: RecurringTemplate | null, preset: RecurringPreset | null, currency: string, day: string): Form {
  if (template) {
    return {
      title: template.title,
      category: template.category,
      categoryPicked: true,
      total: template.total,
      currency: template.currency,
      participants: template.participants.map((p) => ({ ...p })),
      mode: template.mode,
      payerId: template.payerId,
      dayOfMonth: template.dayOfMonth,
      active: template.active,
    }
  }
  const todayDay = Math.min(LAST_DAY, Number(day.slice(8, 10)) || 1)
  return {
    title: preset?.title ?? '',
    category: preset?.category ?? 'other',
    categoryPicked: preset !== null,
    total: null,
    currency,
    participants: [{ friendId: ME_ID, input: null }],
    mode: 'equal',
    payerId: ME_ID,
    dayOfMonth: preset?.dayOfMonth ?? todayDay,
    active: true,
  }
}

/** Keeps each person's typed input when people are added, removed or reordered. */
function withPeople(participants: readonly Participant[], ids: readonly string[]): Participant[] {
  return ids.map((friendId) => participants.find((p) => p.friendId === friendId) ?? { friendId, input: null })
}

function formIssue(form: Form, day: string): ExpenseErrorCode | null {
  return expenseDraftIssue({
    kind: 'split',
    title: form.title,
    category: form.category,
    currency: form.currency,
    total: form.total ?? 0,
    date: day,
    payerId: form.payerId,
    mode: form.mode,
    participants: form.participants,
    roundedToWhole: false,
    note: null,
    groupId: null,
    bill: null,
    recurringId: null,
    source: 'recurring',
  })
}

interface EditorProps {
  template: RecurringTemplate | null
  preset: RecurringPreset | null
  onDeleting: (template: RecurringTemplate) => void
}

function Editor({ template, preset, onDeleting }: EditorProps) {
  const t = useT()
  const toast = useToast()
  const profile = useProfile()
  const pro = usePro()
  const unlocked = useHasFeature('recurring')
  const group = useGroup(template?.groupId ?? null)
  const day = today()
  const due = useDueRecurring(day).find((d) => d.template.id === template?.id) ?? null
  const { splitNow, moment } = useSplitNow()
  const [form, setForm] = useState<Form>(() => initialForm(template, preset, profile.currency, day))
  const [dirty, setDirty] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const isNew = template === null

  // Back with unsaved changes asks first; Back again keeps editing.
  useBackClose(dirty, () => setConfirming(true))
  useBackClose(confirming, () => setConfirming(false))

  const change = (patch: Partial<Form>): void => {
    setForm((current) => ({ ...current, ...patch }))
    setDirty(true)
  }

  const suggested = categoryFromText(form.title)
  const issue = formIssue(form, day)
  const peopleIds = form.participants.map((p) => p.friendId)
  const next = template ? nextRecurringPeriod({ ...template, dayOfMonth: form.dayOfMonth }, day) : null
  const nextDue = next ? next.dueDate : firstDueDate(form.dayOfMonth, day)

  const leave = (): void => {
    if (dirty) setConfirming(true)
    else goBack(LIST)
  }

  const save = (): void => {
    if (issue) return
    try {
      saveRecurring({
        id: template?.id,
        title: form.title,
        category: form.category,
        currency: form.currency,
        total: form.total ?? 0,
        payerId: form.payerId,
        mode: form.mode,
        participants: form.participants,
        dayOfMonth: form.dayOfMonth,
        groupId: template?.groupId ?? null,
        active: form.active,
      })
    } catch (error) {
      if (!(error instanceof ExpenseError)) throw error
      toast(expenseErrorMessage(error.code), { tone: 'error' })
      return
    }
    setDirty(false)
    toast(t(isNew ? 'recurring.editor.saved.toast' : 'recurring.editor.changesSaved.toast'), { tone: 'success' })
    goBack(LIST)
  }

  const remove = (): void => {
    if (!template) return
    onDeleting(template)
    const removed = deleteRecurring(template.id)
    setDirty(false)
    if (removed) {
      toast(t('recurring.editor.deleted.toast', { title: removed.title }), {
        action: { label: t('recurring.editor.undo.cta'), onAction: () => restoreRecurring(removed) },
      })
    }
    goBack(LIST)
  }

  return (
    <Screen
      header={
        <TopBar
          onBack={leave}
          title={t(isNew ? 'recurring.editor.new.title' : 'recurring.editor.title')}
          right={
            template ? (
              <IconButton label={t('recurring.editor.delete.aria', { title: template.title })} onClick={remove}>
                <Trash2 />
              </IconButton>
            ) : undefined
          }
        />
      }
      footer={
        <ActionBar hint={issue ? expenseErrorMessage(issue) : undefined}>
          <Button block disabled={issue !== null} onClick={save}>
            {t(isNew ? 'recurring.editor.save.new.cta' : 'recurring.editor.save.cta')}
          </Button>
        </ActionBar>
      }
      contentClassName={styles.content}
    >
      <h1 className="visually-hidden" tabIndex={-1}>
        {isNew ? t('recurring.editor.new.title') : t('recurring.editor.edit.title', { title: template.title })}
      </h1>

      {!unlocked && template && (
        <Banner tone="warning" title={t(pro.status === 'expired' ? 'recurring.pro.ended.title' : 'recurring.pro.locked.title')}>
          {t('recurring.editor.paused.body')}
        </Banner>
      )}

      {template && next && (
        <Card className={styles.next}>
          <div className={styles.nextText}>
            <p className={styles.nextLabel}>{due ? dueLabel(due) : t('recurring.editor.nextSplit', { date: shortDate(next.dueDate) })}</p>
            <p className={styles.nextMonth}>{t('recurring.forMonth', { month: monthName(next.period, day) })}</p>
          </div>
          {due && !dirty && (
            <Button variant="accent" size="md" onClick={() => splitNow(template, due.period)}>
              {t('recurring.splitNow.cta')}
            </Button>
          )}
          {due && dirty && <p className={styles.nextHint}>{t('recurring.editor.saveFirst.hint')}</p>}
        </Card>
      )}

      <AmountHero
        value={form.total}
        currency={form.currency}
        onChange={(total) => change({ total })}
        label={t('recurring.editor.amount.label')}
        autoFocus={isNew && preset === null}
      />

      <div className={styles.group}>
        <TextField
          label={t('recurring.editor.what.label')}
          value={form.title}
          placeholder={t('recurring.editor.what.placeholder')}
          maxLength={MAX_TITLE_LENGTH}
          autoCapitalize="sentences"
          enterKeyHint="next"
          onChange={(event) => {
            const title = event.target.value
            const hint = categoryFromText(title)
            change(form.categoryPicked || !hint ? { title } : { title, category: hint })
          }}
        />
        <CategoryPicker
          value={form.category}
          suggested={suggested}
          onChange={(category) => change({ category, categoryPicked: true })}
        />
      </div>

      <section className={styles.section} aria-labelledby="recurring-repeats">
        <SectionHeader id="recurring-repeats" title={t('recurring.editor.repeats.title')} />
        <DayOfMonthPicker value={form.dayOfMonth} onChange={(dayOfMonth) => change({ dayOfMonth })} />
        <p className={styles.caption}>
          {t(isNew ? 'recurring.editor.firstReminder' : 'recurring.editor.nextDue', { date: shortDate(nextDue) })}
        </p>
      </section>

      <section className={styles.section} aria-labelledby="recurring-people">
        <SectionHeader id="recurring-people" title={t('recurring.editor.people.title')} />
        <PeoplePicker
          selectedIds={peopleIds}
          onChange={(ids) => change({ participants: withPeople(form.participants, ids) })}
          groupMemberIds={group?.memberIds}
        />
      </section>

      <section className={styles.section} aria-labelledby="recurring-how">
        <SectionHeader id="recurring-how" title={t('recurring.editor.how.title')} />
        <SplitEditor
          className={styles.split}
          total={form.total}
          currency={form.currency}
          mode={form.mode}
          onModeChange={(mode) => change({ mode })}
          participants={form.participants}
          onParticipantsChange={(participants) => change({ participants })}
          payerId={form.payerId}
          roundToWhole={false}
          onRoundToWholeChange={() => undefined}
        />
        <PayerPicker value={form.payerId} onChange={(payerId) => change({ payerId })} candidates={[ME_ID, ...peopleIds]} />
      </section>

      {template && (
        <Card padding="none">
          <Switch
            checked={form.active}
            onChange={(active) => change({ active })}
            label={t('recurring.editor.remind.label')}
            description={t('recurring.editor.remind.description')}
          />
        </Card>
      )}

      <BottomSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('recurring.editor.discard.title')}
        description={t(isNew ? 'recurring.editor.discard.new.description' : 'recurring.editor.discard.description')}
        footer={
          <div className={styles.confirm}>
            <Button
              variant="danger"
              block
              onClick={() => {
                setConfirming(false)
                setDirty(false)
                goBack(LIST)
              }}
            >
              {t('recurring.editor.discard.cta')}
            </Button>
            <Button variant="secondary" block onClick={() => setConfirming(false)}>
              {t('recurring.editor.keep.cta')}
            </Button>
          </div>
        }
      />
      {moment}
      <PaywallHost />
    </Screen>
  )
}
