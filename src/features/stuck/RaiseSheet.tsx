/**
 * Raising a stuck payment, one rung at a time: where to take it (your UPI app or bank, the RBI
 * Ombudsman, the business, the National Consumer Helpline, AirSewa, a consumer commission), the
 * letter ready to copy, share or email, the button that takes you there, and "I've raised it"
 * (the day and the complaint number) so Settle can count the wait for the next rung.
 */
import { useEffect, useId, useState } from 'react'
import { ArrowLeft, Check, Copy, ExternalLink, Mail, MessageCircle, Phone, Share2 } from 'lucide-react'
import { ActionBar, BottomSheet, Button, IconButton, TextField, useToast } from '../../components'
import { useProfile } from '../../data'
import { shortDateLabel } from '../../data/loans'
import type { StuckPayment, StuckStepKind } from '../../data/stores'
import { addStuckStep } from '../../data/stuck'
import { today as todayIso } from '../../engine/dates'
import { useT, type MessageKey } from '../../i18n'
import { DateField } from '../../kit/index-a'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { copyText, shareResult } from '../../lib/share'
import { raiseHelp, type HelpLink, type HelpText } from './help'
import { letterFor, ombudsmanFields, type OmbudsmanFieldId } from './letters'
import { merchantById } from './merchants'
import styles from './RaiseSheet.module.css'

export interface RaiseSheetProps {
  open: boolean
  onClose: () => void
  payment: StuckPayment
  /** The rung to raise. */
  step: StuckStepKind
  /** The bank complaint is for compensation only (the money is back, late). */
  compensationOnly?: boolean
}

const FIELD_KEYS: Readonly<Record<OmbudsmanFieldId, MessageKey>> = {
  entity: 'stuckhelp.field.entity',
  category: 'stuckhelp.field.category',
  date: 'stuckhelp.field.date',
  amount: 'stuckhelp.field.amount',
  reference: 'stuckhelp.field.reference',
  account: 'stuckhelp.field.account',
  bankComplaint: 'stuckhelp.field.bankComplaint',
  relief: 'stuckhelp.field.relief',
}

/** What the text is called: a letter (bank, RBI), a summary (commission), else a message. */
function textKind(step: StuckStepKind): 'letter' | 'message' | 'summary' {
  if (step === 'bank' || step === 'ombudsman') return 'letter'
  return step === 'commission' ? 'summary' : 'message'
}

/** A new email with the subject and text filled in, to whoever you choose. */
function mailtoUrl(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

const LINK_ICONS = { web: ExternalLink, call: Phone, whatsapp: MessageCircle } as const

/** How long "Copied" shows on the button. */
const COPIED_MS = 2000

export function RaiseSheet(props: RaiseSheetProps) {
  // A fresh sheet each time it opens (it keeps its last content while it slides away).
  const [opened, setOpened] = useState(0)
  const [wasOpen, setWasOpen] = useState(props.open)
  if (props.open !== wasOpen) {
    setWasOpen(props.open)
    if (props.open) setOpened((n) => n + 1)
  }
  return <RaiseSheetFrame key={opened} {...props} />
}

function RaiseSheetFrame({ open, onClose, payment, step, compensationOnly = false }: RaiseSheetProps) {
  const t = useT()
  const toast = useToast()
  const profile = useProfile()
  const ids = useId()
  const day = todayIso()
  const [mode, setMode] = useState<'letter' | 'raised'>('letter')
  // Raised before (adding the complaint number later): start from what was noted.
  const noted = payment.steps.find((s) => s.kind === step) ?? null
  const [date, setDate] = useState(noted?.date ?? (day < payment.date ? payment.date : day))
  const [ref, setRef] = useState(noted?.ref ?? '')
  /** What was copied last ('letter', 'subject' or a form field), while "Copied" shows. */
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (copied === null) return
    const timer = window.setTimeout(() => setCopied(null), COPIED_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  const letter = letterFor(step, payment, profile, day, { compensationOnly })
  const help = raiseHelp(step, payment, { compensationOnly, message: letter.body, today: day })
  const fields = step === 'ombudsman' ? ombudsmanFields(payment, profile, day) : null
  const kind = textKind(step)
  const name = merchantById(payment.merchant)?.name ?? (payment.party?.trim() || null)
  const text = (line: HelpText): string => t(line.key, line.vars)

  const copy = async (value: string, what: string): Promise<void> => {
    if (await copyText(value)) {
      haptic('tap')
      setCopied(what)
    } else {
      haptic('error')
      toast(t('stuckhelp.copyFailed.toast'), { tone: 'error' })
    }
  }

  const share = async (): Promise<void> => {
    const outcome = await shareResult(letter.body, { mode: 'share', title: letter.subject })
    if (outcome === 'copied') {
      setCopied('letter')
      toast(t('stuckhelp.copied.toast'), { tone: 'success' })
    } else if (outcome === 'failed') {
      haptic('error')
      toast(t('stuckhelp.copyFailed.toast'), { tone: 'error' })
    }
  }

  const save = (): void => {
    const undo = addStuckStep(payment.id, { kind: step, date, ref: ref.trim() || null })
    haptic('success')
    toast(t('stuckhelp.raised.toast', { kind: step, date: shortDateLabel(date), name: name ?? t('stuckhelp.party.refund') }), {
      tone: 'success',
      action: undo ? { label: t('common.action.undo'), onAction: undo } : undefined,
    })
    onClose()
  }

  const raised = mode === 'raised'
  const channel = help.channel

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      contentKey={mode}
      direction={raised ? 'forward' : 'back'}
      eyebrow={t('stuckhelp.eyebrow', {
        amount: formatMoney(payment.amount, 'INR', { trimZeros: true }),
        name: name ?? t(payment.kind === 'failed' ? 'stuckhelp.party.failed' : 'stuckhelp.party.refund'),
      })}
      title={raised ? t('stuckhelp.raised.title') : text(help.title)}
      description={raised ? t('stuckhelp.raised.description') : text(help.lead)}
      footer={
        raised ? (
          <ActionBar>
            <Button block iconStart={<Check />} onClick={save}>
              {t('stuckhelp.raised.save')}
            </Button>
            <Button block variant="ghost" iconStart={<ArrowLeft />} onClick={() => setMode('letter')}>
              {t('common.action.back')}
            </Button>
          </ActionBar>
        ) : (
          <ActionBar>
            {channel && <ChannelLink link={channel} label={text(channel.label)} newTab={t('stuckhelp.newTab', { label: text(channel.label) })} />}
            <Button block variant={channel ? 'secondary' : 'primary'} iconStart={<Check />} onClick={() => setMode('raised')}>
              {t('stuckhelp.raised.cta')}
            </Button>
          </ActionBar>
        )
      }
    >
      {raised ? (
        <div className={styles.form}>
          <div className={styles.dateRow}>
            <span className={styles.dateLabel} aria-hidden="true">
              {t('stuckhelp.raised.date')}
            </span>
            <DateField label={t('stuckhelp.raised.date')} value={date} min={payment.date} onChange={setDate} />
          </div>
          <TextField
            label={t('stuckhelp.raised.ref', { kind: step })}
            hint={t('stuckhelp.raised.refHint')}
            value={ref}
            maxLength={60}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(event) => setRef(event.currentTarget.value)}
          />
        </div>
      ) : (
        <div className={styles.body}>
          <section className={styles.section} aria-labelledby={`${ids}-how`}>
            <h3 id={`${ids}-how`} className={styles.heading}>
              {t('stuckhelp.how.heading')}
            </h3>
            <ol className={styles.steps} aria-labelledby={`${ids}-how`}>
              {help.steps.map((line) => (
                <li key={line.key} className={styles.step}>
                  {text(line)}
                </li>
              ))}
            </ol>
            {help.links.length > 0 && (
              <ul className={styles.links} aria-label={t('stuckhelp.links.aria')}>
                {help.links.map((link) => (
                  <li key={link.href}>
                    <ChannelLink link={link} label={text(link.label)} newTab={t('stuckhelp.newTab', { label: text(link.label) })} small />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {help.keepReady.length > 0 && (
            <section className={styles.section} aria-labelledby={`${ids}-ready`}>
              <h3 id={`${ids}-ready`} className={styles.heading}>
                {t('stuckhelp.ready.heading')}
              </h3>
              <ul className={styles.ready}>
                {help.keepReady.map((line) => (
                  <li key={line.key}>{text(line)}</li>
                ))}
              </ul>
            </section>
          )}

          {fields && (
            <section className={styles.section} aria-labelledby={`${ids}-fields`}>
              <h3 id={`${ids}-fields`} className={styles.heading}>
                {t('stuckhelp.fields.heading')}
              </h3>
              <p className={styles.hint}>{t('stuckhelp.fields.hint')}</p>
              <dl className={styles.fields}>
                {fields.map((field) => {
                  const label = t(FIELD_KEYS[field.id])
                  return (
                    <div key={field.id} className={styles.field}>
                      <dt className={styles.fieldLabel}>{label}</dt>
                      <dd className={styles.fieldValue}>
                        <span className={cx(styles.value, !field.known && styles.unknown)}>{field.value}</span>
                        <IconButton
                          size="sm"
                          label={copied === field.id ? t('stuckhelp.field.copied', { field: label }) : t('stuckhelp.field.copy', { field: label })}
                          onClick={() => void copy(field.value, field.id)}
                        >
                          {copied === field.id ? <Check /> : <Copy />}
                        </IconButton>
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </section>
          )}

          <section className={styles.section} aria-labelledby={`${ids}-letter`}>
            <h3 id={`${ids}-letter`} className={styles.heading}>
              {t('stuckhelp.letter.heading', { kind })}
            </h3>
            <div className={styles.paper}>
              <p className={styles.subject}>
                <span className={styles.subjectLabel}>{t('stuckhelp.letter.subject')}</span> <span>{letter.subject}</span>
              </p>
              <p className={styles.letter} data-testid="stuck-letter">
                <LetterText text={letter.body} />
              </p>
            </div>
            {/\[[^\]]+\]/.test(letter.body) && <p className={styles.hint}>{t('stuckhelp.letter.fill')}</p>}
            <div className={styles.actions} role="group" aria-label={t('stuckhelp.letter.actions')}>
              <Button variant="secondary" size="sm" iconStart={copied === 'letter' ? <Check /> : <Copy />} onClick={() => void copy(letter.body, 'letter')}>
                {copied === 'letter' ? t('common.action.copied') : t('common.action.copy')}
              </Button>
              <Button variant="secondary" size="sm" iconStart={<Share2 />} onClick={() => void share()}>
                {t('common.action.share')}
              </Button>
              <a className={styles.mail} href={mailtoUrl(letter.subject, letter.body)}>
                <Mail aria-hidden="true" strokeWidth={2.25} />
                {t('stuckhelp.action.email')}
              </a>
            </div>
            <p className="visually-hidden" aria-live="polite">
              {copied !== null ? t('stuckhelp.copied.status') : ''}
            </p>
          </section>
        </div>
      )}
    </BottomSheet>
  )
}

/** A link out — a website, a WhatsApp chat or a number to call — styled as a button (a real link, so a tap always works). */
function ChannelLink({ link, label, newTab, small = false }: { link: HelpLink; label: string; newTab: string; small?: boolean }) {
  const Icon = LINK_ICONS[link.kind]
  const external = link.kind !== 'call'
  return (
    <a
      className={cx(styles.channel, small ? styles.channelSmall : styles.channelPrimary)}
      href={link.href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer', 'aria-label': newTab } : {})}
      onClick={() => haptic('tap')}
    >
      <Icon aria-hidden="true" strokeWidth={2.25} />
      {label}
    </a>
  )
}

/** The letter, with what's left to fill in ("[your mobile number]") marked. */
function LetterText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]\n]+\])/)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className={styles.blank}>
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  )
}
