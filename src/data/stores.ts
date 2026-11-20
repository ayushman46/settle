/** The persisted collections. One localStorage key each, versioned. */
import * as z from 'zod/mini'
import type { ClaimRound, Expense, Friend, Group, Pool, Profile, RecurringTemplate } from '../domain/types'
import {
  claimRoundsSchema,
  defaultProfile,
  expensesSchema,
  friendsSchema,
  groupsSchema,
  meFriend,
  poolsSchema,
  profileSchema,
  recurringListSchema,
  withMe,
} from './schemas'
import { isIsoDate } from '../engine/dates'
import { createStore, type ZodType } from './store'

export const STORAGE_VERSION = 1

export const STORAGE_KEYS = {
  profile: 'settle.v3.profile',
  friends: 'settle.v3.friends',
  expenses: 'settle.v3.expenses',
  groups: 'settle.v3.groups',
  recurring: 'settle.v3.recurring',
  claims: 'settle.v4.claims',
  pools: 'settle.v4.pools',
  /** Payment references marked paid from UPI screenshots (src/features/proof). Keeps the name it was written under. */
  proofRefs: 'settle-proof-refs',
  /** Bank names confirmed as your people in "Who's paid?" (src/features/whospaid). */
  payerAliases: 'settle.v5.payer-aliases',
  /** Reminders you've sent, for "To collect" (src/features/collect). */
  reminders: 'settle.v5.reminders',
  /** Auto-settle on Android: payments waiting for a tap, and the ones just ticked off (src/features/autosettle). */
  autoSettle: 'settle.v5.auto-settle',
  /** Money stuck with a bank or a business — failed payments and refunds still to come (src/features/stuck). */
  stuck: 'settle.v6.stuck',
  /** Stuck money's short memory of the phone's recent alerts: debits, failures, money back (src/features/stuck/track.ts). */
  stuckSeen: 'settle.v6.stuck-seen',
  /** Your mobile, city and address for complaint letters, and where each one's letters go (src/features/stuck/letterMe.ts). Not in backups. */
  letterMe: 'settle.v7.letter-me',
  /** Bank charges: the charges read from statements and SMS, your answers, and your claims (src/features/fees/store.ts). */
  fees: 'settle.v7.fees',
  /** Shared groups: which groups this phone shares, as whom, and with which of your people (src/features/groupsync/store.ts). */
  groupSync: 'settle.v8.group-sync',
  /** Bills paid at the counter: the shop, the live list's secret, shops paid before (src/features/counter/store.ts). */
  counter: 'settle.v8.counter',
  /** The Board: a group's budget and bills said not to be duplicates, on this phone (src/features/play/store.ts). */
  play: 'settle.v8.play',
  /** v10: Why this payment? (src/features/why): Settle up explains each line; pay only who you actually owe. */
  why: 'settle.v10.why',
  /** v10: Settle Day (src/features/settleday): a group’s day of the month to clear everything. */
  settleday: 'settle.v10.settleday',
  /** v10: Settle before you leave (src/features/checkout): a trip’s last-day checklist. */
  checkout: 'settle.v10.checkout',
  /** v10: Pay in parts (src/features/kist): an instalment plan on a due. */
  kist: 'settle.v10.kist',
  /** v10: Promise to pay (src/features/promise): a date on a due. */
  promise: 'settle.v10.promise',
  /** v10: Payday-aware (src/features/payday): your payday and your friends’. */
  payday: 'settle.v10.payday',
  /** v10: Small change rule (src/features/chhutta): tiny dues called even. */
  chhutta: 'settle.v10.chhutta',
  /** v10: Refund splitter (src/features/refund): a refund goes back in the same proportions. */
  refund: 'settle.v10.refund',
  /** v10: On hold (src/features/hold): a disputed expense kept out of the balances. */
  hold: 'settle.v10.hold',
  /** v10: Paid in kind (src/features/kind): a due settled with something that isn’t money. */
  kind: 'settle.v10.kind',
  /** v10: Friend abroad (src/features/abroad): a due in their currency, their PayPal or Wise handle. */
  abroad: 'settle.v10.abroad',
  /** v10: Cash, exact notes (src/features/notes): which notes, what change. */
  notes: 'settle.v10.notes',
  /** v10: Families and couples pay as one (src/features/units): households inside a group. */
  units: 'settle.v10.units',
  /** v10: Statement (src/features/passbook): a passbook between you and a friend. */
  passbook: 'settle.v10.passbook',
  /** v10: Udhaar limit (src/features/limit): a ceiling per friend. */
  limit: 'settle.v10.limit',
  /** v10: Interest on a loan (src/features/byaaj): simple interest between friends and family. */
  byaaj: 'settle.v10.byaaj',
  /** v10: Tally (src/features/tally): doodh, tiffin, paper, dhobi, chai counted by the day. */
  tally: 'settle.v10.tally',
  /** v10: Carpool (src/features/carpool): who rode, month-end by rides. */
  carpool: 'settle.v10.carpool',
  /** v10: House help’s salary (src/features/help): salary, days off, advances, bonus. */
  help: 'settle.v10.help',
  /** v10: Committee (src/features/committee): a rotating savings group among friends. */
  committee: 'settle.v10.committee',
  /** v10: Fair rent (src/features/fairrent): rent by room and what it has. */
  fairrent: 'settle.v10.fairrent',
  /** v10: Deposit ledger (src/features/deposit): who put in what, who gets back what. */
  deposit: 'settle.v10.deposit',
  /** v10: Shared things (src/features/things): things bought together and their buy-out. */
  things: 'settle.v10.things',
  /** v10: Move-out settlement (src/features/moveout): a flatmate’s final number. */
  moveout: 'settle.v10.moveout',
  /** v10: Family pot (src/features/pot): monthly pledges for a shared cause. */
  pot: 'settle.v10.pot',
  /** v10: Subscription seats (src/features/seats): family plans shared by seat. */
  seats: 'settle.v10.seats',
  /** v10: Regulars (src/features/regulars): a regular game or night, split among those who came. */
  regulars: 'settle.v10.regulars',
  /** v10: Running tab (src/features/tab): a night out, round by round. */
  tab: 'settle.v10.tab',
  /** v10: Advance and balance (src/features/vendor): a vendor paid in parts. */
  vendor: 'settle.v10.vendor',
  /** v10: Function budget (src/features/function): a wedding or function’s money. */
  functionBudget: 'settle.v10.function',
  /** v10: Trip estimate (src/features/estimate): what a trip should cost each. */
  estimate: 'settle.v10.estimate',
  /** v10: App lock and hidden amounts (src/features/lock). */
  lock: 'settle.v10.lock',
  /** v10: Scan a friend’s QR (src/features/scanfriend): their UPI ID with no typing. */
  scanfriend: 'settle.v10.scanfriend',
  /** v10: Group health (src/features/health): how a group’s money stands. */
  health: 'settle.v10.health',
  /** v11: Nicknames you taught Settle by picking someone under a voice split (src/features/home/nicknames.ts). */
  nicknames: 'settle.v11.nicknames',
  /** v10: Paid twice? (src/features/twice): one bill paid by two people. */
  twice: 'settle.v10.twice',
  /** v10: Paid too much (src/features/credit): an overpayment kept as credit. */
  credit: 'settle.v10.credit',
  /** Chat to split: which messages of a chat are already in a group, so adding the chat again adds only what is new (src/features/chat/store.ts). */
  chat: 'settle.v9.chat',
  /** Who was on a trip from when to when, on this phone (src/features/presence/store.ts). */
  presence: 'settle.v9.presence',
  /** A group’s kitty: who holds it and what each person puts in (src/features/kitty/store.ts). */
  kitty: 'settle.v9.kitty',
  /** A group’s story: the "looks done" cards put away (src/features/wrapped/store.ts). */
  wrapped: 'settle.v9.wrapped',
  /** Pay it forward: suggestions put away (src/features/swap/store.ts). */
  swap: 'settle.v9.swap',
  /** Expense reports: the name and purpose last used (src/features/report/store.ts). */
  report: 'settle.v9.report',
  /** Who is vegetarian and who doesn’t drink (src/features/diet/store.ts). */
  diet: 'settle.v9.diet',
  /** A group’s usual split (src/features/usual/store.ts). */
  usual: 'settle.v9.usual',
  /** The shagun book: gifts given and received (src/features/shagun/store.ts). */
  shagun: 'settle.v9.shagun',
  /** Split this?: payments this phone saw leave, waiting to be split (src/features/spent/store.ts). */
  spent: 'settle.v9.spent',
} as const

/** Accepts a bare, un-enveloped value (e.g. hand-edited storage) when the schema can read it. */
function bare<T>(schema: ZodType<T>): (raw: unknown) => T | null {
  return (raw) => {
    const parsed = z.safeParse(schema, raw)
    return parsed.success ? parsed.data : null
  }
}

export const profileStore = createStore<Profile>({
  key: STORAGE_KEYS.profile,
  schema: profileSchema,
  initial: defaultProfile,
  version: STORAGE_VERSION,
  migrate: bare(profileSchema),
})

export const friendsStore = createStore<Friend[]>({
  key: STORAGE_KEYS.friends,
  schema: friendsSchema,
  initial: () => withMe([meFriend(profileStore.get().name)]),
  version: STORAGE_VERSION,
  migrate: bare(friendsSchema),
})

export const expensesStore = createStore<Expense[]>({
  key: STORAGE_KEYS.expenses,
  schema: expensesSchema,
  initial: () => [],
  version: STORAGE_VERSION,
  migrate: bare(expensesSchema),
})

export const groupsStore = createStore<Group[]>({
  key: STORAGE_KEYS.groups,
  schema: groupsSchema,
  initial: () => [],
  version: STORAGE_VERSION,
  migrate: bare(groupsSchema),
})

export const recurringStore = createStore<RecurringTemplate[]>({
  key: STORAGE_KEYS.recurring,
  schema: recurringListSchema,
  initial: () => [],
  version: STORAGE_VERSION,
  migrate: bare(recurringListSchema),
})

/** Claim rounds ("Claim your items" links sent for a bill). */
export const claimsStore = createStore<ClaimRound[]>({
  key: STORAGE_KEYS.claims,
  schema: claimRoundsSchema,
  initial: () => [],
  version: STORAGE_VERSION,
  migrate: bare(claimRoundsSchema),
})

/** Collections (chanda / pools). */
export const poolsStore = createStore<Pool[]>({
  key: STORAGE_KEYS.pools,
  schema: poolsSchema,
  initial: () => [],
  version: STORAGE_VERSION,
  migrate: bare(poolsSchema),
})

/** One UPI payment reference this phone has marked paid from a screenshot (the duplicate guard). */
export interface ProofRef {
  utr: string
  friendId: string
  amount: number
  at: number
}

export const proofRefsSchema = z.array(
  z.object({
    utr: z.string().check(z.regex(/^\d{10,22}$/)),
    friendId: z.string().check(z.minLength(1)),
    amount: z.int().check(z.positive()),
    at: z.number(),
  }),
)

/** A bank name confirmed as one of your people ("KARAN MALHOTRA" pays for Bunty), for "Who's paid?". */
export interface PayerAlias {
  /** The printed name's words, lower case ("karan malhotra"). */
  name: string
  friendId: string
  at: number
}

export const payerAliasesSchema = z.array(
  z.object({
    name: z.string().check(z.minLength(1), z.maxLength(120)),
    friendId: z.string().check(z.minLength(1)),
    at: z.number(),
  }),
)

/** Bank names you've confirmed as people. Kept on this phone; backed up with the rest. */
export const payerAliasesStore = createStore<PayerAlias[]>({
  key: STORAGE_KEYS.payerAliases,
  schema: payerAliasesSchema,
  initial: () => [],
  version: STORAGE_VERSION,
  migrate: bare(payerAliasesSchema),
})

export const REMINDER_TONES = ['friendly', 'funny', 'firm'] as const
export type ReminderTone = (typeof REMINDER_TONES)[number]

/** A reminder you sent someone who owes you: when, and in what tone. */
export interface Reminder {
  friendId: string
  at: number
  tone: ReminderTone
}

export const remindersSchema = z.array(
  z.object({
    friendId: z.string().check(z.minLength(1)),
    at: z.number(),
    tone: z.enum(REMINDER_TONES),
  }),
)

/** Reminders you've sent. Kept on this phone; backed up with the rest. */
export const remindersStore = createStore<Reminder[]>({
  key: STORAGE_KEYS.reminders,
  schema: remindersSchema,
  initial: () => [],
  version: STORAGE_VERSION,
  migrate: bare(remindersSchema),
})

/** A payment a UPI app or bank alert said arrived, as Auto-settle keeps it. */
export interface AlertCredit {
  id: string
  /** Paise. */
  amount: number
  /** YYYY-MM-DD. */
  date: string
  /** When the alert came (epoch ms). */
  at: number
  name: string | null
  vpa: string | null
  utr: string | null
}

export interface AutoSettleState {
  /** Payments that may be someone's, waiting for a tap. */
  pending: AlertCredit[]
  /** Payments already ticked off, so the same payment's second alert (the bank's SMS) isn't counted again. */
  recent: AlertCredit[]
}

const alertCreditSchema = z.object({
  id: z.string().check(z.minLength(1)),
  amount: z.int().check(z.positive()),
  date: z.string(),
  at: z.number(),
  name: z.nullable(z.string()),
  vpa: z.nullable(z.string()),
  utr: z.nullable(z.string()),
})

export const autoSettleSchema = z.object({
  pending: z.catch(z.array(alertCreditSchema), []),
  recent: z.catch(z.array(alertCreditSchema), []),
})

/** Auto-settle's working state. Kept on this phone; not in backups (it's only days old at most). */
export const autoSettleStore = createStore<AutoSettleState>({
  key: STORAGE_KEYS.autoSettle,
  schema: autoSettleSchema,
  initial: () => ({ pending: [], recent: [] }),
  version: STORAGE_VERSION,
  migrate: bare(autoSettleSchema),
})

/** The payment references already marked from screenshots. Kept on this phone; backed up with the rest. */
export const proofRefsStore = createStore<ProofRef[]>({
  key: STORAGE_KEYS.proofRefs,
  schema: proofRefsSchema,
  initial: () => [],
  version: STORAGE_VERSION,
  migrate: bare(proofRefsSchema),
})

/**
 * How the money left, for a payment that failed: it decides the RBI's deadline for putting it back
 * (src/features/stuck/rules.ts). UPI to a person and to a shop differ (T+1 against T+5).
 */
export const STUCK_RAILS = ['upi_person', 'upi_merchant', 'imps', 'card_online', 'card_pos', 'card_transfer', 'atm', 'wallet', 'nach', 'aeps'] as const
export type StuckRail = (typeof STUCK_RAILS)[number]

/** A payment that failed but took the money, or a refund a business owes you. */
export const STUCK_KINDS = ['failed', 'refund'] as const
export type StuckKind = (typeof STUCK_KINDS)[number]

/** Where you've taken it: your bank or UPI app, the RBI Ombudsman, the business, the National Consumer Helpline, a consumer commission, AirSewa. */
export const STUCK_STEP_KINDS = ['bank', 'ombudsman', 'merchant', 'nch', 'commission', 'airsewa'] as const
export type StuckStepKind = (typeof STUCK_STEP_KINDS)[number]

/** Where a stuck payment was found. */
export const STUCK_SOURCES = ['alert', 'sms', 'screenshot', 'manual'] as const
export type StuckSource = (typeof STUCK_SOURCES)[number]

/** A complaint you raised: where, on what day, and its number if you were given one. */
export interface StuckStep {
  kind: StuckStepKind
  /** YYYY-MM-DD. */
  date: string
  ref: string | null
}

/** One time money came back: the day, the part of the payment (paise) and any compensation paid then (paise). */
export interface StuckBackPart {
  /** YYYY-MM-DD. */
  date: string
  amount: number
  compensation: number
}

/**
 * The money came back: the totals (the day the last of the money came, how much, and the
 * compensation paid on top) and each part as it came. Read the parts through rules.ts backParts():
 * saved before parts were kept (or edited as one), `parts` is empty and the totals are the one part.
 */
export interface StuckBack {
  date: string
  amount: number
  compensation: number
  /** In date order (on the same day, in the order they came). Empty or missing when it was saved as totals alone. */
  parts?: StuckBackPart[]
}

/** Money a bank or a business owes you back. Kept on this phone; backed up with the rest. */
export interface StuckPayment {
  id: string
  kind: StuckKind
  /** How the money left (failed payments; null for refunds and when not known). */
  rail: StuckRail | null
  /** Who it was paid to, or who owes the refund: "Swiggy", "Riya Sharma", "IndiGo". */
  party: string | null
  /** A business Settle knows (its refund timeline and where to complain), or null. */
  merchant: string | null
  /** Paise. */
  amount: number
  /** The day the money left (T) — for a refund, the day it was promised. YYYY-MM-DD. */
  date: string
  /** The day the business said the refund would arrive by, when it said one. */
  promisedBy: string | null
  /** UPI reference (RRN/UTR), card ARN or transaction id. */
  ref: string | null
  /** The order or booking number (refunds). */
  orderId: string | null
  bank: string | null
  /** The account's last digits as printed ("XX4821"). */
  account: string | null
  app: string | null
  source: StuckSource
  /** Known to have left the account. An app saying a payment failed doesn't always mean it took the money: until then it waits for a tap. */
  confirmed: boolean
  steps: StuckStep[]
  /** The day the bank replied to the complaint or turned it down (YYYY-MM-DD): the RBI Ombudsman opens from then. */
  repliedAt: string | null
  back: StuckBack | null
  /** Not stuck after all (never left the account), or set aside: epoch ms. */
  dismissedAt: number | null
  note: string | null
  createdAt: number
  updatedAt: number
}

const isoDay = z.string().check(z.refine(isIsoDate))

const stuckBackPartSchema = z.object({ date: isoDay, amount: z.int().check(z.nonnegative()), compensation: z.int().check(z.nonnegative()) })

export const stuckSchema = z.array(
  z.object({
    id: z.string().check(z.minLength(1)),
    kind: z.enum(STUCK_KINDS),
    rail: z.catch(z.nullable(z.enum(STUCK_RAILS)), null),
    party: z.catch(z.nullable(z.string().check(z.maxLength(120))), null),
    merchant: z.catch(z.nullable(z.string().check(z.maxLength(40))), null),
    amount: z.int().check(z.positive()),
    date: isoDay,
    promisedBy: z.catch(z.nullable(isoDay), null),
    ref: z.catch(z.nullable(z.string().check(z.maxLength(40))), null),
    orderId: z.catch(z.nullable(z.string().check(z.maxLength(60))), null),
    bank: z.catch(z.nullable(z.string().check(z.maxLength(40))), null),
    account: z.catch(z.nullable(z.string().check(z.maxLength(20))), null),
    app: z.catch(z.nullable(z.string().check(z.maxLength(40))), null),
    source: z.catch(z.enum(STUCK_SOURCES), 'manual'),
    confirmed: z.catch(z.boolean(), true),
    steps: z.catch(z.array(z.object({ kind: z.enum(STUCK_STEP_KINDS), date: isoDay, ref: z.catch(z.nullable(z.string().check(z.maxLength(60))), null) })), []),
    repliedAt: z.catch(z.nullable(isoDay), null),
    back: z.catch(
      z.nullable(
        z.object({
          date: isoDay,
          amount: z.int().check(z.nonnegative()),
          compensation: z.int().check(z.nonnegative()),
          // Saved before the parts were kept: none, and the totals read as one part.
          parts: z.catch(z.array(stuckBackPartSchema).check(z.maxLength(100)), []),
        }),
      ),
      null,
    ),
    dismissedAt: z.catch(z.nullable(z.number()), null),
    note: z.catch(z.nullable(z.string().check(z.maxLength(500))), null),
    createdAt: z.number(),
    updatedAt: z.number(),
  }),
)

/** Money stuck with banks and businesses. */
export const stuckStore = createStore<StuckPayment[]>({
  key: STORAGE_KEYS.stuck,
  schema: stuckSchema,
  initial: () => [],
  version: STORAGE_VERSION,
  migrate: bare(stuckSchema),
})

/** What an alert told Stuck money: money left ('debit'), a payment failed or is pending, money came back, a refund was started. */
export const STUCK_SEEN_KINDS = ['debit', 'failed', 'pending', 'back', 'refund'] as const
export type StuckSeenKind = (typeof STUCK_SEEN_KINDS)[number]

/**
 * One alert Stuck money saw lately: enough to pair a failure with the debit that shows it took the
 * money, and to know the same payment told twice (the UPI app and the bank's SMS) as one.
 */
export interface StuckSeen {
  kind: StuckSeenKind
  /** Paise. */
  amount: number
  /** When the alert came (epoch ms). */
  at: number
  /** UPI reference, or the order number of a refund. */
  ref: string | null
  vpa: string | null
  party: string | null
  account: string | null
  /** The stuck payment it made, joined or closed, or null. */
  stuckId: string | null
}

export const stuckSeenSchema = z.array(
  z.object({
    kind: z.enum(STUCK_SEEN_KINDS),
    amount: z.int().check(z.positive()),
    at: z.number(),
    ref: z.catch(z.nullable(z.string().check(z.maxLength(60))), null),
    vpa: z.catch(z.nullable(z.string().check(z.maxLength(100))), null),
    party: z.catch(z.nullable(z.string().check(z.maxLength(120))), null),
    account: z.catch(z.nullable(z.string().check(z.maxLength(20))), null),
    stuckId: z.catch(z.nullable(z.string()), null),
  }),
)

/** Stuck money's short memory (48 hours at most). Kept on this phone; not in backups. */
export const stuckSeenStore = createStore<StuckSeen[]>({
  key: STORAGE_KEYS.stuckSeen,
  schema: stuckSeenSchema,
  initial: () => [],
  version: STORAGE_VERSION,
  migrate: bare(stuckSeenSchema),
})
