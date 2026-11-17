/**
 * Settle accounts on the phone: one call to `/api/cloud/*` (server/cloud.ts → the `settle-api`
 * Edge Function). The session lives in an HttpOnly cookie this code never sees. Every call
 * resolves to a value — `{ ok: true, data }` or `{ ok: false, code, message }` — never throws.
 */
import type { SettlementStatus, SplitMethod } from '../../../shared/cloud'
import { isOffline, isRecord } from '../../api/http'
import { t } from '../../i18n'

export interface Passkey {
  id: string
  /** The WebAuthn credential ID, to tell the phone's password manager when it's removed. */
  credentialId: string
  nickname: string | null
  /** The password manager that holds it ("Google Password Manager"), when it says. */
  provider: string | null
  /** The passkey this session signed in with. */
  current: boolean
  deviceType: string | null
  backedUp: boolean
  createdAt: string
  lastUsedAt: string | null
}

export type DestinationStatus = 'unverified' | 'validated' | 'verified' | 'disabled'

export interface PaymentMethod {
  id: string
  upiId: string
  displayName: string | null
  status: DestinationStatus
  source: 'typed' | 'qr'
  isDefault: boolean
  createdAt: string
}

export interface Me {
  id: string
  displayName: string
  phoneNumber: string
  phoneVerified: boolean
  createdAt: string
  passkeys: Passkey[]
  paymentMethods: PaymentMethod[]
  /** Sensitive changes work without another passkey check until then. */
  freshUntil: string
}

export interface GroupSummary {
  id: string
  name: string
  role: 'owner' | 'member'
  updatedAt: string
  net: number
  members: number
}

export interface SettlementEvent {
  type: string
  from: SettlementStatus | null
  to: SettlementStatus | null
  actorId: string | null
  at: string
  data: Record<string, unknown>
}

export interface Settlement {
  id: string
  groupId: string
  groupName: string | null
  senderId: string
  senderName: string
  receiverId: string
  receiverName: string
  amountPaise: number
  status: SettlementStatus
  createdAt: string | null
  updatedAt: string
  events: SettlementEvent[]
}

export interface Dashboard {
  owe: number
  owed: number
  net: number
  groups: GroupSummary[]
  open: Settlement[]
}

export interface Member {
  userId: string
  displayName: string
  role: 'owner' | 'member'
  joinedAt: string
  active: boolean
  hasUpi: boolean
}

export interface Balance {
  userId: string
  net: number
  openOut: number
  openIn: number
}

export interface CloudExpense {
  id: string
  payerId: string
  amountPaise: number
  description: string
  category: string | null
  method: SplitMethod
  createdBy: string
  createdAt: string
  updatedAt: string
  splits: Array<{ userId: string; sharePaise: number }>
}

export interface GroupDetail {
  group: { id: string; name: string; createdAt: string; updatedAt: string }
  me: string
  myRole: 'owner' | 'member'
  members: Member[]
  balances: Balance[]
  transfers: Array<{ from: string; to: string; amountPaise: number }>
  expenses: CloudExpense[]
  settlements: Settlement[]
}

export interface PayTicket {
  attemptId: string
  upiId: string
  payeeName: string
  amountPaise: number
  note: string
  upiUri: string
}

export type CloudResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string; message: string }

const TIMEOUT_MS = 25_000

export async function cloud<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<CloudResult<T>> {
  if (isOffline()) return { ok: false, status: 0, code: 'offline', message: t('account.error.offline') }
  let res: Response
  try {
    res = await fetch(`/api/cloud${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'x-settle-csrf': '1', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    return { ok: false, status: 0, code: 'network', message: t('account.error.network') }
  }
  let parsed: unknown = null
  try {
    parsed = await res.json()
  } catch {
    // The server always answers JSON; anything else is a proxy's error page.
  }
  if (res.ok) return { ok: true, data: parsed as T }
  const error = isRecord(parsed) && isRecord(parsed.error) ? parsed.error : null
  return {
    ok: false,
    status: res.status,
    code: typeof error?.code === 'string' ? error.code : 'internal',
    message: typeof error?.message === 'string' ? error.message : t('account.error.generic'),
  }
}

/** A fresh key for one payment tap, so a retried request can never become a second payment. */
export function idempotencyKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
