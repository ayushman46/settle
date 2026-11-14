import { describe, expect, it } from 'vitest'
import { ME_ID, type Friend } from '../../domain/types'
import { payQueue, queueTotal } from './engine'

const friend = (id: string, name: string, upiId: string | null = null): Friend => ({ id, name, upiId, color: 0 }) as unknown as Friend

const people = {
  [ME_ID]: friend(ME_ID, 'Ayush'),
  sam: friend('sam', 'Sam', 'sam@okaxis'),
  riya: friend('riya', 'Riya'),
  asha: friend('asha', 'Asha', 'not a upi id'),
  dev: friend('dev', 'Dev'),
}

describe('payQueue', () => {
  it('lists everyone you owe, the largest first, with whether a UPI ID is saved', () => {
    const queue = payQueue({ sam: -50_000, riya: -134_000, asha: -50_000, dev: 20_000 }, people)
    expect(queue).toEqual([
      { friendId: 'riya', name: 'Riya', amount: 134_000, hasUpi: false },
      // Same amount: by name.
      { friendId: 'asha', name: 'Asha', amount: 50_000, hasUpi: false },
      { friendId: 'sam', name: 'Sam', amount: 50_000, hasUpi: true },
    ])
    expect(queueTotal(queue)).toBe(234_000)
  })

  it('is empty when you owe nobody, and skips you and people no longer on the phone', () => {
    expect(payQueue({}, people)).toEqual([])
    expect(payQueue({ dev: 20_000 }, people)).toEqual([])
    expect(payQueue({ [ME_ID]: -10_000, gone: -10_000 }, people)).toEqual([])
  })
})
