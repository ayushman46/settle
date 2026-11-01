import { useId, useState, type ReactNode } from 'react'
import { CalendarPlus, Check, ChevronDown, Landmark, ScanText, Store } from 'lucide-react'
import { goBack, navigate, useRoute, useSearchParams } from '../../app/router'
import { ActionBar, Banner, Button, Chip, PageTitle, Screen, SectionHeader, Switch, TextField, TopBar, useToast } from '../../components'
import { useStore } from '../../data'
import { stuckStore, type StuckKind, type StuckPayment, type StuckRail } from '../../data/stores'
import { addStuck, deleteStuck, updateStuck, type StuckDraft } from '../../data/stuck'
import type { Minor } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { useT, type MessageKey } from '../../i18n'
import { AmountHero, DateField } from '../../kit/index-a'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { shortDate } from '../recurring/recurringLabels'
import { MERCHANTS, merchantById } from './merchants'
import { STUCK_PATH, stuckPath } from './paths'
import { takeStuckPrefill, type StuckPrefill } from './prefill'
import { dueBy, RAIL_RULES } from './rules'
import { COMMON_RAILS, POPULAR_MERCHANTS, RAIL_ORDER, railDays, railLabel } from './view'
import styles from './Stuck.module.css'

const ROUTES = ['/app/stuck/new', '/app/stuck/:id/edit'] as const

/**
 * `/app/stuck/new` (and `/app/stuck/:id/edit`) — add money that's stuck: what it is (a failed
 * payment that took the money, or a refund that hasn't come), how much, and the few details that
 * set its deadline — how it was paid (the RBI's deadline shows as you pick) or which business owes
 * it (its own timeline, or the day it promised). Opened from a pasted or shared message, it's
 * filled in already. `?kind=failed|refund` picks the kind. Save opens its page.
 */
export function StuckAddScreen() {
  const t = useT()
  const { params } = useRoute(ROUTES)
  const id = params.id ?? null
  const existing = useStore(stuckStore, (all) => (id ? (all.find((s) => s.id === id) ?? null) : null))
  if (id !== null && !existing) {
    return (
      <Screen header={<TopBar onBack={() => goBack(STUCK_PATH)} />}>
        <PageTitle title={t('stuck.detail.gone')} subtitle={t('stuck.detail.gone.text')} />
        <Button onClick={() => navigate(STUCK_PATH, { replace: true })}>{t('stuck.detail.gone.cta')}</Button>
      </Screen>
    )
  }
  return <Editor key={id ?? 'new'} existing={existing} />
}

interface Form {
  kind: StuckKind | null
  amount: Minor | null
  date: string
  rail: StuckRail | null
  party: string
  /** A business Settle knows (refunds), or null for "someone else". */
  merchant: string | null
  /** "Someone else" picked for a refund. */
  other: boolean
  ref: string
  orderId: string
  promisedBy: string | null
  confirmed: boolean
}

/** What the form starts with: the payment being edited, a hand-off, or a blank (with `?kind=`). */
function initialForm(existing: StuckPayment | null, prefill: StuckPrefill | null, kind: StuckKind | null, day: string): Form {
  const from = existing ?? prefill ?? {}
  const merchant = from.merchant ?? null
  const known = merchantById(merchant) !== null
  const resolvedKind = from.kind ?? kind
  return {
    kind: resolvedKind,
    amount: from.amount ?? null,
    date: from.date ?? day,
    rail: from.rail ?? null,
    party: from.party ?? '',
    merchant: known ? merchant : null,
    other: resolvedKind === 'refund' && !known && (from.party ?? '').trim() !== '',
    ref: from.ref ?? '',
    orderId: from.orderId ?? '',
    promisedBy: from.promisedBy ?? null,
    confirmed: from.confirmed ?? true,
  }
}

/** Why it can't be saved yet, or null. */
function formIssue(form: Form): MessageKey | null {
  if (form.kind === null) return 'stuck.add.issue.kind'
  if (form.amount === null || form.amount <= 0) return 'stuck.add.issue.amount'
  if (form.kind === 'refund' && (form.other ? form.party.trim() === '' : form.merchant === null)) return 'stuck.add.issue.business'
  return null
}

function Editor({ existing }: { existing: StuckPayment | null }) {
  const t = useT()
  const toast = useToast()
  const query = useSearchParams()
  const day = todayIso()
  const ids = { kind: useId(), how: useId(), who: useId() }
  const [prefill] = useState(() => (existing ? null : takeStuckPrefill()))
  const queryKind = query.get('kind')
  const [form, setForm] = useState<Form>(() =>
    initialForm(existing, prefill, queryKind === 'failed' || queryKind === 'refund' ? queryKind : null, day),
  )
  // A message that didn't say the money left: ask, instead of assuming.
  const [askConfirmed] = useState(() => prefill?.confirmed === false)
  const [moreRails, setMoreRails] = useState(() => form.rail !== null && !COMMON_RAILS.includes(form.rail))
  const isNew = existing === null
  const issue = formIssue(form)
  const change = (patch: Partial<Form>): void => setForm((current) => ({ ...current, ...patch }))

  const leave = (): void => {
    if (existing) goBack(stuckPath(existing.id))
    else goBack(STUCK_PATH)
  }

  const save = (): void => {
    if (issue || form.kind === null || form.amount === null) return
    const refund = form.kind === 'refund'
    const merchant = refund ? form.merchant : (existing?.merchant ?? prefill?.merchant ?? null)
    const party = refund && form.merchant !== null && !form.other ? (merchantById(form.merchant)?.name ?? null) : form.party.trim() || null
    const fields = {
      kind: form.kind,
      rail: refund ? null : form.rail,
      party,
      merchant,
      amount: form.amount,
      date: form.date,
      promisedBy: refund ? form.promisedBy : null,
      ref: form.ref.trim() || null,
      orderId: refund ? form.orderId.trim() || null : null,
      confirmed: refund ? true : form.confirmed,
    }
    haptic('success')
    if (existing) {
      const undo = updateStuck(existing.id, fields)
      toast(t('stuck.edit.saved'), { tone: 'success', action: undo ? { label: t('common.action.undo'), onAction: undo } : undefined })
      goBack(stuckPath(existing.id))
      return
    }
    const draft: StuckDraft = {
      ...fields,
      bank: prefill?.bank ?? null,
      account: prefill?.account ?? null,
      app: prefill?.app ?? null,
      source: prefill?.source ?? 'manual',
    }
    const saved = addStuck(draft)
    navigate(stuckPath(saved.id), { replace: true })
    toast(t('stuck.add.saved'), { tone: 'success', action: { label: t('common.action.undo'), onAction: () => void deleteStuck(saved.id) } })
  }

  const title = isNew ? t('stuck.add.title') : t('stuck.edit.title')

  return (
    <Screen
      header={<TopBar onBack={leave} title={title} />}
      footer={
        <ActionBar hint={issue && form.kind !== null ? t(issue) : undefined}>
          <Button block disabled={issue !== null} onClick={save}>
            {isNew ? t('stuck.add.save') : t('common.action.save')}
          </Button>
        </ActionBar>
      }
      contentClassName={styles.content}
    >
      <PageTitle title={isNew ? t('stuck.add.heading') : t('stuck.edit.title')} id={ids.kind} />

      {prefill && (
        <Banner tone="info" icon={<ScanText />}>
          {prefill.source === 'screenshot' ? t('stuck.add.fromShot') : t('stuck.add.fromMessage')}
        </Banner>
      )}

      <div role="radiogroup" aria-labelledby={ids.kind} className={styles.tiles}>
        <OptionTile
          selected={form.kind === 'failed'}
          icon={<Landmark />}
          title={t('stuck.add.kind.failed')}
          caption={t('stuck.add.kind.failed.text')}
          onClick={() => change({ kind: 'failed' })}
        />
        <OptionTile
          selected={form.kind === 'refund'}
          icon={<Store />}
          title={t('stuck.add.kind.refund')}
          caption={t('stuck.add.kind.refund.text')}
          onClick={() => change({ kind: 'refund' })}
        />
      </div>

      {form.kind !== null && (
        <>
          <AmountHero value={form.amount} currency="INR" onChange={(amount) => change({ amount })} label={t('stuck.add.amount')} />

          {form.kind === 'failed' ? (
            <>
              <section className={styles.formSection} aria-labelledby={ids.how}>
                <SectionHeader id={ids.how} title={t('stuck.add.how')} />
                <div role="radiogroup" aria-labelledby={ids.how} className={styles.railGrid}>
                  {(moreRails ? RAIL_ORDER : COMMON_RAILS).map((rail) => (
                    <RailTile key={rail} rail={rail} selected={form.rail === rail} onClick={() => change({ rail })} />
                  ))}
                  <RailTile rail={null} selected={form.rail === null} onClick={() => change({ rail: null })} />
                </div>
                {!moreRails && (
                  <Button variant="ghost" size="sm" iconEnd={<ChevronDown />} className={styles.moreRails} onClick={() => setMoreRails(true)}>
                    {t('stuck.add.moreWays')}
                  </Button>
                )}
                <p className={styles.ruleLine}>{ruleLine(form, t)}</p>
              </section>

              <TextField
                label={t('stuck.add.to')}
                value={form.party}
                placeholder={t('stuck.add.to.placeholder')}
                maxLength={120}
                autoCapitalize="words"
                enterKeyHint="next"
                onChange={(event) => change({ party: event.target.value })}
              />

              <div className={styles.dateRow}>
                <span className={styles.dateLabel}>{t('stuck.add.date.failed')}</span>
                <DateField label={t('stuck.add.date.failed')} value={form.date} onChange={(date) => change({ date })} />
              </div>

              <TextField
                label={t('stuck.add.ref')}
                value={form.ref}
                maxLength={40}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                hint={t('stuck.add.ref.hint')}
                onChange={(event) => change({ ref: event.target.value })}
              />

              {askConfirmed && (
                <div className={styles.switchCard}>
                  <Switch
                    checked={form.confirmed}
                    onChange={(confirmed) => change({ confirmed })}
                    label={t('stuck.add.confirmed')}
                    description={t('stuck.add.confirmed.text')}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <section className={styles.formSection} aria-labelledby={ids.who}>
                <SectionHeader id={ids.who} title={t('stuck.add.who')} />
                <div role="radiogroup" aria-labelledby={ids.who} className={styles.chips}>
                  {merchantChoices(form.merchant).map((m) => (
                    <Chip
                      key={m.id}
                      role="radio"
                      aria-checked={form.merchant === m.id && !form.other}
                      selected={form.merchant === m.id && !form.other}
                      onClick={() => change({ merchant: m.id, other: false })}
                    >
                      {m.name}
                    </Chip>
                  ))}
                  <Chip role="radio" aria-checked={form.other} selected={form.other} onClick={() => change({ merchant: null, other: true })}>
                    {t('stuck.add.who.other')}
                  </Chip>
                </div>
                {form.other && (
                  <TextField
                    label={t('stuck.add.who.name')}
                    value={form.party}
                    placeholder={t('stuck.add.who.placeholder')}
                    maxLength={120}
                    autoCapitalize="words"
                    autoFocus
                    onChange={(event) => change({ party: event.target.value })}
                  />
                )}
              </section>

              <div className={styles.dateRow}>
                <span className={styles.dateLabel}>{t('stuck.add.date.refund')}</span>
                <DateField label={t('stuck.add.date.refund')} value={form.date} onChange={(date) => change({ date })} />
              </div>

              <section className={styles.formSection} aria-label={t('stuck.add.promised')}>
                <p className={styles.dateLabel}>{t('stuck.add.promised')}</p>
                <div className={styles.chips}>
                  <Chip selected={form.promisedBy === null} onClick={() => change({ promisedBy: null })}>
                    {t('stuck.add.promised.none')}
                  </Chip>
                  {form.promisedBy === null ? (
                    <Chip leading={<CalendarPlus />} onClick={() => change({ promisedBy: dueBy({ kind: 'refund', rail: null, date: form.date, promisedBy: null, merchant: form.merchant }) })}>
                      {t('stuck.add.promised.add')}
                    </Chip>
                  ) : (
                    <DateField label={t('stuck.add.promised.label')} value={form.promisedBy} min={form.date} max={null} onChange={(promisedBy) => change({ promisedBy })} />
                  )}
                </div>
                <p className={styles.ruleLine}>{ruleLine(form, t)}</p>
              </section>

              <TextField
                label={t('stuck.add.order')}
                value={form.orderId}
                maxLength={60}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) => change({ orderId: event.target.value })}
              />
            </>
          )}
        </>
      )}
    </Screen>
  )
}

/** The businesses to offer: the popular ones, with the one already picked first if it isn't among them. */
function merchantChoices(picked: string | null) {
  const ids = picked && !POPULAR_MERCHANTS.includes(picked) ? [picked, ...POPULAR_MERCHANTS] : POPULAR_MERCHANTS
  return ids.map((id) => MERCHANTS.find((m) => m.id === id)).filter((m) => m !== undefined)
}

/** "Due back by 29 Oct under the RBI's rules. After that, your bank owes you ₹100 a day." */
function ruleLine(form: Form, t: ReturnType<typeof useT>): string {
  const due = shortDate(dueBy({ kind: form.kind ?? 'failed', rail: form.rail, date: form.date, promisedBy: form.promisedBy, merchant: form.merchant }))
  if (form.kind === 'refund') {
    if (form.promisedBy) return t('stuck.add.rule.promised', { date: due })
    const merchant = merchantById(form.merchant)
    return merchant ? t('stuck.add.rule.merchant', { date: due, name: merchant.name, count: merchant.workingDays }) : t('stuck.add.rule.refund', { date: due })
  }
  return form.rail ? t('stuck.add.rule.failed', { date: due }) : t('stuck.add.rule.unknown', { date: due })
}

function OptionTile({ selected, icon, title, caption, onClick }: { selected: boolean; icon: ReactNode; title: string; caption: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={cx(styles.option, selected && styles.optionOn)}
      onClick={() => {
        haptic('select')
        onClick()
      }}
    >
      <span className={styles.optionIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.optionText}>
        <span className={styles.optionTitle}>{title}</span>
        <span className={styles.optionCaption}>{caption}</span>
      </span>
      <span className={styles.optionCheck} aria-hidden="true">
        {selected && <Check strokeWidth={3} />}
      </span>
    </button>
  )
}

function RailTile({ rail, selected, onClick }: { rail: StuckRail | null; selected: boolean; onClick: () => void }) {
  const t = useT()
  const days = rail ? RAIL_RULES[rail].days : railDays(null)
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={cx(styles.rail, selected && styles.railOn)}
      onClick={() => {
        haptic('select')
        onClick()
      }}
    >
      <span className={styles.railName}>{railLabel(rail)}</span>{' '}
      <span className={styles.railDays}>{rail ? t('stuck.rail.back', { count: days }) : t('stuck.rail.unknownBack', { count: days })}</span>
    </button>
  )
}
