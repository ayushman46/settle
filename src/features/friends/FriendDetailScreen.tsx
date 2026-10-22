import { useMemo, useState } from 'react'
import { BellRing, Copy, Pencil, Phone, QrCode, Receipt, Split, UserMinus } from 'lucide-react'
import { goBack, navigate, Redirect, useRoute } from '../../app/router'
import {
  ActionBar,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  IconButton,
  List,
  ListRow,
  Money,
  PageTitle,
  Screen,
  SectionHeader,
  SuccessBurst,
  TopBar,
  useToast,
} from '../../components'
import { removeFriend, useExpenses, useFriend, useGroups, useMe, useProfile, useRecurring } from '../../data'
import { ME_ID, type Friend } from '../../domain/types'
import { today } from '../../engine/dates'
import { FriendAvatar } from '../../kit/index-a'
import { ExpenseRow, NudgeSheet, UpiPaySheet } from '../../kit/index-b'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { copyText } from '../../lib/share'
import { firstName } from '../../share/text'
import { GroupEmoji } from '../groups/GroupEmoji'
import { expensePath, FRIENDS_PATH, groupPath, newSplitPath, settleUpPath, YOU_PATH } from '../groups/paths'
import {
  blockedText,
  friendBalance,
  removalBlockers,
  settleWithFriend,
  sourceDirection,
  sourcesTitle,
  type FriendBalance,
  type RemovalBlockers,
} from './friendBalance'
import { FriendSettleSheet } from './FriendSettleSheet'
import { FriendSheet } from './FriendSheet'
import styles from './FriendDetailScreen.module.css'

const ROUTES = ['/app/friends/:id'] as const

/** Expenses shown before "Show all". */
const FIRST_EXPENSES = 10

/**
 * `/app/friends/:id` — one person: where you stand with them across everything (and where it's
 * from), settle up, a reminder or a UPI payment in a tap, the groups you share and every expense
 * together. Split something new with them from the bottom bar; edit or remove them (when nothing
 * is left to settle).
 */
export function FriendDetailScreen() {
  const { params } = useRoute(ROUTES)
  const id = params.id ?? ''
  const live = useFriend(id)
  // Keeps the page on screen while it leaves after removing them.
  const [leaving, setLeaving] = useState<Friend | null>(null)
  if (id === ME_ID) return <Redirect to={YOU_PATH} />
  const friend = live ?? (leaving?.id === id ? leaving : null)
  if (!friend) return <FriendGone />
  return <FriendDetail key={friend.id} friend={friend} onLeaving={setLeaving} />
}

function FriendGone() {
  return (
    <Screen header={<TopBar onBack={() => goBack(FRIENDS_PATH)} />}>
      <PageTitle title="This person isn’t here" subtitle="They may have been removed — on this phone or in another tab." />
      <Button className={styles.goneAction} onClick={() => navigate(FRIENDS_PATH, { replace: true })}>
        See your people
      </Button>
    </Screen>
  )
}

type Sheet = 'edit' | 'settle' | 'remind' | 'pay' | 'remove' | 'blocked'

function FriendDetail({ friend, onLeaving }: { friend: Friend; onLeaving: (friend: Friend) => void }) {
  const toast = useToast()
  const profile = useProfile()
  const me = useMe()
  const allExpenses = useExpenses()
  const groups = useGroups()
  const recurring = useRecurring()
  const shared = useExpenses({ friendId: friend.id })
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [blockers, setBlockers] = useState<RemovalBlockers | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [celebrate, setCelebrate] = useState(false)

  const balance = useMemo(() => friendBalance(friend.id, allExpenses, groups, profile.currency), [friend.id, allExpenses, groups, profile.currency])
  const sharedGroups = useMemo(() => groups.filter((g) => g.memberIds.includes(friend.id)), [groups, friend.id])
  const name = friend.name
  const first = firstName(name)
  const lead = balance.totals[0] ?? null
  const rest = balance.totals.slice(1)
  const leadSources = lead ? balance.sources.filter((s) => s.currency === lead.currency) : []
  const iOweRupees = lead !== null && lead.currency === 'INR' && lead.amount < 0
  const visible = showAll ? shared : shared.slice(0, FIRST_EXPENSES)
  const close = (): void => setSheet(null)

  const copyUpi = async (): Promise<void> => {
    if (!friend.upiId) return
    if (await copyText(friend.upiId)) {
      haptic('success')
      toast('UPI ID copied', { tone: 'success' })
    } else {
      toast('Couldn’t copy. Long-press the UPI ID to copy it.', { tone: 'error' })
    }
  }

  const askRemove = (): void => {
    const found = removalBlockers(friend.id, allExpenses, groups, recurring)
    if (found.groups.length > 0 || found.splits > 0 || found.recurring.length > 0) {
      setBlockers(found)
      setSheet('blocked')
    } else {
      setSheet('remove')
    }
  }

  const remove = (): void => {
    const result = removeFriend(friend.id)
    if (!result.ok) {
      setBlockers(removalBlockers(friend.id, allExpenses, groups, recurring))
      setSheet('blocked')
      return
    }
    setSheet(null)
    onLeaving(friend)
    haptic('success')
    goBack(FRIENDS_PATH)
    toast(`${name} removed from your people`)
  }

  const paidByUpi = (): void => {
    settleWithFriend(friend.id, leadSources, { method: 'upi', date: today() })
    setCelebrate(true)
  }

  return (
    <Screen
      header={
        <TopBar
          onBack={() => goBack(FRIENDS_PATH)}
          right={
            <IconButton label={`Edit ${name}`} onClick={() => setSheet('edit')}>
              <Pencil />
            </IconButton>
          }
        />
      }
      contentClassName={styles.content}
      footer={
        <ActionBar>
          <Button block iconStart={<Split />} onClick={() => navigate(newSplitPath({ friend: friend.id }))}>
            Split with {first}
          </Button>
        </ActionBar>
      }
    >
      <header className={styles.hero}>
        <FriendAvatar friend={friend} size="lg" className={styles.avatar} />
        <PageTitle align="center" title={name} />
        <div className={styles.contact}>
          {friend.upiId ? (
            <button type="button" className={styles.contactChip} onClick={copyUpi} aria-label={`UPI ID ${friend.upiId}. Copy`}>
              <QrCode aria-hidden="true" />
              <span className={styles.upi}>{friend.upiId}</span>
              <Copy aria-hidden="true" className={styles.copy} />
            </button>
          ) : (
            <button type="button" className={cx(styles.contactChip, styles.missing)} onClick={() => setSheet('edit')}>
              <QrCode aria-hidden="true" />
              <span>Add UPI ID</span>
            </button>
          )}
          {friend.phone && (
            <a className={styles.contactChip} href={`tel:${friend.phone}`} aria-label={`Call ${first} on ${friend.phone}`}>
              <Phone aria-hidden="true" />
              <span>{friend.phone}</span>
            </a>
          )}
        </div>
      </header>

      <StandingCard
        balance={balance}
        name={first}
        onSettle={() => setSheet('settle')}
        onRemind={() => setSheet('remind')}
        onPay={iOweRupees ? () => setSheet('pay') : undefined}
        rest={rest}
      />

      {balance.sources.length > 0 && (
        <section className={styles.section} aria-labelledby="friend-sources">
          <SectionHeader id="friend-sources" title="Where it’s from" />
          <Card padding="none">
            <List>
              {balance.sources.map((source) => (
                <ListRow
                  key={source.key}
                  leading={
                    source.kind === 'group' ? (
                      <GroupEmoji emoji={source.group.emoji} kind={source.group.kind} size="sm" />
                    ) : (
                      <span className={styles.splitIcon} aria-hidden="true">
                        <Receipt strokeWidth={2.25} />
                      </span>
                    )
                  }
                  title={source.kind === 'group' ? source.group.name : `${source.count} ${source.count === 1 ? 'split' : 'splits'} outside groups`}
                  subtitle={sourceDirection(source, first)}
                  trailing={
                    <Money
                      value={Math.abs(source.amount)}
                      currency={source.currency}
                      trimZeros
                      strong
                      tone={source.amount > 0 ? 'positive' : source.amount < 0 ? 'negative' : 'default'}
                    />
                  }
                  onClick={() => (source.kind === 'group' ? navigate(settleUpPath(source.group.id)) : setSheet('settle'))}
                  chevron
                />
              ))}
            </List>
          </Card>
        </section>
      )}

      {sharedGroups.length > 0 && (
        <section className={styles.section} aria-labelledby="friend-groups">
          <SectionHeader id="friend-groups" title="Groups together" />
          <ul role="list" className={styles.groups}>
            {sharedGroups.map((g) => (
              <li key={g.id}>
                <button type="button" className={styles.groupChip} onClick={() => navigate(groupPath(g.id))}>
                  <GroupEmoji emoji={g.emoji} kind={g.kind} size="sm" />
                  <span className={styles.groupName}>{g.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section} aria-labelledby="friend-expenses">
        <SectionHeader id="friend-expenses" title={`Expenses with ${first}`} />
        {shared.length === 0 ? (
          <Card>
            <EmptyState size="sm" headingLevel={3} icon={<Split />} title="Nothing split yet" text={`Split a bill, a cab or the rent with ${first} — it shows up here.`} />
          </Card>
        ) : (
          <>
            <Card padding="none">
              <List>
                {visible.map((e) => (
                  <ExpenseRow key={e.id} expense={e} showDate onClick={() => navigate(expensePath(e.id))} />
                ))}
              </List>
            </Card>
            {shared.length > FIRST_EXPENSES && (
              <Button variant="ghost" size="md" onClick={() => setShowAll((v) => !v)} className={styles.more}>
                {showAll ? 'Show fewer' : `Show all ${shared.length}`}
              </Button>
            )}
          </>
        )}
      </section>

      <Button variant="danger" size="md" iconStart={<UserMinus />} onClick={askRemove} className={styles.remove}>
        Remove from your people
      </Button>

      <FriendSheet open={sheet === 'edit'} friend={friend} onClose={close} />
      <FriendSettleSheet friend={friend} balance={balance} open={sheet === 'settle'} onClose={close} onSettledAll={() => setCelebrate(true)} />
      <NudgeSheet
        open={sheet === 'remind'}
        onClose={close}
        friend={friend}
        amount={lead && lead.amount > 0 ? lead.amount : 0}
        currency={lead?.currency ?? profile.currency}
        title={sourcesTitle(leadSources)}
        link={null}
      />
      <UpiPaySheet
        open={sheet === 'pay'}
        onClose={close}
        payee={{ id: friend.id, name, upiId: friend.upiId, color: friend.color }}
        payer={{ id: ME_ID, name: 'You', color: me.color }}
        amount={lead && lead.amount < 0 ? -lead.amount : 0}
        currency={lead?.currency ?? 'INR'}
        note={sourcesTitle(leadSources) === 'our splits' ? 'Settle up' : sourcesTitle(leadSources)}
        onMarkPaid={paidByUpi}
      />
      <BottomSheet
        open={sheet === 'remove'}
        onClose={close}
        title={`Remove ${name}?`}
        description={`${first} leaves your people and any groups. Past splits stay, showing them as “Someone”.`}
        footer={
          <div className={styles.sheetActions}>
            <Button block variant="danger" onClick={remove}>
              Remove {first}
            </Button>
            <Button block variant="ghost" onClick={close}>
              Keep {first}
            </Button>
          </div>
        }
      />
      <BlockedSheet open={sheet === 'blocked'} name={first} blockers={blockers} onClose={close} onSettle={balance.sources.length > 0 ? () => setSheet('settle') : undefined} />
      {celebrate && <SuccessBurst title={`All square with ${first}`} subtitle="Nothing left to settle." onDone={() => setCelebrate(false)} />}
    </Screen>
  )
}

function StandingCard({
  balance,
  name,
  rest,
  onSettle,
  onRemind,
  onPay,
}: {
  balance: FriendBalance
  name: string
  rest: FriendBalance['totals']
  onSettle: () => void
  onRemind: () => void
  onPay?: () => void
}) {
  const lead = balance.totals[0] ?? null
  const headline = !lead ? `You and ${name} are square` : lead.amount > 0 ? `${name} owes you` : `You owe ${name}`
  const extra = rest.map((t) => (t.amount > 0 ? `owes you ${formatMoney(t.amount, t.currency, { trimZeros: true })}` : `you owe ${formatMoney(-t.amount, t.currency, { trimZeros: true })}`))
  return (
    <section className={cx(styles.standing, lead ? styles.dark : styles.square)} aria-labelledby="friend-standing">
      <h2 id="friend-standing" className={styles.standingLabel}>
        {headline}
      </h2>
      {lead && (
        <Money value={Math.abs(lead.amount)} currency={lead.currency} size="xl" trimZeros className={cx(styles.standingAmount, lead.amount > 0 && styles.owed)} />
      )}
      {extra.length > 0 && <p className={styles.standingLine}>Also {extra.join(' · ')}</p>}
      {!lead && balance.sources.length === 0 && <p className={styles.standingLine}>Nothing to settle — nice.</p>}
      {lead && (
        <div className={styles.standingActions}>
          {lead.amount > 0 && (
            <Button variant="accent" size="md" iconStart={<BellRing />} onClick={onRemind}>
              Remind
            </Button>
          )}
          {lead.amount < 0 && onPay && (
            <Button variant="accent" size="md" iconStart={<QrCode />} onClick={onPay}>
              Pay via UPI
            </Button>
          )}
          <Button variant="tonal" size="md" onClick={onSettle}>
            Settle up
          </Button>
        </div>
      )}
    </section>
  )
}

function BlockedSheet({
  open,
  name,
  blockers,
  onClose,
  onSettle,
}: {
  open: boolean
  name: string
  blockers: RemovalBlockers | null
  onClose: () => void
  onSettle?: () => void
}) {
  const description = blockedText(name, blockers)
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`${name} can’t be removed yet`}
      description={description}
      footer={
        <div className={styles.sheetActions}>
          {onSettle && (
            <Button block onClick={onSettle}>
              Settle up
            </Button>
          )}
          <Button block variant={onSettle ? 'ghost' : 'primary'} onClick={onClose}>
            OK
          </Button>
        </div>
      }
    />
  )
}
