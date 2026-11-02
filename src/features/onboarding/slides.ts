import { BanknoteArrowDown, type LucideIcon } from 'lucide-react'
import type { IllustrationName } from '../../components'
import type { MessageKey } from '../../i18n'

export interface IntroSlide {
  /** A spot illustration, or a big icon in the same halo (for a slide without its own drawing yet). */
  art: IllustrationName | LucideIcon
  title: MessageKey
  text: MessageKey
}

/** Money a bank or shop owes you: failed payments that took the money, refunds that haven't come. */
export const STUCK_SLIDE: IntroSlide = { art: BanknoteArrowDown, title: 'onboarding.slide.stuck.title', text: 'onboarding.slide.stuck.text' }

/** The four things Settle does, one per slide: read a bill, split anything, get paid back, get stuck money back. */
export const INTRO_SLIDES: readonly IntroSlide[] = [
  { art: 'welcome-scan', title: 'onboarding.slide.scan.title', text: 'onboarding.slide.scan.text' },
  { art: 'welcome-split', title: 'onboarding.slide.split.title', text: 'onboarding.slide.split.text' },
  { art: 'welcome-settle', title: 'onboarding.slide.settle.title', text: 'onboarding.slide.settle.text' },
  STUCK_SLIDE,
]
