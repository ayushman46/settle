import { useLayoutEffect } from 'react'
import { profileStore, useStore } from '../data'
import type { Profile } from '../domain/types'
import { setHapticsEnabled } from '../lib/haptics'
import { useHasFeature } from '../pro/store'
import { applyAppearance, clearAppearance, effectiveAccent } from './appearance'

const selectTheme = (p: Profile) => p.theme
const selectAccent = (p: Profile) => p.accent
const selectHaptics = (p: Profile) => p.haptics

/**
 * Keeps the page in step with the profile: theme (system / light / dark), the accent (Pro —
 * lime while Pro is off, the saved one again once it's back), the browser's theme colour, and
 * whether taps vibrate (the "Haptics" switch). Renders nothing; mount it once at the root.
 */
export function ThemeSync(): null {
  const theme = useStore(profileStore, selectTheme)
  const saved = useStore(profileStore, selectAccent)
  const haptics = useStore(profileStore, selectHaptics)
  const themes = useHasFeature('themes')
  const accent = effectiveAccent(saved, themes)

  // Before paint, so a change in Settings never shows a frame of the old look.
  useLayoutEffect(() => {
    applyAppearance({ theme, accent })
  }, [theme, accent])

  useLayoutEffect(() => clearAppearance, [])

  // Before the next tap's cue: turning haptics off silences the very next one.
  useLayoutEffect(() => {
    setHapticsEnabled(haptics)
    return () => setHapticsEnabled(true)
  }, [haptics])

  return null
}
