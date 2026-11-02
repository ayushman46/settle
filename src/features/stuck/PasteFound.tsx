import { useId } from 'react'
import { Button } from '../../components'
import { useT } from '../../i18n'
import { merchantById } from './merchants'
import type { StuckPrefill } from './prefill'
import { inr } from './view'
import styles from './Stuck.module.css'

/** One stuck payment found in a paste. */
export interface FoundItem {
  prefill: StuckPrefill
  /** Told as pending, not failed. */
  pending: boolean
  /** Already on the phone (the same reference or order number): left unticked. */
  tracked: boolean
}

/**
 * "Found 2 stuck payments": each one found in a paste, ticked to be tracked (one already tracked
 * isn't), with "Check first" to look it over in Add before saving.
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
  onCheck: (prefill: StuckPrefill) => void
}) {
  const t = useT()
  const headId = useId()
  return (
    <section className={styles.paste} aria-labelledby={headId}>
      <h3 id={headId} className={styles.pasteLabel}>
        {t('stuck.paste.found', { count: items.length })}
      </h3>
      <p className={styles.fine}>{t('stuck.paste.found.text')}</p>
      <ul className={styles.found}>
        {items.map((item, index) => {
          const { prefill } = item
          const kind = prefill.kind === 'refund' ? t('stuck.kind.refund') : item.pending ? t('stuck.paste.found.pending') : t('stuck.kind.failed')
          const name = prefill.party?.trim() || merchantById(prefill.merchant)?.name || kind
          const amount = prefill.amount !== undefined ? inr(prefill.amount) : null
          return (
            <li key={index} className={styles.foundRow}>
              <label className={styles.foundPick}>
                <input type="checkbox" className={styles.foundCheck} checked={picked[index] === true} onChange={() => onToggle(index)} />
                <span className={styles.foundText}>
                  <span className={styles.foundTitle}>{amount ? `${name} · ${amount}` : name}</span>
                  <span className={styles.foundMeta}>{item.tracked ? `${kind} · ${t('stuck.dupe.row')}` : kind}</span>
                </span>
              </label>
              <Button variant="ghost" size="sm" aria-label={t('stuck.paste.found.checkAria', { name })} onClick={() => onCheck(prefill)}>
                {t('stuck.paste.found.check')}
              </Button>
            </li>
          )
        })}
      </ul>
      {backCount > 0 && <p className={styles.fine}>{t('stuck.paste.found.back', { count: backCount })}</p>}
    </section>
  )
}
