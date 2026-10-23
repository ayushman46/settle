import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { useT } from '../i18n'
import { cx } from '../lib/cx'
import styles from './Banner.module.css'

export type BannerTone = 'info' | 'warning' | 'success' | 'error'

export interface BannerAction {
  label: string
  onAction: () => void
}

export interface BannerProps {
  tone?: BannerTone
  title?: ReactNode
  children?: ReactNode
  /** Shows a ✕ button ("Dismiss"). */
  onDismiss?: () => void
  /** One text action rendered under the message. */
  action?: BannerAction
  /** Custom action row (e.g. two Buttons) — rendered after `action`. */
  actions?: ReactNode
  /** Replace the tone's default icon (`null` hides it). */
  icon?: ReactNode
  className?: string
}

const ICONS: Record<BannerTone, ReactNode> = {
  info: <Info />,
  warning: <TriangleAlert />,
  success: <CircleCheck />,
  error: <CircleAlert />,
}

/**
 * Inline message block. Errors use `role="alert"` (announced immediately); the other tones are
 * polite `role="status"` regions.
 */
export function Banner({ tone = 'info', title, children, onDismiss, action, actions, icon, className }: BannerProps) {
  const t = useT()
  const glyph = icon === undefined ? ICONS[tone] : icon
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx(styles.banner, styles[tone], className)}>
      {glyph != null && (
        <span className={styles.icon} aria-hidden="true">
          {glyph}
        </span>
      )}
      <div className={styles.body}>
        {title != null && <p className={styles.title}>{title}</p>}
        {children != null && <div className={styles.text}>{children}</div>}
        {(action != null || actions != null) && (
          <div className={styles.actions}>
            {action != null && (
              <button type="button" className={styles.action} onClick={action.onAction}>
                {action.label}
              </button>
            )}
            {actions}
          </div>
        )}
      </div>
      {onDismiss != null && (
        <button type="button" className={styles.dismiss} aria-label={t('ui.banner.dismiss.aria')} onClick={onDismiss}>
          <X aria-hidden="true" strokeWidth={2.25} />
        </button>
      )}
    </div>
  )
}
