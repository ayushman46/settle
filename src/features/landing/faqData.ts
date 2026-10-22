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
      `Yes. Splitting, groups, pay links, UPI QR codes, the collect tracker, nudges and backups are free for good, with no ads. You also get ${FREE_AI_PER_DAY} AI bill reads or “Just say it” splits a day.`,
      `${NAME} Pro adds unlimited AI and a few extras for people who split a lot.`,
    ],
  },
  {
    id: 'privacy',
    question: 'Where is my data stored?',
    answer: [
      `On your phone. There’s no account and no database — your splits, friends and groups are saved in your browser on this device, and you can back them up to a file whenever you like.`,
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
      `Never. ${NAME} opens your friend’s UPI app — GPay, PhonePe, Paytm, BHIM or any other — with your UPI ID and their exact amount filled in. The money goes straight from their bank to yours.`,
      'UPI works in rupees. Splits in other currencies are still worked out and tracked; friends just pay you the usual way.',
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
      `Your pass is a signed code saved on your device — there’s no account to sign in to. On your new phone, open ${NAME}, choose “Redeem a code” and enter the same code.`,
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
