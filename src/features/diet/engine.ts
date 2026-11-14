/**
 * Who comes off which item: given a bill's items, who is on each, and who doesn't drink or is
 * vegetarian, the people to take off each drink and each meat dish. Pure, so the Assign step and
 * its tests agree.
 *
 * Rules: only items the app is sure about (see `classifyItem`); only people who are on the item;
 * never an item left with nobody (when everyone on it would come off, it is left alone and said
 * so); and a person the app already handled on an item (taken off, or put back by hand) is never
 * touched there again.
 */
import type { Minor, Shares } from '../../types'
import { classifyItem, type DietKind } from './classify'

/** What one person doesn't have. Absent = has everything. */
export interface DietPrefs {
  noAlcohol?: true
  veg?: true
}

export interface DietItem {
  id: string
  name: string
  amount: Minor
}

/** Take `remove` off this item. */
export interface DietChange {
  itemId: string
  kind: DietKind
  remove: string[]
}

/** Everyone on this item would come off, so it is left as it is. */
export interface DietKept {
  itemId: string
  kind: DietKind
  people: string[]
}

export interface DietPlan {
  changes: DietChange[]
  kept: DietKept[]
}

export interface DietInput {
  items: readonly DietItem[]
  /** Everyone on the bill, in its order. */
  peopleIds: readonly string[]
  assignments: Readonly<Record<string, Shares>>
  prefs: Readonly<Record<string, DietPrefs | undefined>>
  /** Person-on-item pairs (`pairKey`) already handled: never touched again. */
  handled?: ReadonlySet<string>
}

/** One person on one item, as a key. */
export function pairKey(itemId: string, personId: string): string {
  return `${itemId}\u001f${personId}`
}

/** True when someone with `prefs` doesn't have things of `kind`. */
export function avoids(prefs: DietPrefs | undefined, kind: DietKind): boolean {
  return kind === 'alcohol' ? prefs?.noAlcohol === true : prefs?.veg === true
}

/** Each item the app is sure about, with its kind. */
export function classifiedItems(items: readonly DietItem[]): Map<string, DietKind> {
  const out = new Map<string, DietKind>()
  for (const item of items) {
    const kind = classifyItem(item.name)
    if (kind) out.set(item.id, kind)
  }
  return out
}

/** Which kinds of item this bill has (nothing to ask about when it has neither). */
export function billKinds(items: readonly DietItem[]): { alcohol: boolean; nonveg: boolean } {
  const kinds = new Set(classifiedItems(items).values())
  return { alcohol: kinds.has('alcohol'), nonveg: kinds.has('nonveg') }
}

/** The people on an item who are on the bill, in the bill's order. */
function peopleOn(shares: Readonly<Shares> | undefined, peopleIds: readonly string[]): string[] {
  if (!shares) return []
  return peopleIds.filter((id) => Object.hasOwn(shares, id) && (shares[id] ?? 0) > 0)
}

/** What to change on the bill, and which items are left alone because nobody else is on them. */
export function dietPlan({ items, peopleIds, assignments, prefs, handled }: DietInput): DietPlan {
  const changes: DietChange[] = []
  const kept: DietKept[] = []
  const kinds = classifiedItems(items)
  for (const item of items) {
    const kind = kinds.get(item.id)
    if (!kind) continue
    const on = peopleOn(assignments[item.id], peopleIds)
    const off = on.filter((id) => avoids(prefs[id], kind) && !handled?.has(pairKey(item.id, id)))
    if (off.length === 0) continue
    if (off.length === on.length) kept.push({ itemId: item.id, kind, people: off })
    else changes.push({ itemId: item.id, kind, remove: off })
  }
  return { changes, kept }
}

/** The new shares of each item a change touches. */
export function applyPlan(assignments: Readonly<Record<string, Shares>>, changes: readonly DietChange[]): Record<string, Shares> {
  const out: Record<string, Shares> = {}
  for (const change of changes) {
    const shares: Shares = { ...assignments[change.itemId] }
    for (const id of change.remove) delete shares[id]
    out[change.itemId] = shares
  }
  return out
}

/** A person the app took off an item, with the weight they had on it (to put them back). */
export interface Taken {
  item: string
  person: string
  w: number
}

/** One line of the banner: "Riya doesn't drink: taken off 3 drinks (₹1,240)". */
export interface DietLine {
  personId: string
  kind: DietKind
  count: number
  /** What those items came to, in full (not the person's share of them). */
  amount: Minor
}

/**
 * The banner's lines: for each person and kind, how many items they are off and what those came
 * to. Only removals that still stand count (someone put back by hand isn't "taken off").
 * In the bill's people order, drinks before dishes.
 */
export function dietLines(
  taken: readonly Taken[],
  items: readonly DietItem[],
  peopleIds: readonly string[],
  assignments: Readonly<Record<string, Shares>>,
): DietLine[] {
  const kinds = classifiedItems(items)
  const byId = new Map(items.map((item) => [item.id, item]))
  const lines = new Map<string, DietLine>()
  const seen = new Set<string>()
  for (const entry of taken) {
    const item = byId.get(entry.item)
    const kind = kinds.get(entry.item)
    if (!item || !kind || !peopleIds.includes(entry.person)) continue
    if (Object.hasOwn(assignments[entry.item] ?? {}, entry.person)) continue
    const pair = pairKey(entry.item, entry.person)
    if (seen.has(pair)) continue
    seen.add(pair)
    const key = `${entry.person}\u001f${kind}`
    const line = lines.get(key) ?? { personId: entry.person, kind, count: 0, amount: 0 }
    line.count += 1
    line.amount += item.amount
    lines.set(key, line)
  }
  const order = (line: DietLine) => peopleIds.indexOf(line.personId) * 2 + (line.kind === 'alcohol' ? 0 : 1)
  return [...lines.values()].sort((a, b) => order(a) - order(b))
}

/**
 * Puts back people the app took off (each with the weight they had), where the item still exists
 * and they aren't already on it again. Returns the new shares of each item that changes.
 */
export function putBack(
  taken: readonly Taken[],
  itemIds: ReadonlySet<string>,
  peopleIds: readonly string[],
  assignments: Readonly<Record<string, Shares>>,
): Record<string, Shares> {
  const out: Record<string, Shares> = {}
  for (const entry of taken) {
    if (!itemIds.has(entry.item) || !peopleIds.includes(entry.person)) continue
    const current = out[entry.item] ?? assignments[entry.item] ?? {}
    if (Object.hasOwn(current, entry.person)) continue
    const next: Shares = {}
    // In the bill's people order, so the item reads the same as before.
    for (const id of peopleIds) {
      if (id === entry.person) next[id] = Math.max(1, Math.floor(entry.w))
      else if (Object.hasOwn(current, id)) next[id] = current[id] ?? 1
    }
    out[entry.item] = next
  }
  return out
}
