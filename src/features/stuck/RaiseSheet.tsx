/**
 * Raising a stuck payment, one rung at a time: where to take it (your UPI app, bank or wallet, the
 * RBI Ombudsman, the business, the National Consumer Helpline, AirSewa, a consumer commission), your
 * details for the letter (asked once), the letter itself — in English, with a line in your language
 * on what it asks for — ready to copy, share, email or print, the button that takes you there, and
 * "I've raised it" (the day and the complaint number) so Settle can count the wait for the next rung.
 */
import { useEffect, useId, useState } from 'react'
import { ArrowLeft, Check, Copy, ExternalLink, Mail, MessageCircle, Phone, Printer, Share2 } from 'lucide-react'
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
import { hasPlugin, inAndroidApp } from '../../lib/nativeApp'
import { copyText, shareResult } from '../../lib/share'
import { letterSummary, raiseHelp, RBI_CRPC_EMAIL, walletName, walletOf, type HelpLink, type HelpText } from './help'
import { emailKey, LETTER_ME_LIMITS, setLetterEmail, useLetterMe } from './letterMe'
import { LetterMandate } from './LetterMandate'
import { LetterMeFields, type LetterMeField } from './LetterMeFields'
import { LetterPrint } from './LetterPrint'
import { blanksIn, letterFor, ombudsmanFields, withSubject, type LetterPayment, type LetterSender, type OmbudsmanFieldId } from './letters'
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

/** A wallet's complaint is against the company behind it, and it knows you by your mobile number. */
const WALLET_FIELD_KEYS: Readonly<Partial<Record<OmbudsmanFieldId, MessageKey>>> = {
  entity: 'stuckhelp.field.entityWallet',
  account: 'stuckhelp.field.mobile',
  bankComplaint: 'stuckhelp.field.walletComplaint',
}

/** Your details each rung's letter uses. */
const DETAILS: Readonly<Record<StuckStepKind, readonly LetterMeField[]>> = {
  bank: ['mobile', 'address'],
  ombudsman: ['mobile', 'address'],
  merchant: ['mobile', 'address'],
  airsewa: ['mobile', 'address'],
  nch: ['place'],
  commission: ['address', 'mobile'],
}

/** What the text is called: a letter (bank, RBI), a summary (commission), else a message. */
function textKind(step: StuckStepKind): 'letter' | 'message' | 'summary' {
  if (step === 'bank' || step === 'ombudsman') return 'letter'
  return step === 'commission' ? 'summary' : 'message'
}

/** Looks like an email address (else the email opens with no recipient, for you to add one). */
function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** A new email with the recipient (when there's one), subject and text filled in. */
function mailtoUrl(to: string, subject: string, body: string): string {
  const address = isEmail(to) ? encodeURIComponent(to).replace(/%40/g, '@') : ''
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/** The browser can print here (the Android app's WebView can't, unless the app has the file plugin nativeApp's printPage uses). */
function canPrint(): boolean {
  return typeof window.print === 'function' && (!inAndroidApp() || hasPlugin('SettleFiles'))
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
  const details = useLetterMe()
  const ids = useId()
  const day = todayIso()
  const [mode, setMode] = useState<'letter' | 'raised'>('letter')
  // Raised before (adding the complaint number later): start from what was noted.
  const noted = payment.steps.find((s) => s.kind === step) ?? null
  const [date, setDate] = useState(noted?.date ?? (day < payment.date ? payment.date : day))
  const [ref, setRef] = useState(noted?.ref ?? '')
  /** What was copied last ('letter' or a form field), while "Copied" shows. */
  const [copied, setCopied] = useState<string | null>(null)
  /** Each Print tap mounts a fresh printout (0: none yet). */
  const [printRun, setPrintRun] = useState(0)

  // Where this one's email goes: remembered per bank, wallet or business; typed here otherwise.
  const wallet = payment.rail === 'wallet'
  const mailKey = emailKey(step, payment, walletOf(payment))
  const [typedTo, setTypedTo] = useState('')
  const to = step === 'ombudsman' ? RBI_CRPC_EMAIL : mailKey ? (details.emails[mailKey] ?? '') : typedTo
  const setTo = (value: string): void => {
    if (mailKey) setLetterEmail(mailKey, value)
    else setTypedTo(value.trim())
  }

  useEffect(() => {
    if (copied === null) return
    const timer = window.setTimeout(() => setCopied(null), COPIED_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  const me: LetterSender = { name: profile.name, upiId: profile.upiId, mobile: details.mobile, place: details.place, address: details.address }
  // A NACH debit after the mandate was revoked: the letters say so (asked below, for NACH only).
  const nach = payment.kind === 'failed' && payment.rail === 'nach'
  const revokedOn = nach ? details.revoked[payment.id] : undefined
  const about: LetterPayment = revokedOn === undefined ? payment : { ...payment, mandateRevoked: true, mandateRevokedOn: revokedOn || null }
  const letter = letterFor(step, about, me, day, { compensationOnly })
  const help = raiseHelp(step, payment, { compensationOnly, message: letter.body, today: day })
  const fields = step === 'ombudsman' ? ombudsmanFields(about, me, day) : null
  const kind = textKind(step)
  const name = merchantById(payment.merchant)?.name ?? (payment.party?.trim() || null)
  const text = (line: HelpText): string => t(line.key, line.vars)
  // WhatsApp carries the message itself, so it's the helpline's main button; elsewhere copying the
  // letter is, and the page to paste it into sits with the other links.
  const whatsapp = help.channel?.kind === 'whatsapp' ? help.channel : null
  const links = help.channel && !whatsapp ? [help.channel, ...help.links] : help.links
  // The helpline's message goes on WhatsApp as it is; everything else starts with its subject.
  const full = step === 'nch' ? letter.body : withSubject(letter)
  const blanks = blanksIn(full)
  const emailable = step === 'bank' || step === 'merchant' || step === 'ombudsman'
  const printable = step !== 'nch' && canPrint()

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
    const outcome = await shareResult(full, { mode: 'share', title: letter.subject })
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
    // A wallet's company reads as the business would: "raised with Paytm".
    const walletLabel = step === 'bank' && wallet ? walletName(payment) : null
    toast(t('stuckhelp.raised.toast', { kind: walletLabel ? 'merchant' : step, date: shortDateLabel(date), name: walletLabel ?? name ?? t('stuckhelp.party.refund') }), {
      tone: 'success',
      action: undo ? { label: t('common.action.undo'), onAction: undo } : undefined,
    })
    onClose()
  }

  const raised = mode === 'raised'
  const blanksId = `${ids}-blanks`
  const copyLabel = copied === 'letter' ? t('common.action.copied') : t('stuckhelp.action.copy', { kind })

  return (
    <>
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
              {whatsapp ? (
                <ChannelLink link={whatsapp} label={text(whatsapp.label)} newTab={t('stuckhelp.newTab', { label: text(whatsapp.label) })} />
              ) : (
                <Button
                  block
                  iconStart={copied === 'letter' ? <Check /> : <Copy />}
                  aria-describedby={blanks.length > 0 ? blanksId : undefined}
                  onClick={() => void copy(full, 'letter')}
                >
                  {copyLabel}
                </Button>
              )}
              <Button block variant="secondary" iconStart={<Check />} onClick={() => setMode('raised')}>
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
              {links.length > 0 && (
                <ul className={styles.links} aria-label={t('stuckhelp.links.aria')}>
                  {links.map((link) => (
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

            {nach && <LetterMandate payment={payment} />}

          <LetterMeFields fields={DETAILS[step]} />

            {fields && (
              <section className={styles.section} aria-labelledby={`${ids}-fields`}>
                <h3 id={`${ids}-fields`} className={styles.heading}>
                  {t('stuckhelp.fields.heading')}
                </h3>
                <p className={styles.hint}>{t('stuckhelp.fields.hint')}</p>
                <dl className={styles.fields}>
                  {fields.map((field) => {
                    const label = t((wallet ? WALLET_FIELD_KEYS[field.id] : undefined) ?? FIELD_KEYS[field.id])
                    return (
                      <div key={field.id} className={styles.field}>
                        <dt className={styles.fieldLabel}>{label}</dt>
                        <dd className={styles.fieldValue}>
                          <span className={cx(styles.value, !field.known && styles.unknown)} lang="en">
                            {field.value}
                          </span>
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
              <div className={styles.summary}>
                <p className={styles.summaryAsk}>{text(letterSummary(step, payment, { compensationOnly, today: day }))}</p>
                <p className={styles.hint}>{t('stuckhelp.summary.english', { kind })}</p>
              </div>
              <div className={styles.paper} lang="en">
                <p className={styles.letter} data-testid="stuck-letter">
                  <LetterText text={full} />
                </p>
              </div>
              {blanks.length > 0 && (
                <p id={blanksId} className={styles.hint}>
                  {t('stuckhelp.letter.blanks', { count: blanks.length })}
                </p>
              )}
              {emailable && step !== 'ombudsman' && (
                <TextField
                  label={t('stuckhelp.email.label')}
                  hint={t('stuckhelp.email.hint', { kind: wallet ? 'wallet' : step === 'merchant' ? 'business' : 'bank' })}
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={LETTER_ME_LIMITS.email}
                  value={to}
                  onChange={(event) => setTo(event.currentTarget.value)}
                />
              )}
              {step === 'ombudsman' && <p className={styles.hint}>{t('stuckhelp.email.crpc', { email: RBI_CRPC_EMAIL })}</p>}
              <div className={styles.actions} role="group" aria-label={t('stuckhelp.letter.actions')}>
                {whatsapp && (
                  <Button
                    variant="secondary"
                    size="sm"
                    iconStart={copied === 'letter' ? <Check /> : <Copy />}
                    aria-describedby={blanks.length > 0 ? blanksId : undefined}
                    onClick={() => void copy(full, 'letter')}
                  >
                    {copyLabel}
                  </Button>
                )}
                <Button variant="secondary" size="sm" iconStart={<Share2 />} onClick={() => void share()}>
                  {t('common.action.share')}
                </Button>
                {emailable && (
                  <a className={styles.mail} href={mailtoUrl(to, letter.subject, letter.body)}>
                    <Mail aria-hidden="true" strokeWidth={2.25} />
                    {t('stuckhelp.action.email')}
                  </a>
                )}
                {printable && (
                  <Button variant="secondary" size="sm" className={styles.wide} iconStart={<Printer />} onClick={() => setPrintRun((n) => n + 1)}>
                    {t('stuckhelp.action.print')}
                  </Button>
                )}
              </div>
              <p className="visually-hidden" aria-live="polite">
                {copied !== null ? t('stuckhelp.copied.status') : ''}
              </p>
            </section>
          </div>
        )}
      </BottomSheet>
      {open && printRun > 0 && <LetterPrint key={printRun} text={full} title={letter.subject} ackCopy={step === 'bank'} />}
    </>
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
