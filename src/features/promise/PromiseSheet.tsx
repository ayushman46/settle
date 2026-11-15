import { useMemo, useState } from 'react'
import { CalendarCheck, MessageCircle, Share2 } from 'lucide-react'
import { AmountInput, Banner, BottomSheet, Button, Card, Chip, EmptyState, useToast } from '../../components'
import { useExpenses, useFriend, useGroups, useProfile } from '../../data'
import { useT } from '../../i18n'
import { DateField, friendLabel } from '../../kit/index-a'
import { haptic } from '../../lib/haptics'
import { commaIsDecimal, formatMoney, parseMoneyInput, toInputString } from '../../lib/money'
import { shareResult } from '../../lib/share'
import { whatsappUrl } from '../../share/links'
import { firstName } from '../../share/text'
import { friendBalance } from '../friends/friendBalance'
import { dayLabel } from '../kist/text'
import { notePromise, openPromiseWith, removePromise } from './actions'
import { defaultDue, quickDates, type PromiseEntry, type QuickDate } from './engine'
import { usePromises } from './store'
import { promiseMessage } from './text'
import { usePromiseViews } from './usePromiseViews'
import styles from './Promise.module.css'

export interface PromiseSheetProps {
  friendId: string
  open: boolean
  onClose: () => void
}

interface Form {
  currency: string | null
  /** null = all that is owed (or the open promise's amount), as prefilled. */
  text: string | null
  /** null = the open promise's date, or the coming Friday. */
  due: string | null
  /** Save was tapped with something missing: say what. */
  tried: boolean
}

const FRESH: Form = { currency: null, text: null, due: null, tried: false }

const QUICK_LABEL = {
  tomorrow: 'promise.sheet.when.tomorrow',
  friday: 'promise.sheet.when.friday',
  first: 'promise.sheet.when.first',
} as const satisfies Record<QuickDate, string>

/**
 * A date on what is owed between you and one friend. Who is promising follows who owes whom; the
 * amount starts as all of it; the date is one tap (tomorrow, Friday, the 1st) or any day. Saving
 * offers the message to send. An open promise with the same friend is changed, not doubled. Null
 * for someone who is not in your people.
 */
export function PromiseSheet({ friendId, open, onClose }: PromiseSheetProps) {
  const t = useT()
  const toast = useToast()
  const friend = useFriend(friendId)
  const profile = useProfile()
  const expenses = useExpenses()
  const groups = useGroups()
  const promises = usePromises()
  const { views, today } = usePromiseViews(promises)
  const [form, setForm] = useState<Form>(FRESH)
  const [saved, setSaved] = useState<PromiseEntry | null>(null)
  // Fresh choices each time the sheet opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setForm(FRESH)
      setSaved(null)
    }
  }
  const balance = useMemo(() => friendBalance(friendId, expenses, groups, profile.currency), [friendId, expenses, groups, profile.currency])
  if (!friend) return null

  const name = firstName(friendLabel(friend.id, friend))
  const share = async (text: string): Promise<void> => {
    const outcome = await shareResult(text, { title: t('promise.share.title') })
    if (outcome === 'copied') toast(t('promise.share.copied'), { tone: 'success' })
    else if (outcome === 'failed') toast(t('promise.share.failed'), { tone: 'error' })
  }

  if (saved) {
    const mine = saved.direction === 'pay'
    const vars = { name, amount: formatMoney(saved.amount, saved.currency, { trimZeros: true }), date: dayLabel(saved.due, today, 'long') }
    const message = promiseMessage(saved, today)
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={t('promise.sheet.title')}
        footer={
          <Button block variant="secondary" onClick={onClose}>
            {t('promise.saved.done')}
          </Button>
        }
      >
        <div className={styles.sheet}>
          <Banner tone="success" title={t(mine ? 'promise.saved.title.mine' : 'promise.saved.title.theirs', vars)}>
            {t('promise.saved.body')}
          </Banner>
          <section className={styles.block} aria-labelledby="promise-message">
            <h3 id="promise-message" className={styles.label}>
              {t('promise.saved.message.label', { name })}
            </h3>
            <Card tone="sunken">
              <p className={styles.message}>{message}</p>
            </Card>
          </section>
          <div className={styles.actions}>
            <Button block iconStart={<MessageCircle />} onClick={() => window.open(whatsappUrl(message, friend.phone), '_blank', 'noopener,noreferrer')}>
              {t('promise.saved.whatsapp')}
            </Button>
            <Button block variant="ghost" size="md" iconStart={<Share2 />} onClick={() => void share(message)}>
              {t('promise.saved.share')}
            </Button>
          </div>
        </div>
      </BottomSheet>
    )
  }

  const existing = openPromiseWith(friend.id, views)?.promise ?? null
  const total = balance.totals.find((c) => c.currency === (form.currency ?? existing?.currency)) ?? balance.totals[0] ?? null

  if (!total) {
    return (
      <BottomSheet open={open} onClose={onClose} title={t('promise.sheet.title')}>
        <EmptyState size="sm" icon={<CalendarCheck />} title={t('promise.sheet.none.title', { name })} text={t('promise.sheet.none.body')} />
      </BottomSheet>
    )
  }

  const currency = total.currency
  const direction = total.amount > 0 ? 'receive' : 'pay'
  const mine = direction === 'pay'
  const owed = Math.abs(total.amount)
  // The open promise is only carried over when it still points the same way, in the same money.
  const carried = existing && existing.currency === currency && existing.direction === direction ? existing : null
  const money = (minor: number): string => formatMoney(minor, currency, { trimZeros: true })
  const text = form.text ?? toInputString(Math.min(carried?.amount ?? owed, owed), currency, { trimZeros: true })
  const amount = parseMoneyInput(text, currency)
  const issue =
    amount === null || amount <= 0 ? t('promise.sheet.amount.missing') : amount > owed ? t('promise.sheet.amount.over', { amount: money(owed) }) : null
  const due = form.due ?? (carried && carried.due >= today ? carried.due : defaultDue(today))
  const quick = quickDates(today)
  const dateText = dayLabel(due, today, 'long')

  const save = (): void => {
    if (amount === null || issue !== null) {
      setForm((f) => ({ ...f, tried: true }))
      haptic('warning')
      return
    }
    const noted = notePromise({ friendId: friend.id, direction, currency, amount, due })
    if (!noted) {
      setForm((f) => ({ ...f, tried: true }))
      return
    }
    haptic('success')
    setSaved(noted.promise)
    toast(noted.replaced ? t('promise.toast.changed') : t('promise.toast.saved'), {
      tone: 'success',
      action: {
        label: t('common.action.undo'),
        onAction: () => {
          noted.undo()
          setSaved(null)
        },
      },
    })
  }

  const remove = (): void => {
    if (!existing) return
    const undo = removePromise(existing.id)
    if (!undo) return
    onClose()
    toast(t('promise.toast.removed'), { action: { label: t('common.action.undo'), onAction: undo } })
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={existing ? t('promise.sheet.title.change') : t('promise.sheet.title')}
      description={mine ? t('promise.sheet.mine', { name, amount: money(owed) }) : t('promise.sheet.theirs', { name, amount: money(owed) })}
      footer={
        <Button block onClick={save}>
          {issue === null && amount !== null
            ? t(mine ? 'promise.sheet.save.mine' : 'promise.sheet.save.theirs', { amount: money(amount), date: dateText })
            : issue}
        </Button>
      }
    >
      <div className={styles.sheet}>
        {balance.totals.length > 1 && (
          <section className={styles.block} aria-labelledby="promise-currency">
            <h3 id="promise-currency" className={styles.label}>
              {t('promise.sheet.currency.label')}
            </h3>
            <div className={styles.chips} role="group" aria-labelledby="promise-currency">
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
          label={t('promise.sheet.amount.label')}
          currency={currency}
          value={text}
          onChange={(next) => setForm((f) => ({ ...f, text: next, tried: false }))}
          commaGroups={!commaIsDecimal(currency)}
          enterKeyHint="done"
          hint={form.text === null && !carried ? t('promise.sheet.amount.hint') : undefined}
          error={issue !== null && (form.tried || (amount !== null && amount > 0)) ? issue : undefined}
        />
        <section className={styles.block} aria-labelledby="promise-when">
          <h3 id="promise-when" className={styles.label}>
            {t('promise.sheet.when.label')}
          </h3>
          <div className={styles.chips} role="group" aria-labelledby="promise-when">
            {quick.map((q) => (
              <Chip key={q.id} size="lg" selected={q.date === due} onClick={() => setForm((f) => ({ ...f, due: q.date }))}>
                {t(QUICK_LABEL[q.id])}
              </Chip>
            ))}
            <DateField label={t('promise.sheet.when.pick')} value={due} min={today} max={null} onChange={(next) => setForm((f) => ({ ...f, due: next }))} />
          </div>
        </section>
        {existing && (
          <div className={styles.end}>
            <Button variant="ghost" size="md" onClick={remove}>
              {t('promise.sheet.remove')}
            </Button>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
