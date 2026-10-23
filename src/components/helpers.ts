/** Small pure helpers shared by design-system components (kept apart so component files only export components). */
import type { Ref, RefCallback } from 'react'
import { t } from '../i18n'
import { AVATAR_COLORS } from '../types'

/** Wraps any integer into the avatar palette (0..AVATAR_COLORS-1); NaN → 0. */
export function avatarColorIndex(color: number): number {
  if (!Number.isFinite(color)) return 0
  const n = Math.trunc(color) % AVATAR_COLORS
  return n < 0 ? n + AVATAR_COLORS : n
}

/**
 * Readable list of names for labels: "Aisha", "Aisha and Ben", "Aisha, Ben and Chen",
 * "Aisha, Ben and 3 others" (once there are more than `shown + 1`).
 */
export function describePeople(names: readonly string[], shown = 2): string {
  if (names.length === 0) return t('ui.list.none')
  if (names.length === 1) return names[0] ?? ''
  if (names.length <= shown + 1) {
    return t('ui.list.last', { list: names.slice(0, -1).join(', '), last: names[names.length - 1] ?? '' })
  }
  const rest = names.length - shown
  return t('ui.list.others', { list: names.slice(0, shown).join(', '), count: rest })
}

/** Combines refs (callback or object) into one callback ref. */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
  return (value) => {
    // React 19: a callback ref that returns a cleanup isn't called with null on detach,
    // so detaching is done here for every ref, honouring each one's own cleanup.
    const detach: Array<() => void> = []
    for (const ref of refs) {
      if (typeof ref === 'function') {
        const cleanup = ref(value)
        detach.push(typeof cleanup === 'function' ? cleanup : () => ref(null))
      } else if (ref) {
        ref.current = value
        detach.push(() => {
          ref.current = null
        })
      }
    }
    return () => {
      for (const run of detach) run()
    }
  }
}

/**
 * QR modules → one SVG path: each row's runs of dark modules become one rectangle each,
 * shifted by `offset` modules (the quiet zone).
 */
export function qrPath(modules: readonly (readonly boolean[])[], offset = 0): string {
  let d = ''
  modules.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      if (!row[x]) {
        x += 1
        continue
      }
      let end = x
      while (end < row.length && row[end]) end += 1
      const run = end - x
      d += `M${x + offset} ${y + offset}h${run}v1h-${run}z`
      x = end
    }
  })
  return d
}
