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
