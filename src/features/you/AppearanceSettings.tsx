import { useId, type CSSProperties } from 'react'
import { Check, Lock, Monitor, Moon, Sun } from 'lucide-react'
import { effectiveAccent } from '../../app/appearance'
import { Badge, SegmentedControl, type SegmentedOption } from '../../components'
import { updateProfile, useProfile } from '../../data'
import type { AccentId, ThemePref } from '../../domain/types'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { useHasFeature } from '../../pro'
import { CARD_ACCENTS } from '../../share/card/theme'
import { withPro } from '../pro/paywall'
import styles from './AppearanceSettings.module.css'

const THEMES: readonly SegmentedOption<ThemePref>[] = [
  { value: 'system', label: 'System', icon: <Monitor /> },
  { value: 'light', label: 'Light', icon: <Sun /> },
  { value: 'dark', label: 'Dark', icon: <Moon /> },
]

/** Lime is free; the rest come with Pro. */
const ACCENTS: ReadonlyArray<{ id: AccentId; name: string }> = [
  { id: 'lime', name: 'Lime' },
  { id: 'mint', name: 'Mint' },
  { id: 'sky', name: 'Sky' },
  { id: 'violet', name: 'Violet' },
  { id: 'coral', name: 'Coral' },
]

const FREE_ACCENT: AccentId = 'lime'

/**
 * Theme (system / light / dark) and the accent colour. Picking a Pro accent without Pro opens the
 * paywall and applies it the moment Pro is on. A saved accent shows again whenever Pro is back.
 */
export function AppearanceSettings() {
  const profile = useProfile()
  const unlocked = useHasFeature('themes')
  const shown = effectiveAccent(profile.accent, unlocked)
  const accentLabel = useId()
  const accentNote = useId()

  const pick = (accent: AccentId): void => {
    if (accent === FREE_ACCENT || unlocked) {
      haptic('select')
      updateProfile({ accent })
      return
    }
    withPro('themes', () => updateProfile({ accent }))
  }

  return (
    <div className={styles.appearance}>
      <div className={styles.block}>
        <p className={styles.label} aria-hidden="true">
          Theme
        </p>
        <SegmentedControl ariaLabel="Theme" options={THEMES} value={profile.theme} onChange={(theme) => updateProfile({ theme })} />
      </div>

      <div className={styles.block}>
        <div className={styles.labelRow}>
          <p id={accentLabel} className={styles.label}>
            Accent colour
          </p>
          {!unlocked && <Badge tone="pro">Pro</Badge>}
        </div>
        <div
          role="group"
          aria-labelledby={accentLabel}
          aria-describedby={unlocked ? undefined : accentNote}
          className={styles.swatches}
        >
          {ACCENTS.map(({ id, name }) => {
            const selected = id === shown
            const locked = !unlocked && id !== FREE_ACCENT
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                aria-label={locked ? `${name}, Pro` : name}
                className={cx(styles.swatch, selected && styles.selected)}
                style={{ '--swatch': CARD_ACCENTS[id].accent } as CSSProperties}
                onClick={() => pick(id)}
              >
                <span className={styles.dot} aria-hidden="true">
                  {selected ? <Check strokeWidth={3} /> : locked ? <Lock strokeWidth={2.5} /> : null}
                </span>
                <span className={styles.name} aria-hidden="true">
                  {name}
                </span>
              </button>
            )
          })}
        </div>
        {!unlocked && (
          <p id={accentNote} className={styles.note}>
            Lime is free. Mint, sky, violet and coral come with Pro.
          </p>
        )}
      </div>
    </div>
  )
}
