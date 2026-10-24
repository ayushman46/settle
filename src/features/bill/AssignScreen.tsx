import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, ListChecks, Send, UsersRound } from 'lucide-react'
import {
  ActionBar,
  AvatarStack,
  Button,
  Card,
  describePeople,
  EmptyState,
  List,
  ListRow,
  Money,
  PageTitle,
  Screen,
  TopBar,
  useToast,
} from '../../components'
import { useFriendsById, useProfile } from '../../data'
import { useT } from '../../i18n'
import { formatQuantity } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { validShares } from '../../lib/split'
import { reducer } from '../../state/reducer'
import { assignedCount, firstUnassignedIndex, stepProgress, unassignedItems } from '../../state/selectors'
import { useFlow, useSession } from '../../state/store'
import type { Shares } from '../../types'
import { CLAIMS_ENABLED } from '../claim/enabled'
import { claimBoardPath, claimRoundFromBill, claimStartError } from '../claim/startClaimRound'
import { AssignSheet, type AssignDirection } from './AssignSheet'
import { linkToFriends } from './billPeople'
import { withOwnerAvatar, useOwnerAvatarName } from './ownerAvatar'
import { ASSIGNMENT_KEYS, restoreAssignments } from './undoMerge'
import styles from './AssignScreen.module.css'

/** "Who had what?" — every item gets its people, one pop-up per item. */
export function AssignScreen() {
  const { session, dispatch } = useSession()
  const flow = useFlow()
  const toast = useToast()
  const { items, people, currency } = session
  const ownerName = useOwnerAvatarName()
  const friendsById = useFriendsById()
  const profile = useProfile()
  const t = useT()

  const sessionRef = useRef(session)
  useLayoutEffect(() => {
    sessionRef.current = session
  })

  const total = items.length
  const assigned = assignedCount(session)
  const left = total - assigned
  const canAssign = total > 0 && people.length > 0

  // Arriving with work to do: the pop-up opens straight away on the first item nobody is on.
  const [open, setOpen] = useState(() => canAssign && firstUnassignedIndex(session) !== -1)
  const [cursor, setCursor] = useState(() => {
    const first = firstUnassignedIndex(session)
    return first !== -1 ? first : session.assignCursor
  })
  const [direction, setDirection] = useState<AssignDirection>('forward')
  const toResult = useRef(false)

  const baseId = useId()
  const rowId = (itemId: string) => `${baseId}-row-${itemId}`
  // The row of the item on show: where focus lands when the sheet closes and nothing opened it
  // (it pops up by itself on arrival).
  const sheetRow = useRef<HTMLElement | null>(null)
  const shownId = items[cursor]?.id
  useLayoutEffect(() => {
    sheetRow.current = shownId === undefined ? null : document.getElementById(`${baseId}-row-${shownId}`)
  })

  const [openedAt] = useState(cursor)
  useEffect(() => {
    dispatch({ type: 'setAssignCursor', index: openedAt })
  }, [dispatch, openedAt])

  const moveTo = (index: number, dir: AssignDirection) => {
    setDirection(dir)
    setCursor(index)
    dispatch({ type: 'setAssignCursor', index })
  }

  const openAt = (index: number) => {
    moveTo(index, 'forward')
    setOpen(true)
  }

  const finish = () => {
    const first = firstUnassignedIndex(session)
    if (first === -1) {
      haptic('success')
      toResult.current = true
      setOpen(false)
      return
    }
    haptic('warning')
    toast(t('bill.assign.stillNeeds.toast', { count: left }), { tone: 'info' })
    moveTo(first, first < cursor ? 'back' : 'forward')
  }

  const shareRest = () => {
    const before = sessionRef.current
    const targets = unassignedItems(before)
    if (targets.length === 0 || before.people.length === 0) return
    const evenly: Shares = Object.fromEntries(before.people.map((p) => [p.id, 1]))
    const expected: Record<string, Shares> = {}
    for (const item of targets) {
      dispatch({ type: 'setEveryone', itemId: item.id, on: true })
      expected[item.id] = evenly
    }
    // This button goes away now that nothing is left: keep focus in the list.
    const first = before.items[0]
    if (first) document.getElementById(rowId(first.id))?.focus()
    haptic('success')
    const n = targets.length
    toast(t('bill.assign.sharedRest.toast', { count: n }), {
      tone: 'success',
      action: {
        label: t('bill.undo.cta'),
        onAction: () => {
          const restored = restoreAssignments(sessionRef.current, before, expected)
          if (restored) dispatch({ type: 'restore', session: restored, keys: ASSIGNMENT_KEYS })
        },
      },
    })
  }

  // "Rather let them pick?": save the bill as it is (sorted items stay sorted) and send a claim link.
  const startClaims = () => {
    let current = sessionRef.current
    try {
      const links = linkToFriends(current.people, friendsById, profile.name)
      if (Object.keys(links).length > 0) current = reducer(current, { type: 'linkPeople', links })
      const round = claimRoundFromBill(current)
      haptic('success')
      flow.finish(claimBoardPath(round.id, true))
    } catch (error) {
      haptic('error')
      toast(claimStartError(error), { tone: 'error' })
    }
  }

  const subtitle =
    total === 0
      ? undefined
      : left === 0
        ? t('bill.assign.allSet')
        : t('bill.assign.progress', { assigned, total })

  return (
    <Screen
      header={<TopBar onBack={flow.back} progress={stepProgress('assign') ?? undefined} />}
      footer={
        <ActionBar hint={canAssign && left > 0 ? t('bill.assign.left.hint', { count: left }) : undefined}>
          <Button block iconEnd={<ArrowRight />} disabled={!canAssign || left > 0} onClick={() => flow.goTo('result')}>
            {t('bill.assign.result.cta')}
          </Button>
        </ActionBar>
      }
    >
      <div className={styles.titleBlock}>
        <PageTitle title={t('bill.assign.title')} subtitle={subtitle} />
        {total > 0 && (
          <div className={styles.meter} aria-hidden="true">
            <span className={styles.meterFill} style={{ transform: `scaleX(${assigned / total})` }} />
          </div>
        )}
      </div>

      {total === 0 ? (
        <EmptyState
          icon={<ListChecks />}
          title={t('bill.assign.noItems.title')}
          text={t('bill.assign.noItems.body')}
          action={
            <Button size="md" onClick={() => flow.goTo('review')}>
              {t('bill.assign.noItems.cta')}
            </Button>
          }
        />
      ) : people.length === 0 ? (
        <EmptyState
          icon={<UsersRound />}
          title={t('bill.people.title')}
          text={t('bill.assign.noPeople.body')}
          action={
            <Button size="md" onClick={() => flow.goTo('people')}>
              {t('bill.assign.noPeople.cta')}
            </Button>
          }
        />
      ) : (
        <>
          {CLAIMS_ENABLED && left > 0 && (
            <Card className={styles.claim}>
              <span className={styles.claimIcon} aria-hidden="true">
                <Send strokeWidth={2.25} />
              </span>
              <p className={styles.claimText}>{t('claim.entry.assign')}</p>
              <Button size="sm" variant="secondary" onClick={startClaims}>
                {t('claim.entry.assignButton')}
              </Button>
            </Card>
          )}

          {left > 0 && people.length > 1 && (
            <Button variant="secondary" size="md" iconStart={<UsersRound />} className={styles.quick} onClick={shareRest}>
              {t(left === total ? 'bill.assign.shareAll.cta' : 'bill.assign.shareRest.cta')}
            </Button>
          )}

          <Card padding="none">
            <List aria-label={t('bill.assign.list.aria')}>
              {items.map((item, index) => {
                const shares = validShares(session.assignments[item.id], people)
                const on = people.filter((p) => Object.hasOwn(shares, p.id))
                const all = on.length === people.length && people.length > 1
                const qty = item.quantity !== 1 ? ` × ${formatQuantity(item.quantity)}` : ''
                const rowVars = { name: item.name, amount: formatMoney(item.amount, currency), qty }
                const rowLabel =
                  on.length === 0
                    ? t('bill.assign.row.none.aria', rowVars)
                    : all
                      ? t('bill.assign.row.everyone.aria', rowVars)
                      : t('bill.assign.row.some.aria', { ...rowVars, names: describePeople(on.map((p) => p.name), 3) })
                return (
                  <ListRow
                    key={item.id}
                    id={rowId(item.id)}
                    aria-label={rowLabel}
                    title={item.name}
                    subtitle={
                      <>
                        <Money value={item.amount} currency={currency} size="inherit" />
                        {item.quantity !== 1 && ` · × ${formatQuantity(item.quantity)}`}
                      </>
                    }
                    trailing={
                      on.length > 0 ? (
                        <AvatarStack
                          people={withOwnerAvatar(on, ownerName)}
                          size="sm"
                          label={all ? t('bill.assign.row.everyone') : undefined}
                        />
                      ) : (
                        <span className={styles.pending}>{t('bill.assign.row.pending')}</span>
                      )
                    }
                    pending={on.length === 0}
                    onClick={() => openAt(index)}
                  />
                )
              })}
            </List>
          </Card>

          <AssignSheet
            open={open}
            index={cursor}
            direction={direction}
            onClose={() => setOpen(false)}
            onMove={moveTo}
            onDone={finish}
            fallbackFocus={sheetRow}
            onExited={() => {
              if (!toResult.current) return
              toResult.current = false
              flow.goTo('result')
            }}
          />
        </>
      )}
    </Screen>
  )
}
