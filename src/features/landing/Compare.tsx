import { Check, Minus, X } from 'lucide-react'
import { BRAND, FREE_AI_PER_DAY } from '../../domain/types'
import page from './LandingPage.module.css'
import styles from './Compare.module.css'

type Mark = 'yes' | 'no' | 'part'
interface Row {
  feature: string
  settle: [Mark, string]
  splitwise: [Mark, string]
  upi: [Mark, string]
}

/**
 * The honest answer to "why not Splitwise, or the split in my UPI app?". Only what each one does
 * for free today, as their own pages say; dated, so it can be checked.
 */
export const COMPARE_ROWS: readonly Row[] = [
  {
    feature: 'Say the bill out loud, in English or Hinglish',
    settle: ['yes', 'Free, no limit'],
    splitwise: ['no', 'Type it in'],
    upi: ['no', 'Type an amount'],
  },
  {
    feature: 'Friends pay you back from one link, with any UPI app',
    settle: ['yes', 'No app or sign-up for them'],
    splitwise: ['no', 'No UPI'],
    upi: ['part', 'Only people on the same app'],
  },
  {
    feature: 'A group’s running balances: who owes whom, fewest payments',
    settle: ['yes', 'With a “Why?” on each payment'],
    splitwise: ['yes', 'Yes'],
    upi: ['no', 'One payment at a time'],
  },
  {
    feature: 'Scan a bill item by item, and catch an optional service charge',
    settle: ['yes', `Free, ${FREE_AI_PER_DAY} a day`],
    splitwise: ['part', 'Receipt scanning is Pro'],
    upi: ['no', 'No'],
  },
  {
    feature: 'Add as many expenses as you like',
    settle: ['yes', 'No daily cap'],
    splitwise: ['part', 'Free plan caps adds a day'],
    upi: ['no', 'Not a ledger'],
  },
]

export const COMPARE_CHECKED = 'November 2026'

const ICON = { yes: Check, no: X, part: Minus } as const
const WORD = { yes: 'Yes', no: 'No', part: 'Partly' } as const

function Cell({ mark: [mark, note] }: { mark: [Mark, string] }) {
  const Icon = ICON[mark]
  return (
    <td className={styles.cell}>
      <span className={styles[mark]}>
        <Icon aria-hidden="true" strokeWidth={2.5} />
        <span className="visually-hidden">{WORD[mark]}: </span>
      </span>
      <span className={styles.note}>{note}</span>
    </td>
  )
}

/** "Why not Splitwise?" — right under the first screen. */
export function Compare() {
  return (
    <section id="compare" className={page.section} aria-labelledby="compare-title">
      <div className={page.sectionHead}>
        <p className={page.eyebrow}>Why {BRAND.name}</p>
        <h2 id="compare-title" className={page.h2}>
          Why not Splitwise, or the split in your UPI app?
        </h2>
      </div>
      {/* Scrolls sideways on a narrow phone: focusable, so a keyboard can scroll it too. */}
      <div className={styles.wrap} tabIndex={0} role="region" aria-label="Settle compared with Splitwise and UPI apps">
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.corner}>
                <span className="visually-hidden">What you get</span>
              </th>
              <th scope="col" className={styles.us}>
                {BRAND.name}
              </th>
              <th scope="col">Splitwise (free)</th>
              <th scope="col">GPay / PhonePe / Paytm split</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row) => (
              <tr key={row.feature}>
                <th scope="row" className={styles.feature}>
                  {row.feature}
                </th>
                <Cell mark={row.settle} />
                <Cell mark={row.splitwise} />
                <Cell mark={row.upi} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.footnote}>
        What each one offers for free, from their own pages, checked {COMPARE_CHECKED}. Something changed? Tell us and we’ll fix it.
      </p>
    </section>
  )
}
