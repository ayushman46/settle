/**
 * The landing page's questions and answers. Plain text, so the same words feed the accordion and
 * the FAQ structured data search engines read — they can never disagree.
 */
import { BRAND, FREE_AI_PER_DAY } from '../../domain/types'
import { SUPPORT_EMAIL } from '../legal/contact'

export interface FaqEntry {
  id: string
  question: string
  /** Paragraphs. */
  answer: readonly string[]
}

const NAME = BRAND.name

export const FAQ: readonly FaqEntry[] = [
  {
    id: 'free',
    question: `Is ${NAME} really free?`,
    answer: [
      `Yes. Splitting, groups, pay links, UPI QR codes, the collect tracker, nudges, Stuck money and backups are free for good, with no ads. Speaking a split is unlimited, and you get ${FREE_AI_PER_DAY} AI bill reads or typed “Just say it” splits a day.`,
      `${NAME} Pro adds unlimited AI and a few extras for people who split a lot.`,
    ],
  },
  {
    id: 'stuck',
    question: 'A payment failed but the money left my account. What does Stuck money do?',
    answer: [
      `It keeps track until the money is back. Paste or share the bank SMS, or add it in three taps — the ${NAME} Android app spots failed payments and refunds in your UPI app’s and (if you allow it) your bank’s alerts by itself, and ticks them off when the money comes back.`,
      'It knows the RBI’s deadlines for failed UPI, IMPS, card, ATM, AePS, NACH and wallet payments: a failed UPI payment to a person must be back by the next day; one to a shop (by UPI or card), or an ATM that didn’t give cash, within five days. When it’s late, Stuck money counts what the bank owes you for the wait and has the complaint ready — to your bank or UPI app, then, if the bank doesn’t sort it out within 30 days, to the RBI Ombudsman.',
      'Refunds a business promised — Amazon, Flipkart, Swiggy, Zomato, IRCTC, airlines — go the same way: the business first, then the National Consumer Helpline (1915), then a consumer commission, or AirSewa for a flight.',
    ],
  },
  {
    id: 'stuck-compensation',
    question: 'Is the ₹100 a day real?',
    answer: [
      'Yes. The RBI’s circular on failed transactions (RBI/2019-20/67, 20 September 2019) gives each kind of payment a deadline, counted in calendar days from the day you paid, and says that past it the bank pays you ₹100 for every day of delay — on its own, without waiting for you to complain. Banks don’t always pay it on their own, so Stuck money works out the amount and puts it in your letter.',
      `It covers payments that failed but took your money — UPI, cards, ATMs, IMPS and the like — not a shop’s refund. ${NAME} states the published rules and where to complain; it isn’t legal advice, and it can’t make a bank pay.`,
    ],
  },
  {
    id: 'stuck-complaints',
    question: `Does ${NAME} file complaints for me?`,
    answer: [
      `No — ${NAME} drafts, you send. Each letter has your name, the dates and the amount — and for a failed payment, the RBI rule and the compensation so far — ready to copy, share or email to your bank, the business, the RBI Ombudsman (cms.rbi.org.in), the National Consumer Helpline (1915 or WhatsApp), AirSewa or a consumer commission (e-Jagriti).`,
      `${NAME} never contacts a bank, a business or anyone else for you. Your stuck payments are saved to your account, which only you can open; nothing goes to a bank or business unless you send it yourself.`,
    ],
  },
  {
    id: 'privacy',
    question: 'Where is my data stored?',
    answer: [
      `In your own Settle account: a database in Mumbai, India, that only you can open, with a passkey (your fingerprint, face or phone PIN). A copy stays on your phone so it works offline, and you can back everything up to a file whenever you like.`,
      'A pay link carries its split inside the link itself, after the “#”. That part never reaches a server.',
    ],
  },
  {
    id: 'friends',
    question: 'Do my friends need the app?',
    answer: [
      'No. They open your pay link in any browser, tap their name and pay with whichever UPI app they already use. No download, no sign-up.',
    ],
  },
  {
    id: 'upi',
    question: `Does ${NAME} touch the money?`,
    answer: [
      `Never. Your friend pays you in their own UPI app — GPay, PhonePe, Paytm, BHIM or any other — by your QR code or your UPI ID, the ways UPI allows a payment to a person. The money goes straight from their bank to yours.`,
      'UPI works in rupees. Splits in other currencies are still worked out and tracked; friends just pay you the usual way.',
    ],
  },
  {
    id: 'paid',
    question: `How does ${NAME} know who’s paid?`,
    answer: [
      `In the ${NAME} Android app, turn on Auto-settle: when Google Pay, PhonePe, Paytm or BHIM (or, if you allow it, your bank’s SMS) says money arrived, ${NAME} ticks off whoever owed you that — with Undo. It reads only those alerts, on your phone; only the payments it matches are saved, to your account.`,
      'On iPhone or the web, drop your UPI app’s history screenshots, a bank statement or your bank SMS into Who’s paid? and everyone who paid is ticked off at once. Friends can also tap “I’ve paid” on their pay link.',
    ],
  },
  {
    id: 'ai',
    question: 'How accurate is the AI?',
    answer: [
      'It reads most printed bills well — items, quantities, taxes, service charges and the total — and always shows you what it read before anything is saved, so a wrong line takes a tap to fix.',
      `Bill photos and “Just say it” text are sent to an AI model hosted by NVIDIA only so they can be read. ${NAME} doesn’t keep them.`,
    ],
  },
  {
    id: 'offline',
    question: 'Does it work offline?',
    answer: [
      `Yes, apart from the AI. Add ${NAME} to your home screen and splits, groups, QR codes and your history all work without a connection. Reading a bill and “Just say it” need the internet.`,
    ],
  },
  {
    id: 'pro',
    question: 'Is Pro a subscription?',
    answer: [
      'No. Pro is a one-time pass — for a month, a year or for life — paid by UPI or card. It never renews by itself, so there’s nothing to cancel. When a pass ends you’re back on Free, with all your data.',
    ],
  },
  {
    id: 'refunds',
    question: 'Can I get a refund?',
    answer: [
      `If something went wrong — you were charged twice, or you paid and Pro didn’t unlock — write to ${SUPPORT_EMAIL} with your payment ID and we’ll fix it or refund you.`,
      'Passes unlock straight away, so we don’t refund a pass just because you changed your mind.',
    ],
  },
  {
    id: 'license',
    question: 'What happens to Pro if I change phones?',
    answer: [
      `Your pass is saved to your ${NAME} account: sign in on your new phone and it’s there. You can also choose “Redeem a code” and enter the same code.`,
      `Lost the code? Email ${SUPPORT_EMAIL} with your payment ID and we’ll send it again.`,
    ],
  },
  {
    id: 'link-safety',
    question: 'Who can see a pay link?',
    answer: [
      'Anyone who has it — like a message in the group chat. It shows your name, your UPI ID and everyone’s share, so send it only to the people in the split.',
    ],
  },
]
