import { useEffect, useLayoutEffect, useRef } from 'react'
import { ArrowRight, Send } from 'lucide-react'
import { ActionBar, Button, PageTitle, Screen, TopBar, useToast } from '../../components'
import { friendsStore, useFriendsById, useGroup, useProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { useT } from '../../i18n'
import { PeoplePicker } from '../../kit/index-a'
import { haptic } from '../../lib/haptics'
import { MAX_PEOPLE } from '../../lib/people'
import { reducer } from '../../state/reducer'
import { stepProgress } from '../../state/selectors'
import { useFlow, useSession } from '../../state/store'
import type { Person, Session } from '../../types'
import { CLAIMS_ENABLED } from '../claim/enabled'
import { claimBoardPath, claimRoundFromBill, claimStartError } from '../claim/startClaimRound'
import { linkToFriends, personById } from './billPeople'
import { PERSON_KEYS, restorePerson } from './undoMerge'
import styles from './PeopleScreen.module.css'

/** True when taking `personId` off the bill loses something: their items, or being the payer. */
function hasStake(session: Session, personId: string): boolean {
  if (session.payerId === personId) return true
  return Object.values(session.assignments).some((shares) => Object.hasOwn(shares, personId))
}

/**
 * "Who's splitting?" — pick everyone at the table from your people (or add someone new by
 * name). You're in by default. At least two people are needed to split.
 */
export function PeopleScreen() {
  const { session, dispatch } = useSession()
  const flow = useFlow()
  const toast = useToast()
  const group = useGroup(session.groupId)
  const friendsById = useFriendsById()
  const profile = useProfile()
  const t = useT()
  const { people } = session

  const sessionRef = useRef(session)
  useLayoutEffect(() => {
    sessionRef.current = session
  })

  // You're at the table by default: a bill's first visit here, with nobody yet, starts with you.
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    if (sessionRef.current.people.length > 0) return
    const me = personById(ME_ID)
    if (me) dispatch({ type: 'addPerson', person: me })
  }, [dispatch])

  const remove = (person: Person): void => {
    const before = sessionRef.current
    dispatch({ type: 'removePerson', personId: person.id })
    // Unticking someone who had nothing yet loses nothing: the picker says "removed" itself.
    if (!hasStake(before, person.id)) return
    toast(`Removed ${person.name}`, {
      action: {
        label: 'Undo',
        onAction: () => {
          const current = sessionRef.current
          const restored = restorePerson(current, before, person.id)
          if (restored) dispatch({ type: 'restore', session: restored, keys: PERSON_KEYS })
          // Never a silent no-op: say why it couldn't be undone.
          else if (current.people.some((p) => p.id === person.id)) toast(`${person.name} is already back`, { tone: 'info' })
          else if (current.people.length >= MAX_PEOPLE) toast("Couldn't undo — the table is full", { tone: 'info' })
        },
      },
    })
  }

  const onChange = (ids: string[]): void => {
    const current = sessionRef.current.people
    const wanted = new Set(ids)
    for (const person of current) if (!wanted.has(person.id)) remove(person)
    // Someone added a moment ago (the picker's "Add “Name”") is already in the store, if not yet in `friends`.
    const latest = friendsStore.get()
    for (const id of ids) {
      if (current.some((p) => p.id === id)) continue
      const person = personById(id, latest)
      if (person) dispatch({ type: 'addPerson', person })
    }
  }

  // "Let everyone pick their own": save the bill as it is and send one claim link instead.
  const startClaims = (): void => {
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

  const count = people.length
  const canNext = count >= 2
  const hint = canNext ? undefined : count === 0 ? 'Pick at least 2 people' : 'Pick one more person'
  const canClaim = CLAIMS_ENABLED && session.items.length > 0 && count >= 1

  return (
    <Screen
      header={<TopBar onBack={flow.back} progress={stepProgress('people') ?? undefined} />}
      footer={
        <ActionBar hint={hint}>
          <Button block iconEnd={<ArrowRight />} disabled={!canNext} onClick={flow.next}>
            Next: who had what
          </Button>
          {canClaim && (
            <div className={styles.claim}>
              <Button block variant="ghost" iconStart={<Send />} aria-describedby="people-claim-hint" onClick={startClaims}>
                {t('claim.entry.people')}
              </Button>
              <p id="people-claim-hint" className={styles.claimHint}>
                {t('claim.entry.peopleHint')}
              </p>
            </div>
          )}
        </ActionBar>
      }
    >
      <PageTitle title="Who's splitting?" subtitle="Everyone at the table — you're in already." />

      <PeoplePicker
        selectedIds={people.map((p) => p.id)}
        onChange={onChange}
        max={MAX_PEOPLE}
        groupMemberIds={group?.memberIds}
        label="Search or add people at the table"
        className={styles.picker}
      />
    </Screen>
  )
}
