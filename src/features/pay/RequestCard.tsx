import { Avatar, CategoryIcon, ProgressRing } from '../../components'
import { tx, useT } from '../../i18n'
import { formatBillDate } from '../../lib/format'
import { formatMoney } from '../../lib/money'
import { categoryLabel } from '../../share/categories'
import { payLinkProgress, type PayLinkPayload } from '../../share/payLink'
import { payeeColor } from './payView'
import styles from './RequestCard.module.css'

/**
 * "Ayush requested money for Friday dinner": what it was, when, the total and — when several people
 * owe, so the group can see it moving — how much has been collected so far. The page's h1.
 */
export function RequestCard({ payload }: { payload: PayLinkPayload }) {
  const t = useT()
  const money = (minor: number) => formatMoney(minor, payload.c, { trimZeros: true })
  const date = formatBillDate(payload.d)
  const progress = payLinkProgress(payload)
  const owed = progress.collected + progress.outstanding
  const meta = [date, categoryLabel(payload.cat), t('pay.request.total', { amount: money(payload.tot) })].filter(Boolean).join(' · ')

  return (
    <section className={styles.card} aria-labelledby="pay-request-title">
      <div className={styles.icons} aria-hidden="true">
        <CategoryIcon category={payload.cat} size="lg" />
        <Avatar name={payload.to.n} color={payeeColor(payload)} size="md" className={styles.payee} />
      </div>
      <h1 id="pay-request-title" className={styles.title}>
        {tx(
          'pay.request.title',
          { name: payload.to.n, title: payload.t },
          {
            by: (chunk) => <span className={styles.by}>{chunk}</span>,
            what: (chunk) => <span className={styles.what}>{chunk}</span>,
          },
        )}
      </h1>
      <p className={styles.meta}>{meta}</p>
      {payload.note && <p className={styles.note}>“{payload.note}”</p>}
      {progress.peopleCount > 1 && (
        <div className={styles.progress}>
          <ProgressRing value={owed > 0 ? progress.collected / owed : 0} size={40} stroke={5} />
          <p className={styles.progressText}>
            <span className={styles.collected}>
              {t('pay.request.collected', { collected: money(progress.collected), owed: money(owed) })}
            </span>
            <span className={styles.count}>
              {t('pay.request.paidCount', { paid: progress.paidCount, count: progress.peopleCount })}
            </span>
          </p>
        </div>
      )}
    </section>
  )
}
