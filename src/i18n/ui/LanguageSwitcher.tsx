/**
 * The language switcher on public pages (`/pay`, `/claim`, `/pool`): a small pill with the current
 * language's own name; tapping it opens the phone's own list of Settle's languages. The pick is
 * remembered on this phone for public pages only — a friend opening a pay link has no profile and
 * nothing is written into app data.
 *
 * Only one shows per page, wherever it is mounted (the shared public frame or a page itself): a
 * second instance renders nothing while the first is up.
 */
import { ChevronDown, Languages } from 'lucide-react'
import { useId, useLayoutEffect, useState, useSyncExternalStore, type ChangeEvent } from 'react'
import type { LanguageCode } from '../../domain/types'
import { savePublicLanguage } from '../language'
import { isLanguageCode, LANGUAGES, languageInfo } from '../languages'
import { hasCatalog } from '../load'
import { useLang, useT } from '../react'
import { setLanguage } from '../runtime'
import styles from './LanguageSwitcher.module.css'

export interface LanguageSwitcherProps {
  /** `page`: its own right-aligned row at the top of a page's content; `inline` (default): just the pill. */
  placement?: 'inline' | 'page'
  className?: string
}

/* ------------------------------------------------------------------ one per page */

const mounted: string[] = []
const listeners = new Set<() => void>()

function useFirstMounted(id: string): boolean {
  useLayoutEffect(() => {
    mounted.push(id)
    for (const l of [...listeners]) l()
    return () => {
      const at = mounted.indexOf(id)
      if (at !== -1) mounted.splice(at, 1)
      for (const l of [...listeners]) l()
    }
  }, [id])
  const first = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => mounted[0] ?? null,
    () => null,
  )
  // Registered before paint (layout effect), so a second instance never flashes up.
  return first === null || first === id
}

/* ------------------------------------------------------------------ the pill */

export function LanguageSwitcher({ placement = 'inline', className }: LanguageSwitcherProps) {
  const t = useT()
  const lang = useLang()
  const id = useId()
  const shown = useFirstMounted(id)
  const [pending, setPending] = useState<LanguageCode | null>(null)
  if (!shown) return null
  const current = languageInfo(pending ?? lang)

  const choose = async (event: ChangeEvent<HTMLSelectElement>): Promise<void> => {
    const code = event.target.value
    if (!isLanguageCode(code) || code === lang) return
    setPending(code)
    savePublicLanguage(code)
    await setLanguage(code)
    setPending(null)
  }

  const pill = (
    <label className={[styles.pill, placement === 'inline' ? className : undefined].filter(Boolean).join(' ')} data-busy={pending ? 'true' : undefined}>
      <Languages size={16} aria-hidden="true" />
      <span className={styles.name} lang={current.code}>
        {current.native}
      </span>
      <ChevronDown size={14} aria-hidden="true" />
      <select className={styles.select} value={pending ?? lang} onChange={(e) => void choose(e)} aria-label={t('common.language.label')} aria-busy={pending ? true : undefined}>
        {LANGUAGES.filter((l) => hasCatalog(l.code)).map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.code === 'en' ? l.native : `${l.native} · ${l.english}`}
          </option>
        ))}
      </select>
    </label>
  )
  return placement === 'page' ? <div className={[styles.row, className].filter(Boolean).join(' ')}>{pill}</div> : pill
}
