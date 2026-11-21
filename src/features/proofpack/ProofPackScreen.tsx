import { useMemo, useState } from 'react'
import { Download, Printer, ShieldCheck } from 'lucide-react'
import { goBack } from '../../app/router'
import { Banner, Button, Chip, Money, PageTitle, Screen, TopBar } from '../../components'
import { useExpenses, useFriendsById, useGroups, useProfile } from '../../data'
import { proofRefsStore } from '../../data/stores'
import { useStore } from '../../data/store'
import { ME_ID } from '../../domain/types'
import { today } from '../../engine/dates'
import { fullDateLabel } from '../../kit/dateLabel'
import { useT } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { useShagunBook } from '../shagun/store'
import { buildStatement, financialYear, statementCsv, type Statement } from './engine'
import styles from './ProofPack.module.css'

export const PROOF_PACK_PATH = '/app/proof-of-repayments'

type Period = 'thisFy' | 'lastFy' | 'last90' | 'all'

function shiftDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function localDay(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Proof of repayments: the money your friends paid you back, what each payment was for, and the
 * UPI reference when Settle saw it — for a bank that's holding your account over a payment, or to
 * keep repayments apart from gifts at tax time. Print it (or save it as a PDF), or download a CSV.
 */
export function ProofPackScreen() {
  const t = useT()
  const profile = useProfile()
  const expenses = useExpenses()
  // Every group, archived ones too: money paid back in an old trip still counts.
  const groups = useGroups()
  const friends = useFriendsById()
  const proofRefs = useStore(proofRefsStore, (s) => s)
  const shagun = useShagunBook()
  const day = today()
  const [period, setPeriod] = useState<Period>('thisFy')
  const [personId, setPersonId] = useState<string | null>(null)

  const range = useMemo(() => {
    const fy = financialYear(day)
    if (period === 'thisFy') return { from: fy.from, to: day, label: fy.label }
    if (period === 'lastFy') {
      const last = financialYear(shiftDays(fy.from, -1))
      return { from: last.from, to: last.to, label: last.label }
    }
    if (period === 'last90') return { from: shiftDays(day, -89), to: day, label: t('proofpack.period.last90') }
    return { from: '1970-01-01', to: day, label: t('proofpack.period.all') }
  }, [period, day, t])

  const statement: Statement = useMemo(
    () => buildStatement({ expenses, groups, proofRefs, shagun: shagun.entries, from: range.from, to: range.to, personId, dayOf: localDay }),
    [expenses, groups, proofRefs, shagun.entries, range, personId],
  )
  const everyone = useMemo(
    () => buildStatement({ expenses, groups, proofRefs, shagun: [], from: range.from, to: range.to, dayOf: localDay }),
    [expenses, groups, proofRefs, range],
  )
  const senders = [...new Set(everyone.lines.map((l) => l.fromId))]
  const nameOf = (id: string) => (id === ME_ID ? profile.name || t('paidfor.you') : (friends[id]?.name ?? t('paidfor.someone')))

  const download = (): void => {
    const csv = statementCsv(statement, nameOf, (m, c) => formatMoney(m, c, { trimZeros: false }).replace(/[^\d.,-]/g, ''))
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `settle-repayments-${range.from}-to-${range.to}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <Screen header={<TopBar onBack={() => goBack('/app/tools')} />} contentClassName={styles.content}>
      <PageTitle title={t('proofpack.title')} subtitle={t('proofpack.subtitle')} />

      <div className={styles.controls} data-print="hide">
        <div className={styles.chips} role="group" aria-label={t('proofpack.period.label')}>
          {(['thisFy', 'lastFy', 'last90', 'all'] as const).map((p) => (
            <Chip key={p} selected={period === p} onClick={() => setPeriod(p)}>
              {p === 'thisFy' ? t('proofpack.period.thisFy') : p === 'lastFy' ? t('proofpack.period.lastFy') : p === 'last90' ? t('proofpack.period.last90') : t('proofpack.period.all')}
            </Chip>
          ))}
        </div>
        {senders.length > 1 && (
          <label className={styles.person}>
            <span>{t('proofpack.person.label')}</span>
            <select value={personId ?? ''} onChange={(e) => setPersonId(e.currentTarget.value || null)}>
              <option value="">{t('proofpack.person.all')}</option>
              {senders.map((id) => (
                <option key={id} value={id}>
                  {nameOf(id)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <article className={styles.sheet} aria-label={t('proofpack.sheet.aria')}>
        <header className={styles.sheetHead}>
          <ShieldCheck aria-hidden="true" className={styles.mark} />
          <div>
            <h2 className={styles.sheetTitle}>{t('proofpack.sheet.title', { name: profile.name || t('paidfor.you') })}</h2>
            <p className={styles.sheetMeta}>
              {range.label} · {fullDateLabel(range.from === '1970-01-01' ? (statement.lines[0]?.date ?? range.to) : range.from)} – {fullDateLabel(range.to)}
              {personId ? ` · ${t('proofpack.sheet.from', { name: nameOf(personId) })}` : ''}
            </p>
          </div>
        </header>

        <dl className={styles.totals}>
          {Object.entries(statement.totals).map(([currency, total]) => (
            <div key={currency} className={styles.total}>
              <dt>{t('proofpack.total.repayments')}</dt>
              <dd>
                <Money value={total.repayments} currency={currency} trimZeros strong />
              </dd>
              {total.loans > 0 && (
                <>
                  <dt>{t('proofpack.total.loans')}</dt>
                  <dd>
                    <Money value={total.loans} currency={currency} trimZeros strong />
                  </dd>
                </>
              )}
            </div>
          ))}
          {statement.giftsTotal > 0 && (
            <div className={styles.total}>
              <dt>{t('proofpack.total.gifts')}</dt>
              <dd>
                <Money value={statement.giftsTotal} currency="INR" trimZeros strong />
              </dd>
            </div>
          )}
        </dl>

        {statement.lines.length === 0 ? (
          <p className={styles.empty}>{t('proofpack.empty')}</p>
        ) : (
          <ol className={styles.lines}>
            {statement.lines.map((line, i) => (
              <li key={`${line.date}-${line.fromId}-${i}`} className={styles.line}>
                <div className={styles.lineTop}>
                  <span className={styles.lineWho}>
                    {nameOf(line.fromId)}
                    <span className={styles.lineDate}>{fullDateLabel(line.date)}</span>
                  </span>
                  <Money value={line.amount} currency={line.currency} trimZeros strong />
                </div>
                <p className={styles.lineMeta}>
                  {line.kind === 'loan' ? t('proofpack.line.loan') : t('proofpack.line.repayment')}
                  {line.groupName ? ` · ${line.groupName}` : ''}
                  {line.method ? ` · ${t(`proofpack.method.${line.method}` as 'proofpack.method.upi')}` : ''}
                  {line.utr ? ` · ${t('proofpack.line.utr', { utr: line.utr })}` : ''}
                  {line.undated ? ` · ${t('proofpack.line.undated')}` : ''}
                </p>
                {(line.forBills.length > 0 || line.ahead > 0) && (
                  <ul role="list" className={styles.bills}>
                    {line.forBills.map((b) => (
                      <li key={b.expenseId} className={styles.bill}>
                        <span>
                          {t('proofpack.line.for', { title: b.title || t('paidfor.untitled') })} <span className={styles.lineDate}>{b.date ? fullDateLabel(b.date) : ''}</span>
                        </span>
                        <Money value={b.amount} currency={line.currency} trimZeros />
                      </li>
                    ))}
                    {line.ahead > 0 && (
                      <li className={styles.bill}>
                        <span>{t('paidfor.payment.extra')}</span>
                        <Money value={line.ahead} currency={line.currency} trimZeros />
                      </li>
                    )}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}

        {statement.gifts.length > 0 && (
          <section className={styles.gifts} aria-labelledby="proofpack-gifts">
            <h3 id="proofpack-gifts" className={styles.giftsTitle}>
              {t('proofpack.gifts.title')}
            </h3>
            <ul role="list" className={styles.bills}>
              {statement.gifts.map((g, i) => (
                <li key={`${g.date}-${i}`} className={styles.bill}>
                  <span>
                    {g.name} <span className={styles.lineDate}>{fullDateLabel(g.date)}</span>
                  </span>
                  <Money value={g.amount} currency="INR" trimZeros />
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className={styles.footer}>
          <p>{t('proofpack.footer.what')}</p>
          <p>{t('proofpack.footer.not')}</p>
          <p>{t('proofpack.footer.made', { date: fullDateLabel(day) })}</p>
        </footer>
      </article>

      <div className={styles.actions} data-print="hide">
        <Button block iconStart={<Printer />} onClick={() => window.print()} disabled={statement.lines.length === 0}>
          {t('proofpack.print')}
        </Button>
        <Button block variant="secondary" iconStart={<Download />} onClick={download} disabled={statement.lines.length === 0}>
          {t('proofpack.csv')}
        </Button>
      </div>

      <Banner tone="info" title={t('proofpack.when.title')}>
        <p>{t('proofpack.when.freeze')}</p>
        <p>{t('proofpack.when.tax')}</p>
      </Banner>
    </Screen>
  )
}
