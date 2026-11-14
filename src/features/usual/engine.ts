/**
 * A group's usual split: the percentages or shares a couple or a flat always uses (60 / 40, rent
 * by room size), kept per group so every new expense there can start from it. Pure helpers: does
 * a stored split still fit the group, the form state it gives, whether the form right now is it,
 * and its short label ("60 / 40", "2 : 1 : 1").
 *
 * Exact amounts are left out on purpose: ₹600 / ₹400 only fits one total, not every expense.
 */
import type { Participant } from '../../domain/types'
import { FULL_PERCENT_BPS } from '../../engine/split'

export type UsualMode = 'percent' | 'shares'

export interface UsualSplit {
  mode: UsualMode
  /** Friend → basis points (percent: 6000 = 60%) or a whole-number weight (shares). */
  inputs: Record<string, number>
  /** The day it was set, YYYY-MM-DD. */
  set: string
}

/** The form fields a usual split sets. */
export interface UsualForm {
  mode: string
  participants: readonly Participant[]
}

export const MAX_SHARE_WEIGHT = 1000

const isUsualMode = (mode: string): mode is UsualMode => mode === 'percent' || mode === 'shares'

/** The same people, order aside, nobody twice. */
export function samePeople(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a)
  return left.size === a.length && left.size === new Set(b).size && b.every((id) => left.has(id))
}

/** A shares input as its weight (nothing typed = 1, like the split itself reads it). */
function weightOf(input: number | null): number {
  return input === null ? 1 : input
}

/** The inputs as stored, or null when they don't make a whole split (not 100%, nobody with a share, odd numbers). */
function inputsOf(mode: UsualMode, participants: readonly Participant[]): Record<string, number> | null {
  const inputs: Record<string, number> = {}
  for (const p of participants) {
    const value = mode === 'shares' ? weightOf(p.input) : (p.input ?? 0)
    if (!Number.isSafeInteger(value) || value < 0) return null
    if (mode === 'shares' && value > MAX_SHARE_WEIGHT) return null
    inputs[p.friendId] = value
  }
  const sum = Object.values(inputs).reduce((s, v) => s + v, 0)
  if (mode === 'percent' && sum !== FULL_PERCENT_BPS) return null
  if (mode === 'shares' && sum <= 0) return null
  return inputs
}

/** True when a stored split is complete and well formed (what the store keeps). */
export function isValidUsual(usual: Pick<UsualSplit, 'mode' | 'inputs'>): boolean {
  const participants = Object.entries(usual.inputs).map(([friendId, input]) => ({ friendId, input }))
  return participants.length > 0 && inputsOf(usual.mode, participants) !== null
}

/**
 * The usual split this form would make, or null when it can't be one: not percentages or shares,
 * not exactly the group's members, or not adding up yet.
 */
export function usualFromForm(form: UsualForm, memberIds: readonly string[], today: string): UsualSplit | null {
  if (!isUsualMode(form.mode) || memberIds.length < 2) return null
  const ids = form.participants.map((p) => p.friendId)
  if (!samePeople(ids, memberIds)) return null
  const inputs = inputsOf(form.mode, form.participants)
  return inputs ? { mode: form.mode, inputs, set: today } : null
}

/** True when the stored split is for exactly the group's members as they are now. */
export function usualFits(usual: UsualSplit, memberIds: readonly string[]): boolean {
  return samePeople(Object.keys(usual.inputs), memberIds)
}

/** The form's mode and people for `usual`, in the group's member order. Null when it no longer fits. */
export function formFromUsual(usual: UsualSplit, memberIds: readonly string[]): { mode: UsualMode; participants: Participant[] } | null {
  if (!usualFits(usual, memberIds)) return null
  return { mode: usual.mode, participants: memberIds.map((friendId) => ({ friendId, input: usual.inputs[friendId] ?? null })) }
}

/**
 * For a usual split made for different people: the members as they are now, keeping what each
 * one still here had and leaving newcomers blank (for percentages) or at one share, so only the
 * gap needs filling in.
 */
export function formFromStaleUsual(usual: UsualSplit, memberIds: readonly string[]): { mode: UsualMode; participants: Participant[] } {
  return {
    mode: usual.mode,
    participants: memberIds.map((friendId) => ({
      friendId,
      input: Object.hasOwn(usual.inputs, friendId) ? (usual.inputs[friendId] ?? null) : null,
    })),
  }
}

/** True when the form is set to exactly this usual split right now. */
export function matchesUsual(form: UsualForm, usual: UsualSplit): boolean {
  if (form.mode !== usual.mode) return false
  const ids = form.participants.map((p) => p.friendId)
  if (!samePeople(ids, Object.keys(usual.inputs))) return false
  return form.participants.every((p) => {
    const stored = usual.inputs[p.friendId]
    const typed = usual.mode === 'shares' ? weightOf(p.input) : p.input
    return typed === stored
  })
}

/** A percentage in basis points as people write it: 6000 → "60", 3333 → "33.33", 1250 → "12.5". */
function percentText(bps: number): string {
  const whole = Math.floor(bps / 100)
  const rest = bps % 100
  if (rest === 0) return String(whole)
  return `${whole}.${String(rest).padStart(2, '0').replace(/0$/, '')}`
}

/** The short label: "60 / 40", "33.33 / 33.33 / 33.34", "2 : 1 : 1", in the order given (the group's). */
export function usualLabel(usual: Pick<UsualSplit, 'mode' | 'inputs'>, order: readonly string[] = Object.keys(usual.inputs)): string {
  const ids = [...order.filter((id) => Object.hasOwn(usual.inputs, id)), ...Object.keys(usual.inputs).filter((id) => !order.includes(id))]
  const values = ids.map((id) => usual.inputs[id] ?? 0)
  return usual.mode === 'percent' ? values.map(percentText).join(' / ') : values.join(' : ')
}

/** Each person's part, for reading out: [["me", "60%"], ["riya", "40%"]] or [["a", "2 shares"]…] as numbers. */
export function usualParts(usual: Pick<UsualSplit, 'mode' | 'inputs'>, order: readonly string[]): Array<{ friendId: string; value: string }> {
  const ids = [...order.filter((id) => Object.hasOwn(usual.inputs, id)), ...Object.keys(usual.inputs).filter((id) => !order.includes(id))]
  return ids.map((friendId) => {
    const value = usual.inputs[friendId] ?? 0
    return { friendId, value: usual.mode === 'percent' ? percentText(value) : String(value) }
  })
}

/** The fields of a split form a usual split can change. */
export interface ApplicableForm {
  mode: string
  participants: Participant[]
}

/**
 * `form` set to `usual`, when it is still the untouched default for the group: split equally,
 * nothing typed, exactly the group's members. Anything else (and a usual split made for other
 * people) is left as it is.
 */
export function applyUsual<F extends ApplicableForm>(form: F, usual: UsualSplit | null, memberIds: readonly string[]): F {
  if (!usual || form.mode !== 'equal' || form.participants.some((p) => p.input !== null)) return form
  if (!samePeople(form.participants.map((p) => p.friendId), memberIds)) return form
  const next = formFromUsual(usual, memberIds)
  if (!next) return form
  // Keep the people in the order the form has them.
  const order = form.participants.map((p) => p.friendId)
  const participants = order.map((friendId) => next.participants.find((p) => p.friendId === friendId) ?? { friendId, input: null })
  return { ...form, mode: next.mode, participants } as F
}
