import { useState } from 'react'
import { navigate, useBackClose, useSearchParams } from '../../app/router'
import { ScreenTransition, type NavDirection } from '../../components'
import { completeOnboarding } from '../../data'
import { STUCK_PATH } from '../stuck/paths'
import { AboutYouStep, type AboutYou } from './AboutYouStep'
import { HOME_PATH, onboardingDestination } from './destination'
import { IntroSlides } from './IntroSlides'
import { LanguageStep } from './LanguageStep'
import { STUCK_SLIDE } from './slides'

type Step = 'language' | 'intro' | 'you'

const ORDER: readonly Step[] = ['language', 'intro', 'you']

/** True for Stuck money and the pages under it. */
function isStuckPage(destination: string): boolean {
  const path = destination.split(/[?#]/)[0] ?? ''
  return path === STUCK_PATH || path.startsWith(`${STUCK_PATH}/`)
}

/**
 * `/app/welcome` — shown once, before anything else in the app: your language first, then
 * slides on what Settle does, then your name, UPI ID and currency. Finishing (or skipping) opens
 * Home, or the page the person was on their way to (`?next=`), with Home beneath it so its back
 * arrow stays in the app. Someone on their way to Stuck money sees just its slide, and is asked
 * only for their name (it goes on the letters). The details step sits on the Back stack, so Back
 * returns to the slides instead of leaving.
 */
export function OnboardingScreen() {
  const params = useSearchParams()
  const destination = onboardingDestination(params.get('next'))
  const stuck = isStuckPage(destination)
  const [step, setStep] = useState<Step>('language')
  const [direction, setDirection] = useState<NavDirection>('none')

  const go = (next: Step): void => {
    setDirection(ORDER.indexOf(next) > ORDER.indexOf(step) ? 'forward' : 'back')
    setStep(next)
  }

  useBackClose(step === 'you', () => go('intro'))

  const finish = (about: AboutYou): void => {
    completeOnboarding(about)
    navigate(HOME_PATH, { replace: true })
    if (destination !== HOME_PATH) navigate(destination)
  }

  return (
    <ScreenTransition direction={direction}>
      {step === 'language' ? (
        <LanguageStep key="language" onDone={() => go('intro')} onSkip={() => go('you')} />
      ) : step === 'intro' ? (
        <IntroSlides key="intro" slides={stuck ? [STUCK_SLIDE] : undefined} onDone={() => go('you')} />
      ) : (
        <AboutYouStep key="you" nameOnly={stuck} onBack={() => go('intro')} onDone={finish} onSkip={finish} />
      )}
    </ScreenTransition>
  )
}
