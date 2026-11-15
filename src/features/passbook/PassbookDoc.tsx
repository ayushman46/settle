import { BRAND } from '../../domain/types'
import { useT } from '../../i18n'
import { formatMoney } from '../../lib/money'
import type { Passbook } from './engine'
import { balanceLabel, dayLabel, entryKind, entryWhat, groupNote, periodLabel, type Names } from './passbookText'
import styles from './Passbook.module.css'

export interface PassbookDocProps {
  book: Passbook
  names: Names
}

/**
 * The statement on paper: who it is between, the dates, a table (date, details, gave, got, balance)
 * per currency with its opening and closing balance. By name, never "you": it is read by both.
 */
export function PassbookDoc({ book, names }: PassbookDocProps) {
  const t = useT()
  const money = (minor: number, currency: string) => formatMoney(Math.abs(minor), currency)
  const several = book.ledgers.length > 1
  return (
    <article className={styles.sheet} aria-label={t('passbook.doc.title')}>
      <header className={styles.sheetHead}>
        <span className={styles.sheetTitle}>{t('passbook.doc.title')}</span>
        <span className={styles.sheetSub}>{periodLabel(book)}</span>
      </header>
      <dl className={styles.sheetMeta}>
        <div>
          <dt>{t('passbook.doc.between')}</dt>
          <dd>{names.me !== null ? t('passbook.doc.between.names', { me: names.me, name: names.name }) : t('passbook.doc.between.you', { name: names.name })}</dd>
        </div>
        <div>
          <dt>{t('passbook.doc.madeOn')}</dt>
          <dd>{dayLabel(book.to)}</dd>
        </div>
      </dl>
      {book.ledgers.map((ledger) => (
        <section key={ledger.currency} className={styles.sheetLedger}>
          {several && <h3 className={styles.sheetLabel}>{t('passbook.currency.heading', { currency: ledger.currency })}</h3>}
          <table className={styles.sheetTable}>
            <thead>
              <tr>
                <th scope="col">{t('passbook.doc.date')}</th>
                <th scope="col">{t('passbook.doc.details')}</th>
                <th scope="col" className={styles.num}>
                  {names.me !== null ? t('passbook.doc.gave', { me: names.me }) : t('passbook.doc.gave.you')}
                </th>
                <th scope="col" className={styles.num}>
                  {names.me !== null ? t('passbook.doc.got', { me: names.me }) : t('passbook.doc.got.you')}
                </th>
                <th scope="col" className={styles.num}>
                  {t('passbook.doc.balance')}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={styles.nowrap}>{book.from ? dayLabel(book.from) : ''}</td>
                <td>{t('passbook.opening')}</td>
                <td />
                <td />
                <td className={styles.num}>{balanceLabel(ledger.opening, ledger.currency, names, true)}</td>
              </tr>
              {ledger.entries.map((entry) => (
                <tr key={entry.id}>
                  <td className={styles.nowrap}>{dayLabel(entry.date)}</td>
                  <td>
                    {entryWhat(entry)}
                    <span className={styles.sheetFine}>
                      {entry.kind !== 'group' && entry.groupName
                        ? t('passbook.row.in', { kind: entryKind(entry, names, true), group: entry.groupName })
                        : entryKind(entry, names, true)}
                    </span>
                  </td>
                  <td className={styles.num}>{entry.amount > 0 ? money(entry.amount, ledger.currency) : ''}</td>
                  <td className={styles.num}>{entry.amount < 0 ? money(entry.amount, ledger.currency) : ''}</td>
                  <td className={styles.num}>{balanceLabel(entry.balance, ledger.currency, names, true)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className={styles.nowrap}>{dayLabel(book.to)}</td>
                <th scope="row">{t('passbook.closing')}</th>
                <td className={styles.num}>{money(ledger.gave, ledger.currency)}</td>
                <td className={styles.num}>{money(ledger.got, ledger.currency)}</td>
                <td className={styles.num}>{balanceLabel(ledger.closing, ledger.currency, names, true)}</td>
              </tr>
            </tfoot>
          </table>
          {ledger.adjusted.map((g) => (
            <p key={g.groupId} className={styles.sheetNote}>
              {groupNote(g.groupName, names)}
            </p>
          ))}
        </section>
      ))}
      <p className={styles.sheetMade}>
        {t('passbook.doc.note')} {t('passbook.share.made', { app: BRAND.name })}
      </p>
    </article>
  )
}
