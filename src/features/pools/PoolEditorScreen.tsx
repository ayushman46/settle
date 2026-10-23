import { useId, useState } from 'react'
import { CalendarPlus, Pencil, Users } from 'lucide-react'
import { goBack, navigate, Redirect, useBackClose, useRoute } from '../../app/router'
import {
  ActionBar,
  BottomSheet,
  Button,
  Card,
  Chip,
  PageTitle,
  Screen,
  SectionHeader,
  SegmentedControl,
  Stepper,
  Switch,
  TextField,
  TopBar,
  useToast,
} from '../../components'
import { DataError, MAX_POOL_NOTE_LENGTH, MAX_POOL_TITLE_LENGTH, updateProfile, usePool, useProfile } from '../../data'
import { savePool } from '../../data/pools'
import type { Minor, Pool, PoolMode, PoolOccasion } from '../../domain/types'
import { addDays, today } from '../../engine/dates'
import { useT, type MessageKey } from '../../i18n'
import { AmountHero, DateField, PeoplePicker } from '../../kit/index-a'
import { UpiIdForm } from '../../kit/UpiIdForm'
import { POOLS_ENABLED } from './enabled'
import { OccasionGrid } from './OccasionGrid'
import { POOLS_PATH, poolPath } from './paths'
import { PoolEmoji } from './PoolRow'
import { money, poolFormIssue } from './poolView'
import { occasionChips, occasionLabel, occasionTakesName, POOL_TEMPLATES, titleFor } from './poolTemplates'
import styles from './PoolEditorScreen.module.css'

const ROUTES = ['/app/pools/new', '/app/pools/:id/edit'] as const

/**
 * `/app/pools/new` and `/app/pools/:id/edit` — make or change a collection: pick the occasion
 * (ten Indian templates), then one screen of details — who it's for, same amount or pay what you
 * want, who's chipping in, the deadline, a note, where the money goes, and what the link shows.
 */
export function PoolEditorScreen() {
  if (!POOLS_ENABLED) return <Redirect to="/app" />
  return <EditorRoute />
}

function EditorRoute() {
  const t = useT()
  const { params } = useRoute(ROUTES)
  const id = params.id ?? null
  const pool = usePool(id)
  if (id !== null && !pool) {
    return (
      <Screen header={<TopBar onBack={() => goBack(POOLS_PATH)} />}>
        <PageTitle title={t('pools.editor.gone')} subtitle={t('pools.editor.gone.text')} />
        <Button onClick={() => navigate(POOLS_PATH, { replace: true })}>{t('pools.editor.gone.action')}</Button>
      </Screen>
    )
  }
  return <Editor key={id ?? 'new'} pool={pool} />
}

/* ------------------------------------------------------------------ the form */

interface Form {
  occasion: PoolOccasion | null
  name: string
  title: string
  /** Typed by hand: stop following "For whom or what?". */
  titleEdited: boolean
  mode: PoolMode
  amount: Minor | null
  members: string[]
  expectedCount: number | null
  deadline: string | null
  note: string
  showAmounts: boolean
  /** Switched by hand: stop following the mode's default. */
  showEdited: boolean
}

function initialForm(pool: Pool | null): Form {
  if (pool) {
    return {
      occasion: pool.occasion,
      name: '',
      title: pool.title,
      titleEdited: true,
      mode: pool.mode,
      amount: pool.mode === 'fixed' ? pool.perPerson : pool.target,
      members: [...pool.memberIds],
      expectedCount: pool.expectedCount,
      deadline: pool.deadline,
      note: pool.note ?? '',
      showAmounts: pool.showAmounts,
      showEdited: true,
    }
  }
  return {
    occasion: null,
    name: '',
    title: '',
    titleEdited: false,
    mode: 'fixed',
    amount: null,
    members: [],
    expectedCount: null,
    deadline: null,
    note: '',
    showAmounts: true,
    showEdited: false,
  }
}

function Editor({ pool }: { pool: Pool | null }) {
  const t = useT()
  const toast = useToast()
  const profile = useProfile()
  const day = today()
  const ids = { occasion: useId(), chips: useId(), people: useId(), when: useId(), to: useId() }
  const [form, setForm] = useState<Form>(() => initialForm(pool))
  const [dirty, setDirty] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [upiOpen, setUpiOpen] = useState(false)
  const isNew = pool === null
  const currency = pool?.currency ?? profile.currency
  const occasion = form.occasion

  useBackClose(dirty, () => setConfirming(true))
  useBackClose(confirming, () => setConfirming(false))

  const change = (patch: Partial<Form>): void => {
    setForm((current) => ({ ...current, ...patch }))
    setDirty(true)
  }

  const pick = (id: PoolOccasion): void => {
    const template = POOL_TEMPLATES[id]
    setForm((current) => ({
      ...current,
      occasion: id,
      mode: template.mode,
      title: current.titleEdited ? current.title : titleFor(id, current.name),
      showAmounts: current.showEdited ? current.showAmounts : template.mode === 'fixed',
    }))
    setDirty(true)
  }

  const leave = (): void => {
    if (dirty) setConfirming(true)
    else goBack(pool ? poolPath(pool.id) : POOLS_PATH)
  }

  if (occasion === null) {
    return (
      <Screen header={<TopBar onBack={leave} title={t('pools.editor.titleNew')} progress={{ current: 1, total: 2 }} />}>
        <h1 id={ids.occasion} className={styles.stepTitle} tabIndex={-1}>
          {t('pools.editor.occasion.heading')}
        </h1>
        <OccasionGrid value={null} onPick={pick} labelledBy={ids.occasion} />
        <DiscardSheet open={confirming} isNew onClose={() => setConfirming(false)} onDiscard={() => goBack(POOLS_PATH)} />
      </Screen>
    )
  }

  const template = POOL_TEMPLATES[occasion]
  const issue = poolFormIssue(form)
  const chips = occasionChips(occasion, currency)
  const takesName = occasionTakesName(occasion)
  const inr = currency === 'INR'

  const save = (): void => {
    if (issue) return
    let saved: Pool
    try {
      saved = savePool({
        id: pool?.id,
        title: form.title,
        occasion,
        emoji: pool?.occasion === occasion ? pool.emoji : template.emoji,
        currency,
        mode: form.mode,
        perPerson: form.mode === 'fixed' ? form.amount : null,
        target: form.mode === 'target' ? form.amount : null,
        memberIds: form.members,
        expectedCount: form.members.length === 0 ? form.expectedCount : null,
        deadline: form.deadline,
        note: form.note.trim() || null,
        showAmounts: form.showAmounts,
      })
    } catch (error) {
      if (!(error instanceof DataError)) throw error
      toast(error.message, { tone: 'error' })
      return
    }
    setDirty(false)
    if (isNew) {
      navigate(`${poolPath(saved.id)}?share=1`, { replace: true })
    } else {
      toast(t('pools.editor.saved'), { tone: 'success' })
      goBack(poolPath(saved.id))
    }
  }

  const modeOptions = [
    { value: 'fixed' as const, label: t('pools.editor.mode.fixed') },
    { value: 'target' as const, label: t('pools.editor.mode.target') },
  ]

  return (
    <Screen
      header={
        <TopBar
          onBack={leave}
          title={isNew ? t('pools.editor.titleNew') : t('pools.editor.titleEdit')}
          progress={isNew ? { current: 2, total: 2 } : undefined}
        />
      }
      footer={
        <ActionBar hint={issue ? t(issue) : undefined}>
          <Button block disabled={issue !== null} onClick={save}>
            {isNew ? t('pools.editor.create') : t('pools.editor.save')}
          </Button>
        </ActionBar>
      }
      contentClassName={styles.content}
    >
      <h1 className="visually-hidden" tabIndex={-1}>
        {isNew ? t('pools.editor.titleNew') : t('pools.editor.titleEdit')}
      </h1>

      <Card className={styles.occasion}>
        <PoolEmoji emoji={pool?.occasion === occasion ? pool.emoji : template.emoji} />
        <span className={styles.occasionLabel}>{occasionLabel(occasion)}</span>
        <Button
          variant="ghost"
          size="sm"
          iconStart={<Pencil />}
          aria-label={`${t('pools.editor.occasion.change')}: ${t('pools.editor.occasion.heading')}`}
          onClick={() => setForm((current) => ({ ...current, occasion: null }))}
        >
          {t('pools.editor.occasion.change')}
        </Button>
      </Card>

      <div className={styles.group}>
        {takesName && (
          <TextField
            label={t('pools.editor.forWhom')}
            value={form.name}
            placeholder={t('pools.editor.forWhom.placeholder')}
            maxLength={40}
            autoCapitalize="words"
            enterKeyHint="next"
            onChange={(event) => {
              const name = event.target.value
              change(form.titleEdited ? { name } : { name, title: titleFor(occasion, name) })
            }}
          />
        )}
        <TextField
          label={t('pools.editor.title')}
          value={form.title}
          maxLength={MAX_POOL_TITLE_LENGTH}
          autoCapitalize="sentences"
          enterKeyHint="next"
          onChange={(event) => change({ title: event.target.value, titleEdited: true })}
        />
      </div>

      <section className={styles.section} aria-labelledby={`${ids.chips}-how`}>
        <SectionHeader id={`${ids.chips}-how`} title={t('pools.editor.how')} />
        <SegmentedControl
          options={modeOptions}
          value={form.mode}
          ariaLabel={t('pools.editor.how')}
          onChange={(mode) => change(form.showEdited ? { mode } : { mode, showAmounts: mode === 'fixed' })}
        />
        <AmountHero
          value={form.amount}
          currency={currency}
          onChange={(amount) => change({ amount })}
          label={form.mode === 'fixed' ? t('pools.editor.each') : t('pools.editor.goal')}
          hint={form.mode === 'target' && template.hint === null ? t('pools.editor.goalHint') : undefined}
        />
        {form.mode === 'fixed' && chips.length > 0 && (
          <div role="radiogroup" aria-label={t('pools.editor.chips')} className={styles.chips}>
            {chips.map((chip) => (
              <Chip
                key={chip}
                role="radio"
                aria-checked={form.amount === chip}
                selected={form.amount === chip}
                onClick={() => change({ amount: chip })}
              >
                {money(chip, currency)}
              </Chip>
            ))}
          </div>
        )}
        {template.hint && <p className={styles.hint}>{t(template.hint as MessageKey)}</p>}
      </section>

      <section className={styles.section} aria-labelledby={ids.people}>
        <SectionHeader id={ids.people} title={t('pools.editor.who')} description={t('pools.editor.whoHint')} />
        <PeoplePicker selectedIds={form.members} includeMe={false} max={200} onChange={(members) => change({ members })} />
        {form.members.length === 0 &&
          (form.expectedCount === null ? (
            <Button
              variant="ghost"
              size="md"
              iconStart={<Users />}
              className={styles.inlineAction}
              onClick={() => change({ expectedCount: 10 })}
            >
              {t('pools.editor.about')}
            </Button>
          ) : (
            <div className={styles.about}>
              <Stepper
                label={t('pools.editor.about')}
                value={form.expectedCount}
                min={2}
                max={500}
                onChange={(expectedCount) => change({ expectedCount })}
                formatValue={(n) => t('pools.editor.people', { count: n })}
              />
              <Button variant="ghost" size="sm" onClick={() => change({ expectedCount: null })}>
                {t('pools.editor.aboutClear')}
              </Button>
            </div>
          ))}
      </section>

      <section className={styles.section} aria-labelledby={ids.when}>
        <SectionHeader id={ids.when} title={t('pools.editor.when')} />
        <div className={styles.chips}>
          <Chip selected={form.deadline === null} aria-pressed={form.deadline === null} onClick={() => change({ deadline: null })}>
            {t('pools.editor.noDeadline')}
          </Chip>
          {form.deadline === null && (
            <Chip leading={<CalendarPlus aria-hidden="true" />} onClick={() => change({ deadline: addDays(day, 7) })}>
              {t('pools.editor.addDeadline')}
            </Chip>
          )}
        </div>
        {form.deadline !== null && (
          <DateField
            label={t('pools.editor.deadline')}
            value={form.deadline}
            min={day}
            max={null}
            onChange={(deadline) => change({ deadline })}
          />
        )}
      </section>

      <TextField
        label={t('pools.editor.note')}
        value={form.note}
        placeholder={t('pools.editor.note.placeholder')}
        maxLength={MAX_POOL_NOTE_LENGTH}
        autoCapitalize="sentences"
        onChange={(event) => change({ note: event.target.value })}
      />

      <section className={styles.section} aria-labelledby={ids.to}>
        <SectionHeader id={ids.to} title={t('pools.editor.to')} />
        {!inr ? (
          <p className={styles.hint}>{t('pools.editor.to.notInr')}</p>
        ) : profile.upiId ? (
          <Card className={styles.upi}>
            <span className={styles.upiId}>{profile.upiId}</span>
            <Button variant="ghost" size="sm" onClick={() => setUpiOpen(true)} aria-label={`${t('pools.editor.to.change')} ${t('pools.editor.upiSheet')}`}>
              {t('pools.editor.to.change')}
            </Button>
          </Card>
        ) : (
          <>
            <Button variant="tonal" size="md" block onClick={() => setUpiOpen(true)}>
              {t('pools.editor.to.add')}
            </Button>
            <p className={styles.hint}>{t('pools.editor.to.skip', { name: profile.name.trim() || 'me' })}</p>
          </>
        )}
      </section>

      <Card padding="none">
        <Switch
          checked={form.showAmounts}
          onChange={(showAmounts) => change({ showAmounts, showEdited: true })}
          label={t('pools.editor.show')}
          description={form.showAmounts ? t('pools.editor.show.fixed') : t('pools.editor.show.target')}
        />
      </Card>

      <BottomSheet open={upiOpen} onClose={() => setUpiOpen(false)} title={t('pools.editor.upiSheet')} description={t('pools.editor.upiSheet.text')}>
        <UpiIdForm
          ownerId="me"
          ownerName={profile.name}
          autoFocus
          onSave={(upiId) => {
            updateProfile({ upiId })
            setUpiOpen(false)
          }}
        />
      </BottomSheet>
      <DiscardSheet
        open={confirming}
        isNew={isNew}
        onClose={() => setConfirming(false)}
        onDiscard={() => {
          setDirty(false)
          goBack(pool ? poolPath(pool.id) : POOLS_PATH)
        }}
      />
    </Screen>
  )
}

function DiscardSheet({ open, onClose, onDiscard }: { open: boolean; isNew: boolean; onClose: () => void; onDiscard: () => void }) {
  const t = useT()
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('pools.editor.discard.title')}
      description={t('pools.editor.discard.text')}
      footer={
        <div className={styles.confirm}>
          <Button
            variant="danger"
            block
            onClick={() => {
              onClose()
              onDiscard()
            }}
          >
            {t('pools.editor.discard.yes')}
          </Button>
          <Button variant="secondary" block onClick={onClose}>
            {t('pools.editor.discard.no')}
          </Button>
        </div>
      }
    />
  )
}
