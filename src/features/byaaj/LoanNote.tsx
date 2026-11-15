import { BRAND } from '../../domain/types'
import { useT } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { countingRule, dayLabel, rateLabel } from './byaajText'
import { amountWords } from './engine'
import type { LoanView } from './loans'
import styles from './Byaaj.module.css'

export interface LoanNoteProps {
  view: LoanView
  /** The lender's and the borrower's names as they should be written; empty leaves a line to write on. */
  lender: string
  borrower: string
}

/**
 * The loan note for paper: both names, the amount in figures and (for rupees) in words, the rate
 * and how it is counted, the date, where it stands today line by line, and space for both to sign.
 * It says what it is: a record between the two of them, not a legal document.
 */
export function LoanNote({ view, lender, borrower }: LoanNoteProps) {
  const t = useT()
  const { statement: s, facts, plan } = view
  const c = facts.currency
  const money = (minor: number): string => formatMoney(minor, c)
  const words = amountWords(s.principalStart, c)
  const blank = t('byaaj.note.blank')
  return (
    <article className={styles.note} aria-label={t('byaaj.note.title')}>
      <header className={styles.noteHead}>
        <span className={styles.noteTitle}>{t('byaaj.note.title')}</span>
        <span className={styles.noteSub}>{dayLabel(s.from)}</span>
      </header>
      <dl className={styles.noteMeta}>
        <div>
          <dt>{t('byaaj.note.lender')}</dt>
          <dd>{lender || blank}</dd>
        </div>
        <div>
          <dt>{t('byaaj.note.borrower')}</dt>
          <dd>{borrower || blank}</dd>
        </div>
        <div>
          <dt>{t('byaaj.note.amount')}</dt>
          <dd>{money(s.principalStart)}</dd>
        </div>
        {words && (
          <div>
            <dt>{t('byaaj.note.words')}</dt>
            <dd>{words}</dd>
          </div>
        )}
        <div>
          <dt>{t('byaaj.note.date')}</dt>
          <dd>{dayLabel(s.from)}</dd>
        </div>
        <div>
          <dt>{t('byaaj.note.rate')}</dt>
          <dd>{rateLabel(s.rate)}</dd>
        </div>
        <div>
          <dt>{t('byaaj.note.dueOn')}</dt>
          <dd>{plan.dueOn ? dayLabel(plan.dueOn) : blank}</dd>
        </div>
      </dl>
      <section className={styles.noteBlock}>
        <h3 className={styles.noteLabel}>{t('byaaj.note.terms')}</h3>
        <ol className={styles.noteTerms}>
          <li>{t('byaaj.rule.simple', { rate: rateLabel(s.rate), date: dayLabel(s.from) })}</li>
          <li>{countingRule(s.rate.per)}</li>
          <li>{t('byaaj.rule.parts.lent')}</li>
          <li>{t('byaaj.rule.round', { unit: formatMoney(view.unit, c, { trimZeros: true }) })}</li>
        </ol>
      </section>
      <section className={styles.noteBlock}>
        <h3 className={styles.noteLabel}>{t('byaaj.note.statement', { date: dayLabel(s.asOf) })}</h3>
        <table className={styles.noteTable}>
          <thead>
            <tr>
              <th scope="col">{t('byaaj.note.col.date')}</th>
              <th scope="col">{t('byaaj.note.col.what')}</th>
              <th scope="col" className={styles.num}>
                {t('byaaj.note.col.added')}
              </th>
              <th scope="col" className={styles.num}>
                {t('byaaj.note.col.paid')}
              </th>
              <th scope="col" className={styles.num}>
                {t('byaaj.note.col.left')}
              </th>
              <th scope="col" className={styles.num}>
                {t('byaaj.note.col.due')}
              </th>
            </tr>
          </thead>
          <tbody>
            {s.lines.map((line) => (
              <tr key={line.id}>
                <td className={styles.nowrap}>{dayLabel(line.date)}</td>
                <td>
                  {line.kind === 'start'
                    ? t('byaaj.note.start')
                    : line.kind === 'asOf'
                      ? t('byaaj.note.asOf')
                      : line.outside
                        ? t('byaaj.note.payment.outside')
                        : t('byaaj.note.payment')}
                </td>
                <td className={styles.num}>{line.kind === 'start' ? '' : money(line.interestAdded)}</td>
                <td className={styles.num}>{line.kind === 'payment' ? money(line.paid) : ''}</td>
                <td className={styles.num}>{money(line.principal)}</td>
                <td className={styles.num}>{money(line.interestDue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className={styles.noteSign}>
        <div className={styles.signature}>
          <span className={styles.signatureLine} />
          <span>{t('byaaj.note.sign.lender')}</span>
        </div>
        <div className={styles.signature}>
          <span className={styles.signatureLine} />
          <span>{t('byaaj.note.sign.borrower')}</span>
        </div>
        <div className={styles.signature}>
          <span className={styles.signatureLine} />
          <span>{t('byaaj.note.sign.date')}</span>
        </div>
      </div>
      <p className={styles.noteFoot}>{t('byaaj.note.disclaimer')}</p>
      <p className={styles.noteMade}>{t('byaaj.note.made', { app: BRAND.name })}</p>
    </article>
  )
}
