import { useId, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Landmark, ScanText, Store } from 'lucide-react'
import { goBack, navigate, useRoute, useSearchParams } from '../../app/router'
import { ActionBar, Banner, Button, Chip, PageTitle, Screen, SectionHeader, Switch, TextField, TopBar, useToast } from '../../components'
import { useStore } from '../../data'
import { stuckStore, type StuckKind, type StuckPayment, type StuckRail, type StuckStepKind } from '../../data/stores'
import { addStuck, deleteStuck, isStuckOpen, updateStuck, type StuckDraft } from '../../data/stuck'
import type { Minor } from '../../domain/types'
import { daysBetween, isIsoDate, today as todayIso } from '../../engine/dates'
import { useT, type MessageKey } from '../../i18n'
import { AmountHero, DateField } from '../../kit/index-a'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { shortDate } from '../recurring/recurringLabels'
import { AddDate } from './AddDate'
import { AddPaidWith, isKnownBank, OTHER_BANK, walletOf, type PaidWith } from './AddPaidWith'
import { findStuckTwin, type StuckCandidate, type StuckTwin } from './duplicates'
import { upiAppOf } from './help'
import { addWorkingDays, findMerchant, MERCHANTS, merchantById } from './merchants'
import { STUCK_NEW_PATH, STUCK_PATH, stuckPath } from './paths'
import { setStuckPrefill, takeStuckPrefill, type StuckPrefill } from './prefill'
import { COMPENSATION_PER_DAY, dueBy, RAIL_RULES, refundDueBasis } from './rules'
import { COMMON_RAILS, inr, partyName, POPULAR_MERCHANTS, RAIL_ORDER, railDays, railLabel, stepPlace } from './view'
import styles from './Stuck.module.css'

const ROUTES = ['/app/stuck/new', '/app/stuck/:id/edit'] as const

/** "They said: 5 / 7 / 10 working days" — how businesses usually put it. */
const PROMISED_DAYS = [5, 7, 10] as const

/**
 * `/app/stuck/new` (and `/app/stuck/:id/edit`) — add money that's stuck: what it is (a failed
 * payment that took the money, or a refund that hasn't come), how much, the day it left (asked,
 * never assumed), and the few details that set its deadline — how it was paid (the RBI's deadline
 * shows as you pick; nothing is picked for you) or which business owes it (its own timeline, or
 * what it said). For a failed payment, the bank, the UPI app or wallet and the account's last
 * digits, which the complaint is addressed with. Opened from a pasted or shared message, it's
 * filled in already, to check. One already tracked (the same reference or order number) opens
 * instead of being added twice. `?kind=failed|refund` picks the kind. Save opens its page.
 */
export function StuckAddScreen() {
  const t = useT()
  const { params } = useRoute(ROUTES)
  const id = params.id ?? null
  const existing = useStore(stuckStore, (all) => (id ? (all.find((s) => s.id === id) ?? null) : null))
  if (id !== null && !existing) {
    return (
      <Screen header={<TopBar onBack={() => goBack(STUCK_PATH)} />}>
        <PageTitle title={t('stuck.detail.gone')} subtitle={t('stuck.detail.gone.text')} />
        <Button onClick={() => navigate(STUCK_PATH, { replace: true })}>{t('stuck.detail.gone.cta')}</Button>
      </Screen>
    )
  }
  return <Editor key={id ?? 'new'} existing={existing} />
}

interface Form extends PaidWith {
  kind: StuckKind | null
  amount: Minor | null
  /** The day the money left (a refund: the day it was cancelled); null until it's said. */
  date: string | null
  rail: StuckRail | null
  /** How it was paid has been said ("Not sure" counts). A blank form waits, so a skipped choice doesn't quietly take the longest deadline. */
  railPicked: boolean
  party: string
  /** A business Settle knows: the one a refund is owed by, or the one a failed payment went to. */
  merchant: string | null
  /** "Someone else" picked for a refund. */
  other: boolean
  ref: string
  orderId: string
  promisedBy: string | null
  /** "They said 7 working days", counted from the date. */
  promisedDays: number | null
  confirmed: boolean
}

/** Paid by card: the DGCA's 7 days apply to an airline's refund. */
function isCardRail(rail: StuckRail | null): boolean {
  return rail === 'card_online' || rail === 'card_pos' || rail === 'card_transfer'
}

/** "4821" from "XX4821" (the last 4 digits), or ''. */
function lastDigits(account: string | null | undefined): string {
  return (account ?? '').replace(/\D/g, '').slice(-4)
}

/** What the form starts with: the payment being edited, a hand-off, or a blank (with `?kind=`). */
function initialForm(existing: StuckPayment | null, prefill: StuckPrefill | null, kind: StuckKind | null): Form {
  const from = existing ?? prefill ?? {}
  const resolvedKind = from.kind ?? kind
  const party = from.party ?? ''
  // A refund saved without a business Settle knows, but named like one, opens with it picked.
  const merchant = merchantById(from.merchant)?.id ?? (resolvedKind === 'refund' ? (findMerchant(party)?.id ?? null) : null)
  const bank = from.bank ?? ''
  const app = from.app ?? ''
  return {
    kind: resolvedKind,
    amount: from.amount ?? null,
    date: from.date ?? null,
    rail: from.rail ?? null,
    railPicked: existing !== null || (from.rail ?? null) !== null,
    party,
    merchant,
    other: resolvedKind === 'refund' && merchant === null && party.trim() !== '',
    ref: from.ref ?? '',
    orderId: from.orderId ?? '',
    promisedBy: from.promisedBy ?? null,
    promisedDays: null,
    confirmed: from.confirmed ?? true,
    bank: bank === '' || isKnownBank(bank) ? bank : OTHER_BANK,
    bankName: bank !== '' && !isKnownBank(bank) ? bank : '',
    account: lastDigits(from.account),
    app,
    otherWallet: app !== '' && walletOf(app) === null && upiAppOf(app) === null,
  }
}

/** The day they said it would be back by: the date given, or so many working days from the start. */
function promisedOf(form: Form): string | null {
  if (form.promisedDays !== null && form.date !== null) return addWorkingDays(form.date, form.promisedDays)
  return form.promisedBy
}

/** Why it can't be saved yet, or null. */
function formIssue(form: Form, day: string): MessageKey | null {
  if (form.kind === null) return 'stuck.add.issue.kind'
  if (form.amount === null || form.amount <= 0) return 'stuck.add.issue.amount'
  if (form.date === null) return form.kind === 'refund' ? 'stuck.add.issue.dateRefund' : 'stuck.add.issue.date'
  // The picker stops at today, but a typed date doesn't.
  if (!isIsoDate(form.date) || form.date > day) return 'stuck.add.issue.future'
  if (form.kind === 'failed') {
    if (!form.railPicked) return 'stuck.add.issue.rail'
    if (form.rail !== 'wallet' && form.account.length > 0 && form.account.length < 3) return 'stuck.add.issue.account'
    return null
  }
  if (form.other ? form.party.trim() === '' : form.merchant === null) return 'stuck.add.issue.business'
  const promised = promisedOf(form)
  if (promised !== null && promised < form.date) return 'stuck.add.issue.promised'
  return null
}

/** The form as a new stuck payment, to look for one already tracked. */
function candidateOf(form: Form): StuckCandidate {
  const refund = form.kind === 'refund'
  return {
    kind: form.kind,
    amount: form.amount,
    date: form.date,
    party: refund && !form.other ? (merchantById(form.merchant)?.name ?? null) : form.party.trim() || null,
    merchant: refund && form.other ? null : form.merchant,
    ref: form.ref,
    orderId: refund ? form.orderId : null,
  }
}

/** A booking number as typed, without a leading "PNR" ("PNR X7K2LQ" → "X7K2LQ"). */
function orderIdOf(text: string): string | null {
  return text.trim().replace(/^pnr\b\s*(?:no\.?|number)?\s*[:#.-]?\s*/i, '') || null
}

/** The bank, account and app to save. Untouched digits keep the account as it was saved ("XX123456" stays whole). */
function paidWithOf(form: Form, saved: string | null): Pick<StuckDraft, 'bank' | 'account' | 'app'> {
  const bank = form.bank === OTHER_BANK ? form.bankName.trim() || null : form.bank || null
  const account = form.account === '' ? null : form.account === lastDigits(saved) && saved !== null ? saved : `XX${form.account}`
  return { bank, account, app: form.app.trim() || null }
}

/**
 * A complaint that belongs to a payment of this kind: the bank's ladder for a failed payment (and
 * a word to the business), the business's for a refund (AirSewa only for an airline).
 */
function fitsKind(step: StuckStepKind, kind: StuckKind, merchant: string | null): boolean {
  if (kind === 'failed') return step === 'bank' || step === 'ombudsman' || step === 'merchant'
  if (step === 'airsewa') return merchantById(merchant)?.category === 'airline'
  return step === 'merchant' || step === 'nch' || step === 'commission'
}

/** Undo of "Start tracking": it's gone, and from its page (or its edit) the form comes back as it was — never "This one's gone". */
function undoAdd(id: string, refill: StuckPrefill): void {
  deleteStuck(id)
  const page = stuckPath(id)
  const here = window.location.pathname
  if (here === page || here.startsWith(`${page}/`)) {
    setStuckPrefill(refill)
    navigate(STUCK_NEW_PATH, { replace: true })
  }
}

function Editor({ existing }: { existing: StuckPayment | null }) {
  const t = useT()
  const toast = useToast()
  const query = useSearchParams()
  const day = todayIso()
  const ids = { kind: useId(), how: useId(), who: useId(), promised: useId(), shops: useId() }
  const [prefill] = useState(() => (existing ? null : takeStuckPrefill()))
  const queryKind = query.get('kind')
  const [form, setForm] = useState<Form>(() => initialForm(existing, prefill, queryKind === 'failed' || queryKind === 'refund' ? queryKind : null))
  // A message that didn't say the money left: ask, instead of assuming.
  const [askConfirmed] = useState(() => prefill?.confirmed === false)
  const [moreRails, setMoreRails] = useState(() => form.rail !== null && !COMMON_RAILS.includes(form.rail))
  const all = useStore(stuckStore, (list) => list)
  // The one this form just saved isn't a twin of itself (the screen can linger as it leaves).
  const [savedId, setSavedId] = useState<string | null>(null)
  const isNew = existing === null
  const issue = formIssue(form, day)
  const twin = isNew && form.kind !== null ? findStuckTwin(savedId ? all.filter((s) => s.id !== savedId) : all, candidateOf(form)) : null
  const refundMerchant = form.other ? null : form.merchant
  // Complaints noted for the other kind of stuck money (changed in this edit) don't fit any more.
  const dropped = existing && form.kind !== null ? existing.steps.filter((step) => !fitsKind(step.kind, form.kind ?? existing.kind, refundMerchant)) : []
  const change = (patch: Partial<Form>): void => setForm((current) => ({ ...current, ...patch }))

  // A "they said by" day before the new start can't stand: it moves up with it.
  const setDate = (date: string): void =>
    setForm((current) => ({ ...current, date, promisedBy: current.promisedBy !== null && current.promisedBy < date ? date : current.promisedBy }))

  // Switching kind keeps who it was: a failed IRCTC payment becomes a refund owed by IRCTC.
  const pickKind = (kind: StuckKind): void =>
    setForm((current) => {
      if (current.kind === kind) return current
      if (kind === 'refund' && current.merchant === null && !current.other) {
        const known = findMerchant(current.party)
        return known ? { ...current, kind, merchant: known.id, other: false } : { ...current, kind, other: current.party.trim() !== '' }
      }
      if (kind === 'failed' && current.party.trim() === '' && current.merchant !== null && !current.other) {
        return { ...current, kind, party: merchantById(current.merchant)?.name ?? '' }
      }
      return { ...current, kind }
    })

  const leave = (): void => {
    if (existing) goBack(stuckPath(existing.id))
    else goBack(STUCK_PATH)
  }

  const openTwin = (found: StuckTwin): void => navigate(stuckPath(found.payment.id), { replace: true })

  const airline = form.kind === 'refund' && !form.other && merchantById(form.merchant)?.category === 'airline'

  const save = (): void => {
    if (issue || twin?.sure || form.kind === null || form.amount === null || form.date === null) return
    const refund = form.kind === 'refund'
    const merchant = refund ? refundMerchant : form.rail === 'atm' ? null : form.merchant
    const party = refund && !form.other ? (merchantById(form.merchant)?.name ?? null) : form.party.trim() || null
    const source = existing ?? prefill
    const fields = {
      kind: form.kind,
      // A refund keeps how it was paid only where a rule turns on it: a flight paid by card.
      rail: refund ? (airline && isCardRail(form.rail) ? form.rail : null) : form.rail,
      party,
      merchant,
      amount: form.amount,
      date: form.date,
      promisedBy: refund ? promisedOf(form) : null,
      ref: form.ref.trim() || null,
      orderId: refund ? orderIdOf(form.orderId) : null,
      confirmed: refund ? true : form.confirmed,
      // A refund doesn't ask about the bank: what was known stays.
      ...(refund ? { bank: source?.bank ?? null, account: source?.account ?? null, app: source?.app ?? null } : paidWithOf(form, source?.account ?? null)),
    }
    haptic('success')
    if (existing) {
      const steps = existing.steps.filter((step) => fitsKind(step.kind, fields.kind, merchant))
      // The bank's reply goes with the complaint to the bank, when that's taken off.
      const replied = steps.length < existing.steps.length && !steps.some((step) => step.kind === 'bank') ? { repliedAt: null } : {}
      const undo = updateStuck(existing.id, { ...fields, steps, ...replied })
      toast(t('stuck.edit.saved'), { tone: 'success', action: undo ? { label: t('common.action.undo'), onAction: undo } : undefined })
      goBack(stuckPath(existing.id))
      return
    }
    const draft: StuckDraft = { ...fields, source: prefill?.source ?? 'manual' }
    const saved = addStuck(draft)
    setSavedId(saved.id)
    navigate(stuckPath(saved.id), { replace: true })
    toast(t('stuck.add.saved'), { tone: 'success', action: { label: t('common.action.undo'), onAction: () => undoAdd(saved.id, draft) } })
  }

  const title = isNew ? t('stuck.add.title') : t('stuck.edit.title')
  const rule = ruleLine(form, day, t)
  const named = form.kind === 'failed' && form.rail !== 'atm' ? findMerchant(form.party) : null
  const toCopy = partyCopy(form.rail)
  const [refKey, refHint] = refCopy(form.rail, form.app)
  const pnr = form.kind === 'refund' && !form.other && (merchantById(form.merchant)?.category === 'airline' || merchantById(form.merchant)?.category === 'rail')

  return (
    <Screen
      header={<TopBar onBack={leave} title={title} />}
      footer={
        <ActionBar hint={!twin?.sure && issue && form.kind !== null ? t(issue) : undefined}>
          {twin?.sure ? (
            <Button block onClick={() => openTwin(twin)}>
              {t('stuck.dupe.open')}
            </Button>
          ) : (
            <Button block disabled={issue !== null} onClick={save}>
              {!isNew ? t('common.action.save') : twin ? t('stuck.dupe.anyway') : t('stuck.add.save')}
            </Button>
          )}
        </ActionBar>
      }
      contentClassName={styles.content}
    >
      <PageTitle title={t('stuck.add.heading')} id={ids.kind} />

      {prefill && prefill.source !== undefined && prefill.source !== 'manual' && (
        <Banner tone="info" icon={<ScanText />}>
          {prefill.source === 'screenshot' ? t('stuck.add.fromShot') : t('stuck.add.fromMessage')}
        </Banner>
      )}

      <div role="radiogroup" aria-labelledby={ids.kind} className={styles.tiles}>
        <OptionTile
          selected={form.kind === 'failed'}
          icon={<Landmark />}
          title={t('stuck.add.kind.failed')}
          caption={t('stuck.add.kind.failed.text')}
          onClick={() => pickKind('failed')}
        />
        <OptionTile
          selected={form.kind === 'refund'}
          icon={<Store />}
          title={t('stuck.add.kind.refund')}
          caption={t('stuck.add.kind.refund.text')}
          onClick={() => pickKind('refund')}
        />
      </div>
      <p className={styles.fine}>{t('stuck.add.kind.help')}</p>

      {form.kind !== null && (
        <>
          <AmountHero value={form.amount} currency="INR" onChange={(amount) => change({ amount })} label={t('stuck.add.amount')} showLabel />

          <AddDate label={form.kind === 'refund' ? t('stuck.add.date.refund') : t('stuck.add.date.failed')} value={form.date} today={day} onChange={setDate} />

          {form.kind === 'failed' ? (
            <>
              <section className={styles.formSection} aria-labelledby={ids.how}>
                <SectionHeader id={ids.how} title={t('stuck.add.how')} />
                <div role="radiogroup" aria-labelledby={ids.how} className={styles.railGrid}>
                  {(moreRails ? RAIL_ORDER : COMMON_RAILS).map((rail) => (
                    <RailTile key={rail} rail={rail} selected={form.railPicked && form.rail === rail} onClick={() => change({ rail, railPicked: true })} />
                  ))}
                  <RailTile rail={null} selected={form.railPicked && form.rail === null} onClick={() => change({ rail: null, railPicked: true })} />
                </div>
                {!moreRails && (
                  <Button variant="ghost" size="sm" iconEnd={<ChevronDown />} className={styles.moreRails} onClick={() => setMoreRails(true)}>
                    {t('stuck.add.moreWays')}
                  </Button>
                )}
                <p className={styles.fine}>{form.rail === 'nach' ? t('stuck.add.how.nach') : t('stuck.add.how.upi')}</p>
                {rule && <p className={styles.ruleLine}>{rule}</p>}
              </section>

              <TextField
                label={t(toCopy.label)}
                value={form.party}
                placeholder={t(toCopy.placeholder)}
                hint={named ? t('stuck.add.to.merchant', { name: named.name }) : undefined}
                list={toCopy.shops ? ids.shops : undefined}
                maxLength={120}
                autoCapitalize="words"
                enterKeyHint="next"
                onChange={(event) => change({ party: event.target.value, merchant: findMerchant(event.target.value)?.id ?? null })}
              />
              {toCopy.shops && (
                <datalist id={ids.shops}>
                  {MERCHANTS.map((m) => (
                    <option key={m.id} value={m.name} />
                  ))}
                </datalist>
              )}

              <TextField
                label={t(refKey)}
                value={form.ref}
                maxLength={40}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                hint={t(refHint)}
                onChange={(event) => change({ ref: event.target.value })}
              />

              <AddPaidWith rail={form.rail} value={form} onChange={change} />

              {askConfirmed && (
                <div className={styles.switchCard}>
                  <Switch
                    checked={form.confirmed}
                    onChange={(confirmed) => change({ confirmed })}
                    label={t('stuck.add.confirmed')}
                    description={t('stuck.add.confirmed.text')}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <section className={styles.formSection} aria-labelledby={ids.who}>
                <SectionHeader id={ids.who} title={t('stuck.add.who')} />
                <div role="radiogroup" aria-labelledby={ids.who} className={styles.chips}>
                  {merchantChoices(form.merchant).map((m) => (
                    <Chip
                      key={m.id}
                      role="radio"
                      aria-checked={form.merchant === m.id && !form.other}
                      selected={form.merchant === m.id && !form.other}
                      onClick={() => change({ merchant: m.id, other: false })}
                    >
                      {m.name}
                    </Chip>
                  ))}
                  <Chip role="radio" aria-checked={form.other} selected={form.other} onClick={() => change({ merchant: null, other: true })}>
                    {t('stuck.add.who.other')}
                  </Chip>
                </div>
                {form.other && (
                  <TextField
                    label={t('stuck.add.who.name')}
                    value={form.party}
                    placeholder={t('stuck.add.who.placeholder')}
                    maxLength={120}
                    autoCapitalize="words"
                    autoFocus
                    onChange={(event) => change({ party: event.target.value })}
                  />
                )}
              </section>

              {airline && (
                <div className={styles.switchCard}>
                  <Switch
                    checked={isCardRail(form.rail)}
                    onChange={(card) => change({ rail: card ? 'card_online' : null })}
                    label={t('stuck.add.card')}
                    description={t('stuck.add.card.text')}
                  />
                </div>
              )}

              <section className={styles.formSection} aria-labelledby={ids.promised}>
                <p id={ids.promised} className={styles.dateLabel}>
                  {t('stuck.add.promised')}
                </p>
                <div className={styles.chips}>
                  <Chip selected={form.promisedBy === null && form.promisedDays === null} onClick={() => change({ promisedBy: null, promisedDays: null })}>
                    {t('stuck.add.promised.none')}
                  </Chip>
                  {PROMISED_DAYS.map((count) => (
                    <Chip key={count} selected={form.promisedDays === count} onClick={() => change({ promisedDays: count, promisedBy: null })}>
                      {t('stuck.add.promised.days', { count })}
                    </Chip>
                  ))}
                  <DateField
                    label={t('stuck.add.promised.label')}
                    value={form.promisedBy ?? ''}
                    min={form.date ?? undefined}
                    max={null}
                    className={form.promisedBy !== null ? styles.datePicked : undefined}
                    onChange={(promisedBy) => change({ promisedBy, promisedDays: null })}
                  />
                </div>
                {rule && <p className={styles.ruleLine}>{rule}</p>}
              </section>

              <TextField
                label={pnr ? t('stuck.add.order.pnr') : t('stuck.add.order')}
                hint={pnr ? t('stuck.add.order.pnr.hint') : undefined}
                value={form.orderId}
                maxLength={60}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) => change({ orderId: event.target.value })}
              />
            </>
          )}

          {existing && dropped.length > 0 && (
            <Banner tone="warning">{t('stuck.edit.dropsSteps', { places: dropped.map((step) => stepPlace(step.kind, existing)).join(', ') })}</Banner>
          )}

          {twin && <TwinBanner twin={twin} onOpen={twin.sure ? undefined : () => openTwin(twin)} />}
        </>
      )}
    </Screen>
  )
}

/** "You're already tracking this": the one on the phone, what matched, and (when it may be another payment) Open it. */
function TwinBanner({ twin, onOpen }: { twin: StuckTwin; onOpen?: () => void }) {
  const t = useT()
  const s = twin.payment
  const title = !twin.sure ? t('stuck.dupe.titleMaybe') : isStuckOpen(s) ? t('stuck.dupe.title') : t('stuck.dupe.titleClosed')
  const why = twin.by === 'ref' ? t('stuck.dupe.sure') : twin.by === 'order' ? t('stuck.dupe.sureOrder') : t('stuck.dupe.maybe')
  return (
    <Banner tone="warning" title={title} action={onOpen ? { label: t('stuck.dupe.open'), onAction: onOpen } : undefined}>
      <p>{t('stuck.dupe.text', { name: partyName(s), amount: inr(s.amount), date: shortDate(s.date) })}</p>
      <p>{why}</p>
    </Banner>
  )
}

/** The businesses to offer: the popular ones, with the one already picked first if it isn't among them. */
function merchantChoices(picked: string | null) {
  const ids = picked && !POPULAR_MERCHANTS.includes(picked) ? [picked, ...POPULAR_MERCHANTS] : POPULAR_MERCHANTS
  return ids.map((id) => MERCHANTS.find((m) => m.id === id)).filter((m) => m !== undefined)
}

/** "Paid to", "Which ATM?", "Sent to", "Who took the debit?" — and whether businesses are suggested as it's typed. */
function partyCopy(rail: StuckRail | null): { label: MessageKey; placeholder: MessageKey; shops: boolean } {
  switch (rail) {
    case 'atm':
      return { label: 'stuck.add.to.atm', placeholder: 'stuck.add.to.atm.placeholder', shops: false }
    case 'imps':
    case 'card_transfer':
      return { label: 'stuck.add.to.transfer', placeholder: 'stuck.add.to.transfer.placeholder', shops: false }
    case 'nach':
      return { label: 'stuck.add.to.nach', placeholder: 'stuck.add.to.nach.placeholder', shops: false }
    case 'upi_person':
      return { label: 'stuck.add.to', placeholder: 'stuck.add.to.transfer.placeholder', shops: false }
    case null:
      return { label: 'stuck.add.to', placeholder: 'stuck.add.to.placeholder', shops: true }
    default:
      return { label: 'stuck.add.to', placeholder: 'stuck.add.to.shop.placeholder', shops: true }
  }
}

/** The reference a bank asks for, as it's called for this way of paying, with where to find it. */
function refCopy(rail: StuckRail | null, app: string): [MessageKey, MessageKey] {
  switch (rail) {
    case 'upi_person':
    case 'upi_merchant':
      return ['stuck.add.ref.upi', 'stuck.add.ref.upi.hint']
    case 'imps':
      return ['stuck.add.ref.imps', 'stuck.add.ref.imps.hint']
    case 'card_online':
    case 'card_pos':
    case 'card_transfer':
      return ['stuck.add.ref.card', 'stuck.add.ref.card.hint']
    case 'atm':
      return ['stuck.add.ref.atm', 'stuck.add.ref.atm.hint']
    case 'wallet':
      return ['stuck.add.ref.wallet', 'stuck.add.ref.wallet.hint']
    case 'nach':
      return ['stuck.add.ref.nach', 'stuck.add.ref.nach.hint']
    default:
      return upiAppOf(app) !== null ? ['stuck.add.ref.upi', 'stuck.add.ref.upi.hint'] : ['stuck.add.ref', 'stuck.add.ref.hint']
  }
}

/**
 * The deadline as you fill it in — "The RBI says it's due back by 3 Nov", or, already past it, "It
 * was due back by 1 Nov, so your bank already owes you ₹100" — or null until the day is said.
 */
function ruleLine(form: Form, day: string, t: ReturnType<typeof useT>): string | null {
  if (form.kind === null || form.date === null) return null
  if (form.kind === 'failed' && !form.railPicked) return t('stuck.add.rule.pick')
  const merchant = form.other ? null : form.merchant
  const due = dueBy({ kind: form.kind, rail: form.rail, date: form.date, promisedBy: promisedOf(form), merchant })
  const late = Math.max(0, daysBetween(due, day))
  const date = shortDate(due)
  if (form.kind === 'refund') {
    const basis = refundDueBasis({ kind: form.kind, rail: form.rail, date: form.date, promisedBy: promisedOf(form), merchant })
    if (basis.kind === 'dgca') return t(late > 0 ? 'stuck.add.rule.dgcaLate' : 'stuck.add.rule.dgca', { date, count: basis.days })
    if (promisedOf(form)) return t(late > 0 ? 'stuck.add.rule.promisedLate' : 'stuck.add.rule.promised', { date })
    const known = merchantById(merchant)
    if (known) return t(late > 0 ? 'stuck.add.rule.merchantLate' : 'stuck.add.rule.merchant', { date, name: known.name, count: known.workingDays })
    return t(late > 0 ? 'stuck.add.rule.refundLate' : 'stuck.add.rule.refund', { date })
  }
  if (late === 0) return t(form.rail === null ? 'stuck.add.rule.unknown' : form.rail === 'wallet' ? 'stuck.add.rule.wallet' : 'stuck.add.rule.failed', { date })
  const amount = inr(late * COMPENSATION_PER_DAY)
  if (!form.confirmed) return t('stuck.add.rule.failedLateUnsure', { date, amount })
  return t(form.rail === null ? 'stuck.add.rule.unknownLate' : form.rail === 'wallet' ? 'stuck.add.rule.walletLate' : 'stuck.add.rule.failedLate', { date, amount })
}

function OptionTile({ selected, icon, title, caption, onClick }: { selected: boolean; icon: ReactNode; title: string; caption: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={cx(styles.option, selected && styles.optionOn)}
      onClick={() => {
        haptic('select')
        onClick()
      }}
    >
      <span className={styles.optionIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.optionText}>
        <span className={styles.optionTitle}>{title}</span>
        <span className={styles.optionCaption}>{caption}</span>
      </span>
      <span className={styles.optionCheck} aria-hidden="true">
        {selected && <Check strokeWidth={3} />}
      </span>
    </button>
  )
}

function RailTile({ rail, selected, onClick }: { rail: StuckRail | null; selected: boolean; onClick: () => void }) {
  const t = useT()
  const days = rail ? RAIL_RULES[rail].days : railDays(null)
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={cx(styles.rail, selected && styles.railOn)}
      onClick={() => {
        haptic('select')
        onClick()
      }}
    >
      <span className={styles.railName}>{railLabel(rail)}</span>{' '}
      <span className={styles.railDays}>{rail ? t('stuck.add.rail.due', { count: days }) : t('stuck.rail.unknownBack', { count: days })}</span>
    </button>
  )
}
