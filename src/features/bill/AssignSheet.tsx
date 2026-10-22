import { useEffect, useRef, useState, type RefObject } from 'react'
import { ArrowLeft, ArrowRight, Equal, SlidersHorizontal } from 'lucide-react'
import { ActionBar, BottomSheet, Button, Chip, Money, PersonToggle, Progress, Stepper } from '../../components'
import { formatQuantity } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { itemShareAmounts, validShares } from '../../lib/split'
import { MAX_WEIGHT } from '../../state/reducer'
import { isAssigned } from '../../state/selectors'
import { useSession } from '../../state/store'
import type { Session, Shares } from '../../types'
import styles from './AssignSheet.module.css'

/** Past this many items the "Item 3 of 8" dots would get too small; the text stays. */
const MAX_DOTS = 12
/** Default top of the share stepper ("had 20 of the beers"); raised to the line's quantity when bigger. */
const DEFAULT_MAX_SHARES = 20

export type AssignDirection = 'forward' | 'back'

export interface AssignSheetProps {
  open: boolean
  /** Index of the item on show. */
  index: number
  /** Which way the last move went (the content slides that way). */
  direction: AssignDirection
  onClose: () => void
  /** Show another item (Next / Back / swipe / arrow keys). */
  onMove: (index: number, direction: AssignDirection) => void
  /** "Done": no other item still needs someone. */
  onDone: () => void
  onExited?: () => void
  /** Where focus goes when the sheet closes and nothing opened it (e.g. it opened by itself). */
  fallbackFocus?: RefObject<HTMLElement | null>
}

/** The next item after `at` (wrapping round) that nobody is on yet, or -1 when there is none. */
function nextOpenIndex(session: Session, at: number): number {
  const count = session.items.length
  for (let step = 1; step < count; step++) {
    const index = (at + step) % count
    const item = session.items[index]
    if (item && !isAssigned(session, item.id)) return index
  }
  return -1
}

/**
 * The per-item pop-up: "Item 3 of 8 · Butter Chicken — who had it?". Tap people (live share
 * preview on each), optionally split by shares, then Next — the sheet stays up and the next
 * item slides in. Swipe sideways or use ←/→ to step through items.
 */
export function AssignSheet({
  open,
  index,
  direction,
  onClose,
  onMove,
  onDone,
  onExited,
  fallbackFocus,
}: AssignSheetProps) {
  const { session, dispatch } = useSession()
  const { items, people, currency } = session
  const [unevenItemId, setUnevenItemId] = useState<string | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)

  const count = items.length
  const at = Math.min(Math.max(index, 0), Math.max(count - 1, 0))
  const item = items[at]
  const itemId = item?.id

  // Stepping on often disables "Next" (nobody picked yet on the new item) — and a disabled
  // button drops focus to the page, where ←/→ no longer reach the sheet. Keep focus in the sheet.
  useEffect(() => {
    if (!open) return
    const active = document.activeElement
    const lost = active === null || active === document.body || (active instanceof HTMLButtonElement && active.disabled)
    if (lost) anchorRef.current?.closest<HTMLElement>('[role="dialog"]')?.focus({ preventScroll: true })
  }, [open, itemId])

  if (!item) return null

  const shares = validShares(session.assignments[item.id], people)
  const selectedIds = Object.keys(shares)
  const selected = selectedIds.length
  const everyone = people.length > 0 && selected === people.length
  const preview = itemShareAmounts(item.amount, shares, people)
  const weights = Object.values(shares)
  const totalShares = weights.reduce((a, b) => a + b, 0)
  const unevenWeights = weights.some((w) => w !== weights[0])
  const uneven = selected >= 2 && (unevenWeights || unevenItemId === item.id)
  const isFirst = at === 0
  const canGo = selected > 0
  // "Next" skips items that already have people (e.g. back from the result to fix one item);
  // when nothing else needs someone, it's "Done". A first pass goes one by one, as before.
  const nextOpen = nextOpenIndex(session, at)
  const finishing = nextOpen === -1

  const wholeQty = Number.isInteger(item.quantity) && item.quantity >= 2 ? item.quantity : null
  const maxShares = Math.min(MAX_WEIGHT, Math.max(DEFAULT_MAX_SHARES, wholeQty ?? 0))

  const setShares = (next: Shares) => dispatch({ type: 'setShares', itemId: item.id, shares: next })

  const goNext = () => {
    if (!canGo) {
      haptic('warning')
      return
    }
    if (finishing) {
      onDone()
      return
    }
    haptic('tap')
    onMove(nextOpen, nextOpen > at ? 'forward' : 'back')
  }

  const goBack = () => {
    if (!isFirst) onMove(at - 1, 'back')
  }

  const toggleUneven = () => {
    if (uneven) {
      const even: Shares = {}
      for (const id of selectedIds) even[id] = 1
      setShares(even)
      setUnevenItemId(null)
    } else {
      setUnevenItemId(item.id)
    }
  }

  const nameOf = (id: string | undefined) => people.find((p) => p.id === id)?.name ?? ''
  let summary: string
  if (selected === 0) summary = 'Tap everyone who had some.'
  else if (selected === 1) summary = `${nameOf(selectedIds[0])} had all of it.`
  else if (uneven) summary = `Split by shares · ${totalShares} in all`
  else {
    const amounts = Object.values(preview)
    const each = amounts[0] ?? 0
    const equal = amounts.every((a) => a === each)
    const who = everyone ? 'Shared by everyone' : `Split ${selected} ways`
    summary = equal ? `${who} · ${formatMoney(each, currency)} each` : who
  }

  const position = `Item ${at + 1} of ${count}`
  // "4 × ₹75.00" only when the line splits exactly; "3 × ₹33.33" for ₹100 would be a lie.
  const unitPrice = wholeQty !== null && item.amount % wholeQty === 0 ? item.amount / wholeQty : null

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onExited={onExited}
      fallbackFocus={fallbackFocus}
      contentKey={item.id}
      direction={direction}
      onSwipeNext={canGo && !finishing ? goNext : undefined}
      onSwipePrev={isFirst ? undefined : goBack}
      eyebrow={
        <span className={styles.eyebrow}>
          <span>{position}</span>
          {count > 1 && count <= MAX_DOTS && (
            <Progress variant="dots" current={at + 1} total={count} label={position} />
          )}
        </span>
      }
      title={item.name}
      description={
        <span className={styles.price}>
          <Money value={item.amount} currency={currency} strong />
          {item.quantity !== 1 && ' '}
          {item.quantity !== 1 && (
            <span className={styles.qty}>
              {unitPrice !== null
                ? `${formatQuantity(item.quantity)} × ${formatMoney(unitPrice, currency)}`
                : `× ${formatQuantity(item.quantity)}`}
            </span>
          )}
        </span>
      }
      footer={
        <>
          <p className="visually-hidden" aria-live="polite">
            {open ? `${position}: ${item.name}` : ''}
          </p>
          <ActionBar hint={canGo ? undefined : 'Pick who had this'} direction="row">
            {!isFirst && (
              <Button variant="secondary" iconStart={<ArrowLeft />} onClick={goBack}>
                Back
              </Button>
            )}
            <Button disabled={!canGo} iconEnd={finishing ? undefined : <ArrowRight />} onClick={goNext}>
              {finishing ? 'Done' : 'Next'}
            </Button>
          </ActionBar>
        </>
      }
    >
      <div ref={anchorRef} className={styles.head}>
        <p className={styles.summary} aria-live="polite">
          {summary}
        </p>
        {people.length > 1 && (
          <Chip
            selected={everyone}
            onClick={() => dispatch({ type: 'setEveryone', itemId: item.id, on: !everyone })}
          >
            Everyone
          </Chip>
        )}
      </div>

      <div role="group" aria-label={`Who had ${item.name}?`} className={styles.grid}>
        {people.map((person) => {
          const on = Object.hasOwn(shares, person.id)
          const amount = preview[person.id]
          return (
            <PersonToggle
              key={person.id}
              name={person.name}
              color={person.color}
              selected={on}
              meta={on && amount !== undefined ? formatMoney(amount, currency) : undefined}
              onToggle={() => dispatch({ type: 'togglePerson', itemId: item.id, personId: person.id })}
              trailing={
                uneven && on ? (
                  <Stepper
                    label={`Shares for ${person.name}`}
                    value={shares[person.id] ?? 1}
                    min={1}
                    max={maxShares}
                    onChange={(value) => setShares({ ...shares, [person.id]: value })}
                  />
                ) : undefined
              }
            />
          )
        })}
      </div>

      {selected >= 2 && (
        <div className={styles.splitRow}>
          <button type="button" className={styles.splitToggle} onClick={toggleUneven}>
            {uneven ? (
              <Equal aria-hidden="true" strokeWidth={2.25} />
            ) : (
              <SlidersHorizontal aria-hidden="true" strokeWidth={2.25} />
            )}
            {uneven ? 'Split evenly' : 'Split unevenly'}
          </button>
          {uneven && wholeQty !== null && wholeQty <= maxShares && (
            <span className={styles.qtyHint}>{wholeQty} on the bill</span>
          )}
        </div>
      )}
    </BottomSheet>
  )
}
