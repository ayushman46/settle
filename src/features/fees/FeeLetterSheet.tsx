/**
 * Bank charges' one sheet for a claim, by what you're doing: the letter to the bank (your details,
 * where to send it, the letter to copy, share, email or print, then "I've sent it" with the day
 * and complaint number), the RBI Ombudsman (the form's fields to copy, the complaint, "I've raised
 * it"), the day the bank replied, the money that came back — and the letter asking to switch to a
 * Basic Savings account. Reuses Stuck money's letter pieces (your details, printing, the styles)
 * and its words where they're the same.
 */
import { useEffect, useId, useState, type ReactNode } from 'react'
import { Check, Copy, ExternalLink, Mail, Phone, Printer, Share2 } from 'lucide-react'
import { ActionBar, AmountInput, BottomSheet, Button, IconButton, TextField, useToast } from '../../components'
import { useProfile } from '../../data'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { DateField } from '../../kit/index-a'
import { haptic } from '../../lib/haptics'
import { parseMoneyInput, toInputString } from '../../lib/money'
import { hasPlugin, inAndroidApp } from '../../lib/nativeApp'
import { copyText, shareResult } from '../../lib/share'
import { RBI_CMS_URL, RBI_CRPC_EMAIL, RBI_HELPLINE } from '../stuck/help'
import { LETTER_ME_LIMITS, setLetterEmail, useLetterMe } from '../stuck/letterMe'
import { LetterMeFields } from '../stuck/LetterMeFields'
import { LetterPrint } from '../stuck/LetterPrint'
import { bankName, blanksIn, withSubject, type LetterSender } from '../stuck/letters'
import { markClaimBack, markClaimReplied, raiseClaim } from './actions'
import { basicLetter, bankLetter, claimTotal, ombudsmanFields, ombudsmanLetter } from './letters'
import { findingsOf } from './rules'
import { LetterContext, type LetterMode, type OpenedLetter } from './letterContext'
import { useFees } from './store'
import { dayLabel, inr } from './view'
import raise from '../stuck/RaiseSheet.module.css'

/** Holds the one letter sheet, so it stays open while what opened it moves (a group becomes a claim). */
export function LetterSheetHost({ children }: { children: ReactNode }) {
  const [opened, setOpened] = useState<OpenedLetter | null>(null)
  const [shown, setShown] = useState<OpenedLetter | null>(null)
  if (opened && opened !== shown) setShown(opened)
  return (
    <LetterContext.Provider value={setOpened}>
      {children}
      <FeeLetterSheet open={opened !== null} onClose={() => setOpened(null)} {...(shown ?? { claimId: null, mode: 'bank' })} />
    </LetterContext.Provider>
  )
}

const FIELD_KEYS = {
  entity: 'stuckhelp.field.entity',
  category: 'stuckhelp.field.category',
  date: 'fees.claim.back.date',
  amount: 'stuckhelp.field.amount',
  reference: 'stuckhelp.field.bankComplaint',
  account: 'stuckhelp.field.account',
  relief: 'stuckhelp.field.relief',
} as const

function canPrint(): boolean {
  return typeof window.print === 'function' && (!inAndroidApp() || hasPlugin('SettleFiles'))
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function mailtoUrl(to: string, subject: string, body: string): string {
  const address = isEmail(to) ? encodeURIComponent(to).replace(/%40/g, '@') : ''
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export interface FeeLetterSheetProps extends OpenedLetter {
  open: boolean
  onClose: () => void
}

export function FeeLetterSheet(props: FeeLetterSheetProps) {
  // A fresh sheet each time it opens.
  const [opened, setOpened] = useState(0)
  const [wasOpen, setWasOpen] = useState(props.open)
  if (props.open !== wasOpen) {
    setWasOpen(props.open)
    if (props.open) setOpened((n) => n + 1)
  }
  return <Frame key={opened} {...props} />
}

function Frame({ open, onClose, claimId, mode: startMode, bank: basicBank = null, account: basicAccount = null }: FeeLetterSheetProps) {
  const t = useT()
  const toast = useToast()
  const profile = useProfile()
  const details = useLetterMe()
  const ids = useId()
  const day = todayIso()
  const state = useFees((s) => s)
  const claim = state.claims.find((c) => c.id === claimId) ?? null
  const [mode, setMode] = useState<LetterMode | 'sent'>(startMode)
  const [copied, setCopied] = useState<string | null>(null)
  const [printRun, setPrintRun] = useState(0)
  const step = mode === 'ombudsman' ? 'ombudsman' : 'bank'
  const noted = claim?.steps.find((s) => s.kind === step) ?? null
  // The day sent: as noted (changing it), else today; the day money came back: today.
  const [date, setDate] = useState(startMode === 'bank' || startMode === 'ombudsman' ? (noted?.date ?? day) : day)
  const [ref, setRef] = useState(noted?.ref ?? '')
  const [backAmount, setBackAmount] = useState(() => (claim ? toInputString(claim.amount, 'INR') : ''))
  const [repliedOn, setRepliedOn] = useState(claim?.repliedAt ?? day)

  useEffect(() => {
    if (copied === null) return
    const timer = window.setTimeout(() => setCopied(null), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  const findings = claim ? findingsOf(state).filter((f) => claim.chargeIds.includes(f.charge.id) && f.verdict === 'wrong') : []
  const bank = claim?.bank ?? basicBank
  const account = claim?.account ?? basicAccount
  const name = bankName(bank)
  const me: LetterSender = { name: profile.name, upiId: profile.upiId, mobile: details.mobile, place: details.place, address: details.address }
  const raisedOn = claim?.steps.find((s) => s.kind === 'bank')?.date ?? null
  const letter =
    mode === 'basic'
      ? basicLetter(bank, account, me, day)
      : mode === 'ombudsman' && claim
        ? ombudsmanLetter(claim, findings, me, day)
        : bankLetter(findings, me, day, raisedOn)
  const full = withSubject(letter)
  const blanks = blanksIn(full)
  const mailKey = bank ? `bank:${bank}` : null
  const [typedTo, setTypedTo] = useState('')
  const to = mode === 'ombudsman' ? RBI_CRPC_EMAIL : mailKey ? (details.emails[mailKey] ?? '') : typedTo
  const setTo = (value: string): void => {
    if (mailKey) setLetterEmail(mailKey, value)
    else setTypedTo(value.trim())
  }
  const amount = claim ? claimTotal(findings) || claim.amount : 0

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

  const saveSent = (): void => {
    if (!claim) return
    const undo = raiseClaim(claim.id, { kind: step, date, ref: ref.trim() || null })
    haptic('success')
    toast(t(step === 'ombudsman' ? 'fees.sheet.ombudsman.sent.toast' : 'fees.sheet.sent.toast'), { tone: 'success', action: { label: t('common.action.undo'), onAction: undo } })
    onClose()
  }
  const saveReplied = (): void => {
    if (!claim) return
    const undo = markClaimReplied(claim.id, repliedOn)
    haptic('tap')
    toast(t('fees.claim.replied.toast', { date: dayLabel(repliedOn) }), { action: { label: t('common.action.undo'), onAction: undo } })
    onClose()
  }
  const saveBack = (): void => {
    if (!claim) return
    const paise = parseMoneyInput(backAmount, 'INR') ?? 0
    if (paise <= 0) return
    const undo = markClaimBack(claim.id, { date, amount: paise })
    haptic('success')
    toast(t('fees.claim.back.toast', { amount: inr(paise) }), { tone: 'success', action: { label: t('common.action.undo'), onAction: undo } })
    onClose()
  }

  const copyLabel = copied === 'letter' ? t('common.action.copied') : t('stuckhelp.action.copy', { kind: 'letter' })

  let title: string
  let description: string | undefined
  let footer: ReactNode
  let body: ReactNode
  if (mode === 'sent') {
    title = t('fees.sheet.sent.title')
    description = t('fees.sheet.sent.description')
    footer = (
      <ActionBar key="sent">
        <Button block iconStart={<Check />} onClick={saveSent}>
          {t('common.action.save')}
        </Button>
        <Button block variant="ghost" onClick={() => setMode(step)}>
          {t('stuckhelp.raised.back', { kind: 'letter' })}
        </Button>
      </ActionBar>
    )
    body = (
      <div className={raise.form}>
        <div className={raise.dateRow}>
          <span className={raise.dateLabel} aria-hidden="true">
            {t('fees.sheet.sent.date')}
          </span>
          <DateField label={t('fees.sheet.sent.date')} value={date} max={day} onChange={setDate} />
        </div>
        <TextField
          label={t('fees.sheet.sent.ref')}
          hint={t('stuckhelp.raised.refHint')}
          value={ref}
          maxLength={60}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          onChange={(event) => setRef(event.currentTarget.value)}
        />
      </div>
    )
  } else if (mode === 'replied') {
    title = t('fees.claim.replied.title')
    description = t('fees.claim.replied.description')
    footer = (
      <ActionBar key="replied">
        <Button block iconStart={<Check />} onClick={saveReplied}>
          {t('common.action.save')}
        </Button>
      </ActionBar>
    )
    body = (
      <div className={raise.form}>
        <div className={raise.dateRow}>
          <span className={raise.dateLabel} aria-hidden="true">
            {t('fees.claim.back.date')}
          </span>
          <DateField label={t('fees.claim.replied.title')} value={repliedOn} min={raisedOn ?? undefined} max={day} onChange={setRepliedOn} />
        </div>
      </div>
    )
  } else if (mode === 'back') {
    title = t('fees.claim.back.title')
    footer = (
      <ActionBar key="back">
        <Button block iconStart={<Check />} disabled={!(parseMoneyInput(backAmount, 'INR') ?? 0)} onClick={saveBack}>
          {t('common.action.save')}
        </Button>
      </ActionBar>
    )
    body = (
      <div className={raise.form}>
        <AmountInput size="field" currency="INR" label={t('fees.claim.back.amount')} value={backAmount} onChange={setBackAmount} />
        <div className={raise.dateRow}>
          <span className={raise.dateLabel} aria-hidden="true">
            {t('fees.claim.back.date')}
          </span>
          <DateField label={t('fees.claim.back.date')} value={date} max={day} onChange={setDate} />
        </div>
      </div>
    )
  } else {
    const basic = mode === 'basic'
    const ombudsman = mode === 'ombudsman'
    title = basic ? t('fees.basic.title') : ombudsman ? t('fees.sheet.ombudsman.title') : name ? t('fees.sheet.bank.title', { bank: name }) : t('fees.sheet.bank.titleAny')
    description = basic ? t('fees.basic.lead') : ombudsman ? t('fees.sheet.ombudsman.lead') : t('fees.sheet.bank.lead')
    footer = (
      <ActionBar key="letter">
        <Button block iconStart={copied === 'letter' ? <Check /> : <Copy />} onClick={() => void copy(full, 'letter')}>
          {copyLabel}
        </Button>
        {!basic && (
          <Button block variant="secondary" iconStart={<Check />} onClick={() => setMode('sent')}>
            {ombudsman ? t('stuckhelp.raised.cta') : t('fees.sheet.sent')}
          </Button>
        )}
      </ActionBar>
    )
    const fields = ombudsman && claim ? ombudsmanFields(claim, findings) : null
    body = (
      <div className={raise.body}>
        {!basic && (
          <section className={raise.section} aria-labelledby={`${ids}-how`}>
            <h3 id={`${ids}-how`} className={raise.heading}>
              {t('stuckhelp.how.heading')}
            </h3>
            {ombudsman ? (
              <ul className={raise.links} aria-label={t('stuckhelp.links.aria')}>
                <li>
                  <a className={`${raise.channel} ${raise.channelSmall}`} href={RBI_CMS_URL} target="_blank" rel="noopener noreferrer">
                    <ExternalLink aria-hidden="true" strokeWidth={2.25} />
                    {t('fees.sheet.ombudsman.open')}
                  </a>
                </li>
                <li>
                  <a className={`${raise.channel} ${raise.channelSmall}`} href={`tel:${RBI_HELPLINE}`}>
                    <Phone aria-hidden="true" strokeWidth={2.25} />
                    {t('fees.sheet.ombudsman.call')}
                  </a>
                </li>
              </ul>
            ) : (
              <ol className={raise.steps}>
                <li className={raise.step}>{t('fees.sheet.bank.step1')}</li>
                <li className={raise.step}>{t('fees.sheet.bank.step2')}</li>
                <li className={raise.step}>{t('fees.sheet.bank.step3')}</li>
              </ol>
            )}
          </section>
        )}
        <LetterMeFields fields={['name', 'mobile', 'address']} />
        {fields && (
          <section className={raise.section} aria-labelledby={`${ids}-fields`}>
            <h3 id={`${ids}-fields`} className={raise.heading}>
              {t('stuckhelp.fields.heading')}
            </h3>
            <p className={raise.hint}>{t('stuckhelp.fields.hint')}</p>
            <dl className={raise.fields}>
              {fields.map((field) => {
                const label = t(FIELD_KEYS[field.id])
                return (
                  <div key={field.id} className={raise.field}>
                    <dt className={raise.fieldLabel}>{label}</dt>
                    <dd className={raise.fieldValue}>
                      <span className={raise.value} lang="en">
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
        <section className={raise.section} aria-labelledby={`${ids}-letter`}>
          <h3 id={`${ids}-letter`} className={raise.heading}>
            {t('stuckhelp.letter.heading', { kind: 'letter' })}
          </h3>
          {!basic && (
            <div className={raise.summary}>
              <p className={raise.summaryAsk}>
                {name ? t('fees.sheet.summary', { bank: name, amount: inr(amount), count: findings.length }) : t('fees.sheet.summaryAny', { amount: inr(amount), count: findings.length })}
              </p>
              <p className={raise.hint}>{t('fees.sheet.english')}</p>
            </div>
          )}
          <div className={raise.paper} lang="en">
            <p className={raise.letter} data-testid="fee-letter">
              {full.split(/(\[[^\]\n]+\])/).map((part, i) =>
                i % 2 === 1 ? (
                  <mark key={i} className={raise.blank}>
                    {part}
                  </mark>
                ) : (
                  part
                ),
              )}
            </p>
          </div>
          {blanks.length > 0 && <p className={raise.hint}>{t('stuckhelp.letter.blanks', { count: blanks.length })}</p>}
          {!ombudsman && (
            <TextField
              label={t('stuckhelp.email.label')}
              hint={t('stuckhelp.email.hint', { kind: 'bank' })}
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
          {ombudsman && <p className={raise.hint}>{t('stuckhelp.email.crpc', { email: RBI_CRPC_EMAIL })}</p>}
          <div className={raise.actions} role="group" aria-label={t('stuckhelp.letter.actions')}>
            <Button variant="secondary" size="sm" iconStart={<Share2 />} onClick={() => void share()}>
              {t('common.action.share')}
            </Button>
            <a className={raise.mail} href={mailtoUrl(to, letter.subject, letter.body)}>
              <Mail aria-hidden="true" strokeWidth={2.25} />
              {t('stuckhelp.action.email')}
            </a>
            {canPrint() && (
              <Button variant="secondary" size="sm" className={raise.wide} iconStart={<Printer />} onClick={() => setPrintRun((n) => n + 1)}>
                {t('stuckhelp.action.print')}
              </Button>
            )}
          </div>
          <p className="visually-hidden" aria-live="polite">
            {copied !== null ? t('stuckhelp.copied.status') : ''}
          </p>
        </section>
      </div>
    )
  }

  return (
    <>
      <BottomSheet open={open} onClose={onClose} contentKey={mode} direction={mode === 'sent' ? 'forward' : 'back'} title={title} description={description} footer={footer} size="tall">
        {body}
      </BottomSheet>
      {open && printRun > 0 && <LetterPrint key={printRun} text={full} title={letter.subject} ackCopy={mode === 'bank'} />}
    </>
  )
}
