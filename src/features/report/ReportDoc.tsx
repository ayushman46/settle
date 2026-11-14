import { formatMoney } from '../../lib/money'
import { indianDate, type Report } from './engine'
import styles from './Report.module.css'

/**
 * The printed claim is always in English, like the rent receipts: it's a document for an office's
 * accounts team, and that's the language they process. (The screen around it is in the user's language.)
 */
const DOC = {
  title: 'Expense claim',
  name: 'Name',
  employee: 'Employee ID / Department',
  purpose: 'Purpose',
  period: 'Period',
  basisPaid: 'Expenses paid by the claimant',
  basisShare: 'Claimant’s share of shared expenses',
  date: 'Date',
  item: 'Description',
  category: 'Category',
  paidBy: 'Paid by',
  amount: 'Amount',
  paidAbroad: 'paid',
  rate: 'at',
  byCategory: 'By category',
  total: 'Total',
  words: 'In words',
  signature: 'Signature of claimant',
  approved: 'Approved by',
  signedOn: 'Date',
  made: 'Made with Settle',
  blank: '______________________',
} as const

export interface ReportDocProps {
  report: Report
  name: string
  employee: string
  purpose: string
  /** "Goa offsite" or "1/11/2026 to 30/11/2026". */
  period: string
  basis: 'paid' | 'share'
}

const money = (minor: number, currency: string) => formatMoney(minor, currency)

/** One A4 claim sheet: who, what for, the table, totals by category, the grand total in words and a place to sign. */
export function ReportDoc({ report, name, employee, purpose, period, basis }: ReportDocProps) {
  const multi = report.totals.length > 1
  return (
    <article className={styles.sheet} aria-label={DOC.title}>
      <header className={styles.sheetHead}>
        <span className={styles.sheetTitle}>{DOC.title}</span>
        <span className={styles.sheetBasis}>{basis === 'paid' ? DOC.basisPaid : DOC.basisShare}</span>
      </header>

      <dl className={styles.sheetMeta}>
        <div>
          <dt>{DOC.name}</dt>
          <dd>{name || DOC.blank}</dd>
        </div>
        {employee && (
          <div>
            <dt>{DOC.employee}</dt>
            <dd>{employee}</dd>
          </div>
        )}
        {purpose && (
          <div>
            <dt>{DOC.purpose}</dt>
            <dd>{purpose}</dd>
          </div>
        )}
        <div>
          <dt>{DOC.period}</dt>
          <dd>{period}</dd>
        </div>
      </dl>

      <table className={styles.sheetTable}>
        <thead>
          <tr>
            <th scope="col">{DOC.date}</th>
            <th scope="col">{DOC.item}</th>
            <th scope="col">{DOC.category}</th>
            <th scope="col">{DOC.paidBy}</th>
            <th scope="col" className={styles.num}>
              {DOC.amount}
            </th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((r) => (
            <tr key={r.id}>
              <td className={styles.nowrap}>{indianDate(r.date)}</td>
              <td>
                {r.title}
                {r.original && (
                  <span className={styles.sheetFx}>
                    {DOC.paidAbroad} {money(r.original.amount, r.original.currency)} {DOC.rate} {r.original.rate}
                  </span>
                )}
              </td>
              <td>{r.categoryLabel}</td>
              <td>{r.paidBy}</td>
              <td className={styles.num}>{money(r.amount, r.currency)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {report.totals.map((t) => (
            <tr key={t.currency}>
              <th scope="row" colSpan={4}>
                {multi ? `${DOC.total} (${t.currency})` : DOC.total}
              </th>
              <td className={styles.num}>{money(t.amount, t.currency)}</td>
            </tr>
          ))}
        </tfoot>
      </table>

      {report.categories.length > 1 && (
        <section className={styles.sheetCats}>
          <span className={styles.sheetLabel}>{DOC.byCategory}</span>
          <table className={styles.sheetTable}>
            <tbody>
              {report.categories.map((c) => (
                <tr key={`${c.currency}|${c.category}`}>
                  <td>{c.label}</td>
                  <td className={styles.num}>{money(c.amount, c.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {report.words && (
        <p className={styles.sheetWords}>
          {DOC.words}: <strong>{report.words}</strong>
        </p>
      )}

      <div className={styles.sheetSign}>
        <span className={styles.signature}>
          <span className={styles.signatureLine} aria-hidden="true" />
          <span>{DOC.signature}</span>
        </span>
        <span className={styles.signature}>
          <span className={styles.signatureLine} aria-hidden="true" />
          <span>{DOC.signedOn}</span>
        </span>
        <span className={styles.signature}>
          <span className={styles.signatureLine} aria-hidden="true" />
          <span>{DOC.approved}</span>
        </span>
      </div>
      <p className={styles.sheetMade}>{DOC.made}</p>
    </article>
  )
}
