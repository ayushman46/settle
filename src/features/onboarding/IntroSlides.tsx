import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { ActionBar, Button, Illustration, Screen } from '../../components'
import { BRAND } from '../../domain/types'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { BrandMark } from '../landing/BrandMark'
import { INTRO_SLIDES, type IntroSlide } from './slides'
import styles from './OnboardingScreen.module.css'

export interface IntroSlidesProps {
  /** What to show (default: everything Settle does). */
  slides?: readonly IntroSlide[]
  /** "Get started" on the last slide, or "Skip" on any of them. */
  onDone: () => void
}

/** Quiet time after the last scroll event before a swipe counts as finished (ms). */
const SETTLE_MS = 90

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * Swipeable slides — what Settle does — with dots and a Next button. Swiping is the browser's own
 * scroll snapping (native feel on every phone); the arrow keys, the dots and Next move it too.
 */
export function IntroSlides({ slides = INTRO_SLIDES, onDone }: IntroSlidesProps) {
  const t = useT()
  const trackRef = useRef<HTMLDivElement>(null)
  const steering = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [index, setIndex] = useState(0)
  const last = slides.length - 1
  const current = slides[index] ?? slides[0]

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    [],
  )

  const slideAt = (track: HTMLDivElement): number =>
    Math.max(0, Math.min(last, Math.round(Math.abs(track.scrollLeft) / track.clientWidth)))

  const show = (next: number): void => {
    const target = Math.max(0, Math.min(last, next))
    setIndex(target)
    const track = trackRef.current
    if (!track || track.clientWidth === 0) return
    // Ours, not a swipe: the dots already point at the target, so ignore the frames in between.
    steering.current = true
    track.scrollTo({ left: target * track.clientWidth, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  const onScroll = (): void => {
    const track = trackRef.current
    if (!track || track.clientWidth === 0) return
    if (!steering.current) setIndex(slideAt(track))
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      steering.current = false
      setIndex(slideAt(track))
    }, SETTLE_MS)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      show(index + (event.key === 'ArrowRight' ? 1 : -1))
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      show(event.key === 'Home' ? 0 : last)
    }
  }

  const next = (): void => {
    haptic('tap')
    if (index >= last) onDone()
    else show(index + 1)
  }

  return (
    <Screen
      header={
        // A banner landmark, so the wordmark isn't left outside every landmark.
        <header className={styles.topRow}>
          <BrandMark size="sm" />
          <Button variant="ghost" size="sm" onClick={onDone}>
            {t('common.action.skip')}
          </Button>
        </header>
      }
      footer={
        <ActionBar>
          {slides.length > 1 && (
            <div className={styles.dots}>
              {slides.map((slide, i) => (
                <button
                  key={slide.title}
                  type="button"
                  className={cx(styles.dot, i === index && styles.dotActive)}
                  aria-label={t('onboarding.intro.dot.aria', { number: i + 1, title: t(slide.title) })}
                  aria-current={i === index ? 'step' : undefined}
                  onClick={() => show(i)}
                >
                  <span className={styles.dotMark} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
          <Button block onClick={next} iconEnd={index >= last ? <ArrowRight strokeWidth={2.5} /> : undefined}>
            {index >= last ? t('onboarding.intro.start.cta') : t('common.action.next')}
          </Button>
        </ActionBar>
      }
      contentClassName={styles.introContent}
    >
      <h1 className="visually-hidden" tabIndex={-1}>
        {t('onboarding.intro.heading', { brand: BRAND.name })}
      </h1>
      <div
        ref={trackRef}
        className={styles.track}
        role="region"
        aria-roledescription="carousel"
        aria-label={t('onboarding.intro.carousel.aria', { brand: BRAND.name })}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
      >
        {slides.map((slide, i) => (
          <section
            key={slide.title}
            className={styles.slide}
            role="group"
            aria-roledescription="slide"
            aria-label={t('onboarding.intro.slide.aria', { number: i + 1, total: slides.length })}
            aria-hidden={i === index ? undefined : true}
          >
            <div className={styles.stage}>
              <SlideArt art={slide.art} />
            </div>
            <h2 className={styles.slideTitle}>{t(slide.title)}</h2>
            <p className={styles.slideText}>{t(slide.text)}</p>
          </section>
        ))}
      </div>
      <p className="visually-hidden" aria-live="polite">
        {t('onboarding.intro.live', { number: index + 1, total: slides.length, title: current ? t(current.title) : '' })}
      </p>
    </Screen>
  )
}

/** A slide's drawing, or its icon on a tile. */
function SlideArt({ art: Art }: { art: IntroSlide['art'] }) {
  if (typeof Art === 'string') return <Illustration name={Art} size={232} className={styles.art} />
  return (
    <span className={styles.artIcon} aria-hidden="true">
      <Art strokeWidth={1.75} />
    </span>
  )
}
