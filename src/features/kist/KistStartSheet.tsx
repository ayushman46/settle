import { useMemo, useState } from 'react'
import { CalendarClock, HandCoins } from 'lucide-react'
import { navigate } from '../../app/router'
import { AmountInput, BottomSheet, Button, Chip, EmptyState, SegmentedControl, Stepper, useToast } from '../../components'
import { useExpenses, useFriend, useGroups, useProfile } from '../../data'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { DateField, friendLabel } from '../../kit/index-a'
import { haptic } from '../../lib/haptics'
import { commaIsDecimal, formatMoney, parseMoneyInput, toInputString } from '../../lib/money'
import { firstName } from '../../share/text'
import { friendBalance } from '../friends/friendBalance'
import { deletePlan, startPlan, unitOf } from './actions'
import { DEFAULT_PARTS, defaultFirstDue, draftParts, MIN_PARTS, mostParts, planLeft, type KistEvery } from './engine'
import { kistPlanPath } from './paths'
import { runningPlanWith, usePlans } from './store'
import { dayLabel } from './text'
import styles from './Kist.module.css'

export interface KistStartSheetProps {
  friendId: string
  open: boolean
  onClose: () => void
}

interface Form {
  currency: string | null
  /** null = the amount owed, as prefilled. */
  text: string | null
  count: number
  every: KistEvery
  /** null = the usual first date for `every`. */
  first: string | null
  /** Start was tapped with something missing: say what. */
  tried: boolean
}

const FRESH: Form = { currency: null, text: null, count: DEFAULT_PARTS, every: 'month', first: null, tried: false }

/**
 * Starts a plan to pay in parts with one friend. Everything is filled in already: the amount is
 * what is owed between the two of you (whichever way it goes), three parts, monthly from the next
 * 1st. The schedule is on show before anything is saved. Null for someone who is not in your people.
 */
export function KistStartSheet({ friendId, open, onClose }: KistStartSheetProps) {
  const t = useT()
  const toast = useToast()
  const friend = useFriend(friendId)
  const profile = useProfile()
  const expenses = useExpenses()
  const groups = useGroups()
  const plans = usePlans()
  const [form, setForm] = useState<Form>(FRESH)
  const [day, setDay] = useState(() => todayIso())
  // Fresh choices (and today's date) each time the sheet opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setForm(FRESH)
      setDay(todayIso())
    }
  }
  const balance = useMemo(() => friendBalance(friendId, expenses, groups, profile.currency), [friendId, expenses, groups, profile.currency])
  if (!friend) return null

  const name = firstName(friendLabel(friend.id, friend))
  const running = runningPlanWith(friend.id, plans)
  const total = balance.totals.find((c) => c.currency === form.currency) ?? balance.totals[0] ?? null

  if (running) {
    return (
      <BottomSheet open={open} onClose={onClose} title={t('kist.sheet.title')}>
        <EmptyState
          size="sm"
          icon={<CalendarClock />}
          title={t('kist.sheet.has.title', { name })}
          text={t('kist.sheet.has.body', { left: formatMoney(planLeft(running), running.currency, { trimZeros: true }) })}
          action={
            <Button
              onClick={() => {
                onClose()
                navigate(kistPlanPath(running.id))
              }}
            >
              {t('kist.sheet.has.cta')}
            </Button>
          }
        />
      </BottomSheet>
    )
  }

  if (!total) {
    return (
      <BottomSheet open={open} onClose={onClose} title={t('kist.sheet.title')}>
        <EmptyState
          size="sm"
          icon={<HandCoins />}
          title={t('kist.sheet.none.title', { name })}
          text={t('kist.sheet.none.body')}
          action={
            <Button
              onClick={() => {
                onClose()
                navigate('/app/lend')
              }}
            >
              {t('kist.sheet.none.cta')}
            </Button>
          }
        />
      </BottomSheet>
    )
  }

  const currency = total.currency
  const direction = total.amount > 0 ? 'receive' : 'pay'
  const owed = Math.abs(total.amount)
  const unit = unitOf(currency)
  const money = (minor: number): string => formatMoney(minor, currency, { trimZeros: true })
  const text = form.text ?? toInputString(owed, currency, { trimZeros: true })
  const amount = parseMoneyInput(text, currency)
  const issue =
    amount === null || amount <= 0
      ? t('kist.sheet.amount.missing')
      : amount > owed
        ? t('kist.sheet.amount.over', { amount: money(owed) })
        : amount < MIN_PARTS * unit
          ? t('kist.sheet.amount.small')
          : null
  const most = amount !== null && issue === null ? mostParts(amount, unit) : mostParts(owed, unit)
  const count = Math.max(MIN_PARTS, Math.min(form.count, most))
  const first = form.first ?? defaultFirstDue(day, form.every)
  const preview = amount !== null && issue === null ? draftParts(amount, count, first, form.every, unit) : []

  const save = (): void => {
    if (amount === null || issue !== null || preview.length === 0) {
      setForm((f) => ({ ...f, tried: true }))
      haptic('warning')
      return
    }
    const plan = startPlan({ friendId: friend.id, direction, currency, every: form.every, total: amount, count, first })
    if (!plan) {
      setForm((f) => ({ ...f, tried: true }))
      return
    }
    haptic('success')
    onClose()
    navigate(kistPlanPath(plan.id))
    toast(t('kist.started.toast', { name }), {
      tone: 'success',
      action: { label: t('common.action.undo'), onAction: () => void deletePlan(plan.id) },
    })
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('kist.sheet.title')}
      description={direction === 'pay' ? t('kist.sheet.pay', { name, amount: money(owed) }) : t('kist.sheet.receive', { name, amount: money(owed) })}
      size="tall"
      footer={
        <Button block onClick={save}>
          {t('kist.sheet.save')}
        </Button>
      }
    >
      <div className={styles.sheet}>
        {balance.totals.length > 1 && (
          <section className={styles.block} aria-labelledby="kist-currency">
            <h3 id="kist-currency" className={styles.label}>
              {t('kist.sheet.currency.label')}
            </h3>
            <div className={styles.chips} role="group" aria-labelledby="kist-currency">
              {balance.totals.map((c) => (
                <Chip key={c.currency} size="lg" selected={c.currency === currency} onClick={() => setForm({ ...FRESH, currency: c.currency })}>
                  {formatMoney(Math.abs(c.amount), c.currency, { trimZeros: true })}
                </Chip>
              ))}
            </div>
          </section>
        )}
        <AmountInput
          size="field"
          label={t('kist.sheet.amount.label')}
          currency={currency}
          value={text}
          onChange={(next) => setForm((f) => ({ ...f, text: next, tried: false }))}
          commaGroups={!commaIsDecimal(currency)}
          enterKeyHint="done"
          error={issue !== null && (form.tried || (amount !== null && amount > 0)) ? issue : undefined}
        />
        <div className={styles.fieldRow}>
          <span id="kist-parts" className={styles.label}>
            {t('kist.sheet.parts.label')}
          </span>
          <Stepper
            size="md"
            label={t('kist.sheet.parts.label')}
            value={count}
            min={MIN_PARTS}
            max={Math.max(MIN_PARTS, most)}
            onChange={(next) => setForm((f) => ({ ...f, count: next }))}
          />
        </div>
        <SegmentedControl
          ariaLabel={t('kist.sheet.every.label')}
          value={form.every}
          onChange={(every) => setForm((f) => ({ ...f, every, first: null }))}
          options={[
            { value: 'month', label: t('kist.sheet.every.month') },
            { value: 'week', label: t('kist.sheet.every.week') },
          ]}
        />
        <div className={styles.fieldRow}>
          <span className={styles.label}>{t('kist.sheet.first.label')}</span>
          <DateField label={t('kist.sheet.first.label')} value={first} min={day} max={null} onChange={(next) => setForm((f) => ({ ...f, first: next }))} />
        </div>
        {preview.length > 0 && (
          <section className={styles.block} aria-labelledby="kist-preview">
            <h3 id="kist-preview" className={styles.label}>
              {t('kist.sheet.schedule')}
            </h3>
            <ol className={styles.preview} aria-labelledby="kist-preview">
              {preview.map((p, i) => (
                <li key={p.due} className={styles.previewRow}>
                  <span>{`${t('kist.part.name', { part: i + 1 })} · ${dayLabel(p.due, day)}`}</span>
                  <span>{money(p.amount)}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </BottomSheet>
  )
}
