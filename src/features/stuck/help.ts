/**
 * Where to raise a stuck payment, rung by rung: the in-app path in your UPI app (or your bank's or
 * wallet's own route), the RBI Ombudsman, the business's help, the National Consumer Helpline,
 * AirSewa and a consumer commission — short steps as message keys (so they translate), plus the
 * links and numbers, and what each letter asks for in a line. Pure functions of the stuck payment.
 *
 * Every number and address here was checked against its own source in November 2026:
 * - RBI Ombudsman: https://cms.rbi.org.in ("Reserve Bank – Integrated Ombudsman Scheme, 2026") and
 *   the RBI's FAQ on the scheme (rbi.org.in, FAQ 153) — 14448, 24x7 IVR, agents Mon–Sat 8 AM–10 PM;
 *   file after 30 days (or a reply you're not happy with), within 90 days after that.
 * - NPCI's UPI help site (UPI complaints and status): https://www.upihelp.npci.org.in/ — takes a
 *   complaint up to 45 days after the payment. (The old
 *   npci.org.in/what-we-do/upi/dispute-redressal-mechanism page is gone, so it isn't linked.)
 * - National Consumer Helpline: https://consumerhelpline.gov.in/public/contact — 1915 and
 *   1800-11-4000 (8 AM–8 PM), WhatsApp +91 88000 01915; every grievance gets a docket number.
 * - AirSewa: https://airsewa.gov.in. e-Jagriti (e-Daakhil merged into it): https://e-jagriti.gov.in.
 * - Google Pay's path: support.google.com/pay/india/answer/9780926. PhonePe's: its grievance policy
 *   (phonepe.com/grievance-policy). Paytm's: paytm.com/support/upi/how-to-raise-upi-complaint-paytm.
 *   Other UPI apps: NPCI's rule that every UPI app lets you pick a payment and raise a complaint.
 * - Wallets: the companies that issue them, as each one's terms name it (WALLETS). No wallet's
 *   grievance address is linked: you type it in, from the app's own help.
 * - Businesses: only help pages that were opened and checked (MERCHANT_HELP).
 */
import type { StuckPayment, StuckRail, StuckStepKind } from '../../data/stores'
import { daysBetween } from '../../engine/dates'
import type { MessageKey, Vars } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { merchantById } from './merchants'
import { backInFull, stillOwed } from './rules'
import { stuckDate } from './view'

/* ------------------------------------------------------------------ places and numbers */

/** The RBI's complaint portal (Reserve Bank – Integrated Ombudsman Scheme, 2026). */
export const RBI_CMS_URL = 'https://cms.rbi.org.in'
/** The RBI's helpline: guides you and gives status; it can't take the complaint itself. */
export const RBI_HELPLINE = '14448'
/** The RBI's Centralised Receipt and Processing Centre, which takes Ombudsman complaints by email too. */
export const RBI_CRPC_EMAIL = 'crpc@rbi.org.in'
/** NPCI's UPI help site: raise a UPI complaint or check a payment's status. */
export const MYUPI_URL = 'https://www.upihelp.npci.org.in/'
/** NPCI's UPI help site takes a complaint up to this many days after the payment. */
export const MYUPI_WINDOW_DAYS = 45
/** National Consumer Helpline. */
export const NCH_PHONE = '1915'
export const NCH_TOLL_FREE = '1800-11-4000'
/** The helpline's WhatsApp, as wa.me wants it (country code, no plus). */
export const NCH_WHATSAPP = '918800001915'
export const NCH_URL = 'https://consumerhelpline.gov.in'
/** The Ministry of Civil Aviation's grievance portal for air passengers. */
export const AIRSEWA_URL = 'https://airsewa.gov.in'
/** Consumer commissions' online filing (e-Daakhil merged into it in 2025). */
export const EJAGRITI_URL = 'https://e-jagriti.gov.in'

/** A WhatsApp chat with the National Consumer Helpline, the message typed in. */
export function nchWhatsAppUrl(text: string): string {
  return `https://wa.me/${NCH_WHATSAPP}?text=${encodeURIComponent(text)}`
}

/** A business's own help or refunds page — only the ones opened and checked. */
export interface MerchantHelp {
  url: string
  /** A help centre, or a page about refunds. */
  kind: 'help' | 'refunds'
}

export const MERCHANT_HELP: Readonly<Record<string, MerchantHelp>> = {
  amazon: { url: 'https://www.amazon.in/gp/help/customer/display.html?nodeId=202111770', kind: 'refunds' },
  flipkart: { url: 'https://www.flipkart.com/helpcentre', kind: 'help' },
  swiggy: { url: 'https://www.swiggy.com/refund-policy', kind: 'refunds' },
  indigo: { url: 'https://www.goindigo.in/refund.html', kind: 'refunds' },
  akasa: { url: 'https://www.akasaair.com/support', kind: 'help' },
}

/* ------------------------------------------------------------------ UPI apps */

export const UPI_APP_IDS = ['gpay', 'phonepe', 'paytm', 'bhim', 'cred', 'amazonpay'] as const
export type UpiAppId = (typeof UPI_APP_IDS)[number]

/** How each app calls itself. */
export const UPI_APP_NAMES: Readonly<Record<UpiAppId, string>> = {
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  bhim: 'BHIM',
  cred: 'CRED',
  amazonpay: 'Amazon Pay',
}

/** Android packages (as notifications name them) for each app. */
const UPI_APP_PACKAGES: Readonly<Record<string, UpiAppId>> = {
  'com.google.android.apps.nbu.paisa.user': 'gpay',
  'com.phonepe.app': 'phonepe',
  'net.one97.paytm': 'paytm',
  'in.org.npci.upiapp': 'bhim',
  'com.dreamplug.androidapp': 'cred',
  'in.amazon.mShop.android.shopping': 'amazonpay',
}

/** The UPI app a saved `app` means — an id ("gpay"), a package, or a name ("Google Pay", "GPay") — or null. */
export function upiAppOf(app: string | null | undefined): UpiAppId | null {
  const raw = app?.trim()
  if (!raw) return null
  const byPackage = UPI_APP_PACKAGES[raw]
  if (byPackage) return byPackage
  const name = raw.toLowerCase().replace(/[^a-z]/g, '')
  if (name === 'gpay' || name === 'googlepay' || name === 'tez') return 'gpay'
  if (name === 'phonepe') return 'phonepe'
  if (name === 'paytm') return 'paytm'
  if (name === 'bhim' || name === 'bhimupi') return 'bhim'
  if (name === 'cred' || name === 'credpay') return 'cred'
  if (name === 'amazonpay' || name === 'amazonpayupi') return 'amazonpay'
  return null
}

/* ------------------------------------------------------------------ wallets */

export const WALLET_IDS = ['paytm', 'phonepe', 'amazonpay', 'mobikwik'] as const
export type WalletId = (typeof WALLET_IDS)[number]

/**
 * Each wallet as its app calls it, and the company that issues it: the RBI's rules (a wallet is a
 * prepaid payment instrument) and a complaint are that company's, bank or not.
 */
export const WALLETS: Readonly<Record<WalletId, { name: string; issuer: string }>> = {
  paytm: { name: 'Paytm', issuer: 'Paytm Payments Bank Ltd' },
  phonepe: { name: 'PhonePe', issuer: 'PhonePe Pvt Ltd' },
  amazonpay: { name: 'Amazon Pay', issuer: 'Amazon Pay (India) Pvt Ltd' },
  mobikwik: { name: 'MobiKwik', issuer: 'One MobiKwik Systems Ltd' },
}

/** The wallet a wallet payment was made from (saved in `app`: an id, a package or a name), or null. */
export function walletOf(s: Pick<StuckPayment, 'rail' | 'app' | 'bank'>): WalletId | null {
  if (s.rail !== 'wallet') return null
  const app = upiAppOf(s.app)
  if (app === 'paytm' || app === 'phonepe' || app === 'amazonpay') return app
  if (/mobikwik/i.test(s.app ?? '')) return 'mobikwik'
  return s.bank?.trim().toLowerCase() === 'paytm' ? 'paytm' : null
}

/** The wallet's name for a wallet payment: one Settle knows ("Paytm"), or the one typed in ("Freecharge"). */
export function walletName(s: Pick<StuckPayment, 'rail' | 'app' | 'bank'>): string | null {
  if (s.rail !== 'wallet') return null
  const id = walletOf(s)
  if (id) return WALLETS[id].name
  const raw = s.app?.trim()
  // An Android package nobody would recognise reads worse than nothing.
  return raw && !/^[a-z0-9_]+(\.[a-z0-9_]+){2,}$/i.test(raw) ? raw : null
}

/* ------------------------------------------------------------------ the help for each rung */

/** A line of copy: its key and values. */
export interface HelpText {
  key: MessageKey
  vars?: Vars
}

export type HelpLinkKind = 'web' | 'call' | 'whatsapp'

export interface HelpLink {
  kind: HelpLinkKind
  href: string
  label: HelpText
}

export interface RaiseHelp {
  /** The sheet's title: "Raise it with your bank", "Raise it with Swiggy". */
  title: HelpText
  /** One line on what this rung is. */
  lead: HelpText
  /** Where and how, in order. */
  steps: HelpText[]
  /** The one button that takes you there (WhatsApp for the helpline, the RBI's portal…), or null. */
  channel: HelpLink | null
  /** Other ways in (a number to call, a website). */
  links: HelpLink[]
  /** What to have to hand (the Ombudsman asks for these). */
  keepReady: HelpText[]
}

export interface RaiseHelpOptions {
  /** The bank complaint is for compensation only (the money came back, late). */
  compensationOnly?: boolean
  /** The message, for links that carry it (WhatsApp). */
  message?: string
  /** YYYY-MM-DD, for the compensation in the title and the UPI help site's 45 days. */
  today?: string
}

const UPI_RAILS: ReadonlySet<StuckRail> = new Set(['upi_person', 'upi_merchant'])
const CARD_RAILS: ReadonlySet<StuckRail> = new Set(['card_online', 'card_pos', 'card_transfer'])

function inr(paise: number): string {
  return formatMoney(paise, 'INR', { trimZeros: true })
}

/** The business's name, when it's known by name. */
function businessName(s: StuckPayment): string | null {
  return merchantById(s.merchant)?.name ?? (s.party?.trim() || null)
}

function isAirline(s: StuckPayment): boolean {
  return merchantById(s.merchant)?.category === 'airline'
}

/** A UPI payment: the rail says so, or it was made in a UPI app. */
function isUpi(s: StuckPayment): boolean {
  return s.rail !== null ? UPI_RAILS.has(s.rail) : upiAppOf(s.app) !== null
}

/** A UPI payment still young enough for NPCI's UPI help site (any, when today isn't given). */
function myUpiOpen(s: StuckPayment, today?: string): boolean {
  return isUpi(s) && (!today || daysBetween(s.date, today) <= MYUPI_WINDOW_DAYS)
}

function call(number: string, label: HelpText): HelpLink {
  return { kind: 'call', href: `tel:${number.replace(/\D/g, '')}`, label }
}

/** The first step for a failed payment: the app or the bank's own route. */
function bankFirstStep(s: StuckPayment): HelpText {
  const app = upiAppOf(s.app)
  if (isUpi(s)) {
    if (app === 'gpay') return { key: 'stuckhelp.bank.app.gpay' }
    if (app === 'phonepe') return { key: 'stuckhelp.bank.app.phonepe' }
    if (app === 'paytm') return { key: 'stuckhelp.bank.app.paytm' }
    if (app) return { key: 'stuckhelp.bank.app.other', vars: { app: UPI_APP_NAMES[app] } }
    return { key: 'stuckhelp.bank.app.unknown' }
  }
  if (s.rail === 'atm') return { key: 'stuckhelp.bank.atm' }
  if (s.rail !== null && CARD_RAILS.has(s.rail)) return { key: 'stuckhelp.bank.card' }
  if (s.rail === 'wallet') {
    const name = walletName(s)
    return name ? { key: 'stuckhelp.wallet.app', vars: { name } } : { key: 'stuckhelp.bank.wallet' }
  }
  return { key: 'stuckhelp.bank.direct' }
}

/** The last line: save the complaint number, or (once it's saved) the day it was raised and what's next. */
function bankNote(s: StuckPayment, today?: string): HelpText {
  const raised = s.steps.find((x) => x.kind === 'bank')
  if (!raised) return { key: 'stuckhelp.bank.note' }
  return { key: 'stuckhelp.bank.raised', vars: { date: stuckDate(raised.date, today), ref: raised.ref ?? 'none' } }
}

function bankHelp(s: StuckPayment, opts: RaiseHelpOptions): RaiseHelp {
  const back = opts.compensationOnly === true || backInFull(s)
  const wallet = s.rail === 'wallet'
  const name = walletName(s)
  const links: HelpLink[] = []
  const app = upiAppOf(s.app)
  const myUpi = !back && myUpiOpen(s, opts.today)
  if (!back && !wallet && app === 'phonepe') links.push({ kind: 'web', href: 'https://grievance.phonepe.com/', label: { key: 'stuckhelp.link.phonepeGrievance' } })
  if (myUpi) links.push({ kind: 'web', href: MYUPI_URL, label: { key: 'stuckhelp.link.myupi' } })
  if (back) {
    const owed = opts.today ? stillOwed(s, opts.today).compensation : 0
    return {
      title: owed > 0 ? { key: 'stuckhelp.title.compensation', vars: { amount: inr(owed) } } : { key: 'stuckhelp.title.compensationAny' },
      lead: { key: wallet ? 'stuckhelp.lead.compensationWallet' : 'stuckhelp.lead.compensation' },
      steps: [{ key: wallet ? 'stuckhelp.compensation.sendWallet' : 'stuckhelp.compensation.send' }, { key: 'stuckhelp.compensation.why' }, bankNote(s, opts.today)],
      channel: null,
      links,
      keepReady: [],
    }
  }
  const steps: HelpText[] = [bankFirstStep(s), { key: wallet ? 'stuckhelp.wallet.letter' : 'stuckhelp.bank.letter' }]
  if (myUpi) steps.push({ key: 'stuckhelp.bank.myupi' })
  else if (isUpi(s)) steps.push({ key: 'stuckhelp.bank.myupiPassed' })
  steps.push(bankNote(s, opts.today))
  if (wallet) {
    return {
      title: name ? { key: 'stuckhelp.title.wallet', vars: { name } } : { key: 'stuckhelp.title.walletAny' },
      lead: { key: 'stuckhelp.lead.wallet' },
      steps,
      channel: null,
      links,
      keepReady: [],
    }
  }
  return { title: { key: 'stuckhelp.title.bank' }, lead: { key: 'stuckhelp.lead.bank' }, steps, channel: null, links, keepReady: [] }
}

function ombudsmanHelp(s: StuckPayment): RaiseHelp {
  const wallet = s.rail === 'wallet'
  const id = walletOf(s)
  const issuer = id ? WALLETS[id].issuer : walletName(s)
  const file: HelpText = !wallet
    ? { key: 'stuckhelp.ombudsman.file' }
    : issuer
      ? { key: 'stuckhelp.ombudsman.fileWallet', vars: { issuer } }
      : { key: 'stuckhelp.ombudsman.fileWalletAny' }
  return {
    title: { key: 'stuckhelp.title.ombudsman' },
    lead: { key: wallet ? 'stuckhelp.lead.ombudsmanWallet' : 'stuckhelp.lead.ombudsman' },
    steps: [
      { key: wallet ? 'stuckhelp.ombudsman.whenWallet' : 'stuckhelp.ombudsman.when' },
      file,
      { key: wallet ? 'stuckhelp.ombudsman.pasteWallet' : 'stuckhelp.ombudsman.paste' },
      { key: 'stuckhelp.ombudsman.call', vars: { phone: RBI_HELPLINE } },
    ],
    channel: { kind: 'web', href: RBI_CMS_URL, label: { key: 'stuckhelp.link.cms' } },
    links: [call(RBI_HELPLINE, { key: 'stuckhelp.link.call', vars: { phone: RBI_HELPLINE } })],
    keepReady: wallet
      ? [{ key: 'stuckhelp.ready.complaintWallet' }, { key: 'stuckhelp.ready.replyWallet' }, { key: 'stuckhelp.ready.payment' }, { key: 'stuckhelp.ready.wallet' }, { key: 'stuckhelp.ready.relief' }]
      : [{ key: 'stuckhelp.ready.complaint' }, { key: 'stuckhelp.ready.reply' }, { key: 'stuckhelp.ready.payment' }, { key: 'stuckhelp.ready.account' }, { key: 'stuckhelp.ready.relief' }],
  }
}

function merchantHelp(s: StuckPayment): RaiseHelp {
  const name = businessName(s)
  const page = s.merchant ? MERCHANT_HELP[s.merchant] : undefined
  const known = merchantById(s.merchant) !== null
  const steps: HelpText[] = [
    name ? { key: page ? 'stuckhelp.merchant.page' : 'stuckhelp.merchant.app', vars: { name } } : { key: 'stuckhelp.merchant.unknown' },
    { key: 'stuckhelp.merchant.paste' },
  ]
  if (isAirline(s)) steps.push({ key: 'stuckhelp.rule.dgca' })
  else if (known) steps.push({ key: 'stuckhelp.rule.ecommerce' })
  steps.push({ key: isAirline(s) ? 'stuckhelp.merchant.nextAirsewa' : 'stuckhelp.merchant.nextNch' })
  const channel: HelpLink | null =
    page && name ? { kind: 'web', href: page.url, label: { key: page.kind === 'help' ? 'stuckhelp.link.merchantHelp' : 'stuckhelp.link.merchantRefunds', vars: { name } } } : null
  return {
    title: name ? { key: 'stuckhelp.title.merchant', vars: { name } } : { key: 'stuckhelp.title.merchantAny' },
    lead: { key: 'stuckhelp.lead.merchant' },
    steps,
    channel,
    links: [],
    keepReady: [],
  }
}

function nchHelp(s: StuckPayment, opts: RaiseHelpOptions): RaiseHelp {
  const name = businessName(s)
  return {
    title: { key: 'stuckhelp.title.nch' },
    lead: { key: 'stuckhelp.lead.nch' },
    steps: [
      { key: 'stuckhelp.nch.send', vars: { whatsapp: '+91 88000 01915', phone: NCH_PHONE, tollFree: NCH_TOLL_FREE } },
      name ? { key: 'stuckhelp.nch.docket', vars: { name } } : { key: 'stuckhelp.nch.docketAny' },
      { key: 'stuckhelp.nch.next' },
    ],
    channel: { kind: 'whatsapp', href: nchWhatsAppUrl(opts.message ?? ''), label: { key: 'stuckhelp.link.whatsapp' } },
    links: [
      call(NCH_PHONE, { key: 'stuckhelp.link.call', vars: { phone: NCH_PHONE } }),
      call(NCH_TOLL_FREE, { key: 'stuckhelp.link.call', vars: { phone: NCH_TOLL_FREE } }),
      { kind: 'web', href: NCH_URL, label: { key: 'stuckhelp.link.nchSite' } },
    ],
    keepReady: [],
  }
}

function airsewaHelp(s: StuckPayment): RaiseHelp {
  const name = businessName(s)
  return {
    title: { key: 'stuckhelp.title.airsewa' },
    lead: { key: 'stuckhelp.lead.airsewa' },
    steps: [
      name ? { key: 'stuckhelp.airsewa.file', vars: { name } } : { key: 'stuckhelp.airsewa.fileAny' },
      { key: 'stuckhelp.airsewa.paste' },
      { key: 'stuckhelp.rule.dgca' },
      { key: 'stuckhelp.airsewa.note' },
    ],
    channel: { kind: 'web', href: AIRSEWA_URL, label: { key: 'stuckhelp.link.airsewa' } },
    links: [],
    keepReady: [],
  }
}

function commissionHelp(): RaiseHelp {
  return {
    title: { key: 'stuckhelp.title.commission' },
    lead: { key: 'stuckhelp.lead.commission' },
    steps: [{ key: 'stuckhelp.commission.where' }, { key: 'stuckhelp.commission.attach' }, { key: 'stuckhelp.commission.advice' }],
    channel: { kind: 'web', href: EJAGRITI_URL, label: { key: 'stuckhelp.link.ejagriti' } },
    links: [],
    keepReady: [],
  }
}

/** Where and how to raise this rung for this payment. */
export function raiseHelp(step: StuckStepKind, payment: StuckPayment, opts: RaiseHelpOptions = {}): RaiseHelp {
  switch (step) {
    case 'bank':
      return bankHelp(payment, opts)
    case 'ombudsman':
      return ombudsmanHelp(payment)
    case 'merchant':
      return merchantHelp(payment)
    case 'nch':
      return nchHelp(payment, opts)
    case 'airsewa':
      return airsewaHelp(payment)
    case 'commission':
      return commissionHelp()
  }
}

/* ------------------------------------------------------------------ the letter, in a line */

/**
 * What this rung's letter asks for, in the app's language (the letter itself stays in English):
 * "It asks for ₹500 back, and the ₹800 owed so far for the delay (₹100 a day)."
 */
export function letterSummary(step: StuckStepKind, s: StuckPayment, opts: { compensationOnly?: boolean; today: string }): HelpText {
  // A letter treats the money as gone (sending it says so), as the letter's own sums do.
  const owed = stillOwed(s.kind === 'failed' ? { ...s, confirmed: true, dismissedAt: null } : s, opts.today)
  switch (step) {
    case 'bank':
      if (s.kind === 'refund') return { key: 'stuckhelp.summary.refund', vars: { amount: inr(owed.money) } }
      if (opts.compensationOnly === true || backInFull(s))
        return owed.compensation > 0 ? { key: 'stuckhelp.summary.compensation', vars: { compensation: inr(owed.compensation) } } : { key: 'stuckhelp.summary.compensationAny' }
      return owed.compensation > 0
        ? { key: 'stuckhelp.summary.reverseOwed', vars: { amount: inr(owed.money), compensation: inr(owed.compensation) } }
        : { key: 'stuckhelp.summary.reverse', vars: { amount: inr(owed.money) } }
    case 'ombudsman': {
      const total = owed.money + owed.compensation
      return total > 0 ? { key: 'stuckhelp.summary.ombudsman', vars: { total: inr(total) } } : { key: 'stuckhelp.summary.ombudsmanAny' }
    }
    case 'merchant':
      return s.kind === 'failed' ? { key: 'stuckhelp.summary.confirm', vars: { amount: inr(s.amount) } } : { key: 'stuckhelp.summary.refund', vars: { amount: inr(owed.money) } }
    case 'nch':
      return { key: 'stuckhelp.summary.nch', vars: { amount: inr(owed.money || s.amount) } }
    case 'airsewa':
      return { key: 'stuckhelp.summary.airsewa', vars: { amount: inr(owed.money || s.amount) } }
    case 'commission':
      return { key: 'stuckhelp.summary.commission', vars: { amount: inr(owed.money + owed.compensation || s.amount) } }
  }
}
