import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Link2Off } from 'lucide-react'
import { Link, useBackClose, useLocation } from '../../app/router'
import { Skeleton } from '../../components'
import { BRAND } from '../../domain/types'
import type { PayLinkPayload } from '../../share/payLink'
import { BrandMark } from '../landing/BrandMark'
import { CtaLink } from '../landing/CtaLink'
import { usePageMeta } from '../landing/pageMeta'
import { PayPanel } from './PayPanel'
import { payPeople } from './payView'
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
  return (
    <section className={styles.problem} aria-labelledby="pay-problem-title">
      <span className={styles.problemIcon} aria-hidden="true">
        <Link2Off strokeWidth={2} />
      </span>
      <h1 id="pay-problem-title" className={styles.problemTitle}>
        {kind === 'invalid' ? 'This pay link doesn’t work' : 'No pay link here'}
      </h1>
      <p className={styles.problemText}>
        {kind === 'invalid'
          ? 'It may have been cut short when it was copied. Ask whoever sent it to share it again.'
          : 'Open the link your friend shared — it has everything you need to pay them.'}
      </p>
    </section>
  )
}

function Loading() {
  return (
    <div className={styles.loading}>
      <p role="status" className="visually-hidden">
        Opening the pay link…
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
  const { hash } = useLocation()
  const link = usePayLink(hash)
  usePageMeta({
    title:
      link.status === 'ok' ? `Pay ${link.payload.to.n} · ${link.payload.t} · ${BRAND.name}` : `Pay link · ${BRAND.name}`,
    description: `Pay your share in a tap with any UPI app. Sent with ${BRAND.name}.`,
    robots: 'noindex',
  })

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <div className={styles.barInner}>
          <Link to="/" className={styles.brand} aria-label={`${BRAND.name} home`}>
            <BrandMark size="sm" />
          </Link>
          <Link to="/" className={styles.what}>
            What’s {BRAND.name}?
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        {link.status === 'loading' && <Loading />}
        {(link.status === 'empty' || link.status === 'invalid') && <Problem kind={link.status} />}
        {link.status === 'ok' && <PayRequest key={link.fragment} payload={link.payload} />}

        <aside className={styles.pitch} aria-labelledby="pay-pitch-title">
          <p id="pay-pitch-title" className={styles.pitchTitle}>
            Splitting the bill next time?
          </p>
          <p className={styles.pitchText}>
            Snap the bill, share one link like this, and get paid back by UPI. No sign-up, no ads.
          </p>
          <CtaLink to="/" variant="accent" size="md" block iconEnd={<ArrowRight strokeWidth={2.25} />}>
            Split your own bills with {BRAND.name} — free
          </CtaLink>
        </aside>
      </main>

      <footer className={styles.footer}>
        <Link to="/privacy" className={styles.footerLink}>
          Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <Link to="/terms" className={styles.footerLink}>
          Terms
        </Link>
      </footer>
    </div>
  )
}
