import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { Button, Card, useToast } from '../../components'
import { useT } from '../../i18n'
import { formatPercent } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { reducer, type Action } from '../../state/reducer'
import { effectivePaid } from '../../state/selectors'
import { useFlow, useSession } from '../../state/store'
import type { Minor, Session } from '../../types'
import { checkBill, type BillFinding } from './billCheck'
import { hasNote } from './staffNote'
import { StaffNoteSheet } from './StaffNoteSheet'
import { ITEM_KEYS, restoreItem } from './undoMerge'
import styles from './BillCheckCard.module.css'

/** What taking charges off changes — what Undo puts back. */
const TAKE_KEYS = ['meta', 'items', 'assignments', 'assignCursor', 'paid'] as const

export interface BillCheckCardProps {
  /** The amount being split changed (charges taken off, or put back): the screen's input follows. */
  onPaidChange: (paid: Minor) => void
}

/**
 * Bill check on "What did you pay?": what's worth a look on the bill before it's split — a default
 * service charge (and the GST on it), a charge by another name, a printed tip, a tax that no longer
 * exists, a total above its own lines — with the possible saving, a note to show the staff, and
 * one tap to split without them. Rupee bills as printed get the full check; quiet when all's well.
 */
export function BillCheckCard({ onPaidChange }: BillCheckCardProps) {
  const t = useT()
  const { session, dispatch } = useSession()
  const flow = useFlow()
  const toast = useToast()
  const titleId = useId()
  const [noteOpen, setNoteOpen] = useState(false)
  const latest = useRef(session)
  useLayoutEffect(() => {
    latest.current = session
  })
  const check = useMemo(() => checkBill(session), [session])
  const { currency } = session
  const money = (minor: Minor) => formatMoney(minor, currency, { trimZeros: true })
  const printedInr = currency === 'INR' && (session.source === 'scan' || session.source === 'sample')

  if (check.findings.length === 0) {
    // Quiet when it's all clear — and silent once the table chose to keep what it found.
    if (!printedInr || session.items.length === 0 || check.kept > 0) return null
    return (
      <p className={styles.clear}>
        <ShieldCheck aria-hidden="true" />
        <span>{t('bill.check.clear')}</span>
      </p>
    )
  }

  /** Dispatches `action` and tells the screen the new amount being split. */
  const apply = (action: Action): void => {
    const next = reducer(latest.current, action)
    dispatch(action)
    onPaidChange(effectivePaid(next))
  }

  const takeOff = (): void => {
    const before = latest.current
    const saving = check.saving
    apply({ type: 'takeOff', ...check.take })
    haptic('success')
    toast(t('bill.check.taken.toast', { amount: money(saving) }), {
      tone: 'success',
      action: { label: t('bill.undo.cta'), onAction: () => apply({ type: 'restore', session: before, keys: TAKE_KEYS }) },
    })
  }

  const keep = (finding: BillFinding): void => {
    const before = latest.current
    dispatch({ type: 'keepFinding', key: finding.key })
    toast(t(finding.saving > 0 ? 'bill.check.kept.toast' : 'bill.check.okay.toast'), {
      action: { label: t('bill.undo.cta'), onAction: () => dispatch({ type: 'restore', session: before, keys: ['checkKept'] }) },
    })
  }

  const removeOne = (finding: Extract<BillFinding, { kind: 'duplicate' }>): void => {
    const before = latest.current
    apply({ type: 'removeItem', itemId: finding.itemId })
    toast(t('bill.check.removed.toast', { name: finding.name }), {
      action: {
        label: t('bill.undo.cta'),
        onAction: () => {
          const restored = restoreItem(latest.current, before, finding.itemId)
          if (restored) apply({ type: 'restore', session: restored, keys: ITEM_KEYS })
        },
      },
    })
  }

  const saving = check.saving > 0
  const note = hasNote(check.findings)
  return (
    <Card padding="none" className={styles.card}>
      <section aria-labelledby={titleId}>
        <header className={styles.head}>
          <span className={styles.icon} aria-hidden="true">
            <ShieldAlert />
          </span>
          <div className={styles.headText}>
            <p className={styles.eyebrow}>{t('bill.check.title')}</p>
            <h2 id={titleId} className={styles.title}>
              {saving ? t('bill.check.saving', { amount: money(check.saving) }) : t('bill.check.look')}
            </h2>
            <p className={styles.sub}>{saving ? t('bill.check.saving.text') : t('bill.check.look.text')}</p>
          </div>
        </header>

        <ul className={styles.list} aria-label={t('bill.check.list.aria')}>
          {check.findings.map((finding) => (
            <li key={finding.key} className={styles.finding}>
              <FindingText finding={finding} session={session} />
              <div className={styles.findingActions}>
                {finding.kind === 'total_over' && (
                  <Button size="sm" variant="tonal" onClick={flow.back}>
                    {t('bill.check.numbers.cta')}
                  </Button>
                )}
                {finding.kind === 'duplicate' && (
                  <Button size="sm" variant="tonal" onClick={() => removeOne(finding)}>
                    {t('bill.check.removeOne.cta')}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => keep(finding)}>
                  {t(finding.saving > 0 ? (finding.kind === 'printed_tip' ? 'bill.check.added.cta' : 'bill.check.keep.cta') : 'bill.check.right.cta')}
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {saving && (
          <div className={styles.actions}>
            <Button block size="md" onClick={takeOff}>
              {t('bill.check.take.cta')}
            </Button>
            {note && (
              <Button block size="md" variant="secondary" onClick={() => setNoteOpen(true)}>
                {t('bill.check.staff.cta')}
              </Button>
            )}
          </div>
        )}
        {note && (
          <button type="button" className={styles.why} onClick={() => setNoteOpen(true)}>
            {t('bill.check.why.cta')}
          </button>
        )}
      </section>
      <StaffNoteSheet open={noteOpen} findings={check.findings} currency={currency} onClose={() => setNoteOpen(false)} />
    </Card>
  )
}

type Translate = ReturnType<typeof useT>

/** One finding's title, plain-words explanation and (for GST) an extra line. */
function describe(f: BillFinding, t: Translate, money: (minor: Minor) => string): { title: string; text: string; extra?: string } {
  switch (f.kind) {
    case 'service_charge':
      return {
        title: t('bill.check.service.title', { amount: money(f.amount) }),
        text: t('bill.check.service.text'),
        extra: f.gst > 0 ? t('bill.check.gst', { amount: money(f.gst) }) : f.gstUnknown ? t('bill.check.gstUnknown') : undefined,
      }
    case 'renamed_charge':
      return {
        title: t('bill.check.renamed.title', { label: f.label, amount: money(f.amount) }),
        text: t('bill.check.renamed.text'),
        extra: f.gst > 0 ? t('bill.check.gst', { amount: money(f.gst) }) : undefined,
      }
    case 'printed_tip':
      return { title: t('bill.check.tip.title', { amount: money(f.amount) }), text: t('bill.check.tip.text') }
    case 'old_tax':
      return { title: t('bill.check.oldTax.title', { label: f.label, amount: money(f.amount) }), text: t('bill.check.oldTax.text') }
    case 'supply_gst':
      return { title: t('bill.check.supply.title', { amount: money(f.amount) }), text: t('bill.check.supply.text') }
    case 'hotel_rate':
      return { title: t('bill.check.hotel.title'), text: t('bill.check.hotel.text', { amount: money(f.atFive) }) }
    case 'odd_tax':
      return { title: t('bill.check.odd.title', { percent: formatPercent(f.rate, { maxFractionDigits: 0 }) }), text: t('bill.check.odd.text') }
    case 'gst_halves':
      return { title: t('bill.check.halves.title'), text: t('bill.check.halves.text', { cgst: money(f.cgst), sgst: money(f.sgst) }) }
    case 'total_over':
      return {
        title: t('bill.check.over.title', { amount: money(f.over) }),
        text: t('bill.check.over.text', { lines: money(f.lines), total: money(f.total) }),
      }
    case 'duplicate':
      return { title: t('bill.check.dup.title', { name: f.name, amount: money(f.amount), count: f.count }), text: t('bill.check.dup.text') }
  }
}

function FindingText({ finding, session }: { finding: BillFinding; session: Session }) {
  const t = useT()
  const { title, text, extra } = describe(finding, t, (minor) => formatMoney(minor, session.currency, { trimZeros: true }))
  return (
    <div className={styles.findingText}>
      <p className={styles.findingTitle}>{title}</p>
      <p className={styles.findingBody}>{text}</p>
      {extra && <p className={styles.findingBody}>{extra}</p>}
    </div>
  )
}
