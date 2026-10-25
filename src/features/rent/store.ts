/**
 * Shared rents, kept on this phone like everything else (one localStorage key, no database): the
 * flat, the landlord, the monthly rent and each flatmate's share. Payments go straight to the
 * landlord through a pay link (rentLink.ts); receipts are built from this (hra.ts).
 */
import { useCallback } from 'react'
import * as z from 'zod/mini'
import { records } from '../../data/schemas'
import { createStore, useStore } from '../../data/store'
import type { Minor } from '../../domain/types'
import { newId } from '../../lib/ids'
import { isValidUpiId, normalizeUpiId } from '../../lib/upi'
import { normalizePan, PAN_PATTERN, RENT_PAYMENT_MODES, type RentPaymentMode } from './hra'

export interface RentTenant {
  /** A friend id (`ME_ID` for you). */
  friendId: string
  /** Their part of the monthly rent, in paise. */
  share: Minor
  /** Their name as it should appear on rent receipts (their legal name), when it differs. */
  legalName?: string
}

export interface Rent {
  id: string
  createdAt: number
  updatedAt: number
  /** "Flat 302, Koramangala". */
  name: string
  /** The flat's full address, printed on receipts. */
  address: string
  landlordName: string
  /** Where the rent is paid (valid UPI ID), or null when it's paid another way. */
  landlordUpi: string | null
  /** The landlord's PAN (ABCDE1234F), or null when not known yet. */
  landlordPan: string | null
  /** The whole monthly rent, in paise: the shares add up to it exactly. */
  monthly: Minor
  /** Rent is due on this day of the month (1–28). */
  dueDay: number
  /** How the rent is usually paid (printed on receipts). */
  mode: RentPaymentMode
  tenants: RentTenant[]
}

export const RENT_KEY = 'settle.v5.rent'
export const MAX_RENTS = 20
export const MAX_TENANTS = 12
export const MAX_RENT: Minor = 50_00_000_00
const MAX_TEXT = 120
const MAX_ADDRESS = 300

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function minor(value: unknown): Minor | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_RENT ? value : null
}

/** A stored rent, tidied; null when it can't be used (no id, no landlord, shares that don't add up…). */
export function cleanRent(raw: unknown): Rent | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const id = text(r.id, 200)
  const monthly = minor(r.monthly)
  const name = text(r.name, MAX_TEXT)
  const landlordName = text(r.landlordName, MAX_TEXT)
  if (!id || !name || !landlordName || monthly === null || monthly <= 0 || !Array.isArray(r.tenants)) return null
  const seen = new Set<string>()
  const tenants: RentTenant[] = []
  for (const t of r.tenants.slice(0, MAX_TENANTS)) {
    if (typeof t !== 'object' || t === null) return null
    const friendId = text((t as Record<string, unknown>).friendId, 200)
    const share = minor((t as Record<string, unknown>).share)
    if (!friendId || share === null || seen.has(friendId)) return null
    seen.add(friendId)
    const legalName = text((t as Record<string, unknown>).legalName, MAX_TEXT)
    tenants.push(legalName ? { friendId, share, legalName } : { friendId, share })
  }
  if (tenants.length === 0 || tenants.reduce((sum, t) => sum + t.share, 0) !== monthly) return null
  const upi = typeof r.landlordUpi === 'string' ? normalizeUpiId(r.landlordUpi) : ''
  const pan = typeof r.landlordPan === 'string' ? normalizePan(r.landlordPan) : ''
  const day = typeof r.dueDay === 'number' && Number.isFinite(r.dueDay) ? Math.min(28, Math.max(1, Math.round(r.dueDay))) : 1
  return {
    id,
    createdAt: typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : 0,
    updatedAt: typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : 0,
    name,
    address: text(r.address, MAX_ADDRESS),
    landlordName,
    landlordUpi: upi && isValidUpiId(upi) ? upi : null,
    landlordPan: pan && PAN_PATTERN.test(pan) ? pan : null,
    monthly,
    dueDay: day,
    mode: (RENT_PAYMENT_MODES as readonly unknown[]).includes(r.mode) ? (r.mode as RentPaymentMode) : 'upi',
    tenants,
  }
}

const rentSchema = z.pipe(
  z.unknown(),
  z.transform((raw: unknown, ctx) => {
    const rent = cleanRent(raw)
    if (rent) return rent
    ctx.issues.push({ code: 'custom', message: 'Unusable rent', input: raw })
    return z.NEVER
  }),
)

export const rentStore = createStore<Rent[]>({
  key: RENT_KEY,
  schema: records(rentSchema, (r) => r.id, MAX_RENTS),
  initial: () => [],
  version: 1,
})

/** Most recently changed first. */
function sorted(rents: Rent[]): Rent[] {
  return [...rents].sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name))
}

export function useRents(): Rent[] {
  return useStore(rentStore, sorted, (a, b) => a.length === b.length && a.every((r, i) => r === b[i]))
}

export function useRent(id: string | null | undefined): Rent | null {
  const select = useCallback((rents: Rent[]) => (id ? (rents.find((r) => r.id === id) ?? null) : null), [id])
  return useStore(rentStore, select)
}

/** What the editor fills in. */
export type RentInput = Omit<Rent, 'id' | 'createdAt' | 'updatedAt'>

export type RentIssue = 'name' | 'landlord' | 'amount' | 'tenants' | 'shares' | 'upi' | 'pan'

/** The first thing wrong with a form, or null when it can be saved. */
export function rentIssue(input: RentInput): RentIssue | null {
  if (!text(input.name, MAX_TEXT)) return 'name'
  if (!text(input.landlordName, MAX_TEXT)) return 'landlord'
  if (!(input.monthly > 0) || input.monthly > MAX_RENT || !Number.isSafeInteger(input.monthly)) return 'amount'
  if (input.tenants.length === 0 || input.tenants.length > MAX_TENANTS) return 'tenants'
  if (input.tenants.reduce((sum, t) => sum + t.share, 0) !== input.monthly || input.tenants.some((t) => !(t.share >= 0))) return 'shares'
  if (input.landlordUpi && !isValidUpiId(input.landlordUpi)) return 'upi'
  if (input.landlordPan && !PAN_PATTERN.test(normalizePan(input.landlordPan))) return 'pan'
  return null
}

/** Saves a new rent (no `id`) or an edit; throws when `rentIssue` finds a problem. */
export function saveRent(input: RentInput, id?: string, now: number = Date.now()): Rent {
  const issue = rentIssue(input)
  if (issue) throw new Error(`rent: ${issue}`)
  const existing = id ? rentStore.get().find((r) => r.id === id) : undefined
  const rent = cleanRent({ ...input, id: existing?.id ?? newId(), createdAt: existing?.createdAt ?? now, updatedAt: now })
  if (!rent) throw new Error('rent: invalid')
  const others = rentStore.get().filter((r) => r.id !== rent.id)
  rentStore.set([rent, ...others].slice(0, MAX_RENTS))
  return rent
}

export function deleteRent(id: string): void {
  rentStore.set(rentStore.get().filter((r) => r.id !== id))
}
