import { useId, useRef, useState } from 'react'
import { ClipboardPaste, PenLine } from 'lucide-react'
import { navigate } from '../../app/router'
import { ActionBar, Banner, BottomSheet, Button, useToast } from '../../components'
import { stuckStore, type StuckPayment } from '../../data/stores'
import { confirmStuck, isStuckOpen } from '../../data/stuck'
import { today as todayIso } from '../../engine/dates'
import { useT, type MessageKey } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { WHOS_PAID_PATH } from '../whospaid/paths'
import { AddDate } from './AddDate'
import type { StuckSignal } from './detect'
import { findStuckTwin } from './duplicates'
import { PasteFound, type FoundItem } from './PasteFound'
import { STUCK_NEW_PATH, stuckPath } from './paths'
import { MAX_PASTE_MESSAGES, openStuckAdd, promiseEnds, readStuckPaste, type PasteSkip, type StuckPaste, type StuckPrefill } from './prefill'
import { compensationDue } from './rules'
import { trackStuckSignals } from './track'
import { useTickBack } from './useTickBack'
import { inr } from './view'
import styles from './Stuck.module.css'

export interface StuckPasteSheetProps {
  open: boolean
  onClose: () => void
}

/** What a paste came to, when it needs a word from the person before anything is saved. */
type Outcome =
  /** Nothing stuck: what the messages did say goes into Add it yourself; money in points to Who's paid?. */
  | { kind: 'missed'; paste: StuckPaste }
  /** Only a plain debit: did that payment fail but keep the money? */
  | { kind: 'debit'; paste: StuckPaste; prefill: StuckPrefill; amount: number }
  /** A payment still pending: worth waiting for the final SMS. */
  | { kind: 'pending'; paste: StuckPaste; prefill: StuckPrefill }
  /** Two or more found (or one and money back): pick which to track — and, for messages that print no day, the day they came. */
  | { kind: 'many'; paste: StuckPaste; items: FoundItem[]; picked: boolean[]; day: string | null; checked: number[] }

const SKIP_KEYS: Readonly<Record<PasteSkip, MessageKey>> = {
  otp: 'stuck.paste.skip.otp',
  offer: 'stuck.paste.skip.offer',
  in: 'stuck.paste.skip.in',
  out: 'stuck.paste.skip.out',
  bill: 'stuck.paste.skip.bill',
  autopay: 'stuck.paste.skip.autopay',
  unread: 'stuck.paste.skip.unread',
  repeat: 'stuck.paste.skip.repeat',
  other: 'stuck.paste.skip.other',
}

/* ---------------------------------------------------------------- a list left for "Check first" */

/**
 * The list of several found, kept while one of them is checked over in Add (or one already tracked
 * is opened): back on the list, the sheet opens with it again, ticks and day as they were.
 */
interface Batch {
  text: string
  picked: boolean[]
  day: string | null
  /** The ones taken to Add: saved there, they're not ticked again. */
  checked: number[]
  at: number
}

const BATCH_KEY = 'settle.v6.stuck-paste'
/** A list left longer than this isn't brought back. */
const BATCH_MS = 30 * 60 * 1000

function session(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

function keepBatch(batch: Batch): void {
  try {
    session()?.setItem(BATCH_KEY, JSON.stringify(batch))
  } catch {
    // sessionStorage unavailable: the list isn't brought back, that's all.
  }
}

function isBatch(value: unknown): value is Batch {
  if (typeof value !== 'object' || value === null) return false
  const b = value as Record<string, unknown>
  return (
    typeof b.text === 'string' &&
    Array.isArray(b.picked) &&
    b.picked.every((on) => typeof on === 'boolean') &&
    (b.day === null || typeof b.day === 'string') &&
    Array.isArray(b.checked) &&
    b.checked.every((n) => typeof n === 'number') &&
    typeof b.at === 'number'
  )
}

function keptBatch(): Batch | null {
  try {
    const batch: unknown = JSON.parse(session()?.getItem(BATCH_KEY) ?? 'null')
    return isBatch(batch) && Date.now() - batch.at >= 0 && Date.now() - batch.at < BATCH_MS ? batch : null
  } catch {
    return null
  }
}

function dropBatch(): void {
  try {
    session()?.removeItem(BATCH_KEY)
  } catch {
    // Nothing to clear.
  }
}

/* ---------------------------------------------------------------- reading */

/** Each found one, with the stuck payment already tracked for it (the same reference or order number). */
function foundItems(paste: StuckPaste, checked: readonly number[] = []): FoundItem[] {
  const list = stuckStore.get()
  return paste.items.map((item, index) => {
    const twin = findStuckTwin(list, item.prefill)
    // One checked over in Add and saved there may only match by amount, party and day.
    const tracked = twin !== null && (twin.sure || checked.includes(index)) ? twin.payment.id : null
    return { prefill: item.prefill, pending: item.signal.type === 'pending', trackedId: tracked }
  })
}

/** The list of several found, as it was left (null when the paste no longer makes one). */
function resumed(batch: Batch | null): Outcome | null {
  if (!batch) return null
  const paste = readStuckPaste(batch.text, todayIso())
  if (paste.items.length === 0) return null
  const items = foundItems(paste, batch.checked)
  const picked = items.map((item, index) => item.trackedId === null && batch.picked[index] === true)
  return { kind: 'many', paste, items, picked, day: batch.day, checked: batch.checked }
}

/** The signal as the person confirmed it: on the day they said when the message didn't, with a promise in days counted from it. */
function signalOn(item: StuckPaste['items'][number], day: string | null): StuckSignal {
  const { signal, prefill } = item
  const date = prefill.date ?? day ?? signal.date
  if (signal.type === 'refund_initiated' && prefill.promisedDays) {
    return { ...signal, date, promisedBy: promiseEnds(date, prefill.promisedDays, prefill.promisedWorking ?? true) }
  }
  return { ...signal, date }
}

/** A message that shows money left for a tracked failed payment not yet known to have taken it (the same reference, the same amount). */
function provesTaken(prefill: StuckPrefill, s: StuckPayment): boolean {
  return prefill.kind === 'failed' && prefill.confirmed === true && s.kind === 'failed' && !s.confirmed && isStuckOpen(s) && (prefill.amount === undefined || prefill.amount === s.amount)
}

/**
 * "Paste the bank SMS or app message" — one or several at once, each read on its own, so an OTP or
 * an offer pasted alongside doesn't hide a failed payment. One failed or pending payment, or a
 * refund a business has started, opens Add with it filled in (or the one already tracked, when it
 * has the same reference — and when this message shows the money left, that's noted). Several are
 * listed to track together; "Check first" looks one over in Add and comes back to the list. A
 * message that prints no day is never put on "today": Add asks, or the list asks once for all of
 * them. Money that came back ticks off the stuck payment it belongs to (with Undo). A plain debit
 * asks whether that payment failed; a pending one suggests waiting; money in points to Who's paid?;
 * anything else says so kindly, with "Add it yourself" filled in with whatever the message did say.
 * Every message is read (up to MAX_PASTE_MESSAGES at once — any more are counted and said), and
 * the sheet says what it read. Read on the phone.
 */
export function StuckPasteSheet({ open, onClose }: StuckPasteSheetProps) {
  const t = useT()
  const toast = useToast()
  const fieldId = useId()
  // A list left for "Check first": the sheet opens with it again.
  const [batch] = useState(keptBatch)
  const [text, setText] = useState(() => batch?.text ?? '')
  const [outcome, setOutcome] = useState<Outcome | null>(() => resumed(batch))
  const [reopened, setReopened] = useState(() => outcome !== null)
  // Set on the way to "Check first": the list is kept for coming back, whatever closes the sheet as it goes.
  const keeping = useRef(false)
  const tickBack = useTickBack()
  const canPaste = typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function'

  const close = (): void => {
    if (!keeping.current) dropBatch()
    setOutcome(null)
    setReopened(false)
    onClose()
  }

  /** Done with this paste: the sheet closes, empty for the next one. */
  const done = (): void => {
    close()
    setText('')
  }

  /** Opens Add filled in — or the stuck payment already tracked with the same reference or order number (noting the money left, when this shows it). */
  const track = (prefill: StuckPrefill): void => {
    const twin = findStuckTwin(stuckStore.get(), prefill)
    haptic('success')
    done()
    if (!twin?.sure) {
      openStuckAdd(prefill)
      return
    }
    const s = twin.payment
    navigate(stuckPath(s.id))
    if (provesTaken(prefill, s)) {
      const undo = confirmStuck(s.id)
      const owed = compensationDue({ ...s, confirmed: true }, todayIso())
      const line = owed > 0 ? t(s.rail === 'wallet' ? 'stuck.paste.confirmedOwed.wallet' : 'stuck.paste.confirmedOwed', { amount: inr(owed) }) : t('stuck.paste.confirmed')
      toast(line, { tone: 'success', action: undo ? { label: t('common.action.undo'), onAction: undo } : undefined })
      return
    }
    // Back, with compensation still owed, is still tracked: only one set aside is "before".
    toast(s.dismissedAt === null ? t('stuck.dupe.opened') : t('stuck.dupe.titleClosed'))
  }

  /** Saves the ones ticked (with the debits and money back pasted alongside), with one Undo. */
  const trackPicked = (paste: StuckPaste, picked: readonly boolean[], day: string | null): void => {
    const chosen = paste.items.filter((_, index) => picked[index] === true).map((item) => signalOn(item, day))
    const result = trackStuckSignals([...chosen, ...paste.paired, ...paste.debits.map((d) => d.signal), ...paste.back], 'sms')
    done()
    if (result.added.length === 0 && result.back.length === 0) {
      const backAmount = paste.back.reduce((sum, signal) => sum + signal.amount, 0)
      toast(chosen.length > 0 || paste.back.length === 0 ? t('stuck.dupe.none') : t('stuck.paste.noMatch', { amount: inr(backAmount) }))
      return
    }
    haptic('success')
    const lines: string[] = []
    if (result.added.length > 0) lines.push(t('stuck.paste.tracked', { count: result.added.length }))
    if (result.back.length > 0) lines.push(t('stuck.back.toastMany', { count: result.back.length }))
    toast(lines.join(' · '), { tone: 'success', action: { label: t('common.action.undo'), onAction: result.undo } })
  }

  /** "Check first" (or "Open it" for one already tracked): there, and back to this list after. */
  const leaveList = (many: Extract<Outcome, { kind: 'many' }>, index: number): void => {
    const item = many.items[index]
    if (!item) return
    keeping.current = true
    keepBatch({ text, picked: many.picked.map((on, at) => on && at !== index), day: many.day, checked: [...many.checked, index], at: Date.now() })
    close()
    if (item.trackedId !== null) navigate(stuckPath(item.trackedId))
    else openStuckAdd(item.prefill.date === undefined && many.day !== null ? { ...item.prefill, date: many.day } : item.prefill)
  }

  const read = (value: string): void => {
    keeping.current = false
    dropBatch()
    const paste = readStuckPaste(value, todayIso())
    const { items, back, debits } = paste
    if (items.length === 0 && back.length > 0) {
      const [first] = back
      if (back.length === 1 && first) {
        done()
        tickBack(first)
      } else trackPicked(paste, [], null)
      return
    }
    const [only] = items
    if (only && items.length === 1 && back.length === 0) {
      if (only.signal.type === 'pending') {
        haptic('tap')
        setOutcome({ kind: 'pending', paste, prefill: only.prefill })
        return
      }
      track(only.prefill)
      // Nothing left out quietly, even on the way to Add.
      if (paste.left > 0) toast(t('stuck.paste.left', { count: paste.left, max: MAX_PASTE_MESSAGES }), { tone: 'warning' })
      return
    }
    if (items.length > 0) {
      haptic('success')
      const found = foundItems(paste)
      setOutcome({ kind: 'many', paste, items: found, picked: found.map((item) => item.trackedId === null), day: null, checked: [] })
      return
    }
    haptic('tap')
    const [debit] = debits
    if (debit && debits.length === 1) {
      setOutcome({ kind: 'debit', paste, prefill: debit.prefill, amount: debit.signal.amount })
      return
    }
    setOutcome({ kind: 'missed', paste })
  }

  const paste = async (): Promise<void> => {
    try {
      const clip = await navigator.clipboard.readText()
      if (!clip.trim()) {
        toast(t('stuck.paste.empty'))
        return
      }
      setText(clip)
      read(clip)
    } catch {
      toast(t('stuck.paste.denied'), { tone: 'warning' })
    }
  }

  /** "3 messages skipped (OTP, money in)", or null. */
  const skippedLine = (skipped: readonly PasteSkip[]): string | null => {
    if (skipped.length === 0) return null
    const reasons = [...new Set(skipped)].map((reason) => t(SKIP_KEYS[reason]))
    return t('stuck.paste.skipped', { count: skipped.length, reasons: reasons.join(', ') })
  }

  /**
   * What the paste came to, in a line: "Read 6 messages · 4 stuck · 1 came back · 1 message skipped
   * (OTP)" — just what was skipped when it was one message — and, past the limit, how many weren't read.
   */
  const tally = (paste: StuckPaste, skipped: readonly PasteSkip[]): string[] => {
    const lines: string[] = []
    const skip = skippedLine(skipped)
    if (paste.read > 1) {
      const parts = [t('stuck.paste.readCount', { count: paste.read })]
      if (paste.items.length > 0) parts.push(t('stuck.paste.readStuck', { count: paste.items.length }))
      if (paste.back.length > 0) parts.push(t('stuck.paste.readBack', { count: paste.back.length }))
      if (skip) parts.push(skip)
      lines.push(parts.join(' · '))
    } else if (skip) lines.push(skip)
    if (paste.left > 0) lines.push(t('stuck.paste.left', { count: paste.left, max: MAX_PASTE_MESSAGES }))
    return lines
  }

  const addYourself = (found: StuckPrefill | null): void => {
    close()
    if (found) openStuckAdd(found)
    else navigate(STUCK_NEW_PATH)
  }

  const many = outcome?.kind === 'many' ? outcome : null
  const pickedCount = many ? many.picked.filter(Boolean).length : 0
  // Ticked ones whose message prints no day: one question for them all.
  const undated = many ? many.items.filter((item, index) => many.picked[index] === true && item.prefill.date === undefined).length : 0
  const allTracked = many !== null && many.items.every((item) => item.trackedId !== null)
  const needsDay = undated > 0 && many?.day === null
  // A debit that isn't one of theirs is a payment that went out.
  const outLines = outcome ? tally(outcome.paste, [...outcome.paste.skipped, ...(outcome.kind === 'debit' ? [] : outcome.paste.debits.map((): PasteSkip => 'out'))]) : []
  const manyHint = many && !allTracked ? (pickedCount === 0 ? t('stuck.paste.pick') : needsDay ? t('stuck.paste.day.issue') : undefined) : undefined

  return (
    <BottomSheet
      open={open || reopened}
      onClose={close}
      title={t('stuck.paste.title')}
      description={t('stuck.paste.text')}
      footer={
        <ActionBar hint={manyHint}>
          {many && allTracked ? (
            <Button block onClick={() => (many.paste.back.length > 0 || many.paste.paired.length > 0 ? trackPicked(many.paste, [], null) : done())}>
              {t('common.action.done')}
            </Button>
          ) : many ? (
            <Button block disabled={pickedCount === 0 || needsDay} onClick={() => trackPicked(many.paste, many.picked, many.day)}>
              {t('stuck.paste.track', { count: pickedCount })}
            </Button>
          ) : (
            <Button block disabled={text.trim() === ''} onClick={() => read(text)}>
              {t('stuck.paste.read')}
            </Button>
          )}
        </ActionBar>
      }
    >
      <div className={styles.paste}>
        <label htmlFor={fieldId} className={styles.pasteLabel}>
          {t('stuck.paste.label')}
        </label>
        <textarea
          id={fieldId}
          className={styles.area}
          rows={5}
          value={text}
          placeholder={t('stuck.paste.placeholder')}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(event) => {
            setText(event.target.value)
            setOutcome(null)
            keeping.current = false
            dropBatch()
          }}
        />
        {canPaste && (
          <Button variant="ghost" size="md" iconStart={<ClipboardPaste />} className={styles.pasteButton} onClick={() => void paste()}>
            {t('stuck.paste.clipboard')}
          </Button>
        )}
        {many && (
          <>
            <PasteFound
              items={many.items}
              picked={many.picked}
              backCount={many.paste.back.length}
              onToggle={(index) => setOutcome({ ...many, picked: many.picked.map((on, at) => (at === index ? !on : on)) })}
              onCheck={(index) => leaveList(many, index)}
            />
            {undated > 0 && (
              <AddDate label={t('stuck.paste.day', { count: undated })} value={many.day} today={todayIso()} onChange={(day) => setOutcome({ ...many, day })} />
            )}
            {outLines.map((line) => (
              <p key={line} className={styles.fine}>
                {line}
              </p>
            ))}
          </>
        )}
        {outcome?.kind === 'pending' && (
          <Banner
            tone="info"
            title={t('stuck.paste.pending.title')}
            actions={
              <Button size="sm" variant="secondary" onClick={() => track(outcome.prefill)}>
                {t('stuck.paste.pending.cta')}
              </Button>
            }
          >
            <p>{t('stuck.paste.pending.text')}</p>
            {outLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </Banner>
        )}
        {outcome?.kind === 'debit' && (
          <Banner
            tone="info"
            title={t('stuck.paste.debit.title')}
            actions={
              <>
                <Button size="sm" onClick={() => track(outcome.prefill)}>
                  {t('stuck.paste.debit.yes')}
                </Button>
                <Button size="sm" variant="secondary" onClick={done}>
                  {t('stuck.paste.debit.no')}
                </Button>
              </>
            }
          >
            <p>{t('stuck.paste.debit.text', { amount: inr(outcome.amount) })}</p>
            {outLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </Banner>
        )}
        {outcome?.kind === 'missed' && <Missed paste={outcome.paste} lines={outLines} onAdd={addYourself} onWhosPaid={close} />}
        <p className={styles.fine}>{t('stuck.paste.private')}</p>
      </div>
    </BottomSheet>
  )
}

/** Nothing stuck in the paste: Add it yourself (with what the messages did say), or Who's paid? for money in. */
function Missed({ paste, lines, onAdd, onWhosPaid }: { paste: StuckPaste; lines: readonly string[]; onAdd: (found: StuckPrefill | null) => void; onWhosPaid: () => void }) {
  const t = useT()
  const credit = paste.credits > 0
  const text = credit
    ? t('stuck.paste.credit.text')
    : paste.found && paste.skipped.includes('unread')
      ? t('stuck.paste.missed.unread')
      : paste.found
        ? t('stuck.paste.missed.found')
        : t('stuck.paste.missed.text')
  return (
    <Banner
      tone="info"
      title={credit ? t('stuck.paste.credit.title') : t('stuck.paste.missed.title')}
      actions={
        <>
          {credit && (
            <Button
              size="sm"
              onClick={() => {
                onWhosPaid()
                navigate(WHOS_PAID_PATH)
              }}
            >
              {t('stuck.paste.credit.cta')}
            </Button>
          )}
          <Button size="sm" variant="secondary" iconStart={<PenLine />} onClick={() => onAdd(paste.found)}>
            {t('stuck.paste.missed.cta')}
          </Button>
        </>
      }
    >
      <p>{text}</p>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </Banner>
  )
}
