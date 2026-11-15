import { useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { Check, Copy, ExternalLink, Send } from 'lucide-react'
import { AmountInput, BottomSheet, Button, Chip, Switch, TextField, useToast } from '../../components'
import { useFriend, useProfile } from '../../data'
import { ME_ID, type Friend, type Minor } from '../../domain/types'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/index-a'
import { isKnownCurrency } from '../../lib/currencies'
import { haptic } from '../../lib/haptics'
import { commaIsDecimal, formatMoney, parseMoneyInput, toInputString } from '../../lib/money'
import { copyText, shareResult } from '../../lib/share'
import { isValidUpiId, normalizeUpiId } from '../../lib/upi'
import { firstName } from '../../share/text'
import { askMessage, rateDateLabel, rateText, serviceLabel } from './abroadText'
import {
  ABROAD_CURRENCIES,
  ABROAD_SERVICES,
  cleanHandle,
  currencyFromPhone,
  MAX_OTHER_NOTE,
  paidIssue,
  paidOutcome,
  payLink,
  type AbroadService,
  type AbroadSetup,
} from './engine'
import { recordAbroadPaid } from './record'
import { clearAbroad, setAbroad, useAbroad, useLastSent, type AbroadSent } from './store'
import { useAbroadMoney, type AbroadMoney } from './useAbroadMoney'
import styles from './Abroad.module.css'

export interface AbroadSheetProps {
  friendId: string
  open: boolean
  onClose: () => void
}

type Mode = 'view' | 'setup' | 'paid'

const money = (minor: Minor, currency: string): string => formatMoney(minor, currency, { trimZeros: true })

const HANDLE_LABELS = {
  paypal: 'abroad.setup.handle.paypal',
  wise: 'abroad.setup.handle.wise',
  revolut: 'abroad.setup.handle.revolut',
  other: 'abroad.setup.handle.other',
} as const
const HANDLE_PLACEHOLDERS = {
  paypal: 'abroad.setup.placeholder.paypal',
  wise: 'abroad.setup.placeholder.wise',
  revolut: 'abroad.setup.placeholder.revolut',
  other: 'abroad.setup.placeholder.other',
} as const
const HANDLE_HINTS = {
  paypal: 'abroad.setup.hint.paypal',
  wise: 'abroad.setup.hint.wise',
  revolut: 'abroad.setup.hint.revolut',
  other: 'abroad.setup.hint.other',
} as const

interface SetupDraft {
  currency: string
  /** "Other" is picked: the code is typed. */
  other: boolean
  code: string
  via: AbroadService
  /** What was typed for each service, so switching back and forth loses nothing. */
  handles: Record<AbroadService, string>
  tried: boolean
}

interface PaidDraft {
  /** It cleared everything (the default); off = only a part was sent. */
  all: boolean
  text: string
  tried: boolean
}

function isChip(code: string): boolean {
  return (ABROAD_CURRENCIES as readonly string[]).includes(code)
}

function setupDraft(setup: AbroadSetup | null, friend: Pick<Friend, 'phone'> | null): SetupDraft {
  const currency = setup?.currency ?? currencyFromPhone(friend?.phone) ?? 'USD'
  const via = setup?.via ?? 'paypal'
  const handles: Record<AbroadService, string> = { paypal: '', wise: '', revolut: '', other: '' }
  handles[via] = setup?.handle ?? ''
  return { currency, other: !isChip(currency), code: isChip(currency) ? '' : currency, via, handles, tried: false }
}

function paidDraft(owed: Minor, currency: string): PaidDraft {
  return { all: true, text: toInputString(owed, currency, { trimZeros: true }), tried: false }
}

/**
 * A friend who lives outside India: what is owed between you in rupees and in their currency at
 * today's reference rate; a button that opens their PayPal.Me, Wise or Revolut page when you owe
 * them, and "I've paid" to record it; a message with both amounts and your UPI ID when they owe
 * you. Opens on the set-up the first time. Nothing for yourself or someone who is gone.
 */
export function AbroadSheet({ friendId, open, onClose }: AbroadSheetProps) {
  const t = useT()
  const toast = useToast()
  const profile = useProfile()
  const friend = useFriend(friendId)
  const setup = useAbroad(friendId)
  const last = useLastSent(friendId)
  const m = useAbroadMoney(friendId, setup)
  const { view, rate } = m
  const busy = useRef(false)

  const [mode, setMode] = useState<Mode>('view')
  const [draft, setDraft] = useState<SetupDraft>(() => setupDraft(setup, friend))
  const [paid, setPaid] = useState<PaidDraft>(() => paidDraft(view.amount, view.currency))
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setMode('view')
      setDraft(setupDraft(setup, friend))
      setPaid(paidDraft(view.amount, view.currency))
    }
  }

  if (friendId === ME_ID || !friend) return null

  const name = firstName(friendLabel(friendId, friend))
  const shown: Mode = setup === null ? 'setup' : mode === 'paid' && view.side !== 'youOwe' ? 'view' : mode
  const upiId = profile.upiId && isValidUpiId(profile.upiId) ? normalizeUpiId(profile.upiId) : null

  /* ---- set-up */
  const code = draft.code.trim().toUpperCase()
  const draftCurrency = draft.other ? code : draft.currency
  const currencyOk = isKnownCurrency(draftCurrency)
  const handle = cleanHandle(draft.via, draft.handles[draft.via])

  const openSetup = (): void => {
    setDraft(setupDraft(setup, friend))
    setMode('setup')
  }

  const save = (): void => {
    if (!currencyOk || handle === null) {
      haptic('warning')
      setDraft((d) => ({ ...d, tried: true }))
      return
    }
    setAbroad(friend.id, { currency: draftCurrency, via: draft.via, handle })
    haptic('success')
    if (setup === null) toast(t('abroad.toast.saved', { name, currency: draftCurrency }), { tone: 'success', keepOverSheets: true })
    setMode('view')
  }

  const remove = (): void => {
    const had = clearAbroad(friend.id)
    if (had) {
      toast(t('abroad.toast.removed', { name }), { action: { label: t('common.action.undo'), onAction: () => setAbroad(friend.id, had) } })
    }
    onClose()
  }

  /* ---- you owe them */
  // What was typed stays if the person goes Back and returns; a fresh sheet starts from what is owed.
  const openPaid = (): void => setMode('paid')

  const typed = parseMoneyInput(paid.text, view.currency)
  const paidProblem = paidIssue(typed)

  const record = (): void => {
    if (paidProblem !== null || typed === null || setup === null) {
      haptic('warning')
      setPaid((p) => ({ ...p, tried: true }))
      return
    }
    const outcome = paidOutcome(paid.all ? 'all' : 'part', typed, view.amount)
    const done = recordAbroadPaid({
      friendId,
      currency: view.currency,
      settled: outcome.settled,
      cost: outcome.cost,
      theirCurrency: setup.currency,
      rate: rate?.rate ?? null,
      date: today(),
    })
    if (!done) {
      haptic('error')
      toast(t('abroad.toast.paid.failed', { name }), { tone: 'error' })
      onClose()
      return
    }
    haptic('success')
    const vars = { name, settled: money(done.sent.settled, view.currency), cost: money(done.sent.cost, view.currency), left: money(done.left, view.currency) }
    const message =
      done.left > 0 ? t('abroad.toast.paid.part', vars) : done.sent.cost !== done.sent.settled ? t('abroad.toast.paid.all.cost', vars) : t('abroad.toast.paid.all', vars)
    toast(message, { tone: 'success', action: { label: t('common.action.undo'), onAction: done.undo } })
    onClose()
  }

  const copyAmount = async (): Promise<void> => {
    if (view.theirAmount === null) return
    const theirs = money(view.theirAmount, view.theirCurrency)
    const ok = await copyText(toInputString(view.theirAmount, view.theirCurrency, { trimZeros: true }))
    haptic(ok ? 'success' : 'error')
    toast(ok ? t('abroad.pay.copied', { theirs }) : t('abroad.pay.copyFailed', { theirs }), { tone: ok ? 'success' : 'error', keepOverSheets: true })
  }

  /* ---- they owe you */
  const ask = async (): Promise<void> => {
    if (busy.current) return
    busy.current = true
    try {
      const shared = await shareResult(askMessage(view, name, upiId, rate?.rateDate ?? null), { title: t('abroad.message.title') })
      if (shared === 'shared' || shared === 'copied') haptic('success')
      if (shared === 'copied') toast(t('abroad.ask.copied', { name }), { tone: 'success', keepOverSheets: true })
      if (shared === 'failed') {
        haptic('error')
        toast(t('abroad.ask.failed'), { tone: 'error', keepOverSheets: true })
      }
    } finally {
      busy.current = false
    }
  }

  let title: string
  let description: string | undefined
  let footer: ReactNode
  let body: ReactNode

  if (shown === 'setup' || setup === null) {
    title = t('abroad.sheet.title.setup', { name })
    description = t('abroad.setup.body')
    footer = (
      <div className={styles.footer}>
        <Button block onClick={save}>
          {t('abroad.setup.save')}
        </Button>
        {setup !== null && (
          <Button block variant="ghost" onClick={remove}>
            {t('abroad.setup.remove', { name })}
          </Button>
        )}
      </div>
    )
    body = <SetupFields draft={draft} setDraft={setDraft} currencyOk={currencyOk} handleOk={handle !== null} onSubmit={save} />
  } else if (shown === 'paid') {
    const owed = money(view.amount, view.currency)
    const partLeft = !paid.all && typed !== null && typed > 0 && typed < view.amount ? view.amount - typed : null
    title = t('abroad.sheet.title.paid', { name })
    description = t('abroad.paid.body', { name, amount: owed })
    footer = (
      <div className={styles.footer}>
        <Button block onClick={record}>
          {t('abroad.paid.cta')}
        </Button>
        <Button block variant="ghost" onClick={() => setMode('view')}>
          {t('abroad.paid.back')}
        </Button>
      </div>
    )
    body = (
      <form
        className={styles.body}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          record()
        }}
      >
        <Switch
          checked={paid.all}
          onChange={(all) => setPaid({ ...paidDraft(view.amount, view.currency), all })}
          label={t('abroad.paid.all', { amount: owed })}
          description={t('abroad.paid.all.body')}
        />
        <AmountInput
          size="field"
          label={paid.all ? t('abroad.paid.cost.label') : t('abroad.paid.part.label')}
          currency={view.currency}
          value={paid.text}
          onChange={(text) => setPaid((p) => ({ ...p, text }))}
          commaGroups={!commaIsDecimal(view.currency)}
          enterKeyHint="done"
          hint={
            paid.all
              ? t('abroad.paid.cost.hint', { amount: owed })
              : partLeft !== null
                ? t('abroad.paid.part.hint', { left: money(partLeft, view.currency) })
                : t('abroad.paid.part.hint.all')
          }
          error={paid.tried && paidProblem !== null ? t('abroad.paid.error') : undefined}
        />
      </form>
    )
  } else {
    title = t('abroad.sheet.title')
    description = undefined
    footer =
      view.side === 'youOwe' ? (
        <Button block iconStart={<Check />} onClick={openPaid}>
          {t('abroad.pay.paid')}
        </Button>
      ) : view.side === 'theyOwe' ? (
        <Button block iconStart={<Send />} onClick={() => void ask()}>
          {t('abroad.ask.cta', { name })}
        </Button>
      ) : (
        <Button block onClick={onClose}>
          {t('common.action.done')}
        </Button>
      )
    body = <ViewContent name={name} setup={setup} money={m} last={last} hasUpi={upiId !== null} onSetup={openSetup} onCopy={() => void copyAmount()} />
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={title} description={description} footer={footer}>
      {body}
    </BottomSheet>
  )
}

/* ------------------------------------------------------------------ what is owed */

interface ViewContentProps {
  name: string
  setup: AbroadSetup
  money: AbroadMoney
  last: AbroadSent | null
  hasUpi: boolean
  onSetup: () => void
  onCopy: () => void
}

function ViewContent({ name, setup, money: m, last, hasUpi, onSetup, onCopy }: ViewContentProps) {
  const t = useT()
  const { view, rate, rateStatus, others } = m
  const amount = money(view.amount, view.currency)
  const theirs = view.theirAmount !== null ? money(view.theirAmount, view.theirCurrency) : null
  const service = serviceLabel(setup.via)
  const link = payLink(setup, view.theirAmount)

  const rateNote =
    rateStatus === 'ok' && rate
      ? rateText(rate, view.currency, view.theirCurrency)
      : rateStatus === 'loading'
        ? t('abroad.rate.loading')
        : rateStatus === 'not_covered'
          ? t('abroad.rate.none', { code: view.theirCurrency, currency: view.currency })
          : rateStatus === 'offline'
            ? t('abroad.rate.offline', { currency: view.currency })
            : rateStatus === 'error'
              ? t('abroad.rate.error', { currency: view.currency })
              : view.same && view.side !== 'even'
                ? t('abroad.view.same', { name })
                : null

  return (
    <div className={styles.body}>
      <div className={styles.owed} role="status">
        <p className={styles.big}>
          {view.side === 'youOwe'
            ? t('abroad.view.youOwe', { name, amount })
            : view.side === 'theyOwe'
              ? t('abroad.view.theyOwe', { name, amount })
              : t('abroad.view.even', { name })}
        </p>
        {view.side === 'even' && <p className={styles.fine}>{t('abroad.view.even.body', { currency: view.currency, theirs: view.theirCurrency })}</p>}
        {view.side !== 'even' && theirs !== null && !view.same && <p className={styles.theirs}>{t('abroad.view.about', { theirs })}</p>}
        {rateNote !== null && <p className={styles.fine}>{rateNote}</p>}
      </div>

      {others.length > 0 && (
        <p className={styles.fine}>{t('abroad.view.others', { list: others.map((o) => money(o.amount, o.currency)).join(', '), currency: view.currency })}</p>
      )}

      <div className={styles.how}>
        <div className={styles.howText}>
          <span className={styles.label}>{t('abroad.view.how', { name })}</span>
          <span className={styles.value}>{setup.handle ? t('abroad.view.how.value', { service, handle: setup.handle }) : t('abroad.view.how.none')}</span>
        </div>
        <Button variant="tonal" size="md" onClick={onSetup} aria-label={t('abroad.view.change.aria', { name })}>
          {t('abroad.view.change')}
        </Button>
      </div>

      {view.side === 'youOwe' && (
        <div className={styles.actions}>
          {link && (
            <a className={styles.link} href={link.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" />
              <span>{link.withAmount && theirs !== null ? t('abroad.pay.open.amount', { service, theirs }) : t('abroad.pay.open', { service, name })}</span>
            </a>
          )}
          {theirs !== null && !(link?.withAmount ?? false) && (
            <>
              <Button variant="secondary" size="md" block iconStart={<Copy />} onClick={onCopy}>
                {t('abroad.pay.copy', { theirs })}
              </Button>
              <p className={styles.fine}>{link ? t('abroad.pay.copy.hint', { service }) : t('abroad.pay.copy.hint.other')}</p>
            </>
          )}
          {!link && setup.via !== 'other' && (
            <>
              <p className={styles.fine}>{t('abroad.pay.add.body', { name })}</p>
              <Button variant="secondary" size="md" block onClick={onSetup}>
                {t('abroad.pay.add', { name })}
              </Button>
            </>
          )}
          <p className={styles.fine}>{t('abroad.pay.fine')}</p>
        </div>
      )}

      {view.side === 'theyOwe' && (
        <div className={styles.actions}>
          <p className={styles.fine}>{t('abroad.ask.fine', { name })}</p>
          {!hasUpi && <p className={styles.fine}>{t('abroad.ask.noUpi')}</p>}
        </div>
      )}

      {last && (
        <p className={styles.fine}>
          {last.cost !== last.settled
            ? t('abroad.last.cost', { date: rateDateLabel(last.date), settled: money(last.settled, last.currency), cost: money(last.cost, last.currency) })
            : t('abroad.last', { date: rateDateLabel(last.date), settled: money(last.settled, last.currency) })}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ set-up */

interface SetupFieldsProps {
  draft: SetupDraft
  setDraft: Dispatch<SetStateAction<SetupDraft>>
  currencyOk: boolean
  handleOk: boolean
  onSubmit: () => void
}

function SetupFields({ draft, setDraft, currencyOk, handleOk, onSubmit }: SetupFieldsProps) {
  const t = useT()
  return (
    <form
      className={styles.body}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div className={styles.field}>
        <p className={styles.label}>{t('abroad.setup.currency')}</p>
        <div className={styles.chips} role="group" aria-label={t('abroad.setup.currency')}>
          {ABROAD_CURRENCIES.map((c) => (
            <Chip key={c} size="lg" selected={!draft.other && draft.currency === c} onClick={() => setDraft((d) => ({ ...d, other: false, currency: c }))}>
              {c}
            </Chip>
          ))}
          <Chip size="lg" selected={draft.other} onClick={() => setDraft((d) => ({ ...d, other: true }))}>
            {t('abroad.setup.currency.other')}
          </Chip>
        </div>
        {draft.other && (
          <TextField
            label={t('abroad.setup.code.label')}
            placeholder={t('abroad.setup.code.placeholder')}
            value={draft.code}
            maxLength={3}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setDraft((d) => ({ ...d, code: event.target.value.toUpperCase() }))}
            hint={t('abroad.setup.code.hint')}
            error={draft.tried && !currencyOk ? t('abroad.setup.code.error') : undefined}
          />
        )}
      </div>

      <div className={styles.field}>
        <p className={styles.label}>{t('abroad.setup.via')}</p>
        <div className={styles.chips} role="group" aria-label={t('abroad.setup.via')}>
          {ABROAD_SERVICES.map((via) => (
            <Chip key={via} size="lg" selected={draft.via === via} onClick={() => setDraft((d) => ({ ...d, via }))}>
              {serviceLabel(via)}
            </Chip>
          ))}
        </div>
        <TextField
          label={t(HANDLE_LABELS[draft.via])}
          placeholder={t(HANDLE_PLACEHOLDERS[draft.via])}
          value={draft.handles[draft.via]}
          maxLength={draft.via === 'other' ? MAX_OTHER_NOTE : 200}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => setDraft((d) => ({ ...d, handles: { ...d.handles, [d.via]: event.target.value } }))}
          hint={t(HANDLE_HINTS[draft.via])}
          error={draft.tried && !handleOk ? t('abroad.setup.handle.error', { service: serviceLabel(draft.via) }) : undefined}
        />
      </div>
    </form>
  )
}
