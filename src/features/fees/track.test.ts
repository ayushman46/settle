import { beforeEach, describe, expect, it } from 'vitest'
import { t } from '../../i18n'
import { answerFindings, makeClaim } from './actions'
import { feeToastMessage } from './alertToast'
import { findingsOf } from './rules'
import { emptyFees, feesStore } from './store'
import { trackChargeSms, trackFeeAlerts } from './track'

const SMS = 'com.google.android.apps.messaging'
const alert = (text: string, app = SMS, title = 'HDFC Bank') => ({ app, title, text, postedAt: Date.parse('2026-11-02T10:00:00+05:30') })

beforeEach(() => {
  localStorage.clear()
  feesStore.set(emptyFees())
})

describe('the Android app’s bank SMS', () => {
  it('a minimum-balance charge that left the balance negative: kept, wrong, and toasted', () => {
    const result = trackFeeAlerts([alert('Rs.590.00 debited from A/c XX4821 on 01-11-26 towards Non Maintenance of AMB Charges incl GST. Avl Bal INR -312.40 -HDFC Bank')], '2026-11-02')
    expect(result.added).toHaveLength(1)
    expect(result.added[0]).toMatchObject({ kind: 'minbal', amount: 50000, gst: 9000, balanceAfter: -31240, source: 'alert', bank: 'hdfc' })
    const [f] = findingsOf(feesStore.get())
    expect(f).toMatchObject({ rule: 'minbalNegative', verdict: 'wrong', claim: 31240 })
    expect(feeToastMessage(result, t)?.text).toBe('HDFC Bank took ₹590 (Minimum balance) against the RBI’s rules')
  })

  it('the bank’s low-balance warning is kept for the month the rule gives; a UPI app’s own alert is not a bank SMS', () => {
    const result = trackFeeAlerts(
      [
        alert('Dear Customer, the balance in your A/c XX4821 is below the required Monthly Average Balance of Rs.10,000. Maintain AMB to avoid charges.'),
        alert('Rs.20 debited towards SMS charges', 'com.phonepe.app', 'PhonePe'),
      ],
      '2026-11-02',
    )
    expect(result.notices).toBe(1)
    expect(result.added).toEqual([])
    expect(feesStore.get().notices).toEqual([{ date: '2026-11-02', bank: null, account: 'XX4821' }])
  })

  it('a reversal is noted on the charge it puts back', () => {
    trackFeeAlerts([alert('Rs.590.00 debited from A/c XX4821 on 01-11-26 towards Non Maintenance of AMB Charges incl GST. -HDFC Bank')], '2026-11-02')
    const back = trackFeeAlerts([alert('Rs 590 credited to your A/c XX4821 on 05-11-26 towards reversal of AMB charges. -HDFC Bank')], '2026-11-05')
    expect(back.reversed).toBe(1)
    expect(feesStore.get().charges[0]?.reversed).toBe(59000)
    expect(feeToastMessage(back, t)).toEqual({ text: '₹590 of a bank charge was put back', good: true })
  })

  it('a reversal dated after today hasn’t happened yet', () => {
    trackChargeSms(['Rs.590.00 debited from A/c XX4821 on 01-11-26 towards Non Maintenance of AMB Charges incl GST. -HDFC Bank'], 'sms', '2026-11-03')
    const back = trackChargeSms(['Rs 590 credited to your A/c XX4821 on 05-11-26 towards reversal of AMB charges. -HDFC Bank'], 'sms', '2026-11-03')
    expect(back.reversed).toBe(0)
    expect(feesStore.get().charges[0]?.reversed).toBe(0)
  })

  it('the same reversal read twice is put back once', () => {
    trackChargeSms(['Rs.590.00 debited from A/c XX4821 on 01-11-26 towards Non Maintenance of AMB Charges incl GST. -HDFC Bank'], 'sms', '2026-11-03')
    const reversal = 'Rs.300.00 credited to A/c XX4821 on 03-11-26 towards reversal of AMB Charges. -HDFC Bank'
    expect(trackChargeSms([reversal], 'sms', '2026-11-03').reversed).toBe(1)
    const again = trackChargeSms([reversal], 'sms', '2026-11-03')
    expect(again).toMatchObject({ reversed: 0, known: 1 })
    expect(feesStore.get().charges[0]?.reversed).toBe(300_00)
    // The rest, when it comes, still counts.
    expect(trackChargeSms(['Rs 290.00 credited to your A/c XX4821 on 03-11-26 towards reversal of AMB charges. -HDFC Bank'], 'sms', '2026-11-03').reversed).toBe(1)
    expect(feesStore.get().charges[0]?.reversed).toBe(590_00)
  })

  it('a claim not sent yet takes in what a later answer adds', () => {
    trackChargeSms(['Rs.590.00 debited from A/c XX4821 on 01-11-26 towards Non Maintenance of AMB Charges incl GST. Avl Bal INR -312.40 -HDFC Bank'], 'sms', '2026-11-03')
    const [firm] = findingsOf(feesStore.get())
    expect(firm?.verdict).toBe('wrong')
    expect(firm?.upgrade).not.toBeNull()
    const { claim } = makeClaim('hdfc', 'XX4821', [firm?.charge.id ?? ''], firm?.claim ?? 0)
    answerFindings([firm?.upgrade?.key ?? ''], true)
    expect(feesStore.get().claims.find((c) => c.id === claim.id)?.amount).toBe(590_00)
  })

  it('the same SMS read twice is one charge, and an allowed charge is kept without a toast', () => {
    const sms = alert('ICICI Bank Acct XX7712 debited with Rs 27.14 on 31-Oct-26; ATM TXN CHGS. Avl Bal Rs 3,412.10')
    trackFeeAlerts([sms], '2026-11-02')
    const again = trackFeeAlerts([sms], '2026-11-02')
    expect(feesStore.get().charges).toHaveLength(1)
    expect(again.added).toEqual([])
    expect(feeToastMessage(again, t)).toBeNull()
  })
})
