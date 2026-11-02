import { useId, useState } from 'react'
import { ClipboardPaste, PenLine } from 'lucide-react'
import { navigate } from '../../app/router'
import { ActionBar, Banner, BottomSheet, Button, useToast } from '../../components'
import { stuckStore } from '../../data/stores'
import { isStuckOpen } from '../../data/stuck'
import { today as todayIso } from '../../engine/dates'
import { useT, type MessageKey } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { WHOS_PAID_PATH } from '../whospaid/paths'
import { findStuckTwin } from './duplicates'
import { PasteFound, type FoundItem } from './PasteFound'
import { STUCK_NEW_PATH, stuckPath } from './paths'
import { openStuckAdd, prefillFromDebit, readStuckPaste, type PasteSkip, type StuckPaste, type StuckPrefill } from './prefill'
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
  | { kind: 'missed'; found: StuckPrefill | null; credit: boolean; skipped: PasteSkip[] }
  /** Only a plain debit: did that payment fail but keep the money? */
  | { kind: 'debit'; prefill: StuckPrefill; amount: number }
  /** A payment still pending: worth waiting for the final SMS. */
  | { kind: 'pending'; prefill: StuckPrefill }
  /** Two or more found (or one and money back): pick which to track. */
  | { kind: 'many'; paste: StuckPaste; items: FoundItem[]; picked: boolean[] }

const SKIP_KEYS: Readonly<Record<PasteSkip, MessageKey>> = {
  otp: 'stuck.paste.skip.otp',
  offer: 'stuck.paste.skip.offer',
  in: 'stuck.paste.skip.in',
  out: 'stuck.paste.skip.out',
  other: 'stuck.paste.skip.other',
}

/**
 * "Paste the bank SMS or app message" — one or several at once, each read on its own, so an OTP or
 * an offer pasted alongside doesn't hide a failed payment. One failed or pending payment, or a
 * refund a business has started, opens Add with it filled in (or the one already tracked, when it
 * has the same reference). Several are listed to track together. Money that came back ticks off
 * the stuck payment it belongs to (with Undo). A plain debit asks whether that payment failed; a
 * pending one suggests waiting; money in points to Who's paid?; anything else says so kindly,
 * with "Add it yourself" filled in with whatever the message did say. Read on the phone.
 */
export function StuckPasteSheet({ open, onClose }: StuckPasteSheetProps) {
  const t = useT()
  const toast = useToast()
  const fieldId = useId()
  const [text, setText] = useState('')
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const tickBack = useTickBack()
  const canPaste = typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function'

  const close = (): void => {
    setOutcome(null)
    onClose()
  }

  /** Done with this paste: the sheet closes, empty for the next one. */
  const done = (): void => {
    close()
    setText('')
  }

  /** Opens Add filled in — or the stuck payment already tracked with the same reference or order number. */
  const track = (prefill: StuckPrefill): void => {
    const twin = findStuckTwin(stuckStore.get(), prefill)
    haptic('success')
    done()
    if (twin?.sure) {
      navigate(stuckPath(twin.payment.id))
      toast(isStuckOpen(twin.payment) ? t('stuck.dupe.opened') : t('stuck.dupe.titleClosed'))
      return
    }
    openStuckAdd(prefill)
  }

  /** Saves the ones ticked (with the debits and money back pasted alongside), with one Undo. */
  const trackPicked = (paste: StuckPaste, picked: readonly boolean[]): void => {
    const chosen = paste.items.filter((_, index) => picked[index] === true).map((item) => item.signal)
    const result = trackStuckSignals([...chosen, ...paste.paired, ...paste.debits.map((d) => d.signal), ...paste.back], 'sms')
    done()
    if (result.added.length === 0 && result.back.length === 0) {
      const backAmount = paste.back.reduce((sum, signal) => sum + signal.amount, 0)
      toast(chosen.length > 0 ? t('stuck.dupe.none') : t('stuck.paste.noMatch', { amount: inr(backAmount) }))
      return
    }
    haptic('success')
    const lines: string[] = []
    if (result.added.length > 0) lines.push(t('stuck.paste.tracked', { count: result.added.length }))
    if (result.back.length > 0) lines.push(t('stuck.back.toastMany', { count: result.back.length }))
    toast(lines.join(' · '), { tone: 'success', action: { label: t('common.action.undo'), onAction: result.undo } })
  }

  const read = (value: string): void => {
    const paste = readStuckPaste(value, todayIso())
    const { items, back, debits } = paste
    if (items.length === 0 && back.length > 0) {
      const [first] = back
      if (back.length === 1 && first) {
        done()
        tickBack(first)
      } else trackPicked(paste, [])
      return
    }
    const [only] = items
    if (only && items.length === 1 && back.length === 0) {
      if (only.signal.type === 'pending') {
        haptic('tap')
        setOutcome({ kind: 'pending', prefill: only.prefill })
      } else track(only.prefill)
      return
    }
    if (items.length > 0) {
      haptic('success')
      const list = stuckStore.get()
      const found = items.map((item) => ({ prefill: item.prefill, pending: item.signal.type === 'pending', tracked: findStuckTwin(list, item.prefill)?.sure === true }))
      setOutcome({ kind: 'many', paste, items: found, picked: found.map((item) => !item.tracked) })
      return
    }
    haptic('tap')
    const [debit] = debits
    if (debit && debits.length === 1) {
      setOutcome({ kind: 'debit', prefill: prefillFromDebit(debit.signal, debit.text), amount: debit.signal.amount })
      return
    }
    setOutcome({ kind: 'missed', found: paste.found, credit: paste.credits > 0, skipped: paste.skipped })
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

  const addYourself = (found: StuckPrefill | null): void => {
    close()
    if (found) openStuckAdd(found)
    else navigate(STUCK_NEW_PATH)
  }

  const many = outcome?.kind === 'many' ? outcome : null
  const pickedCount = many ? many.picked.filter(Boolean).length : 0
  // Next to what was found, a debit that isn't one of theirs is a payment that went out.
  const manySkipped = many ? skippedLine([...many.paste.skipped, ...many.paste.debits.map((): PasteSkip => 'out')]) : null

  return (
    <BottomSheet
      open={open}
      onClose={close}
      title={t('stuck.paste.title')}
      description={t('stuck.paste.text')}
      footer={
        <ActionBar>
          {many ? (
            <Button block disabled={pickedCount === 0} onClick={() => trackPicked(many.paste, many.picked)}>
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
              onCheck={track}
            />
            {manySkipped && <p className={styles.fine}>{manySkipped}</p>}
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
            {t('stuck.paste.pending.text')}
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
            {t('stuck.paste.debit.text', { amount: inr(outcome.amount) })}
          </Banner>
        )}
        {outcome?.kind === 'missed' && (
          <Banner
            tone="info"
            title={outcome.credit ? t('stuck.paste.credit.title') : t('stuck.paste.missed.title')}
            actions={
              <>
                {outcome.credit && (
                  <Button
                    size="sm"
                    onClick={() => {
                      close()
                      navigate(WHOS_PAID_PATH)
                    }}
                  >
                    {t('stuck.paste.credit.cta')}
                  </Button>
                )}
                <Button size="sm" variant="secondary" iconStart={<PenLine />} onClick={() => addYourself(outcome.found)}>
                  {t('stuck.paste.missed.cta')}
                </Button>
              </>
            }
          >
            <p>{outcome.credit ? t('stuck.paste.credit.text') : outcome.found ? t('stuck.paste.missed.found') : t('stuck.paste.missed.text')}</p>
            {skippedLine(outcome.skipped) && <p>{skippedLine(outcome.skipped)}</p>}
          </Banner>
        )}
        <p className={styles.fine}>{t('stuck.paste.private')}</p>
      </div>
    </BottomSheet>
  )
}
