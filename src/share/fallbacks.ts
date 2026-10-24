/**
 * Names and labels a share text falls back to when a person never gave one. They are written into
 * the link or text, so they're read in the language of whoever builds it (the sender), or — for a
 * fallback applied while a link is opened — in the viewer's language.
 */
import { t } from '../i18n'

/** "Your friend": the organiser or payee when their name is missing. */
export function friendFallback(): string {
  return t('share.fallback.friend')
}

/** "Person 2": the placeholder for the n-th person (1-based) when a name is missing. */
export function personFallback(n: number): string {
  return t('share.fallback.person', { n: String(n) })
}

/** True for the "Your friend" fallback, in English or in the UI language. */
export function isFriendFallback(name: string): boolean {
  return name === 'Your friend' || name === friendFallback()
}

/** "Someone": a person who has no name anywhere (a removed friend, an unnamed reply). */
export function someoneFallback(): string {
  return t('share.fallback.someone')
}
