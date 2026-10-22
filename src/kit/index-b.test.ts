import { describe, expect, it } from 'vitest'
import * as kitA from './index-a'
import * as kitB from './index-b'

describe('kit part B', () => {
  it('exports every component and helper screens build on', () => {
    for (const name of [
      'BalanceCard',
      'CollectCard',
      'ExpenseRow',
      'NudgeSheet',
      'ShareList',
      'ShareSheet',
      'TransferRow',
      'UpiIdForm',
      'UpiPaySheet',
      'balanceHeadline',
      'hasOutstanding',
      'expenseRowView',
      'pendingIds',
      'shareLines',
      'upiPaymentForShare',
      'upiPaymentForTransfer',
      'useCountUp',
      'useMediaQuery',
      'usePayLink',
    ]) {
      expect(kitB, name).toHaveProperty(name, expect.any(Function))
    }
  })

  it('shares no names with part A, so one kit index can re-export both', () => {
    const clashes = Object.keys(kitB).filter((name) => Object.hasOwn(kitA, name))
    expect(clashes).toEqual([])
  })
})
