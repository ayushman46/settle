import { useMemo, useState } from 'react'
import { AmountInput, Banner, BottomSheet, Button, Chip, SegmentedControl, TextField, useToast } from '../../components'
import { useT } from '../../i18n'
import { parseMoneyInput } from '../../lib/money'
import { computeShares, type SplitMethod } from '../../../shared/cloud'
import { cloud, type Member } from './api'
import { inr } from './settlementText'
import styles from './Account.module.css'

export interface ExpenseSheetProps {
  open: boolean
  groupId: string
  me: string
  members: readonly Member[]
  onClose: () => void
  onSaved: () => void
}

/** Percent typed as "33.33" → basis points (3333); null when it isn't a number. */
function basisPoints(text: string): number | null {
  const value = Number(text.replace(',', '.').trim())
  return text.trim() !== '' && Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null
}

/**
 * Adding an expense to an account group: amount, who paid, who it's between and how. The split
 * shown is computed by the same rules the server uses (shared/cloud.ts), and the server computes
 * it again itself — what's sent is the inputs, never the shares.
 */
export function ExpenseSheet({ open, groupId, me, members, onClose, onSaved }: ExpenseSheetProps) {
  const t = useT()
  const toast = useToast()
  const active = useMemo(() => members.filter((m) => m.active), [members])
  const nameOf = (id: string) => (id === me ? t('account.cloud.group.member.you', { name: active.find((m) => m.userId === id)?.displayName ?? '' }) : (active.find((m) => m.userId === id)?.displayName ?? ''))
  const [description, setDescription] = useState('')
  const [amountText, setAmountText] = useState('')
  const [payer, setPayer] = useState(me)
  const [method, setMethod] = useState<SplitMethod>('equal')
  const [between, setBetween] = useState<Set<string>>(() => new Set(active.map((m) => m.userId)))
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amount = parseMoneyInput(amountText, 'INR') ?? 0
  const people = active.filter((m) => between.has(m.userId))
  const values = people.map((m) => {
    const raw = inputs[m.userId] ?? ''
    if (method === 'exact') return { userId: m.userId, value: parseMoneyInput(raw, 'INR') ?? 0 }
    if (method === 'percent') return { userId: m.userId, value: basisPoints(raw) ?? 0 }
    return { userId: m.userId, value: 0 }
  })
  const preview = amount > 0 && people.length > 0 ? computeShares(amount, method, values) : null
  const assigned = values.reduce((s, v) => s + v.value, 0)
  const canSave = description.trim().length > 0 && preview?.ok === true

  const reset = () => {
    setDescription('')
    setAmountText('')
    setPayer(me)
    setMethod('equal')
    setBetween(new Set(active.map((m) => m.userId)))
    setInputs({})
    setError(null)
  }

  const save = async () => {
    if (!canSave || busy) return
    setBusy(true)
    setError(null)
    const res = await cloud<{ id: string }>('POST', `/groups/${groupId}/expenses`, {
      description: description.trim(),
      amountPaise: amount,
      payerId: payer,
      method,
      participants: values,
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    toast(t('account.cloud.expense.saved'), { tone: 'success' })
    reset()
    onSaved()
    onClose()
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('account.cloud.expense.title')}
      size="tall"
      footer={
        <Button block loading={busy} disabled={!canSave} onClick={() => void save()}>
          {t('account.cloud.expense.save')}
        </Button>
      }
    >
      <div className={styles.form}>
        <TextField
          label={t('account.cloud.expense.description')}
          placeholder={t('account.cloud.expense.description.placeholder')}
          value={description}
          maxLength={120}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
        <AmountInput label={t('account.cloud.expense.amount')} currency="INR" value={amountText} onChange={setAmountText} size="field" />

        <fieldset className={`${styles.form} ${styles.fieldset}`}>
          <legend className={styles.rowSub}>{t('account.cloud.expense.payer')}</legend>
          <div className={styles.chips}>
            {active.map((m) => (
              <Chip key={m.userId} selected={payer === m.userId} onClick={() => setPayer(m.userId)}>
                {nameOf(m.userId)}
              </Chip>
            ))}
          </div>
        </fieldset>

        <SegmentedControl
          ariaLabel={t('account.cloud.expense.split.aria')}
          value={method}
          onChange={setMethod}
          options={[
            { value: 'equal', label: t('account.cloud.expense.split.equal') },
            { value: 'exact', label: t('account.cloud.expense.split.exact') },
            { value: 'percent', label: t('account.cloud.expense.split.percent') },
          ]}
        />

        <fieldset className={`${styles.form} ${styles.fieldset}`}>
          <legend className={styles.rowSub}>{t('account.cloud.expense.between')}</legend>
          <div className={styles.chips}>
            {active.map((m) => (
              <Chip
                key={m.userId}
                selected={between.has(m.userId)}
                aria-pressed={between.has(m.userId)}
                onClick={() =>
                  setBetween((prev) => {
                    const next = new Set(prev)
                    if (next.has(m.userId)) next.delete(m.userId)
                    else next.add(m.userId)
                    return next
                  })
                }
              >
                {nameOf(m.userId)}
              </Chip>
            ))}
          </div>
        </fieldset>

        {method !== 'equal' &&
          people.map((m) => (
            <TextField
              key={m.userId}
              label={method === 'percent' ? t('account.cloud.expense.percent.label', { name: nameOf(m.userId) }) : t('account.cloud.expense.amount.label', { name: nameOf(m.userId) })}
              inputMode="decimal"
              value={inputs[m.userId] ?? ''}
              onChange={(e) => {
                const text = e.currentTarget.value
                setInputs((prev) => ({ ...prev, [m.userId]: text }))
              }}
            />
          ))}

        {method === 'exact' && amount > 0 && assigned !== amount && <p className={styles.footnote}>{t('account.cloud.expense.left', { amount: inr(amount - assigned) })}</p>}
        {method === 'percent' && assigned !== 10_000 && <p className={styles.footnote}>{t('account.cloud.expense.percentLeft', { value: ((10_000 - assigned) / 100).toFixed(2) })}</p>}

        {preview?.ok && (
          <div className={styles.shareGrid} aria-live="polite">
            {preview.shares.map((s) => (
              <span key={s.userId} className={styles.rowSub}>
                {t('account.cloud.expense.share', { name: nameOf(s.userId), amount: inr(s.sharePaise) })}
              </span>
            ))}
          </div>
        )}
        {error && <Banner tone="error">{error}</Banner>}
      </div>
    </BottomSheet>
  )
}
