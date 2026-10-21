/**
 * Settling up: once someone has paid the whole bill, everyone else owes them their share.
 * Pure helpers on top of `computeSplit`'s result.
 */
import type { Minor, Person } from '../types'
import type { SplitResult } from './split'

export interface Debt {
  person: Person
  /** What this person owes the payer (their full share of the bill, ≥ 0 when paid ≥ 0). */
  owes: Minor
}

export interface Settlement {
  payer: Person
  /** What the payer handed over for the whole bill. */
  paid: Minor
  /** The payer's own share of the bill. */
  payerShare: Minor
  /** What the others owe the payer in total. Always equals the sum of `debts`. */
  getsBack: Minor
  /** Everyone except the payer, in people order — including anyone who owes nothing. */
  debts: Debt[]
}

/** Who owes the payer what. Null when nobody (or someone not on the bill) is chosen as payer. */
export function settleUp(result: SplitResult, payerId: string | null | undefined): Settlement | null {
  if (!payerId) return null
  const payerSplit = result.people.find((p) => p.person.id === payerId)
  if (!payerSplit) return null
  const debts: Debt[] = []
  let getsBack = 0
  for (const split of result.people) {
    if (split.person.id === payerId) continue
    debts.push({ person: split.person, owes: split.total })
    getsBack += split.total
  }
  return {
    payer: payerSplit.person,
    paid: result.paid,
    payerShare: payerSplit.total,
    getsBack,
    debts,
  }
}

/** What `personId` owes the payer; null for the payer themself, unknown people or no settlement. */
export function owedBy(settlement: Settlement | null, personId: string): Minor | null {
  if (!settlement) return null
  return settlement.debts.find((d) => d.person.id === personId)?.owes ?? null
}

/** Debts that actually need paying (amount > 0), in people order. */
export function openDebts(settlement: Settlement | null): Debt[] {
  return settlement ? settlement.debts.filter((d) => d.owes > 0) : []
}
