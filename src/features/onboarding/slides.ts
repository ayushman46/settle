import type { IllustrationName } from '../../components'

export interface IntroSlide {
  art: IllustrationName
  title: string
  text: string
}

/** The three things Settle does, one per slide: read a bill, split anything, get paid back. */
export const INTRO_SLIDES: readonly IntroSlide[] = [
  {
    art: 'welcome-scan',
    title: 'Snap the bill',
    text: 'AI reads every item. Tap who had what, and the split is done in seconds.',
  },
  {
    art: 'welcome-split',
    title: 'Split anything',
    text: 'Rent, trips, cabs, Netflix. Or just say it: “Cab 840 with Riya and Sam”.',
  },
  {
    art: 'welcome-settle',
    title: 'Get paid back by UPI',
    text: 'Send one link to the group. Friends tap their name and pay with any UPI app.',
  },
]
