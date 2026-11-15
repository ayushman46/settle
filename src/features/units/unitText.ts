/**
 * How households are named and spoken about. A household nobody named is called after its people:
 * "The Sharmas" when two or more of them share a last name, "Rahul and Priya" for a pair,
 * "Rahul’s family" otherwise. Sentences keep their grammar: "The Sharmas pay the Khans",
 * "Sam pays the Khans", "You pay Sam".
 */
import { ME_ID, type Friend } from '../../domain/types'
import { t } from '../../i18n'
import { friendLabel, friendObjectLabel } from '../../kit/friendName'
import { firstName } from '../../share/text'
import type { Unit, UnitsSummary } from './engine'

export interface UnitPeople {
  friendsById: Readonly<Record<string, Pick<Friend, 'name'> | undefined>>
  /** The owner's own name (their profile's): only used to spot a shared family name. */
  myName?: string | null
}

const WORD = /^\p{L}[\p{L}'’-]+$/u

function fullName(id: string, people: UnitPeople): string {
  return (id === ME_ID ? (people.myName ?? '') : (people.friendsById[id]?.name ?? '')).trim()
}

/** The last name two or more members share ("Rahul Sharma", "Priya Sharma"), or null. */
function sharedSurname(unit: Unit, people: UnitPeople): string | null {
  const counts = new Map<string, { word: string; n: number }>()
  for (const id of unit.memberIds) {
    const words = fullName(id, people).split(/\s+/).filter(Boolean)
    const last = words[words.length - 1]
    if (words.length < 2 || !last || !WORD.test(last)) continue
    const key = last.toLocaleLowerCase('en')
    const entry = counts.get(key)
    if (entry) entry.n++
    else counts.set(key, { word: last, n: 1 })
  }
  const shared = [...counts.values()].filter((entry) => entry.n >= 2)
  return shared.length === 1 ? (shared[0]?.word ?? null) : null
}

const short = (id: string, people: UnitPeople): string => firstName(friendLabel(id, people.friendsById[id] ?? null))

/** What a household is called when nobody has named it. */
export function defaultUnitName(unit: Unit, people: UnitPeople): string {
  const surname = sharedSurname(unit, people)
  if (surname) return /(s|x|z|ch|sh)$/i.test(surname) ? t('units.name.surnameFamily', { surname }) : t('units.name.surname', { surname })
  if (unit.memberIds.length === 2) {
    const [first, second] = unit.memberIds.includes(ME_ID) ? [ME_ID, unit.memberIds.find((id) => id !== ME_ID) ?? ''] : unit.memberIds
    return t('units.name.pair', { a: short(first ?? '', people), b: short(second ?? '', people) })
  }
  const adult = unit.memberIds.find((id) => !unit.childIds.includes(id)) ?? unit.payerId
  return adult === ME_ID ? t('units.name.yours') : t('units.name.family', { name: short(adult, people) })
}

/** The unit's name: the person's own when they are on their own, else the household's (typed, or worked out). */
export function unitLabel(unit: Unit, people: UnitPeople): string {
  if (!unit.household) return friendLabel(unit.memberIds[0] ?? unit.id, people.friendsById[unit.memberIds[0] ?? unit.id] ?? null)
  return unit.name || defaultUnitName(unit, people)
}

/** A name as it reads in the middle of a sentence: "the Khans", "you and Riya", "your family". */
export function midSentence(label: string): string {
  return label.replace(/^The /, 'the ').replace(/^You(r?)\b/, (_, r: string) => `you${r}`)
}

/** The unit's name as the object of a sentence ("… pay the Khans", "… pays you"). */
export function unitObjectLabel(unit: Unit, people: UnitPeople): string {
  if (!unit.household) return friendObjectLabel(unit.memberIds[0] ?? unit.id, people.friendsById[unit.memberIds[0] ?? unit.id] ?? null)
  return midSentence(unitLabel(unit, people))
}

/** True when the name takes "pay", not "pays": you, "The Sharmas", "Rahul and Priya". */
export function isPluralName(unit: Unit, label: string): boolean {
  if (!unit.household) return unit.memberIds[0] === ME_ID
  return /s$/i.test(label) || /\s(and|&)\s/i.test(label)
}

/** "The Sharmas pay the Khans", "Sam pays the Khans", "You pay Sam". */
export function paySentence(from: Unit, to: Unit, people: UnitPeople): string {
  const label = unitLabel(from, people)
  return t(isPluralName(from, label) ? 'units.pay.plural' : 'units.pay.singular', { from: label, to: unitObjectLabel(to, people) })
}

/** "The Sharmas paid the Khans", from names as they were when it was recorded. */
export function paidSentence(fromName: string, toName: string): string {
  return t('units.paid', { from: fromName, to: midSentence(toName) })
}

/** "Rahul, Priya, Anu (child)": a household's people, in its own order. */
export function membersLine(unit: Unit, people: UnitPeople): string {
  return unit.memberIds
    .map((id) => {
      const name = friendLabel(id, people.friendsById[id] ?? null)
      return unit.childIds.includes(id) ? t('units.member.child', { name }) : name
    })
    .join(', ')
}

/**
 * The household split in one line: "Per family: 3 equal parts. The Sharmas: one part between 4
 * people." or "Per head, children at half: 6 adults, 2 children." Empty for a plain per-head split.
 */
export function splitLine(summary: UnitsSummary, people: UnitPeople): string {
  if (summary.basis === 'family') {
    const main = summary.largest
      ? t('units.bar.family', { parts: summary.parts, name: unitLabel(summary.largest.unit, people), count: summary.largest.count })
      : t('units.bar.family.plain', { parts: summary.parts })
    if (summary.childCount === 0 || summary.children === 'full') return main
    return `${main} ${t(summary.children === 'half' ? 'units.bar.rule.half' : 'units.bar.rule.free')}`
  }
  if (summary.childCount === 0 || summary.children === 'full') return ''
  return t(summary.children === 'half' ? 'units.bar.head.half' : 'units.bar.head.free', { adults: summary.adults, children: summary.childCount })
}
