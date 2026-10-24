/** Home's greeting: "Good evening" over "Hi, Ayush" — or "Hi there" until we know a name. */
import { t } from '../../i18n'
import { nameKey } from '../../lib/people'
import { firstName } from '../../share/text'

/** Names that don't say who the owner is (a skipped onboarding saves "You"). */
const PLACEHOLDERS: ReadonlySet<string> = new Set(['', 'you', 'me', 'myself', 'i'])

/** "Good morning" (5–11), "Good afternoon" (12–16), "Good evening" otherwise. */
export function timeOfDayGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return t('home.greet.morning')
  if (hour >= 12 && hour < 17) return t('home.greet.afternoon')
  return t('home.greet.evening')
}

/** The current local hour (0–23). */
export function currentHour(): number {
  return new Date().getHours()
}

/** The owner's first name, or null when their profile name is blank or a placeholder. */
export function greetingName(profileName: string): string | null {
  const name = firstName(profileName)
  return PLACEHOLDERS.has(nameKey(name)) ? null : name
}

/** "Hi, Ayush" / "Hi there". */
export function helloLine(profileName: string): string {
  const name = greetingName(profileName)
  return name ? t('home.greet.hiName', { name }) : t('home.greet.hi')
}
