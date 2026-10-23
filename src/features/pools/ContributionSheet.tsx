import { useId, useState, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { ActionBar, AmountInput, BottomSheet, Button, Chip, SegmentedControl, TextField, useToast } from '../../components'
import { DataError, MAX_CONTRIBUTOR_NAME_LENGTH, useFriendsById } from '../../data'
import { addContribution, removeContribution, restoreContribution, updateContribution } from '../../data/pools'
import type { Contribution, Pool } from '../../domain/types'
import { today } from '../../engine/dates'
import { useT, type MessageKey } from '../../i18n'
import { DateField } from '../../kit/DateField'
import { friendLabel } from '../../kit/friendName'
import { parseMoneyInput, toInputString } from '../../lib/money'
import styles from './ContributionSheet.module.css'

export type ContributionSheetState =
  | { mode: 'add'; friendId: string | null }
  | { mode: 'edit'; contribution: Contribution }

export interface ContributionSheetProps {
  pool: Pool
  state: ContributionSheetState | null
  onClose: () => void
}

const METHODS: ReadonlyArray<Contribution['method']> = ['upi', 'cash', 'other']
const SOMEONE_ELSE = '\u0000else'

/** Add someone's payment (pick them, or "Someone else" by name) or change / remove one already ticked. */
export function ContributionSheet({ pool, state, onClose }: ContributionSheetProps) {
  return (
    <BottomSheetFrame open={state !== null} onClose={onClose} title={state?.mode === 'edit' ? state.contribution.name : null}>
      {state && <ContributionForm key={state.mode === 'edit' ? state.contribution.id : `add-${state.friendId ?? ''}`} pool={pool} state={state} onClose={onClose} />}
    </BottomSheetFrame>
  )
}

function BottomSheetFrame({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string | null; children: ReactNode }) {
  const t = useT()
  return (
    <BottomSheet open={open} onClose={onClose} title={title ? t('pools.contribution.editTitle', { name: title }) : t('pools.contribution.addTitle')}>
      {children}
    </BottomSheet>
  )
}

function ContributionForm({ pool, state, onClose }: { pool: Pool; state: ContributionSheetState; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const friendsById = useFriendsById()
  const ids = { who: useId(), method: useId() }
  const editing = state.mode === 'edit' ? state.contribution : null
  const [who, setWho] = useState<string | null>(editing ? (editing.friendId ?? SOMEONE_ELSE) : state.mode === 'add' ? state.friendId : null)
  const [name, setName] = useState(editing && !editing.friendId ? editing.name : '')
  const fallbackAmount = pool.mode === 'fixed' ? pool.perPerson : null
  const [amountText, setAmountText] = useState(toInputString(editing ? editing.amount : fallbackAmount, pool.currency))
  const [method, setMethod] = useState<Contribution['method']>(editing?.method ?? 'upi')
  const [date, setDate] = useState(editing?.date ?? today())
  const amount = parseMoneyInput(amountText, pool.currency)
  const guest = who === SOMEONE_ELSE
  const issue: MessageKey | null =
    !editing && (who === null || (guest && name.trim() === ''))
      ? 'pools.contribution.issue.name'
      : amount === null || amount <= 0
        ? 'pools.contribution.issue.amount'
        : null

  const methodOptions = METHODS.map((m) => ({ value: m, label: t(`pools.method.${m}` as MessageKey) }))

  const save = (): void => {
    if (issue || amount === null) return
    try {
      if (editing) {
        updateContribution(pool.id, editing.id, { amount, method, date })
      } else {
        const friendId = guest ? null : who
        const added = addContribution(pool.id, {
          friendId,
          name: guest ? name : friendLabel(friendId, friendId ? (friendsById[friendId] ?? null) : null),
          amount,
          date,
          method,
          via: 'tick',
          replyId: null,
        })
        toast(t('pools.contribution.added', { name: added.name }), {
          tone: 'success',
          action: { label: t('pools.detail.undo'), onAction: () => removeContribution(pool.id, added.id) },
        })
      }
    } catch (error) {
      if (!(error instanceof DataError)) throw error
      toast(error.message, { tone: 'error' })
      return
    }
    onClose()
  }

  const remove = (): void => {
    if (!editing) return
    const removed = removeContribution(pool.id, editing.id)
    onClose()
    if (removed) {
      toast(t('pools.contribution.removed'), {
        action: { label: t('pools.detail.undo'), onAction: () => restoreContribution(pool.id, removed) },
      })
    }
  }

  return (
    <div className={styles.form}>
      {!editing && (
        <div className={styles.field}>
          <p id={ids.who} className={styles.label}>
            {t('pools.contribution.who')}
          </p>
          <div role="radiogroup" aria-labelledby={ids.who} className={styles.chips}>
            {pool.memberIds.map((id) => (
              <Chip key={id} role="radio" aria-checked={who === id} selected={who === id} onClick={() => setWho(id)}>
                {friendLabel(id, friendsById[id] ?? null)}
              </Chip>
            ))}
            <Chip role="radio" aria-checked={guest} selected={guest} onClick={() => setWho(SOMEONE_ELSE)}>
              {t('pools.contribution.someoneElse')}
            </Chip>
          </div>
          {guest && (
            <TextField
              label={t('pools.contribution.name')}
              value={name}
              maxLength={MAX_CONTRIBUTOR_NAME_LENGTH}
              autoCapitalize="words"
              autoFocus
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </div>
      )}
      <AmountInput
        size="field"
        label={t('pools.contribution.amount')}
        currency={pool.currency}
        value={amountText}
        onChange={setAmountText}
      />
      <div className={styles.field}>
        <p id={ids.method} className={styles.label}>
          {t('pools.contribution.method')}
        </p>
        <SegmentedControl options={methodOptions} value={method} onChange={setMethod} ariaLabel={t('pools.contribution.method')} />
      </div>
      <DateField label={t('pools.contribution.date')} value={date} onChange={setDate} />
      <ActionBar hint={issue ? t(issue) : undefined}>
        <Button block disabled={issue !== null} onClick={save}>
          {editing ? t('pools.contribution.save') : t('pools.contribution.add')}
        </Button>
        {editing && (
          <Button variant="ghost" block iconStart={<Trash2 />} onClick={remove}>
            {t('pools.contribution.remove')}
          </Button>
        )}
      </ActionBar>
    </div>
  )
}
