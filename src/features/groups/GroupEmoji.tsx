import type { CSSProperties } from 'react'
import { categoryColor } from '../../components'
import type { GroupKind } from '../../domain/types'
import { cx } from '../../lib/cx'
import { kindMeta } from './groupView'
import styles from './GroupEmoji.module.css'

export interface GroupEmojiProps {
  emoji: string
  kind: GroupKind
  /** `md` 48px list tile (default) · `lg` 76px hero tile · `sm` 36px. */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/** A group's emoji on a soft squircle tinted for its kind (trips sky, homes warm…). Decorative. */
export function GroupEmoji({ emoji, kind, size = 'md', className }: GroupEmojiProps) {
  const tint = { '--group-tint': categoryColor(kindMeta(kind).tint, 'bg') } as CSSProperties
  return (
    <span aria-hidden="true" className={cx(styles.tile, styles[size], className)} style={tint}>
      <span className={styles.glyph}>{emoji}</span>
    </span>
  )
}
