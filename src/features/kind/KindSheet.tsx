import { useId, useMemo, useState } from 'react'
import { AmountInput, BottomSheet, Button, Chip, TextField, useToast } from '../../components'
import { useExpenses, useFriend, useGroups, useProfile } from '../../data'
import { ME_ID, type Minor } from '../../domain/types'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { DateField, friendLabel } from '../../kit/index-a'
import { haptic } from '../../lib/haptics'
import { commaIsDecimal, formatMoney, parseMoneyInput, toInputString } from '../../lib/money'
import { firstName } from '../../share/text'
import { friendBalance } from '../friends/friendBalance'
import { KIND_WHATS, kindIssue, kindOpen, MAX_KIND_TEXT, type KindIssue, type KindOpen, type KindWhat } from './engine'
import { kindChipLabel } from './kindText'
import { recordKind } from './record'
import styles from './Kind.module.css'

export interface KindSheetProps {
  friendId: string
  open: boolean
  onClose: () => void
}

interface Form {
  currency: string
  /** The amount as typed. */
  amount: string
  what: KindWhat | null
  text: string
  date: string
  /** Settle was tapped with something missing: say what. */
  tried: boolean
}

function freshForm(first: KindOpen | undefined): Form {
  return {
    currency: first?.currency ?? 'INR',
    amount: first ? toInputString(first.amount, first.currency, { trimZeros: true }) : '',
    what: null,
    text: '',
    date: today(),
    tried: false,
  }
}

function sameOpen(a: readonly KindOpen[], b: readonly KindOpen[]): boolean {
  return a.length === b.length && a.every((x, i) => x.currency === b[i]?.currency && x.amount === b[i]?.amount && x.direction === b[i]?.direction)
}

/**
 * Settle what one of you owes the other with something that isn't money: how much (all of it to
 * start with), what it was, and when. Recorded as a real payment (method "other") with the note
 * kept beside it; Undo puts everything back. Nothing open between you: renders nothing.
 */
export function KindSheet({ friendId, open, onClose }: KindSheetProps) {
  const t = useT()
  const toast = useToast()
  const whatLabelId = useId()
  const profile = useProfile()
  const friend = useFriend(friendId)
  const expenses = useExpenses()
  const groups = useGroups()
  const live = useMemo(
    () => (friendId === ME_ID ? [] : kindOpen(friendBalance(friendId, expenses, groups, profile.currency))),
    [friendId, expenses, groups, profile.currency],
  )
  // What was open stays on show while the sheet slides away after settling it.
  const [kept, setKept] = useState<readonly KindOpen[]>(live)
  if (live.length > 0 && !sameOpen(live, kept)) setKept(live)
  const opens = live.length > 0 ? live : kept

  const [form, setForm] = useState<Form>(() => freshForm(live[0]))
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setForm(freshForm(live[0]))
  }

  const current = opens.find((o) => o.currency === form.currency) ?? opens[0]
  if (!current) return null

  const name = firstName(friendLabel(friendId, friend))
  const money = (minor: Minor): string => formatMoney(minor, current.currency, { trimZeros: true })
  const amount = parseMoneyInput(form.amount, current.currency)
  const issue: KindIssue | null = kindIssue({ amount, what: form.what, text: form.text }, current.amount)
  const shownIssue = form.tried || issue === 'over' ? issue : null
  const part = amount !== null && amount > 0 && amount < current.amount

  const pickCurrency = (next: KindOpen): void => {
    setForm((f) => ({ ...f, currency: next.currency, amount: toInputString(next.amount, next.currency, { trimZeros: true }), tried: false }))
  }

  const submit = (): void => {
    if (issue !== null || amount === null || form.what === null) {
      haptic('warning')
      setForm((f) => ({ ...f, tried: true }))
      return
    }
    const recorded = recordKind({
      friendId,
      direction: current.direction,
      amount,
      currency: current.currency,
      what: form.what,
      text: form.text,
      date: form.date,
    })
    if (!recorded) {
      haptic('error')
      toast(t('kind.toast.failed'), { tone: 'error' })
      onClose()
      return
    }
    haptic('success')
    const vars = { amount: money(recorded.entry.amount), name, left: money(recorded.left) }
    toast(recorded.left > 0 ? t('kind.toast.part', vars) : t('kind.toast.all', vars), {
      tone: 'success',
      action: { label: t('common.action.undo'), onAction: recorded.undo },
    })
    onClose()
  }

  return (
    <BottomSheet
      open={open && live.length > 0}
      onClose={onClose}
      title={t('kind.sheet.title')}
      description={t(current.direction === 'in' ? 'kind.sheet.body.in' : 'kind.sheet.body.out', { name, amount: money(current.amount) })}
      footer={
        <Button block onClick={submit}>
          {amount !== null && amount > 0 && issue !== 'over' ? t('kind.cta', { amount: money(amount) }) : t('kind.cta.empty')}
        </Button>
      }
    >
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        {opens.length > 1 && (
          <div className={styles.chips} role="group" aria-label={t('kind.currency.aria')}>
            {opens.map((o) => (
              <Chip key={o.currency} size="lg" selected={o.currency === current.currency} onClick={() => pickCurrency(o)}>
                {t(o.direction === 'in' ? 'kind.currency.in' : 'kind.currency.out', { amount: formatMoney(o.amount, o.currency, { trimZeros: true }) })}
              </Chip>
            ))}
          </div>
        )}

        <AmountInput
          size="field"
          label={t('kind.amount.label')}
          currency={current.currency}
          value={form.amount}
          onChange={(text) => setForm((f) => ({ ...f, amount: text }))}
          commaGroups={!commaIsDecimal(current.currency)}
          enterKeyHint="done"
          hint={part && amount !== null ? t('kind.amount.hint.part', { left: money(current.amount - amount) }) : t('kind.amount.hint.all')}
          error={
            shownIssue === 'amount' ? t('kind.error.amount') : shownIssue === 'over' ? t('kind.error.over', { amount: money(current.amount) }) : undefined
          }
        />

        <div className={styles.field}>
          <p className={styles.label} id={whatLabelId}>
            {t('kind.what.label')}
          </p>
          <div className={styles.chips} role="group" aria-labelledby={whatLabelId}>
            {KIND_WHATS.map((what) => (
              <Chip key={what} size="lg" selected={form.what === what} onClick={() => setForm((f) => ({ ...f, what: f.what === what ? null : what }))}>
                {kindChipLabel(what, current.direction)}
              </Chip>
            ))}
          </div>
          {shownIssue === 'what' && (
            <p className={styles.error} role="alert">
              {t('kind.error.what')}
            </p>
          )}
        </div>

        {form.what === 'other' && (
          <TextField
            label={t('kind.text.label')}
            placeholder={t('kind.text.placeholder')}
            value={form.text}
            maxLength={MAX_KIND_TEXT}
            onChange={(event) => setForm((f) => ({ ...f, text: event.target.value }))}
            error={shownIssue === 'text' ? t('kind.error.text') : undefined}
            enterKeyHint="done"
          />
        )}

        <div className={styles.row}>
          <span className={styles.label}>{t('kind.date.label')}</span>
          <DateField label={t('kind.date.aria')} value={form.date} onChange={(date) => setForm((f) => ({ ...f, date }))} />
        </div>

        <p className={styles.fine}>{t('kind.fine')}</p>
      </form>
    </BottomSheet>
  )
}
