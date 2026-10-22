import { useLayoutEffect } from 'react'
import { profileStore, useStore } from '../data'
import type { Profile } from '../domain/types'
import { useHasFeature } from '../pro/store'
import { applyAppearance, clearAppearance, effectiveAccent } from './appearance'

const selectTheme = (p: Profile) => p.theme
const selectAccent = (p: Profile) => p.accent

/**
 * Keeps the page's look in step with the profile: theme (system / light / dark), the accent (Pro —
 * lime while Pro is off, the saved one again once it's back) and the browser's theme colour.
 * Renders nothing; mount it once at the root.
 */
export function ThemeSync(): null {
  const theme = useStore(profileStore, selectTheme)
  const saved = useStore(profileStore, selectAccent)
  const themes = useHasFeature('themes')
  const accent = effectiveAccent(saved, themes)

  // Before paint, so a change in Settings never shows a frame of the old look.
  useLayoutEffect(() => {
    applyAppearance({ theme, accent })
  }, [theme, accent])

  useLayoutEffect(() => clearAppearance, [])

  return null
}
