/**
 * The split editor's pure side: percentage fields, the live "adds up?" status, round-to-whole
 * cover and the previews behind "Split the rest equally". Money maths comes from the engine.
 */
import type { Minor, Participant } from '../domain/types'
import { t } from '../i18n'
import {
  FULL_PERCENT_BPS,
  hadSum,
  isValidTotal,
  splitAmount,
  splitRestEqually,
  uniqueParticipants,
  type AmountSplitInput,
  type AmountSplitMode,
  type AmountSplitResult,
} from '../engine/split'
import { formatPercent } from '../lib/format'
import { cleanAmountText, formatMoney } from '../lib/money'

/* ------------------------------------------------------------------ percentages */

/** Most decimals a percentage can have (basis points: 33.33%). */
export const PERCENT_DECIMALS = 2

/**
 * Tidies a percentage as it's typed: digits (any script, like money fields) and one separator
 * (`.` or `,`, as typed), at most two decimals and three whole digits, no leading zeros.
 * "033.333" → "33.33".
 */
export function cleanPercentText(text: string): string {
  // Same keystroke rules as amounts with two decimals; then at most three whole digits.
  const clean = cleanAmountText(text, 'USD')
  const match = /^(\d*)([.,]?)(\d*)$/.exec(clean)
  if (!match) return ''
  const [, whole = '', separator = '', fraction = ''] = match
  return `${whole.slice(0, 3)}${separator}${fraction.slice(0, PERCENT_DECIMALS)}`
}

/** A typed percentage in basis points ("12.5" → 1250, "33,33" → 3333); null when nothing is typed. */
export function parsePercentText(text: string): number | null {
  const clean = cleanPercentText(text)
  if (!/\d/.test(clean)) return null
  const [whole = '', fraction = ''] = clean.split(/[.,]/)
  return Number(whole || '0') * 100 + Number(fraction.padEnd(PERCENT_DECIMALS, '0') || '0')
}

/** Basis points as editable text: 2500 → "25", 1250 → "12.5", 3333 → "33.33"; null → "". */
export function percentText(bps: number | null): string {
  if (bps === null || !Number.isFinite(bps) || bps < 0) return ''
  const value = Math.round(bps)
  const whole = Math.floor(value / 100)
  const fraction = String(value % 100).padStart(2, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : String(whole)
}

/** Basis points for display: 3333 → "33.33%" (user locale). */
export function formatBps(bps: number): string {
  return formatPercent(bps / FULL_PERCENT_BPS, { maxFractionDigits: PERCENT_DECIMALS })
}

/* ------------------------------------------------------------------ status */

export type SplitStatusTone = 'ok' | 'pending' | 'over' | 'idle'

export interface SplitStatus {
  tone: SplitStatusTone
  /** The headline: "₹200 left to assign", "Adds up to 100%", "Adds up". */
  message: string
  /** A quieter second part: "₹800 of ₹1,000", "₹250 each", "6 shares · ₹125 a share". */
  detail: string | null
  /** How much of the total is assigned (0..1), for the meter — exact and percent modes only. */
  progress: number | null
  /** Whether "Split the rest equally" has something to hand out. */
  canSplitRest: boolean
  /** What everyone had, offered as the total when none is typed yet (had mode). */
  useTotal?: Minor
}

export interface SplitStatusInput {
  total: Minor | null
  currency: string
  mode: AmountSplitMode
  participants: readonly Participant[]
  result: AmountSplitResult
}

function money(minor: Minor, currency: string): string {
  return formatMoney(minor, currency, { trimZeros: true })
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

/** What the editor's footer says about the split right now. */
export function splitStatus({ total, currency, mode, participants, result }: SplitStatusInput): SplitStatus {
  const people = uniqueParticipants(participants)
  if (people.length === 0) {
    return { tone: 'idle', message: t('kit.split.status.pickPeople'), detail: null, progress: null, canSplitRest: false }
  }
  if (mode === 'had') return hadStatus(total, currency, people, result)
  if (!isValidTotal(total)) {
    return { tone: 'idle', message: t('kit.split.status.enterAmount'), detail: null, progress: null, canSplitRest: false }
  }

  switch (mode) {
    case 'exact': {
      const assigned = total - result.remainder
      const detail = t('kit.split.status.ofTotal', { assigned: money(assigned, currency), total: money(total, currency) })
      const progress = clamp01(assigned / total)
      if (result.remainder > 0) {
        return { tone: 'pending', message: t('kit.split.status.left', { amount: money(result.remainder, currency) }), detail, progress, canSplitRest: true }
      }
      if (result.remainder < 0) {
        return { tone: 'over', message: t('kit.split.status.over', { amount: money(-result.remainder, currency) }), detail, progress, canSplitRest: false }
      }
      return { tone: 'ok', message: t('kit.split.status.addsUp'), detail, progress, canSplitRest: false }
    }
    case 'percent': {
      const left = result.percentRemainder
      const progress = clamp01((FULL_PERCENT_BPS - left) / FULL_PERCENT_BPS)
      if (left > 0) {
        return { tone: 'pending', message: t('kit.split.status.left', { amount: formatBps(left) }), detail: t('kit.split.status.percentOf', { percent: formatBps(FULL_PERCENT_BPS - left) }), progress, canSplitRest: true }
      }
      if (left < 0) {
        return { tone: 'over', message: t('kit.split.status.percentOver', { percent: formatBps(-left) }), detail: t('kit.split.status.percentTotal', { percent: formatBps(FULL_PERCENT_BPS - left) }), progress, canSplitRest: false }
      }
      return { tone: 'ok', message: t('kit.split.status.addsUp100'), detail: null, progress, canSplitRest: false }
    }
    case 'shares': {
      if (result.issues.includes('zero_weights')) {
        return { tone: 'pending', message: t('kit.split.status.zeroShares'), detail: null, progress: null, canSplitRest: false }
      }
      // Same weights as the engine: empty = 1, anything unusable = 0.
      const count = people.reduce((sum, p) => sum + (p.input === null ? 1 : Number.isFinite(p.input) && p.input > 0 ? p.input : 0), 0)
      const perShare = total / count
      const each = Number.isInteger(perShare) ? money(perShare, currency) : t('kit.split.status.about', { amount: money(Math.round(perShare), currency) })
      const shares = Number.isInteger(count) ? String(count) : count.toFixed(1)
      return {
        tone: 'ok',
        message: t('kit.split.status.addsUp'),
        detail: t('kit.split.status.shares', { shares, count, each }),
        progress: null,
        canSplitRest: false,
      }
    }
    case 'equal':
    default: {
      const amounts = people.map((p) => result.shares[p.friendId] ?? 0)
      const low = Math.min(...amounts)
      const same = amounts.every((a) => a === low)
      return {
        tone: 'ok',
        message: t('kit.split.status.addsUp'),
        detail: same ? t('kit.split.status.each', { amount: money(low, currency) }) : t('kit.split.status.aboutEach', { amount: money(low, currency) }),
        progress: null,
        canSplitRest: false,
      }
    }
  }
}

/** Extra on top of what everyone had above this share of it looks like a missed item, not tax and tip. */
const MUCH_MORE = 0.35

/**
 * What each had: what it comes to with no total yet (offered as the total), then how the total
 * differs — tax and tip or a discount, shared in proportion.
 */
function hadStatus(total: Minor | null, currency: string, people: readonly Participant[], result: AmountSplitResult): SplitStatus {
  const none = { progress: null, canSplitRest: false }
  const sum = hadSum(people)
  if (sum <= 0 || result.issues.includes('nothing_had')) {
    return { tone: 'pending', message: t('kit.split.status.typeHad'), detail: null, ...none }
  }
  if (!isValidTotal(total)) {
    return { tone: 'pending', message: t('kit.split.status.hadComes', { amount: money(sum, currency) }), detail: t('kit.split.status.hadUseHint'), ...none, useTotal: sum }
  }
  const detail = t('kit.split.status.hadOf', { had: money(sum, currency), total: money(total, currency) })
  const diff = total - sum
  if (diff === 0) return { tone: 'ok', message: t('kit.split.status.addsUp'), detail: null, ...none }
  if (diff < 0) return { tone: 'ok', message: t('kit.split.status.hadLess', { amount: money(-diff, currency) }), detail, ...none }
  if (diff > sum * MUCH_MORE) return { tone: 'pending', message: t('kit.split.status.hadMuchMore', { amount: money(diff, currency) }), detail: t('kit.split.status.hadMuchMoreHint'), ...none }
  return { tone: 'ok', message: t('kit.split.status.hadMore', { amount: money(diff, currency) }), detail, ...none }
}

/* ------------------------------------------------------------------ helpers for the rows */

/**
 * What "Split the rest equally" would give each person who has nothing entered yet — shown as
 * their field's placeholder. Empty when there's nothing left to hand out.
 */
export function restPreview(input: AmountSplitInput): Record<string, number> {
  if (input.mode !== 'exact' && input.mode !== 'percent') return {}
  const before = uniqueParticipants(input.participants)
  const after = splitRestEqually(input)
  const out: Record<string, number> = {}
  before.forEach((p, i) => {
    const filled = after[i]?.input ?? null
    const empty = p.input === null || p.input <= 0
    if (empty && filled !== null && filled > 0) out[p.friendId] = filled
  })
  return out
}

/**
 * How much the payer takes on so everyone else pays a whole amount (round to whole): the
 * payer's rounded share minus their exact share. 0 when rounding is off or the split isn't valid.
 */
export function roundingCover(input: AmountSplitInput): Minor {
  if (!input.roundToWhole) return 0
  const rounded = splitAmount({ ...input, roundToWhole: true })
  if (!rounded.ok) return 0
  const exact = splitAmount({ ...input, roundToWhole: false })
  return (rounded.shares[input.payerId] ?? 0) - (exact.shares[input.payerId] ?? 0)
}

/** Every participant with no input — the starting point of a mode, or after "Reset". */
export function clearedInputs(participants: readonly Participant[]): Participant[] {
  return uniqueParticipants(participants).map((p) => ({ friendId: p.friendId, input: null }))
}

/** Inputs remembered for a mode, applied to whoever is in the split now (newcomers start empty). */
export function restoreInputs(participants: readonly Participant[], saved: Readonly<Record<string, number | null>> | undefined): Participant[] {
  return uniqueParticipants(participants).map((p) => ({
    friendId: p.friendId,
    input: saved && Object.hasOwn(saved, p.friendId) ? (saved[p.friendId] ?? null) : null,
  }))
}
