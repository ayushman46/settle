/**
 * What Bank charges keeps (src/features/fees): the charges your bank took — read from a statement,
 * a bank SMS, or (in the Android app) its alerts — each with what was around it when it was taken
 * (the balance before and after, the ATM withdrawals that month, the transfer it was charged on),
 * your answers about the account, and each claim you made: the letter sent, the bank's reply, the
 * RBI Ombudsman, the money back. Only charge lines are kept, never the rest of the statement.
 * Kept on this phone; backed up with the rest.
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { isIsoDate } from '../../engine/dates'
import { FEE_KINDS, type FeeKind } from './kinds'

export const FEES_KEY = STORAGE_KEYS.fees

/** Where a charge was seen. */
export const FEE_SOURCES = ['statement', 'sms', 'alert'] as const
export type FeeSource = (typeof FEE_SOURCES)[number]

/** What kind of savings account the charges are on (it decides whether a minimum balance applies at all). */
/** basic: a Basic Savings (BSBD) or Jan Dhan account; scholarship: one a government scholarship is paid into; minor: a child's. */
export const ACCOUNT_TYPES = ['regular', 'basic', 'scholarship', 'minor', 'salary', 'senior', 'unknown'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

/** One charge the bank took. */
export interface FeeCharge {
  id: string
  /** YYYY-MM-DD. */
  date: string
  kind: FeeKind
  /** Paise, without its GST. */
  amount: number
  /** The GST charged on it (paise), when a separate line shows it. */
  gst: number
  /** Put back already (paise, GST included). */
  reversed: number
  /** The narration or SMS line, as printed (shortened). */
  text: string
  /** The bank (src/features/sharein/sms/brands.ts BankId), when known. */
  bank: string | null
  /** The account's last digits as printed ("XX4821"). */
  account: string | null
  /** Paise: the balance just before the charge and just after (GST included), when known. */
  balanceBefore: number | null
  balanceAfter: number | null
  /** ATM charges: the ATM withdrawals in that calendar month up to and including the one charged, when a statement showed them. */
  monthAtm: number | null
  /** An ATM charge on a withdrawal that was reversed (it failed). */
  onFailed: boolean
  /** A NEFT or RTGS charge on a transfer sent from net or mobile banking (true), at a branch (false), or not known (null). */
  online: boolean | null
  /**
   * Minimum-balance charges: the average balance a statement showed for the period the charge is
   * most likely for (the month before one taken in the first half of a month, else that month;
   * the quarter before for a quarterly one), when the statement covered all of it.
   */
  avg: { period: string; balance: number } | null
  /** Days since the last transaction you made (not interest, not a charge) before this charge, when a statement reached back that far. */
  idleDays: number | null
  /** Withdrawals that month (cash at the branch or any ATM, cheques; not UPI, IMPS, NEFT, RTGS or card payments): for basic accounts' four free ones. */
  monthWithdrawals: number | null
  source: FeeSource
  addedAt: number
}

/** Your answers about the account, per bank (`bank:account`, or `*` for all). */
export interface FeeAccount {
  type: AccountType
  /** The average balance the account must keep (paise), when you said. */
  mab: number | null
}

/** A complaint raised on some charges. */
export interface FeeStep {
  kind: 'bank' | 'ombudsman'
  date: string
  ref: string | null
}

/** The charges you asked one bank to put back, and how it's going. */
export interface FeeClaim {
  id: string
  bank: string | null
  account: string | null
  /** The charges claimed (FeeCharge ids). */
  chargeIds: string[]
  /** Paise: what the claim asks for. */
  amount: number
  steps: FeeStep[]
  /** The bank replied or said no (YYYY-MM-DD): the RBI Ombudsman opens from then. */
  repliedAt: string | null
  /** Money put back for it. */
  back: { date: string; amount: number } | null
  dismissedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface FeesState {
  charges: FeeCharge[]
  accounts: Readonly<Record<string, FeeAccount>>
  claims: FeeClaim[]
  /** The statements read: when, what they covered and how many lines (no lines kept). */
  checks: { at: number; from: string; to: string; bank: string | null; account: string | null; lines: number; charges: number }[]
  /** Findings you said were fine ("rule:chargeId"). */
  dismissed: string[]
  /**
   * Your answers to the questions findings ask, by finding key: true is the answer that makes the
   * charge wrong, false the one that makes it fine, 'unsure' a "Not sure" (the letter then asks the
   * bank to show what it relies on, rather than saying it didn't happen).
   */
  answers: Readonly<Record<string, FeeAnswer>>
  /** Your bank's warnings that the balance was short (Android, from its SMS): the day, and the account. */
  notices: { date: string; bank: string | null; account: string | null }[]
  /** ATM withdrawals a statement showed coming back after the RBI's 5 days (owed ₹100 a day): kept until claimed in Stuck money. */
  late: LateRefund[]
}

export type FeeAnswer = boolean | 'unsure'

/** An ATM withdrawal that failed and came back late. */
export interface LateRefund {
  date: string
  backOn: string
  amount: number
  text: string
  bank: string | null
  account: string | null
  /** Claimed in Stuck money (the stuck payment's id), or null. */
  stuckId: string | null
}

/** Enough for years of charges; the oldest go first. */
export const MAX_CHARGES = 1500
export const MAX_CLAIMS = 200

const isoDay = z.string().check(z.refine(isIsoDate))
const paise = z.int().check(z.nonnegative())
const signed = z.int()

const chargeSchema = z.object({
  id: z.string().check(z.minLength(1), z.maxLength(80)),
  date: isoDay,
  kind: z.enum(FEE_KINDS),
  amount: z.int().check(z.positive()),
  gst: z.catch(paise, 0),
  reversed: z.catch(paise, 0),
  text: z.catch(z.string().check(z.maxLength(200)), ''),
  bank: z.catch(z.nullable(z.string().check(z.maxLength(40))), null),
  account: z.catch(z.nullable(z.string().check(z.maxLength(20))), null),
  balanceBefore: z.catch(z.nullable(signed), null),
  balanceAfter: z.catch(z.nullable(signed), null),
  monthAtm: z.catch(z.nullable(z.int().check(z.nonnegative())), null),
  onFailed: z.catch(z.boolean(), false),
  online: z.catch(z.nullable(z.boolean()), null),
  avg: z.catch(z.nullable(z.object({ period: z.string().check(z.maxLength(10)), balance: signed })), null),
  idleDays: z.catch(z.nullable(z.int().check(z.nonnegative())), null),
  monthWithdrawals: z.catch(z.nullable(z.int().check(z.nonnegative())), null),
  source: z.catch(z.enum(FEE_SOURCES), 'statement'),
  addedAt: z.number(),
})

const accountSchema = z.object({
  type: z.catch(z.enum(ACCOUNT_TYPES), 'unknown'),
  mab: z.catch(z.nullable(paise), null),
})

const claimSchema = z.object({
  id: z.string().check(z.minLength(1)),
  bank: z.catch(z.nullable(z.string().check(z.maxLength(40))), null),
  account: z.catch(z.nullable(z.string().check(z.maxLength(20))), null),
  chargeIds: z.catch(z.array(z.string().check(z.maxLength(80))).check(z.maxLength(400)), []),
  amount: z.int().check(z.positive()),
  steps: z.catch(z.array(z.object({ kind: z.enum(['bank', 'ombudsman']), date: isoDay, ref: z.catch(z.nullable(z.string().check(z.maxLength(60))), null) })), []),
  repliedAt: z.catch(z.nullable(isoDay), null),
  back: z.catch(z.nullable(z.object({ date: isoDay, amount: paise })), null),
  dismissedAt: z.catch(z.nullable(z.number()), null),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const feesSchema = z.object({
  charges: z.catch(z.array(chargeSchema).check(z.maxLength(MAX_CHARGES * 2)), []),
  accounts: z.catch(z.record(z.string().check(z.maxLength(80)), accountSchema), {}),
  claims: z.catch(z.array(claimSchema).check(z.maxLength(MAX_CLAIMS * 2)), []),
  checks: z.catch(
    z.array(
      z.object({
        at: z.number(),
        from: isoDay,
        to: isoDay,
        bank: z.catch(z.nullable(z.string().check(z.maxLength(40))), null),
        account: z.catch(z.nullable(z.string().check(z.maxLength(20))), null),
        lines: z.int().check(z.nonnegative()),
        charges: z.int().check(z.nonnegative()),
      }),
    ).check(z.maxLength(200)),
    [],
  ),
  dismissed: z.catch(z.array(z.string().check(z.maxLength(120))).check(z.maxLength(2000)), []),
  answers: z.catch(z.record(z.string().check(z.maxLength(120)), z.union([z.boolean(), z.literal('unsure')])), {}),
  notices: z.catch(
    z.array(z.object({ date: isoDay, bank: z.catch(z.nullable(z.string().check(z.maxLength(40))), null), account: z.catch(z.nullable(z.string().check(z.maxLength(20))), null) })).check(z.maxLength(500)),
    [],
  ),
  late: z.catch(
    z
      .array(
        z.object({
          date: isoDay,
          backOn: isoDay,
          amount: z.int().check(z.positive()),
          text: z.catch(z.string().check(z.maxLength(200)), ''),
          bank: z.catch(z.nullable(z.string().check(z.maxLength(40))), null),
          account: z.catch(z.nullable(z.string().check(z.maxLength(20))), null),
          stuckId: z.catch(z.nullable(z.string().check(z.maxLength(80))), null),
        }),
      )
      .check(z.maxLength(200)),
    [],
  ),
})

export const emptyFees = (): FeesState => ({ charges: [], accounts: {}, claims: [], checks: [], dismissed: [], answers: {}, notices: [], late: [] })

export const feesStore = createStore<FeesState>({
  key: FEES_KEY,
  schema: feesSchema,
  initial: emptyFees,
  version: 1,
})

export function useFees<T>(select: (state: FeesState) => T): T {
  return useStore(feesStore, select)
}

/** The key an account's answers are kept under. */
export function accountKey(bank: string | null, account: string | null): string {
  return `${bank ?? '?'}:${account ?? '?'}`
}

/** Your answers for the account `charge` is on (that account's, else the ones for all accounts, else unknown). */
export function accountOf(state: Pick<FeesState, 'accounts'>, charge: Pick<FeeCharge, 'bank' | 'account'>): FeeAccount {
  return state.accounts[accountKey(charge.bank, charge.account)] ?? state.accounts['*'] ?? { type: 'unknown', mab: null }
}

export type { FeeKind }
