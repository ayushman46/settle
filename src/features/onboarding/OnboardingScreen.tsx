import { useState } from 'react'
import { navigate, useBackClose, useSearchParams } from '../../app/router'
import { ScreenTransition, type NavDirection } from '../../components'
import { completeOnboarding } from '../../data'
import { AboutYouStep, type AboutYou } from './AboutYouStep'
import { onboardingDestination } from './destination'
import { IntroSlides } from './IntroSlides'
import { LanguageStep } from './LanguageStep'

type Step = 'language' | 'intro' | 'you'

const ORDER: readonly Step[] = ['language', 'intro', 'you']

/**
 * `/app/welcome` — shown once, before anything else in the app: your language first, then three
 * slides on what Settle does, then your name, UPI ID and currency. Finishing (or skipping) opens
 * Home, or the page the person was on their way to (`?next=`). The details step sits on the Back
 * stack, so Back returns to the slides instead of leaving.
 */
export function OnboardingScreen() {
  const params = useSearchParams()
  const [step, setStep] = useState<Step>('language')
  const [direction, setDirection] = useState<NavDirection>('none')

  const go = (next: Step): void => {
    setDirection(ORDER.indexOf(next) > ORDER.indexOf(step) ? 'forward' : 'back')
    setStep(next)
  }

  useBackClose(step === 'you', () => go('intro'))

  const finish = (about: AboutYou): void => {
    completeOnboarding(about)
    navigate(onboardingDestination(params.get('next')), { replace: true })
  }

  return (
    <ScreenTransition direction={direction}>
      {step === 'language' ? (
        <LanguageStep key="language" onDone={() => go('intro')} onSkip={() => go('you')} />
      ) : step === 'intro' ? (
        <IntroSlides key="intro" onDone={() => go('you')} />
      ) : (
        <AboutYouStep key="you" onBack={() => go('intro')} onDone={finish} onSkip={finish} />
      )}
    </ScreenTransition>
  )
}
