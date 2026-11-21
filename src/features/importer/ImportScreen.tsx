import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeftRight, Check, ChevronRight, FileSpreadsheet, Lock, TriangleAlert } from 'lucide-react'
import { fold, rankNameCandidates, sureMatch } from '../../../shared/nameMatch'
import { goBack, navigate } from '../../app/router'
import { Banner, Button, Money, PageTitle, Screen, TextField, TopBar, useToast } from '../../components'
import { useFriends, useProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { categoryFromText } from '../../engine/categories'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { WhoPicker, type WhoRow } from '../home/WhoPicker'
import { useNicknames } from '../home/nicknames'
import { applyImport, mainCurrency, undoImport, type ImportResult } from './apply'
import { checkTotals, planSplitwise, readSplitwise, SplitwiseFormatError, type Plan, type SplitwiseFile } from './splitwise'
import styles from './Import.module.css'

export const IMPORT_PATH = '/app/import'

/** A group's name from Splitwise's file name ("goa-trip_2026-11-21_export.csv" → "Goa trip"). */
export function nameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[a-z0-9]+$/i, '').replace(/_?\d{4}-\d{2}-\d{2}.*$/, '').replace(/[_-]+/g, ' ').replace(/\bexport\b/i, '').trim()
  if (!base) return ''
  return base.charAt(0).toUpperCase() + base.slice(1)
}

type Stage =
  | { kind: 'start'; problem: string | null }
  | { kind: 'review'; file: SplitwiseFile; plan: Plan; fileName: string }
  | { kind: 'done'; result: ImportResult }

/** "Bring your Splitwise": the way in, from the Groups screen. */
export function ImportStart() {
  const t = useT()
  return (
    <button type="button" className={styles.start} onClick={() => navigate(IMPORT_PATH)}>
      <span className={styles.startIcon} aria-hidden="true">
        <ArrowLeftRight />
      </span>
      <span className={styles.startText}>
        <span className={styles.startTitle}>{t('import.start.title')}</span>
        <span className={styles.fine}>{t('import.start.body')}</span>
      </span>
      <ChevronRight className={styles.startChevron} aria-hidden="true" />
    </button>
  )
}

/**
 * Bring your Splitwise: drop a group's Splitwise export (Group → Settings → Export as spreadsheet)
 * and the group comes over — people matched to yours, every bill and payment — with its balances
 * checked against Splitwise's own total, to the paisa. Read on the phone; nothing is uploaded.
 */
export default function ImportScreen() {
  const t = useT()
  const toast = useToast()
  const profile = useProfile()
  const friends = useFriends()
  const nicknames = useNicknames()
  const input = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>({ kind: 'start', problem: null })
  const [groupName, setGroupName] = useState('')
  const [me, setMe] = useState<string | null>(null)
  const [picks, setPicks] = useState<Record<string, string | null>>({})
  const [busy, setBusy] = useState(false)
  const people = useMemo(() => friends.filter((f) => f.id !== ME_ID), [friends])

  const pick = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const chosen = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!chosen) return
    try {
      const text = await chosen.text()
      const file = readSplitwise(text, profile.currency)
      const plan = planSplitwise(file, categoryFromText)
      // Which column is you: your name, else the one sure match.
      const meSure = sureMatch(rankNameCandidates(profile.name || '', file.people.map((p) => ({ id: p, name: p }))))
      const meGuess = meSure?.id ?? file.people.find((p) => fold(p) === fold(profile.name || '')) ?? null
      setMe(meGuess)
      // Everyone else: the one person of yours they surely are, else someone new.
      const initial: Record<string, string | null> = {}
      for (const name of file.people) {
        if (name === meGuess) continue
        initial[name] = sureMatch(rankNameCandidates(name, people, nicknames))?.id ?? null
      }
      setPicks(initial)
      setGroupName(nameFromFile(chosen.name))
      haptic('success')
      setStage({ kind: 'review', file, plan, fileName: chosen.name })
    } catch (error) {
      haptic('error')
      setStage({ kind: 'start', problem: error instanceof SplitwiseFormatError ? t('import.problem.notSplitwise') : t('import.problem.file') })
    }
  }

  if (stage.kind === 'start') {
    return (
      <Screen header={<TopBar onBack={() => goBack('/app/groups')} />} contentClassName={styles.content}>
        <PageTitle title={t('import.title')} subtitle={t('import.subtitle')} />
        <div className={styles.hero}>
          <span className={styles.heroIcon} aria-hidden="true">
            <FileSpreadsheet />
          </span>
          <ol className={styles.steps}>
            <li>{t('import.how.1')}</li>
            <li>{t('import.how.2')}</li>
            <li>{t('import.how.3')}</li>
          </ol>
          <input ref={input} type="file" accept=".csv,text/csv,text/comma-separated-values" hidden onChange={(e) => void pick(e)} aria-label={t('import.pick')} />
          <Button block iconStart={<FileSpreadsheet />} onClick={() => input.current?.click()}>
            {t('import.pick')}
          </Button>
          <p className={styles.private}>
            <Lock aria-hidden="true" />
            {t('import.private')}
          </p>
        </div>
        {stage.problem && (
          <Banner tone="warning" icon={<TriangleAlert />}>
            <span role="alert">{stage.problem}</span>
          </Banner>
        )}
      </Screen>
    )
  }

  if (stage.kind === 'done') {
    const { result } = stage
    const matched = result.mismatches.length === 0
    return (
      <Screen header={<TopBar onBack={() => navigate('/app/groups')} />} contentClassName={styles.content}>
        <PageTitle title={t('import.done.title')} subtitle={t('import.done.subtitle', { bills: result.bills, payments: result.payments })} />
        {matched ? (
          <Banner tone="success" icon={<Check />} title={t('import.done.match.title')}>
            {t('import.done.match.body')}
          </Banner>
        ) : (
          <Banner tone="warning" icon={<TriangleAlert />} title={t('import.done.mismatch.title')}>
            <ul className={styles.mismatch}>
              {result.mismatches.map((m) => (
                <li key={m.person}>
                  {m.person}: Splitwise <Money value={m.splitwise} currency={result.currency} sign="always" trimZeros /> · Settle{' '}
                  <Money value={m.settle} currency={result.currency} sign="always" trimZeros />
                </li>
              ))}
            </ul>
          </Banner>
        )}
        {(result.otherCurrency.bills > 0 || result.otherCurrency.paymentsLeftOut > 0) && (
          <Banner tone="info" title={t('import.done.other.title')}>
            {t('import.done.other.body', { bills: result.otherCurrency.bills, payments: result.otherCurrency.paymentsLeftOut, currency: result.currency })}
          </Banner>
        )}
        <div className={styles.actions}>
          <Button block onClick={() => navigate(`/app/groups/${encodeURIComponent(result.groupId)}`)}>
            {t('import.done.open')}
          </Button>
          <Button
            block
            variant="ghost"
            onClick={() => {
              undoImport(result)
              toast(t('import.done.undone'))
              setStage({ kind: 'start', problem: null })
            }}
          >
            {t('import.done.undo')}
          </Button>
        </div>
      </Screen>
    )
  }

  const { file, plan } = stage
  const currency = mainCurrency(file)
  const mismatches = checkTotals(file, plan)
  const bills = plan.items.filter((i) => i.kind === 'bill').length
  const payments = plan.items.filter((i) => i.kind === 'payment').length
  const others = file.people.filter((p) => p !== me)
  const rows: WhoRow[] = others.map((name) => ({ said: name, friendId: picks[name] ?? null, role: 'in' }))
  const pickedSet = new Set(Object.keys(picks).map(fold))
  const totals = file.totals[currency] ?? null

  const run = (): void => {
    if (!me) return
    setBusy(true)
    try {
      const result = applyImport(file, plan, { groupName, me, people: picks })
      haptic('success')
      setStage({ kind: 'done', result })
    } catch {
      haptic('error')
      toast(t('import.problem.save'), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen header={<TopBar onBack={() => setStage({ kind: 'start', problem: null })} />} contentClassName={styles.content}>
      <PageTitle title={t('import.review.title')} subtitle={t('import.review.subtitle', { bills, payments, people: file.people.length })} />

      <TextField label={t('import.review.name')} value={groupName} onChange={(e) => setGroupName(e.currentTarget.value)} maxLength={60} />

      <fieldset className={styles.me}>
        <legend className={styles.legend}>{t('import.review.me')}</legend>
        <div className={styles.meList}>
          {file.people.map((name) => (
            <label key={name} className={styles.meOption}>
              <input
                type="radio"
                name="import-me"
                checked={me === name}
                onChange={() => {
                  setMe(name)
                  setPicks((p) => {
                    const next = { ...p }
                    delete next[name]
                    if (me && !(me in next)) next[me] = sureMatch(rankNameCandidates(me, people, nicknames))?.id ?? null
                    return next
                  })
                }}
              />
              <span>{name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {me && rows.length > 0 && (
        <WhoPicker rows={rows} people={people} nicknames={nicknames} onSettle={new Map()} picked={pickedSet} onPick={(said, id) => setPicks((p) => ({ ...p, [said]: id }))} />
      )}

      {totals && (
        <section className={styles.check} aria-labelledby="import-check">
          <h2 id="import-check" className={styles.checkTitle}>
            {mismatches.length === 0 ? t('import.review.check.ok') : t('import.review.check.bad')}
          </h2>
          <ul role="list" className={styles.balances}>
            {file.people.map((name) => (
              <li key={name} className={styles.balance}>
                <span>{name === me ? t('import.review.you', { name }) : name}</span>
                <Money value={totals[name] ?? 0} currency={currency} sign="always" trimZeros />
              </li>
            ))}
          </ul>
          <p className={styles.fine}>{t('import.review.check.note')}</p>
        </section>
      )}

      {(plan.skipped.length > 0 || file.problems.length > 0) && (
        <Banner tone="info" title={t('import.review.left.title')}>
          {plan.skipped.length > 0 && <p>{t('import.review.left.own', { count: plan.skipped.length })}</p>}
          {file.problems.map((p) => (
            <p key={p.line}>{t('import.review.left.line', { line: p.line, reason: p.reason })}</p>
          ))}
        </Banner>
      )}

      <div className={styles.actions}>
        <Button block onClick={run} loading={busy} disabled={!me || groupName.trim() === ''}>
          {t('import.review.cta', { bills, payments })}
        </Button>
        {!me && <p className={styles.fine}>{t('import.review.pickMe')}</p>}
      </div>
    </Screen>
  )
}
