/** Short lines for the You tab's rows. Pure, so the rows and their tests agree. */
import { ME_ID, type Friend, type RecurringTemplate } from '../../domain/types'

/** "Riya, Sam and 4 more" — most recent first (pass `useFriends()` order); a nudge when there's nobody yet. */
export function peopleLine(friends: readonly Friend[]): string {
  const names = friends.filter((f) => f.id !== ME_ID).map((f) => f.name)
  if (names.length === 0) return 'Add the people you split with'
  if (names.length <= 2) return names.join(' and ')
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`
}

/** "2 active · 1 due" once there are recurring splits (and Pro to run them); else what they're for. */
export function recurringLine(templates: readonly RecurringTemplate[], dueCount: number, unlocked: boolean): string {
  if (!unlocked || templates.length === 0) return 'Rent, Wi-Fi, subscriptions — split monthly'
  const active = templates.filter((t) => t.active).length
  const parts = [active > 0 ? `${active} active` : 'All paused']
  if (dueCount > 0) parts.push(`${dueCount} due`)
  return parts.join(' · ')
}
