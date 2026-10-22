import { Fragment } from 'react'
import { SUPPORT_EMAIL } from './contact'

/** Plain text in which the support address becomes a mailto link. */
export function EmailText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(SUPPORT_EMAIL)
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && (
            <a href={`mailto:${SUPPORT_EMAIL}`} className={className}>
              {SUPPORT_EMAIL}
            </a>
          )}
        </Fragment>
      ))}
    </>
  )
}
