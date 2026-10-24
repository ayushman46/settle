/**
 * Choosing the app's language (onboarding's first step, You → Language): load it, switch, then
 * save the choice in the profile — so it survives reloads and goes into backups. null means
 * "Automatic": follow the phone's languages.
 */
import { updateProfile } from '../../data'
import type { LanguageCode } from '../../domain/types'
import { browserLanguages, detectLanguage } from '../../i18n/language'
import { getLanguage, setLanguage } from '../../i18n/runtime'

let latest = 0

/** The language "Automatic" gives on this phone. */
export function phoneLanguage(): LanguageCode {
  return detectLanguage(browserLanguages())
}

/**
 * Switches to `choice` (null = the phone's language) once its chunk is in, then saves it.
 * 'failed' when the chunk couldn't load (nothing changes); 'superseded' when a later choice
 * came in first (that one wins).
 */
export async function chooseAppLanguage(choice: LanguageCode | null): Promise<'ok' | 'failed' | 'superseded'> {
  const mine = ++latest
  const target = choice ?? phoneLanguage()
  const switched = await setLanguage(target)
  if (mine !== latest) return 'superseded'
  if (!switched && getLanguage() !== target) return 'failed'
  updateProfile({ language: choice })
  return 'ok'
}
