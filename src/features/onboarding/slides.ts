import type { IllustrationName } from '../../components'
import type { MessageKey } from '../../i18n'

export interface IntroSlide {
  art: IllustrationName
  title: MessageKey
  text: MessageKey
}

/** The three things Settle does, one per slide: read a bill, split anything, get paid back. */
export const INTRO_SLIDES: readonly IntroSlide[] = [
  { art: 'welcome-scan', title: 'onboarding.slide.scan.title', text: 'onboarding.slide.scan.text' },
  { art: 'welcome-split', title: 'onboarding.slide.split.title', text: 'onboarding.slide.split.text' },
  { art: 'welcome-settle', title: 'onboarding.slide.settle.title', text: 'onboarding.slide.settle.text' },
]
