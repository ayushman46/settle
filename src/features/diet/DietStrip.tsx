/**
 * "Anyone not drinking, or vegetarian?" at the top of the Assign step: two toggles a person,
 * remembered by friend, and the drinks and meat dishes on the bill taken off whoever doesn't have
 * them. It applies by itself when the step opens with remembered people, whenever a toggle
 * changes, and as items get their people; anyone put back by hand stays put.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Leaf, WineOff } from 'lucide-react'
import { Banner, Card, Chip, describePeople, useToast } from '../../components'
import { ME_ID } from '../../domain/types'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { formatMoney } from '../../lib/money'
import { useSession } from '../../state/store'
import type { Shares } from '../../types'
import type { DietKind } from './classify'
import { applyPlan, avoids, classifiedItems, dietLines, dietPlan, pairKey, putBack, type Taken } from './engine'
import { setDiet, updateDietBill, useDietBill, useDietPrefs } from './store'
import styles from './Diet.module.css'

export interface DietStripProps {
  /** The item pop-up is up (the strip and banner are behind it): changes are told in a toast too. */
  sheetOpen?: boolean
}

/** More people than this and the toggles start folded away. */
const FOLD_AT = 4

export function DietStrip({ sheetOpen = false }: DietStripProps) {
  const t = useT()
  const toast = useToast()
  const { session, dispatch } = useSession()
  const prefs = useDietPrefs()
  const bill = useDietBill(session.id)
  const { items, people, assignments, currency } = session
  const peopleIds = useMemo(() => people.map((p) => p.id), [people])
  const kinds = useMemo(() => classifiedItems(items), [items])
  const hasAlcohol = [...kinds.values()].includes('alcohol')
  const hasNonVeg = [...kinds.values()].includes('nonveg')
  const [open, setOpen] = useState(people.length <= FOLD_AT)
  const bodyId = useId()

  const live = useRef({ session, bill, sheetOpen })
  useLayoutEffect(() => {
    live.current = { session, bill, sheetOpen }
  })

  const setAll = (next: Record<string, Shares>) => {
    for (const [itemId, shares] of Object.entries(next)) dispatch({ type: 'setShares', itemId, shares })
  }

  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? ''

  // A saved bill opened again: who is on what now is what was chosen. Nothing changes until a toggle does.
  const editingSaved = session.expenseId !== null
  useEffect(() => {
    if (!editingSaved || bill) return
    const handled: string[] = []
    for (const [itemId, kind] of kinds) {
      for (const id of peopleIds) if (Object.hasOwn(assignments[itemId] ?? {}, id) && avoids(prefs[id], kind)) handled.push(pairKey(itemId, id))
    }
    updateDietBill(session.id, (b) => ({ ...b, handled: [...b.handled, ...handled] }))
  }, [editingSaved, bill, kinds, peopleIds, assignments, prefs, session.id])

  // Take people off what they don't have, once per person and item.
  useEffect(() => {
    if (editingSaved && !bill) return
    const handled = new Set(bill?.handled ?? [])
    const plan = dietPlan({ items, peopleIds, assignments, prefs, handled })
    if (plan.changes.length === 0 && plan.kept.length === 0) return
    const taken: Taken[] = plan.changes.flatMap((c) =>
      c.remove.map((person) => ({ item: c.itemId, person, w: assignments[c.itemId]?.[person] ?? 1 })),
    )
    const keptPairs = plan.kept.flatMap((k) => k.people.map((person) => pairKey(k.itemId, person)))
    setAll(applyPlan(assignments, plan.changes))
    updateDietBill(session.id, (b) => ({
      ...b,
      handled: [...b.handled, ...taken.map((e) => pairKey(e.item, e.person)), ...keptPairs],
      taken: [...b.taken, ...taken],
    }))
    const first = plan.changes[0]
    if (live.current.sheetOpen && first) {
      const item = items.find((i) => i.id === first.itemId)?.name ?? ''
      const names = describePeople(first.remove.map(nameOf), 3)
      const mine = taken.filter((e) => e.item === first.itemId)
      toast(t(first.kind === 'alcohol' ? 'diet.toast.alcohol' : 'diet.toast.nonveg', { item, names }), {
        action: { label: t('diet.banner.undo'), onAction: () => undo(mine) },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on what it reads; the helpers read `live`
  }, [editingSaved, bill, items, peopleIds, assignments, prefs, session.id])

  /** Puts these people back (where the item is still there and they aren't on it again) and forgets them as taken. */
  function undo(entries: readonly Taken[]) {
    const current = live.current.session
    const itemIds = new Set(current.items.map((i) => i.id))
    setAll(putBack(entries, itemIds, current.people.map((p) => p.id), current.assignments))
    const gone = new Set(entries.map((e) => pairKey(e.item, e.person)))
    updateDietBill(current.id, (b) => ({ ...b, taken: b.taken.filter((e) => !gone.has(pairKey(e.item, e.person))) }))
  }

  const toggle = (personId: string, kind: DietKind, on: boolean) => {
    const itemIds = [...kinds].filter(([, k]) => k === kind).map(([id]) => id)
    const pairs = new Set(itemIds.map((itemId) => pairKey(itemId, personId)))
    if (on) {
      // Asked again: their items of this kind are looked at afresh, hand-picked ones too.
      updateDietBill(session.id, (b) => ({ ...b, handled: b.handled.filter((k) => !pairs.has(k)) }))
    } else {
      // Not any more: back on the items the app took them off.
      const mine = (live.current.bill?.taken ?? []).filter((e) => e.person === personId && pairs.has(pairKey(e.item, e.person)))
      undo(mine)
      updateDietBill(session.id, (b) => ({ ...b, handled: b.handled.filter((k) => !pairs.has(k)) }))
    }
    setDiet(personId, kind, on)
  }

  if ((!hasAlcohol && !hasNonVeg) || people.length === 0) return null

  const lines = dietLines(bill?.taken ?? [], items, peopleIds, assignments)
  const kept = [...kinds].flatMap(([itemId, kind]) => {
    const on = peopleIds.filter((id) => Object.hasOwn(assignments[itemId] ?? {}, id))
    return on.length > 0 && on.every((id) => avoids(prefs[id], kind)) ? [{ itemId, on }] : []
  })
  const money = (minor: number) => formatMoney(minor, currency, { trimZeros: true })
  const remembered = people.filter((p) => (hasAlcohol && prefs[p.id]?.noAlcohol) || (hasNonVeg && prefs[p.id]?.veg)).length
  const title = t(hasAlcohol && hasNonVeg ? 'diet.strip.title.both' : hasAlcohol ? 'diet.strip.title.alcohol' : 'diet.strip.title.nonveg')

  return (
    <div className={styles.strip}>
      <Card className={styles.card}>
        <button type="button" className={styles.head} aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
          <span className={styles.headText}>
            <span className={styles.title}>{title}</span>
            {!open && <span className={styles.fine}>{t('diet.strip.summary', { count: remembered })}</span>}
          </span>
          <ChevronDown aria-hidden="true" className={cx(styles.chevron, open && styles.chevronOpen)} />
        </button>
        <div id={bodyId} hidden={!open} className={styles.body}>
          <p className={styles.fine}>{t('diet.strip.body')}</p>
          <ul className={styles.people} aria-label={t('diet.strip.people.aria')}>
            {people.map((person) => (
              <li key={person.id} className={styles.person}>
                <span className={styles.name}>{person.name}</span>
                <span className={styles.chips}>
                  {hasAlcohol && (
                    <Chip
                      selected={prefs[person.id]?.noAlcohol === true}
                      leading={<WineOff />}
                      aria-label={t('diet.strip.alcohol.aria', { name: person.name })}
                      onClick={() => toggle(person.id, 'alcohol', prefs[person.id]?.noAlcohol !== true)}
                    >
                      {t('diet.strip.alcohol')}
                    </Chip>
                  )}
                  {hasNonVeg && (
                    <Chip
                      selected={prefs[person.id]?.veg === true}
                      leading={<Leaf />}
                      aria-label={t('diet.strip.nonveg.aria', { name: person.name })}
                      onClick={() => toggle(person.id, 'nonveg', prefs[person.id]?.veg !== true)}
                    >
                      {t('diet.strip.nonveg')}
                    </Chip>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {(lines.length > 0 || kept.length > 0) && (
        <Banner
          tone="success"
          icon={null}
          action={
            lines.length > 0
              ? {
                  label: t('diet.banner.undo'),
                  onAction: () => {
                    undo(live.current.bill?.taken ?? [])
                    toast(t('diet.banner.undone'), { tone: 'info' })
                  },
                }
              : undefined
          }
        >
          {lines.map((line) => {
            const me = line.personId === ME_ID
            const key =
              line.kind === 'alcohol' ? (me ? 'diet.banner.alcohol.me' : 'diet.banner.alcohol') : me ? 'diet.banner.nonveg.me' : 'diet.banner.nonveg'
            return (
              <p key={`${line.personId}-${line.kind}`} className={styles.line}>
                {t(key, { name: nameOf(line.personId), count: line.count, amount: money(line.amount) })}
              </p>
            )
          })}
          {kept.slice(0, 2).map(({ itemId, on }) => (
            <p key={itemId} className={styles.line}>
              {t('diet.banner.kept', { item: items.find((i) => i.id === itemId)?.name ?? '', names: describePeople(on.map(nameOf), 3) })}
            </p>
          ))}
          {kept.length > 2 && <p className={styles.line}>{t('diet.banner.keptMore', { count: kept.length - 2 })}</p>}
        </Banner>
      )}
    </div>
  )
}
