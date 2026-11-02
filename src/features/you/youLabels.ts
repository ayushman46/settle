/** Short lines for the You tab's rows, in the UI language. Pure, so the rows and their tests agree. */
import { ME_ID, type Friend, type RecurringTemplate } from '../../domain/types'
import { t } from '../../i18n'

/** "Riya, Sam and 4 more" — most recent first (pass `useFriends()` order); a nudge when there's nobody yet. */
export function peopleLine(friends: readonly Friend[]): string {
  const [first, second, ...rest] = friends.filter((f) => f.id !== ME_ID).map((f) => f.name)
  if (first === undefined) return t('you.shortcuts.people.empty')
  if (second === undefined) return first
  if (rest.length === 0) return t('you.shortcuts.people.two', { first, second })
  return t('you.shortcuts.people.many', { first, second, count: rest.length })
}

/** "2 active · 1 due" once there are recurring splits (and Pro to run them); else what they're for. */
export function recurringLine(templates: readonly RecurringTemplate[], dueCount: number, unlocked: boolean): string {
  if (!unlocked || templates.length === 0) return t('you.shortcuts.recurring.empty')
  const active = templates.filter((template) => template.active).length
  const parts = [active > 0 ? t('you.shortcuts.recurring.active', { count: active }) : t('you.shortcuts.recurring.paused')]
  if (dueCount > 0) parts.push(t('you.shortcuts.recurring.due', { count: dueCount }))
  return parts.join(' · ')
}
