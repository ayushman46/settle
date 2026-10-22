import { describe, expect, it } from 'vitest'
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
      'useCountUp',
      'useMediaQuery',
    ]) {
      expect(kitB, name).toHaveProperty(name, expect.any(Function))
    }
  })
})
