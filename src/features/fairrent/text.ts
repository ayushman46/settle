/** Words for Fair rent: the one-line reason for each person's amount, and the whole split as a message. */
import { t } from '../../i18n'
import { formatMoney } from '../../lib/money'
import type { FairPlan, FairResult, PersonRent, Room } from './engine'

/** "a", "a and b", "a, b and c". */
export function joined(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  return t('fairrent.list.and', { head: parts.slice(0, -1).join(', '), last: parts[parts.length - 1] ?? '' })
}

/** "the large room with the bathroom and AC". */
export function roomWords(room: Room): string {
  const base = room.sqft !== null && room.sqft > 0 ? t('fairrent.why.sqft', { n: room.sqft }) : t(`fairrent.why.size.${room.size}`)
  const extras: string[] = []
  if (room.bath) extras.push(t('fairrent.why.bath'))
  if (room.balcony) extras.push(t('fairrent.why.balcony'))
  if (room.ac) extras.push(t('fairrent.why.ac'))
  if (room.tweak > 0) extras.push(t('fairrent.why.up', { n: room.tweak }))
  if (room.tweak < 0) extras.push(t('fairrent.why.down', { n: -room.tweak }))
  return extras.length > 0 ? t('fairrent.why.with', { room: base, extras: joined(extras) }) : base
}

/** Why this person pays what they pay, in one line. */
export function reasonLine(person: PersonRent, nameOf: (id: string) => string): string {
  const room = roomWords(person.room)
  return person.mates.length > 0 ? t('fairrent.why.shared', { room, names: joined(person.mates.map(nameOf)) }) : room
}

/** How a person's amount compares with a plain equal split. */
export function equalLine(person: PersonRent, currency: string): string {
  const money = (value: number): string => formatMoney(value, currency, { trimZeros: true })
  if (person.diff === 0) return t('fairrent.result.equal.same')
  const vars = { equal: money(person.equal), diff: money(Math.abs(person.diff)) }
  return person.diff > 0 ? t('fairrent.result.equal.more', vars) : t('fairrent.result.equal.less', vars)
}

/** The split as a message for the flat's chat. `nameOf` gives names as others see them (never "You"). */
export function splitMessage(plan: FairPlan, result: FairResult, nameOf: (id: string) => string): string {
  if (result.people.length === 0 || result.total <= 0) return ''
  const money = (value: number): string => formatMoney(value, plan.currency, { trimZeros: true })
  const lines = [t('fairrent.message.head', { amount: money(result.total) })]
  for (const person of result.people) {
    lines.push(t('fairrent.message.line', { name: nameOf(person.friendId), amount: money(person.amount), why: reasonLine(person, nameOf) }))
  }
  lines.push(t('fairrent.message.method', { pct: plan.commonPct }))
  const equal = result.people[0]?.equal ?? 0
  // Only said when it is true for everyone: an equal split that needs an odd rupee is not "each".
  if (result.people.length > 1 && result.people.every((p) => p.equal === equal)) lines.push(t('fairrent.message.equal', { amount: money(equal) }))
  return lines.join('\n')
}
