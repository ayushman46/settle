import { describe, expect, it } from 'vitest'
import type { Settlement } from './api'
import { isOpen, lineText, needsText, referenceOf, statusText } from './settlementText'

function settlement(overrides: Partial<Settlement> = {}): Settlement {
  return {
    id: 's1',
    groupId: 'g1',
    groupName: 'Goa',
    senderId: 'rahul',
    senderName: 'Rahul',
    receiverId: 'ayush',
    receiverName: 'Ayush',
    amountPaise: 50_000,
    status: 'awaiting_confirmation',
    createdAt: null,
    updatedAt: '2026-11-16T10:00:00Z',
    events: [],
    ...overrides,
  }
}

describe('settlement wording', () => {
  it('asks the receiver to confirm, and tells the payer who it waits on', () => {
    expect(needsText(settlement(), 'ayush')).toBe('Rahul says they paid you ₹500.00')
    expect(needsText(settlement(), 'rahul')).toBe('Waiting for Ayush to confirm ₹500.00')
    expect(needsText(settlement({ status: 'disputed' }), 'rahul')).toBe('Ayush hasn’t received your ₹500.00')
    expect(needsText(settlement({ status: 'failed' }), 'rahul')).toBe('Finish paying Ayush ₹500.00')
  })

  it('says "you" on your own side of a payment', () => {
    expect(statusText(settlement({ status: 'confirmed' }), 'ayush')).toBe('Confirmed by you')
    expect(statusText(settlement({ status: 'confirmed' }), 'rahul')).toBe('Confirmed by Ayush')
    expect(lineText(settlement(), 'rahul')).toBe('You → Ayush')
    expect(lineText(settlement(), 'ayush')).toBe('Rahul → you')
    expect(lineText(settlement(), 'sam')).toBe('Rahul → Ayush')
  })

  it('finds the latest UPI reference and knows which payments are still open', () => {
    const s = settlement({
      events: [
        { type: 'sent', from: 'initiated', to: 'awaiting_confirmation', actorId: 'rahul', at: '1', data: { transaction_reference: '111' } },
        { type: 'sent', from: 'disputed', to: 'awaiting_confirmation', actorId: 'rahul', at: '2', data: { transaction_reference: '222' } },
      ],
    })
    expect(referenceOf(s)).toBe('222')
    expect(referenceOf(settlement())).toBeNull()
    expect(isOpen(settlement({ status: 'disputed' }))).toBe(true)
    expect(isOpen(settlement({ status: 'confirmed' }))).toBe(false)
    expect(isOpen(settlement({ status: 'cancelled' }))).toBe(false)
  })
})
