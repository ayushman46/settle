import { useId } from 'react'
import { Button } from '../../components'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { merchantById } from './merchants'
import type { StuckPrefill } from './prefill'
import { accountLine, inr, railLabel, stuckDate } from './view'
import styles from './Stuck.module.css'

/** One stuck payment found in a paste. */
export interface FoundItem {
  prefill: StuckPrefill
  /** Told as pending, not failed. */
  pending: boolean
  /** Already on the phone (the same reference or order number): its id. It isn't ticked; "Open it" opens it. */
  trackedId: string | null
}

/**
 * "Found 2 stuck payments": each one found in a paste, ticked to be tracked (one already tracked
 * isn't — it opens instead), with "Check first" to look it over in Add before saving. Each row
 * says who (or, with no name, the bank and how it was paid), how much and on what day — so two
 * rows never read the same.
 */
export function PasteFound({
  items,
  picked,
  backCount,
  onToggle,
  onCheck,
}: {
  items: readonly FoundItem[]
  picked: readonly boolean[]
  /** Messages in the paste that say money came back (ticked off with the rest). */
  backCount: number
  onToggle: (index: number) => void
  /** "Check first", or "Open it" for one already tracked. */
  onCheck: (index: number) => void
}) {
  const t = useT()
  const headId = useId()
  const day = todayIso()
  const allTracked = items.every((item) => item.trackedId !== null)
  return (
    <section className={styles.paste} aria-labelledby={headId}>
      <h3 id={headId} className={styles.pasteLabel}>
        {t('stuck.paste.found', { count: items.length })}
      </h3>
      <p className={styles.fine}>{allTracked ? t('stuck.dupe.none') : t('stuck.paste.found.text')}</p>
      <ul className={styles.found}>
        {items.map((item, index) => {
          const { prefill } = item
          const kind = prefill.kind === 'refund' ? t('stuck.kind.refund') : item.pending ? t('stuck.paste.found.pending') : t('stuck.kind.failed')
          const who =
            prefill.party?.trim() ||
            merchantById(prefill.merchant)?.name ||
            accountLine({ bank: prefill.bank ?? null, account: prefill.account ?? null }) ||
            (prefill.kind !== 'refund' && prefill.rail ? railLabel(prefill.rail) : kind)
          const title = prefill.amount !== undefined ? `${who} · ${inr(prefill.amount)}` : who
          const date = prefill.date !== undefined ? stuckDate(prefill.date, day) : null
          const meta = [kind, date ?? t('stuck.paste.found.noDay'), item.trackedId !== null ? t('stuck.dupe.row') : null].filter((part) => part !== null).join(' · ')
          // Unique to the row: who, how much and the day.
          const name = date ? `${title} · ${date}` : title
          const tracked = item.trackedId !== null
          return (
            <li key={index} className={styles.foundRow}>
              <label className={styles.foundPick}>
                <input type="checkbox" className={styles.foundCheck} checked={picked[index] === true} disabled={tracked} onChange={() => onToggle(index)} />
                <span className={styles.foundText}>
                  <span className={styles.foundTitle}>{title}</span>{' '}
                  <span className={styles.foundMeta}>{meta}</span>
                </span>
              </label>
              <Button
                variant="ghost"
                size="sm"
                className={styles.foundAction}
                aria-label={t(tracked ? 'stuck.paste.found.openAria' : 'stuck.paste.found.checkAria', { name })}
                onClick={() => onCheck(index)}
              >
                {tracked ? t('stuck.dupe.open') : t('stuck.paste.found.check')}
              </Button>
            </li>
          )
        })}
      </ul>
      {backCount > 0 && <p className={styles.fine}>{t('stuck.paste.found.back', { count: backCount })}</p>}
    </section>
  )
}
