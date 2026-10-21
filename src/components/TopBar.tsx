import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cx } from '../lib/cx'
import { IconButton } from './IconButton'
import { Progress } from './Progress'
import styles from './TopBar.module.css'

export interface TopBarProps {
  /** Shows a back chevron when provided. */
  onBack?: () => void
  /** Accessible name of the back button. Default "Back". */
  backLabel?: string
  /** Small centred label (keep it short). */
  title?: ReactNode
  /** Trailing slot, e.g. a currency pill or an IconButton. */
  right?: ReactNode
  /** Renders a segmented `Progress` under the bar. */
  progress?: { current: number; total: number }
  className?: string
}

/** Screen header: back · title · action, with optional step progress. */
export function TopBar({ onBack, backLabel = 'Back', title, right, progress, className }: TopBarProps) {
  return (
    <header className={cx(styles.bar, className)}>
      <div className={styles.row}>
        <div className={styles.start}>
          {onBack && (
            <IconButton label={backLabel} onClick={onBack}>
              <ChevronLeft strokeWidth={2.25} />
            </IconButton>
          )}
        </div>
        <div className={styles.title}>{title}</div>
        <div className={styles.end}>{right}</div>
      </div>
      {progress && (
        <div className={styles.progress}>
          <Progress current={progress.current} total={progress.total} />
        </div>
      )}
    </header>
  )
}
