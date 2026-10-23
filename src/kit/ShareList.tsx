import { useId, useState } from 'react'
import { BellRing, Check, ChevronDown, QrCode } from 'lucide-react'
import { Button, Money } from '../components'
import { useFriendsById, useGroup } from '../data'
import { t, useT } from '../i18n'
import { ME_ID, type Expense, type Friend } from '../domain/types'
import { isSettledInGroup } from '../engine/balances'
import { cx } from '../lib/cx'
import { haptic } from '../lib/haptics'
import { formatMoney } from '../lib/money'
import { firstName } from '../share/text'
import { FriendAvatar } from './FriendAvatar'
import { friendLabel, friendObjectLabel } from './friendName'
import { extrasLabel, shareActions, shareLines, type ShareLine } from './shareLines'
import styles from './ShareList.module.css'

export interface ShareListProps {
  expense: Expense
  /** Ticks someone off as having paid the payer back (`paid` true) or undoes it. Without it there are no ticks. */
  onTogglePaid?: (friendId: string, paid: boolean) => void
  /**
   * Opens a UPI QR for `friendId`'s share: them paying you (you paid), or you paying the payer
   * (`friendId` is you). Offered on open rupee shares only.
   */
  onPayUpi?: (friendId: string) => void
  /** Opens a reminder for `friendId` (only for people who owe you). */
  onNudge?: (friendId: string) => void
  className?: string
}

/**
 * Everyone's share of an expense, payer first: avatar, name, where it stands ("Owes you",
 * "Paid you back"), the amount, a tick to mark it paid, and — while it's open — "UPI QR" and
 * "Nudge". On itemized bills each person's items fold out. Group expenses list shares only
 * (they settle through the group's balances).
 */
export function ShareList({ expense, onTogglePaid, onPayUpi, onNudge, className }: ShareListProps) {
  const friendsById = useFriendsById()
  const group = useGroup(expense.groupId)
  const settledInGroup = group !== null && isSettledInGroup(expense, [group])
  const lines = shareLines(expense, { settledInGroup })
  const payer = friendsById[expense.payerId] ?? null

  return (
    <ul role="list" aria-label="Shares" className={cx(styles.list, className)}>
      {lines.map((line) => (
        <ShareRow
          key={line.friendId}
          line={line}
          expense={expense}
          friend={friendsById[line.friendId] ?? null}
          payer={payer}
          groupName={group?.name ?? null}
          onTogglePaid={onTogglePaid}
          onPayUpi={onPayUpi}
          onNudge={onNudge}
        />
      ))}
    </ul>
  )
}

interface ShareRowProps extends Omit<ShareListProps, 'className'> {
  line: ShareLine
  friend: Friend | null
  payer: Friend | null
  groupName: string | null
}

/** What the line says under the name. */
function statusText(line: ShareLine, payerObject: string, groupName: string | null): string {
  switch (line.state) {
    case 'payer':
      return t('kit.shares.status.payer')
    case 'paid':
      return t('kit.shares.status.paid', { name: payerObject })
    case 'owes':
      return line.friendId === ME_ID ? t('kit.shares.status.youOwe', { name: payerObject }) : t('kit.shares.status.owes', { name: payerObject })
    case 'zero':
      return t('kit.shares.status.zero')
    case 'group':
      return groupName ? t('kit.shares.status.group', { group: groupName }) : t('kit.shares.status.groupUnnamed')
  }
}

function ShareRow({ line, expense, friend, payer, groupName, onTogglePaid, onPayUpi, onNudge }: ShareRowProps) {
  useT()
  const itemsId = useId()
  const [open, setOpen] = useState(false)
  const id = line.friendId
  const name = friendLabel(id, friend)
  const payerObject = friendObjectLabel(expense.payerId, payer)
  const amount = formatMoney(line.share, expense.currency, { trimZeros: true })
  const actions = shareActions(line, expense)
  const paid = line.state === 'paid'
  const canToggle = actions.toggle && onTogglePaid !== undefined
  const canUpi = actions.upi && onPayUpi !== undefined
  const canNudge = actions.nudge && onNudge !== undefined
  const hasItems = line.items.length > 0
  const payingPayer = id === ME_ID && expense.payerId !== ME_ID

  const toggle = () => {
    haptic(paid ? 'tap' : 'success')
    onTogglePaid?.(id, !paid)
  }

  return (
    <li className={styles.item} data-state={line.state}>
      <div className={styles.row}>
        <FriendAvatar friendId={id} friend={friend} size="md" />
        <span className={styles.text}>
          <span className={styles.name}>{name}</span>
          <span className={styles.status}>
            {(paid || line.state === 'payer') && <Check aria-hidden="true" className={styles.statusIcon} strokeWidth={3} />}
            {statusText(line, payerObject, groupName)}
          </span>
        </span>
        <Money
          value={line.share}
          currency={expense.currency}
          trimZeros
          strong={line.state === 'owes'}
          muted={line.state === 'zero'}
          className={cx(styles.amount, paid && styles.paidAmount)}
        />
        {canToggle && (
          <button
            type="button"
            className={styles.tick}
            aria-pressed={paid}
            aria-label={t('kit.shares.tick.aria', { name, payer: payerObject })}
            onClick={toggle}
          >
            <span className={styles.tickMark} aria-hidden="true">
              <Check strokeWidth={3.25} />
            </span>
          </button>
        )}
      </div>

      {(hasItems || canUpi || canNudge) && (
        <div className={styles.more}>
          {hasItems && (
            <button
              type="button"
              className={styles.disclose}
              aria-expanded={open}
              aria-controls={itemsId}
              aria-label={id === ME_ID ? t('kit.shares.items.mine.aria', { count: line.items.length }) : t('kit.shares.items.aria', { count: line.items.length, name })}
              onClick={() => setOpen((v) => !v)}
            >
              {t('kit.shares.items.cta', { count: line.items.length })}
              <ChevronDown aria-hidden="true" strokeWidth={2.5} className={styles.chevron} />
            </button>
          )}
          {(canUpi || canNudge) && (
            <span className={styles.actions}>
              {canUpi && (
                <Button
                  size="sm"
                  variant={payingPayer ? 'accent' : 'tonal'}
                  iconStart={<QrCode />}
                  onClick={() => onPayUpi?.(id)}
                  aria-label={payingPayer ? t('kit.shares.pay.aria', { name: payerObject, amount }) : t('kit.shares.qr.aria', { name, amount })}
                >
                  {payingPayer ? t('kit.shares.pay.cta', { name: firstName(payerObject) }) : t('kit.shares.qr.cta')}
                </Button>
              )}
              {canNudge && (
                <Button size="sm" variant="tonal" iconStart={<BellRing />} onClick={() => onNudge?.(id)} aria-label={t('kit.shares.nudge.aria', { name, amount })}>
                  {t('kit.shares.nudge.cta')}
                </Button>
              )}
            </span>
          )}
        </div>
      )}

      {hasItems && (
        <ul id={itemsId} role="list" hidden={!open} className={styles.items} aria-label={id === ME_ID ? t('kit.shares.items.mine.list') : t('kit.shares.items.list', { name })}>
          {line.items.map((item) => (
            <li key={item.itemId} className={styles.line}>
              <span className={styles.lineName}>
                {item.name}
                {(item.portion !== null || item.everyone) && (
                  <span className={styles.portion}>
                    {' · '}
                    {[item.portion, item.everyone ? t('kit.shares.item.sharedByAll') : null].filter(Boolean).join(', ')}
                  </span>
                )}
              </span>
              <Money value={item.amount} currency={expense.currency} size="sm" trimZeros className={styles.lineAmount} />
            </li>
          ))}
          {line.extras !== 0 && (
            <li className={cx(styles.line, styles.extras)}>
              <span className={styles.lineName}>{extrasLabel(line.extras, expense.currency)}</span>
              <Money value={line.extras} currency={expense.currency} size="sm" sign="always" trimZeros className={styles.lineAmount} />
            </li>
          )}
        </ul>
      )}
    </li>
  )
}
