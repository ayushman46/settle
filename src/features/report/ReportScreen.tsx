import { useId, useMemo, useState } from 'react'
import { FileSpreadsheet, Printer, ReceiptText } from 'lucide-react'
import { goBack, navigate, useSearchParams } from '../../app/router'
import { Button, Card, Chip, EmptyState, PageTitle, Screen, SegmentedControl, TextField, TopBar, useToast } from '../../components'
import { useExpenses, useFriendsById, useGroups, useProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { formatMoney } from '../../lib/money'
import { printPage } from '../../lib/nativeApp'
import { shareFile } from '../../share'
import { claimableGroups, defaultScope, indianDate, monthRange, reportCandidates, summarize, type ReportBasis, type ReportScope } from './engine'
import { ReportDoc } from './ReportDoc'
import { reportCsvBlob, reportCsvFilename } from './reportCsv'
import { REPORT_LIMITS, saveReportDetails, useReportDetails } from './store'
import styles from './Report.module.css'

const NO_SKIPS: ReadonlySet<string> = new Set()

type DatesScope = Extract<ReportScope, { kind: 'dates' }>

/**
 * `/app/report` (optionally `?group=<id>`) — an expense claim from what Settle already has: pick a
 * group or dates and what to claim, untick what the office won't pay for, then print it (or save
 * it as a PDF) or download a spreadsheet. The name, ID and purpose are remembered for next time.
 */
export function ReportScreen() {
  const t = useT()
  const toast = useToast()
  const query = useSearchParams()
  const expenses = useExpenses()
  const groups = useGroups()
  const friendsById = useFriendsById()
  const profile = useProfile()
  const saved = useReportDetails()
  const fieldId = useId()
  const [today] = useState(() => todayIso())

  const choices = useMemo(() => claimableGroups(groups, expenses), [groups, expenses])
  const [scope, setScope] = useState<ReportScope>(() => {
    const asked = query.get('group')
    if (asked && groups.some((g) => g.id === asked)) return { kind: 'group', groupId: asked }
    return defaultScope(groups, expenses, today)
  })
  const [lastDates, setLastDates] = useState<DatesScope>(() => (scope.kind === 'dates' ? scope : { kind: 'dates', ...monthRange(today) }))
  const [basis, setBasis] = useState<ReportBasis>('paid')
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(NO_SKIPS)
  const [details, setDetails] = useState(() => ({ ...saved, name: saved.name || profile.name.trim() }))
  const [busy, setBusy] = useState(false)

  const claimant = details.name.trim() || profile.name.trim()
  const nameOf = useMemo(() => (id: string) => (id === ME_ID && claimant ? claimant : friendLabel(id, friendsById[id] ?? null)), [claimant, friendsById])
  const candidates = useMemo(() => reportCandidates({ expenses, scope, basis, nameOf }), [expenses, scope, basis, nameOf])
  const report = useMemo(() => summarize(candidates, skipped), [candidates, skipped])
  const money = (minor: number, currency: string) => formatMoney(minor, currency, { trimZeros: true })

  const group = scope.kind === 'group' ? groups.find((g) => g.id === scope.groupId) : undefined
  const period =
    scope.kind === 'group'
      ? (group?.name ?? '')
      : t('report.dates.period', { from: indianDate(scope.from <= scope.to ? scope.from : scope.to), to: indianDate(scope.from <= scope.to ? scope.to : scope.from) })

  if (expenses.every((e) => e.kind === 'loan')) {
    return (
      <Screen header={<TopBar onBack={() => goBack('/app')} />}>
        <PageTitle title={t('report.title')} />
        <EmptyState icon={<ReceiptText />} title={t('report.none.title')} text={t('report.none.text')} action={<Button onClick={() => navigate('/app')}>{t('report.none.cta')}</Button>} />
      </Screen>
    )
  }

  const remember = (key: 'name' | 'employee' | 'purpose') => saveReportDetails({ [key]: details[key] })
  const setField = (key: 'name' | 'employee' | 'purpose', value: string) => setDetails((d) => ({ ...d, [key]: value }))

  const withBill = candidates.filter((r) => r.hasBill)
  const showBillsFilter = withBill.length > 0 && withBill.length < candidates.length
  const billsOnly = showBillsFilter && candidates.every((r) => skipped.has(r.id) !== r.hasBill)
  const ticked = report.rows.length

  const toggle = (id: string) =>
    setSkipped((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const downloadCsv = async () => {
    if (busy || ticked === 0) return
    setBusy(true)
    const outcome = await shareFile(reportCsvBlob(report), reportCsvFilename(today), undefined, { title: t('report.docTitle') })
    setBusy(false)
    if (outcome === 'shared' || outcome === 'downloaded') toast(outcome === 'shared' ? t('report.csv.shared') : t('report.csv.saved'), { tone: 'success' })
    else if (outcome === 'failed') toast(t('report.csv.failed'), { tone: 'error' })
  }

  const pickKind = (kind: ReportScope['kind']) => {
    if (kind === scope.kind) return
    if (kind === 'dates') setScope(lastDates)
    else {
      if (scope.kind === 'dates') setLastDates(scope)
      const first = choices[0]
      if (first) setScope({ kind: 'group', groupId: first.id })
    }
  }

  return (
    <Screen header={<TopBar onBack={() => goBack('/app')} />} contentClassName={styles.content}>
      <PageTitle title={t('report.title')} subtitle={t('report.subtitle')} />

      <Card>
        <div className={styles.fields}>
          {choices.length > 0 && (
            <div className={styles.field}>
              <span className={styles.label}>{t('report.from.label')}</span>
              <SegmentedControl
                ariaLabel={t('report.from.label')}
                size="sm"
                value={scope.kind}
                onChange={pickKind}
                options={[
                  { value: 'group', label: t('report.from.group') },
                  { value: 'dates', label: t('report.from.dates') },
                ]}
              />
            </div>
          )}
          {scope.kind === 'group' ? (
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${fieldId}-group`}>
                {t('report.group.label')}
              </label>
              <select
                id={`${fieldId}-group`}
                className={styles.select}
                value={scope.groupId}
                onChange={(e) => setScope({ kind: 'group', groupId: e.target.value })}
              >
                {group && !choices.includes(group) && (
                  <option value={group.id}>
                    {group.emoji} {group.name}
                  </option>
                )}
                {choices.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.emoji} {g.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className={styles.pair}>
              <TextField
                type="date"
                label={t('report.dates.from')}
                value={scope.from}
                onChange={(e) => e.target.value && setScope({ ...scope, from: e.target.value })}
              />
              <TextField type="date" label={t('report.dates.to')} value={scope.to} onChange={(e) => e.target.value && setScope({ ...scope, to: e.target.value })} />
            </div>
          )}
          <div className={styles.field}>
            <span className={styles.label}>{t('report.basis.label')}</span>
            <SegmentedControl
              ariaLabel={t('report.basis.label')}
              size="sm"
              value={basis}
              onChange={setBasis}
              options={[
                { value: 'paid', label: t('report.basis.paid') },
                { value: 'share', label: t('report.basis.share') },
              ]}
            />
            <span className={styles.hint}>{basis === 'paid' ? t('report.basis.paid.hint') : t('report.basis.share.hint')}</span>
          </div>
        </div>
      </Card>

      {candidates.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<ReceiptText />}
          title={t('report.empty.title')}
          text={basis === 'paid' ? t('report.empty.paid') : t('report.empty.share')}
          action={
            basis === 'paid' ? (
              <Button variant="secondary" onClick={() => setBasis('share')}>
                {t('report.basis.share')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <section className={styles.section} aria-labelledby={`${fieldId}-list`}>
            <div className={styles.row}>
              <h2 id={`${fieldId}-list`} className={styles.sectionTitle}>
                {t('report.list.title')}
              </h2>
              <span className={styles.hint}>{t('report.list.count', { ticked, count: candidates.length })}</span>
            </div>
            <div className={styles.chips}>
              <Chip selected={false} onClick={() => setSkipped(ticked === candidates.length ? new Set(candidates.map((r) => r.id)) : NO_SKIPS)}>
                {ticked === candidates.length ? t('report.list.none') : t('report.list.all')}
              </Chip>
              {showBillsFilter && (
                <Chip
                  selected={billsOnly}
                  aria-pressed={billsOnly}
                  onClick={() => setSkipped(billsOnly ? NO_SKIPS : new Set(candidates.filter((r) => !r.hasBill).map((r) => r.id)))}
                >
                  {t('report.list.bills')}
                </Chip>
              )}
            </div>
            <Card padding="none">
              <ul className={styles.list} aria-label={t('report.list.aria')}>
                {candidates.map((r) => {
                  const amount = money(r.amount, r.currency)
                  return (
                    <li key={r.id}>
                      <label className={styles.item}>
                        <input
                          type="checkbox"
                          className={styles.check}
                          checked={!skipped.has(r.id)}
                          onChange={() => toggle(r.id)}
                          aria-label={t('report.row.tick.aria', { title: r.title, amount })}
                        />
                        <span className={styles.itemText}>
                          <span className={styles.itemTitle}>{r.title}</span>
                          <span className={styles.itemMeta}>
                            {t('report.row.meta', { date: indianDate(r.date), category: r.categoryLabel, name: r.paidBy })}
                          </span>
                          {r.original && (
                            <span className={styles.itemMeta}>{t('report.row.fx', { amount: money(r.original.amount, r.original.currency), rate: r.original.rate })}</span>
                          )}
                        </span>
                        <span className={styles.itemAmount}>{amount}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </Card>
          </section>

          <div className={styles.total} role="status" aria-label={t('report.total.aria')}>
            {report.totals.length === 0 ? (
              <span className={styles.totalLine}>{t('report.total.none')}</span>
            ) : (
              report.totals.map((total) => (
                <span key={total.currency} className={styles.totalLine}>
                  {t('report.total', { amount: money(total.amount, total.currency), count: total.count })}
                </span>
              ))
            )}
            {report.words && <span className={styles.hint}>{t('report.total.words', { words: report.words })}</span>}
          </div>

          <Card>
            <div className={styles.fields}>
              <h2 className={styles.sectionTitle}>{t('report.details.title')}</h2>
              <TextField
                label={t('report.details.name')}
                value={details.name}
                maxLength={REPORT_LIMITS.name}
                autoComplete="name"
                onChange={(e) => setField('name', e.target.value)}
                onBlur={() => remember('name')}
              />
              <TextField
                label={t('report.details.employee')}
                hint={t('report.details.employee.hint')}
                value={details.employee}
                maxLength={REPORT_LIMITS.employee}
                onChange={(e) => setField('employee', e.target.value)}
                onBlur={() => remember('employee')}
              />
              <TextField
                label={t('report.details.purpose')}
                hint={t('report.details.purpose.hint')}
                value={details.purpose}
                maxLength={REPORT_LIMITS.purpose}
                onChange={(e) => setField('purpose', e.target.value)}
                onBlur={() => remember('purpose')}
              />
              <span className={styles.hint}>{t('report.details.remembered')}</span>
            </div>
          </Card>

          <div className={styles.actions}>
            <Button block iconStart={<Printer />} disabled={ticked === 0} onClick={() => printPage(t('report.docTitle'))}>
              {t('report.print')}
            </Button>
            <Button block variant="secondary" iconStart={<FileSpreadsheet />} disabled={ticked === 0 || busy} onClick={() => void downloadCsv()}>
              {busy ? t('report.csv.busy') : t('report.csv')}
            </Button>
          </div>

          {ticked > 0 && (
            <section className={styles.section} aria-labelledby={`${fieldId}-preview`}>
              <h2 id={`${fieldId}-preview`} className={styles.sectionTitle}>
                {t('report.preview')}
              </h2>
              <p className={styles.hint}>{t('report.preview.hint')}</p>
              <div className={styles.printArea}>
                <ReportDoc report={report} name={claimant} employee={details.employee.trim()} purpose={details.purpose.trim()} period={period} basis={basis} />
              </div>
            </section>
          )}
        </>
      )}
    </Screen>
  )
}
