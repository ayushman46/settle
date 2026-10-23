import { useEffect, useRef, useState } from 'react'
import { useBackClose, useLocation } from '../../app/router'
import { Skeleton } from '../../components'
import { BRAND } from '../../domain/types'
import { useT } from '../../i18n'
import type { PayLinkPayload } from '../../share/payLink'
import { usePageMeta } from '../landing/pageMeta'
import { PayPanel } from './PayPanel'
import { payPeople } from './payView'
import { PublicProblem, PublicShell } from './PublicShell'
import { RequestCard } from './RequestCard'
import { usePayLink } from './usePayLink'
import { WhoAreYou } from './WhoAreYou'
import styles from './PayPage.module.css'

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * The request and the person paying it. Picking a name opens their share; Back (or "Not you?")
 * returns to the names. With just one person on the link, their share opens straight away.
 */
function PayRequest({ payload }: { payload: PayLinkPayload }) {
  const people = payPeople(payload)
  const only = people.length === 1 ? (people[0] ?? null) : null
  const [picked, setPicked] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const lastPicked = useRef<number | null>(null)
  const person = only ?? people.find((p) => p.index === picked) ?? null

  // The share sits on its own history entry, so the phone's Back button returns to the names.
  useBackClose(only === null && picked !== null, () => setPicked(null))

  useEffect(() => {
    if (only) return
    if (picked !== null) {
      const heading = headingRef.current
      if (!heading) return
      heading.focus({ preventScroll: true })
      const top = heading.getBoundingClientRect().top
      if ((top < 0 || top > window.innerHeight * 0.6) && typeof heading.scrollIntoView === 'function') {
        heading.closest('section')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
      }
      return
    }
    if (lastPicked.current !== null) {
      listRef.current?.querySelector<HTMLButtonElement>(`[data-person="${lastPicked.current}"]`)?.focus()
    }
  }, [picked, only])

  return (
    <>
      <RequestCard payload={payload} />
      {person ? (
        <PayPanel
          payload={payload}
          person={person}
          headingRef={headingRef}
          onChangePerson={only ? undefined : () => setPicked(null)}
        />
      ) : (
        <div ref={listRef}>
          <WhoAreYou
            people={people}
            currency={payload.c}
            onPick={(index) => {
              lastPicked.current = index
              setPicked(index)
            }}
          />
        </div>
      )}
    </>
  )
}

function Problem({ kind }: { kind: 'empty' | 'invalid' }) {
  const t = useT()
  return kind === 'invalid' ? (
    <PublicProblem title={t('pay.problem.invalid.title')} text={t('pay.problem.invalid.body')} />
  ) : (
    <PublicProblem title={t('pay.problem.empty.title')} text={t('pay.problem.empty.body')} />
  )
}

function Loading() {
  const t = useT()
  return (
    <div className={styles.loading}>
      <p role="status" className="visually-hidden">
        {t('pay.loading.status')}
      </p>
      <Skeleton shape="md" width={64} height={64} />
      <Skeleton width="50%" height={16} />
      <Skeleton width="70%" height={28} />
      <Skeleton width="40%" height={14} />
    </div>
  )
}

/**
 * `/pay#…` — what a friend sees when they open a pay link: who's asking and for what, "Which one
 * are you?", then their share with a one-tap UPI payment (QR on a computer) and the payee's UPI ID.
 * Everything comes from the link itself: nothing is read from or written to this device's app
 * data, and onboarding never runs here.
 */
export function PayPage() {
  const t = useT()
  const { hash } = useLocation()
  const link = usePayLink(hash)
  const brand = BRAND.name
  usePageMeta({
    title:
      link.status === 'ok'
        ? t('pay.meta.title', { name: link.payload.to.n, title: link.payload.t, brand })
        : t('pay.meta.title.empty', { brand }),
    description: t('pay.meta.description', { brand }),
    robots: 'noindex',
  })

  return (
    <PublicShell>
      {link.status === 'loading' && <Loading />}
      {(link.status === 'empty' || link.status === 'invalid') && <Problem kind={link.status} />}
      {link.status === 'ok' && <PayRequest key={link.fragment} payload={link.payload} />}
    </PublicShell>
  )
}
