import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from '../../app/router'
import { isPlainLeftClick } from '../../components'
import { ctaClassName, ctaParts, type CtaStyle } from './cta'
import { scrollToSection } from './scroll'

export interface CtaLinkProps extends LinkProps, CtaStyle {
  iconStart?: ReactNode
  iconEnd?: ReactNode
}

/** A call to action that goes somewhere in the app (`/app`, `/app/pro`…), drawn as a pill. */
export function CtaLink({ variant, size, block, iconStart, iconEnd, className, children, ...rest }: CtaLinkProps) {
  return (
    <Link {...rest} className={ctaClassName({ variant, size, block }, className)}>
      {iconStart != null && (
        <span className={ctaParts.icon} aria-hidden="true">
          {iconStart}
        </span>
      )}
      <span>{children}</span>
      {iconEnd != null && (
        <span className={ctaParts.iconEnd} aria-hidden="true">
          {iconEnd}
        </span>
      )}
    </Link>
  )
}

export interface SectionLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** Id of the section on this page. */
  to: string
}

/**
 * A `#section` link that scrolls there in place (and focuses its heading) instead of adding a
 * history entry; modified clicks keep the browser's behaviour.
 */
export function SectionLink({ to, onClick, ...rest }: SectionLinkProps) {
  return (
    <a
      {...rest}
      href={`#${to}`}
      onClick={(event) => {
        onClick?.(event)
        if (!isPlainLeftClick(event)) return
        if (scrollToSection(to)) event.preventDefault()
      }}
    />
  )
}
