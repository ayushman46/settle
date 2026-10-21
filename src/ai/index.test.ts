import { describe, expect, it } from 'vitest'
import { DESCRIBE_LIMITS } from '../../shared/api'
import type { SplitPrefill } from '../data/handoff'
import type { DescribedSplit, Friend } from '../domain/types'
import * as ai from './index'

/* Compile-time checks that the public API matches the v3 contract (spec §5.5). */
const contract: {
  describeSplit: (text: string, ctx: { currency: string; people: string[]; today: string }, signal?: AbortSignal) => Promise<DescribedSplit>
  describedToPrefill: (
    d: DescribedSplit,
    ctx: { friends: Friend[]; meId: string; currency: string; addFriend: (name: string) => Friend },
  ) => SplitPrefill
} = ai

describe('the AI entry point', () => {
  it('exposes the contract', () => {
    expect(typeof contract.describeSplit).toBe('function')
    expect(typeof contract.describedToPrefill).toBe('function')
    expect(new ai.DescribeError('timeout')).toBeInstanceOf(Error)
  })

  it('coaches with examples the AI can read, within its limits', () => {
    expect(ai.DESCRIBE_EXAMPLES[0]).toBe(ai.DESCRIBE_EXAMPLE)
    expect(new Set(ai.DESCRIBE_EXAMPLES).size).toBe(ai.DESCRIBE_EXAMPLES.length)
    for (const example of ai.DESCRIBE_EXAMPLES) {
      expect(example.length).toBeLessThanOrEqual(DESCRIBE_LIMITS.maxTextChars)
      expect(example).toMatch(/\d/)
    }
  })
})
