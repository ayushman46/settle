/** The reasons people pick Settle (spec §1): splitting first, then the money-back tools, in the order the landing page's bento grid lays them out. */
import { BRAND } from '../../domain/types'
import { FEES_PATH } from '../fees/paths'
import { STUCK_PATH } from '../stuck/paths'

export type FeatureId =
  | 'fees'
  | 'stuck'
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
  /** Just arrived: marked "New". */
  isNew?: boolean
  /** Bento size: `full` takes a whole row (text beside the mockup on wide screens), `wide` half a row, `regular` a third. */
  size: 'full' | 'wide' | 'regular'
  /** Somewhere to start, right there in the tile. */
  cta?: { label: string; to: string }
}

export const FEATURES: readonly Feature[] = [
  {
    id: 'describe',
    eyebrow: 'Say it',
    title: 'Say the bill. It’s split.',
    text: 'Speak or type it the way you’d tell a friend — “Cab 840 with Riya and Sam, Sam pays double”, or “Sam ne 1200 diye, sab mein barabar”. It becomes a split you save in one tap. Speaking is free, with no limit.',
    size: 'wide',
  },
  {
    id: 'scan',
    eyebrow: 'AI bill reading',
    title: 'Snap the bill. Every item lands in the split.',
    text: `Point your camera at a restaurant bill and tap who had what. Electricity, cab or hotel bill? ${BRAND.name} fills in the total and the category for you.`,
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
    eyebrow: 'Auto-settle · Android app',
    title: 'Payments tick themselves off.',
    text: 'In the Android app, when GPay, PhonePe, Paytm or BHIM says money arrived, whoever paid is ticked off — and now it catches failed payments and refunds for Stuck money too. Read on your phone; only the payments it matches are saved. Whoever’s left gets a reminder, friendly first.',
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
    title: 'No ads. No tracking cookies. No passwords.',
    text: 'Everything you add is saved to your own account, stored in India and opened with your passkey: no password, no OTP. We count page views without cookies, with amounts and IDs stripped from addresses. A copy stays on your phone, so everything but the AI works offline.',
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
  {
    id: 'fees',
    eyebrow: 'Bank charges',
    title: 'Your bank took charges it shouldn’t have. Get them back.',
    text: `Add your bank statement. ${BRAND.name} checks every charge against the RBI’s rules — a minimum-balance charge that took you below zero or came without a warning, ATM charges inside your free withdrawals, fees on online NEFT or UPI, charges your bank stopped levying — and writes the letter that gets them reversed, then takes it to the RBI Ombudsman. Read on your phone; the Android app checks each charge SMS as it comes.`,
    isNew: true,
    size: 'full',
    cta: { label: 'Check your bank charges', to: FEES_PATH },
  },
  {
    id: 'stuck',
    eyebrow: 'Stuck money',
    title: 'Payment failed, money gone? Get it back.',
    text: `A UPI, card or ATM payment that failed but took your money, or a refund that never came. ${BRAND.name} knows the RBI’s deadline for UPI, IMPS, card, ATM, AePS, NACH and wallet failures, counts the ₹100 a day the bank owes you after it, and has the next complaint ready — your bank, the RBI Ombudsman, the consumer helpline. The Android app spots them by itself.`,
    isNew: true,
    size: 'full',
    cta: { label: 'Check what your bank owes you', to: STUCK_PATH },
  },
]
