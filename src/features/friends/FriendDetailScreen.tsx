import { useMemo, useState } from 'react'
import { ArrowLeftRight, BellRing, Copy, Pencil, Phone, QrCode, Receipt, Split, UserMinus } from 'lucide-react'
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
import { useT } from '../../i18n'
import { FriendAvatar } from '../../kit/index-a'
import { ExpenseRow, NudgeSheet, UpiPaySheet } from '../../kit/index-b'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { copyText } from '../../lib/share'
import { firstName } from '../../share/text'
import { GroupEmoji } from '../groups/GroupEmoji'
import { expensePath, FRIENDS_PATH, groupPath, newSplitPath, settleUpPath, YOU_PATH } from '../groups/paths'
import { LEND_ENABLED } from '../lend/enabled'
import {
  blockedText,
  friendBalance,
  removalBlockers,
  settleWithFriend,
  singleSourceTitle,
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
  const t = useT()
  return (
    <Screen header={<TopBar onBack={() => goBack(FRIENDS_PATH)} />}>
      <PageTitle title={t('friends.gone.title')} subtitle={t('friends.gone.subtitle')} />
      <Button className={styles.goneAction} onClick={() => navigate(FRIENDS_PATH, { replace: true })}>
        {t('friends.gone.cta')}
      </Button>
    </Screen>
  )
}

type Sheet = 'edit' | 'settle' | 'remind' | 'pay' | 'remove' | 'blocked'

function FriendDetail({ friend, onLeaving }: { friend: Friend; onLeaving: (friend: Friend) => void }) {
  const t = useT()
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
      toast(t('friends.detail.upi.copied.toast'), { tone: 'success' })
    } else {
      toast(t('friends.detail.upi.copy.error'), { tone: 'error' })
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
    toast(t('friends.detail.removed.toast', { name }))
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
            <IconButton label={t('friends.detail.edit.aria', { name })} onClick={() => setSheet('edit')}>
              <Pencil />
            </IconButton>
          }
        />
      }
      contentClassName={styles.content}
      footer={
        <ActionBar>
          {LEND_ENABLED ? (
            <div className={styles.footerRow}>
              <Button block iconStart={<Split />} onClick={() => navigate(newSplitPath({ friend: friend.id }))}>
                {t('friends.detail.split.cta', { name: first })}
              </Button>
              <Button
                variant="secondary"
                iconStart={<ArrowLeftRight />}
                className={styles.lend}
                onClick={() => navigate(`/app/lend?friend=${encodeURIComponent(friend.id)}`)}
              >
                {t('lend.friend.cta')}
              </Button>
            </div>
          ) : (
            <Button block iconStart={<Split />} onClick={() => navigate(newSplitPath({ friend: friend.id }))}>
              {t('friends.detail.split.cta', { name: first })}
            </Button>
          )}
        </ActionBar>
      }
    >
      <header className={styles.hero}>
        <FriendAvatar friend={friend} size="lg" className={styles.avatar} />
        <PageTitle align="center" title={name} />
        <div className={styles.contact}>
          {friend.upiId ? (
            <button type="button" className={styles.contactChip} onClick={copyUpi} aria-label={t('friends.detail.upi.aria', { upi: friend.upiId })}>
              <QrCode aria-hidden="true" />
              <span className={styles.upi}>{friend.upiId}</span>
              <Copy aria-hidden="true" className={styles.copy} />
            </button>
          ) : (
            <button type="button" className={cx(styles.contactChip, styles.missing)} onClick={() => setSheet('edit')}>
              <QrCode aria-hidden="true" />
              <span>{t('friends.detail.upi.add')}</span>
            </button>
          )}
          {friend.phone && (
            <a className={styles.contactChip} href={`tel:${friend.phone}`} aria-label={t('friends.detail.call.aria', { name: first, phone: friend.phone })}>
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
          <SectionHeader id="friend-sources" title={t('friends.sources.title')} />
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
                  title={source.kind === 'group' ? source.group.name : t('friends.sources.splits', { count: source.count })}
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
          <SectionHeader id="friend-groups" title={t('friends.detail.groups.title')} />
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
        <SectionHeader id="friend-expenses" title={t('friends.detail.expenses.title', { name: first })} />
        {shared.length === 0 ? (
          <Card>
            <EmptyState
              size="sm"
              headingLevel={3}
              icon={<Split />}
              title={t('friends.detail.expenses.empty.title')}
              text={t('friends.detail.expenses.empty.body', { name: first })}
            />
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
                {showAll ? t('friends.detail.expenses.fewer.cta') : t('friends.detail.expenses.all.cta', { count: shared.length })}
              </Button>
            )}
          </>
        )}
      </section>

      <Button variant="danger" size="md" iconStart={<UserMinus />} onClick={askRemove} className={styles.remove}>
        {t('friends.detail.remove.cta')}
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
        payer={{ id: ME_ID, name: t('common.people.you'), color: me.color }}
        amount={lead && lead.amount < 0 ? -lead.amount : 0}
        currency={lead?.currency ?? 'INR'}
        // The UPI note stays in English: banks and UPI apps show it as is.
        note={singleSourceTitle(leadSources) ?? 'Settle up'}
        onMarkPaid={paidByUpi}
      />
      <BottomSheet
        open={sheet === 'remove'}
        onClose={close}
        title={t('friends.remove.title', { name })}
        description={t('friends.remove.body', { name: first })}
        footer={
          <div className={styles.sheetActions}>
            <Button block variant="danger" onClick={remove}>
              {t('friends.remove.cta', { name: first })}
            </Button>
            <Button block variant="ghost" onClick={close}>
              {t('friends.remove.keep.cta', { name: first })}
            </Button>
          </div>
        }
      />
      <BlockedSheet open={sheet === 'blocked'} name={first} blockers={blockers} onClose={close} onSettle={balance.sources.length > 0 ? () => setSheet('settle') : undefined} />
      {celebrate && <SuccessBurst title={t('friends.allSquare', { name: first })} subtitle={t('friends.allSquare.subtitle')} onDone={() => setCelebrate(false)} />}
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
  const t = useT()
  const lead = balance.totals[0] ?? null
  const headline = !lead
    ? t('friends.standing.square', { name })
    : lead.amount > 0
      ? t('friends.standing.owesYou', { name })
      : t('friends.standing.youOwe', { name })
  const extra = rest.map((total) =>
    total.amount > 0
      ? t('friends.line.owesYou', { amount: formatMoney(total.amount, total.currency, { trimZeros: true }) })
      : t('friends.line.youOwe', { amount: formatMoney(-total.amount, total.currency, { trimZeros: true }) }),
  )
  return (
    <section className={cx(styles.standing, lead ? styles.dark : styles.square)} aria-labelledby="friend-standing">
      <h2 id="friend-standing" className={styles.standingLabel}>
        {headline}
      </h2>
      {lead && (
        <Money value={Math.abs(lead.amount)} currency={lead.currency} size="xl" trimZeros className={cx(styles.standingAmount, lead.amount > 0 && styles.owed)} />
      )}
      {extra.length > 0 && <p className={styles.standingLine}>{t('friends.standing.also', { list: extra.join(' · ') })}</p>}
      {!lead && balance.sources.length === 0 && <p className={styles.standingLine}>{t('friends.standing.nothing')}</p>}
      {lead && (
        <div className={styles.standingActions}>
          {lead.amount > 0 && (
            <Button variant="accent" size="md" iconStart={<BellRing />} onClick={onRemind}>
              {t('friends.standing.remind.cta')}
            </Button>
          )}
          {lead.amount < 0 && onPay && (
            <Button variant="accent" size="md" iconStart={<QrCode />} onClick={onPay}>
              {t('friends.standing.pay.cta')}
            </Button>
          )}
          <Button variant="tonal" size="md" onClick={onSettle}>
            {t('friends.settle.cta')}
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
  const t = useT()
  const description = blockedText(name, blockers)
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('friends.blocked.title', { name })}
      description={description}
      footer={
        <div className={styles.sheetActions}>
          {onSettle && (
            <Button block onClick={onSettle}>
              {t('friends.settle.cta')}
            </Button>
          )}
          <Button block variant={onSettle ? 'ghost' : 'primary'} onClick={onClose}>
            {t('friends.blocked.ok.cta')}
          </Button>
        </div>
      }
    />
  )
}
