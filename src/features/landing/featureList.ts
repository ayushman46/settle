/** The ten reasons people pick Settle (spec §1), in the order the landing page's bento grid lays them out. */
import { BRAND } from '../../domain/types'

export type FeatureId =
  | 'scan'
  | 'describe'
  | 'paylink'
  | 'collect'
  | 'groups'
  | 'modes'
  | 'recurring'
  | 'cards'
  | 'insights'
  | 'privacy'

export interface Feature {
  id: FeatureId
  /** Small label above the title. */
  eyebrow: string
  title: string
  text: string
  /** Part of Settle Pro. */
  pro?: boolean
  /** Bento size on wide screens: `wide` takes half a row, `regular` a third. */
  size: 'wide' | 'regular'
}

export const FEATURES: readonly Feature[] = [
  {
    id: 'scan',
    eyebrow: 'AI bill reading',
    title: 'Snap the bill. Every item lands in the split.',
    text: `Point your camera at a restaurant bill and tap who had what. Electricity, cab or hotel bill? ${BRAND.name} fills in the total and the category for you.`,
    size: 'wide',
  },
  {
    id: 'describe',
    eyebrow: 'Just say it',
    title: 'Type it like you’d text it.',
    text: '“Cab 840 with Riya and Sam, Sam pays double” becomes a ready-to-save split. Check it, tap once, done.',
    size: 'wide',
  },
  {
    id: 'paylink',
    eyebrow: 'Pay links',
    title: 'One link for the whole group.',
    text: 'Drop it in the group chat. Each friend taps their name and pays their exact share with any UPI app — no app to install, no account.',
    size: 'regular',
  },
  {
    id: 'collect',
    eyebrow: 'Auto-settle',
    title: 'Payments tick themselves off.',
    text: 'In the Android app, when GPay, PhonePe, Paytm or BHIM says money arrived, whoever paid is ticked off — read on your phone, nothing uploaded. Whoever’s left gets a reminder, friendly first.',
    size: 'regular',
  },
  {
    id: 'groups',
    eyebrow: 'Groups',
    title: 'Trips and flats, squared up.',
    text: `Anyone can pay for anything. ${BRAND.name} works out the fewest payments that make everyone even, with a UPI QR for each.`,
    size: 'regular',
  },
  {
    id: 'modes',
    eyebrow: 'Six ways to split',
    title: 'Fair, however you define it.',
    text: 'Equally, exact amounts, percentages, shares, item by item, or what each had when there’s no bill. Round to whole rupees and the payer keeps the paise.',
    size: 'regular',
  },
  {
    id: 'cards',
    eyebrow: 'Share cards',
    title: 'A receipt worth posting.',
    text: 'Turn any split into a clean image for the group chat — who paid, who owes, who’s settled.',
    size: 'regular',
  },
  {
    id: 'privacy',
    eyebrow: 'Private by default',
    title: 'No sign-up. No ads. No tracking.',
    text: 'Your splits live on your phone, not on our servers. Back them up to a file you own. Everything but the AI works offline.',
    size: 'regular',
  },
  {
    id: 'recurring',
    eyebrow: 'Recurring splits',
    title: 'Rent and Wi-Fi, on repeat.',
    text: `${BRAND.name} reminds you when monthly bills are due and splits them in one tap, the same way every month.`,
    pro: true,
    size: 'wide',
  },
  {
    id: 'insights',
    eyebrow: 'Insights',
    title: 'Know where the money goes.',
    text: 'Your share of spending by category, by month and by friend — worked out on your phone.',
    pro: true,
    size: 'wide',
  },
]
