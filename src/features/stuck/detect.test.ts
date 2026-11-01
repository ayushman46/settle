/**
 * Stuck money's reader: a corpus of failed, pending, reversed and refunded payments as banks, UPI
 * apps and businesses word them (invented accounts, references and names, real layouts), the
 * messages that must never count (OTPs, offers, cashback, requests, a friend paying you), and the
 * whole SMS corpus of src/features/sharein run through it: nothing that went through is stuck.
 */
import { describe, expect, it } from 'vitest'
import { CORPUS_TODAY, SMS_CORPUS } from '../sharein/sms/corpus'
import { MERCHANT_APPS, readStuckMessage, signalToDraft, UPI_APP_IDS, type StuckSignal } from './detect'
import { merchantById } from './merchants'

/* The client tsconfig has no Node types: the two functions used are typed here (as in parseSms.test.ts). */
interface Fs {
  readFileSync: (path: string, encoding: 'utf8') => string
}
interface NodeUrl {
  fileURLToPath: (url: string) => string
}
const [FS_MODULE, URL_MODULE] = ['node:fs', 'node:url']
const { readFileSync } = (await import(/* @vite-ignore */ FS_MODULE)) as Fs
const { fileURLToPath } = (await import(/* @vite-ignore */ URL_MODULE)) as NodeUrl
const source = (path: string): string => readFileSync(fileURLToPath(new URL(path, import.meta.url).href), 'utf8')

/** Monday 2 Nov 2026, 10 am: when every notification below was posted. */
const TODAY = '2026-11-02'
const AT = new Date(2026, 10, 2, 10, 0).getTime()

const GPAY = 'com.google.android.apps.nbu.paisa.user'
const PHONEPE = 'com.phonepe.app'
const PAYTM = 'net.one97.paytm'
const BHIM = 'in.org.npci.upiapp'
const AMAZON = 'in.amazon.mShop.android.shopping'
const SWIGGY = 'in.swiggy.android'

type Expected = Partial<Record<string, unknown>> & { type: StuckSignal['type'] }
type Case = readonly [id: string, text: string, app: string | null, expected: Expected | null]

const CASES: readonly Case[] = [
  /* ------------------------------------------------------------------ failed, from the bank */
  ['bank-failed-debited', 'Rs.640.00 debited from HDFC Bank A/c XX4821 on 30-10-26 for UPI txn to SWIGGY. Txn failed at beneficiary bank; amount will be reversed by 04-11-26. UPI Ref 630412345678', null,
    { type: 'failed', amount: 64_000, party: 'Swiggy', merchant: 'swiggy', rail: 'upi_merchant', debited: true, ref: '630412345678', date: '2026-10-30', bank: 'hdfc', account: 'XX4821' }],
  ['bank-failed-auto-reversed', 'Dear SBI User, your A/c X3367 debited by 500.0 on date 29Oct26 for UPI txn Refno 630298765432 which failed. Amount will be auto-reversed. If not done by you call 1800111109 -SBI', null,
    { type: 'failed', amount: 50_000, debited: true, ref: '630298765432', date: '2026-10-29', bank: 'sbi', account: 'XX3367', rail: null }],
  ['bank-failed-maybe', 'Dear Customer, your UPI txn of Rs 1,200.00 to RIYA SHARMA on 28-Oct-26 has failed. If debited, amount will be credited back to Acct XX902 within 1 working day. UPI:630101234567 -ICICI Bank', null,
    { type: 'failed', amount: 120_000, party: 'Riya Sharma', rail: 'upi_person', debited: false, ref: '630101234567', date: '2026-10-28', bank: 'icici' }],
  ['bank-failed-vpa-person', 'Your UPI payment of Rs.2,400.00 to sam.kapoor-1@okhdfcbank failed. Any amount debited will be reversed in 48 hrs. -HDFC Bank', null,
    { type: 'failed', amount: 240_000, vpa: 'sam.kapoor-1@okhdfcbank', party: null, rail: 'upi_person', debited: false }],
  ['bank-failed-vpa-brand', 'Your request to send Rs.180.00 to rapido.bike@axisbank has failed. Amount if debited will be refunded in 48 hrs. -Kotak Bank', null,
    { type: 'failed', amount: 18_000, party: 'Rapido', merchant: 'rapido', rail: 'upi_merchant', debited: false, bank: 'kotak' }],
  ['bank-failed-imps', 'IMPS txn of Rs 5,000.00 from A/c XX9921 to A/c XX7713 failed. Rs 5,000.00 debited will be reversed within 1 working day. IMPS Ref No 630305551234 -PNB', null,
    { type: 'failed', amount: 500_000, party: null, rail: 'imps', debited: true, ref: '630305551234' }],
  ['bank-atm-not-dispensed', 'Dear Customer, cash of Rs.2,000 was not dispensed at ATM ID S1NB000123 on 31/10/26 but A/c XX3367 is debited. Amount will be reversed within 5 days. -SBI', null,
    { type: 'failed', amount: 200_000, party: null, merchant: null, rail: 'atm', debited: true, date: '2026-10-31' }],
  ['bank-atm-failed', 'Dear Customer, your transaction of Rs.1,500 at ATM failed and the amount of Rs.1,500 debited from your account will be reversed. -PNB', null,
    { type: 'failed', amount: 150_000, rail: 'atm', debited: true, party: null }],
  ['bank-card-online', 'Your HDFC Bank Credit Card xx9034 was debited for INR 1,499.00 at FLIPKART on 27-10-2026 but the transaction failed. The amount will be credited back within 5 working days.', null,
    { type: 'failed', amount: 149_900, party: 'Flipkart', merchant: 'flipkart', rail: 'card_online', debited: true, account: 'XX9034', date: '2026-10-27' }],
  ['card-failed-domain', 'Your credit card transaction of RS. 1234.56 on flipkart.com failed.', null,
    { type: 'failed', amount: 123_456, party: 'Flipkart', rail: 'card_online', debited: false }],
  ['bank-failed-shop', 'Your UPI transaction of INR 750.00 from A/c XX1234 to KRISHNA GENERAL STORE has failed. Money if debited will be refunded in 48 hrs -Canara Bank', null,
    { type: 'failed', amount: 75_000, party: 'Krishna General Store', rail: 'upi_merchant', debited: false }],
  ['bank-not-credited', 'Rs.2,000.00 debited from your A/c XX4821 on 01-11-26 but not credited to the beneficiary. UPI Ref 630511223344. It will be reversed within T+1 day. -HDFC Bank', null,
    { type: 'failed', amount: 200_000, debited: true, ref: '630511223344', date: '2026-11-01' }],

  /* ------------------------------------------------------------------ failed or pending, from UPI apps */
  ['gpay-failed', 'Payment failed\n₹500 to Riya Sharma · Any money debited will be refunded to your account within 3 working days', GPAY,
    { type: 'failed', amount: 50_000, party: 'Riya Sharma', rail: 'upi_person', debited: false, app: 'gpay', date: TODAY, at: AT }],
  ['gpay-pending', 'Payment pending\nYour payment of ₹1,250 to Swiggy is processing. If the payment is failed, the money will be credited back to your account in 5 business days', GPAY,
    { type: 'pending', amount: 125_000, party: 'Swiggy', merchant: 'swiggy', rail: 'upi_merchant', debited: false }],
  ['phonepe-deducted', 'Payment Failed\nMoney Deducted / Transaction Not Completed. ₹349 to Blinkit will be refunded to your bank account in 3-5 days. Debited from XXXXXX5810 (Axis Bank)', PHONEPE,
    { type: 'failed', amount: 34_900, party: 'Blinkit', merchant: 'blinkit', rail: 'upi_merchant', debited: true, app: 'phonepe', bank: 'axis', account: 'XX5810' }],
  ['phonepe-pending-longer', 'Payment pending\n₹2,000 to Ramesh Tea Stall. Your bank is taking longer than usual. We will update you in 30 minutes.', PHONEPE,
    { type: 'pending', amount: 200_000, party: 'Ramesh Tea Stall', rail: 'upi_merchant' }],
  ['paytm-pending', 'Payment of ₹240 to Chai Point is pending. Paytm will update the status in 48 hours. Money if debited is safe', PAYTM,
    { type: 'pending', amount: 24_000, party: 'Chai Point', rail: 'upi_merchant', debited: false, app: 'paytm' }],
  ['paytm-pending-or-failed', 'Your payment of ₹1,200 to Kabir Mehta is pending or failed. If money was debited, it will be refunded in 3-5 working days.', PAYTM,
    { type: 'failed', amount: 120_000, party: 'Kabir Mehta', rail: 'upi_person', debited: false }],
  ['bhim-failed','Transaction failed. Rs 300.00 to neha.v@okhdfcbank. UPI Ref No 630399887766. Amount if debited will be reversed.', BHIM,
    { type: 'failed', amount: 30_000, vpa: 'neha.v@okhdfcbank', rail: 'upi_person', ref: '630399887766', app: 'bhim' }],
  ['bank-pending', 'Your UPI transaction of Rs.1,500.00 to ANANYA RAO is pending with the beneficiary bank. Ref No 630588776655. Status will be updated shortly. -SBI', null,
    { type: 'pending', amount: 150_000, party: 'Ananya Rao', rail: 'upi_person', ref: '630588776655' }],
  ['bank-pending-debited', 'Dear Customer, Rs 349.00 has been debited from A/c XX5810 but the UPI transaction to BLINKIT is pending. It will be resolved within T+1 day. - Axis Bank', null,
    { type: 'pending', amount: 34_900, party: 'Blinkit', debited: true }],
  ['phonepe-bill-pending', 'Your bill payment of ₹1,180 for BESCOM is pending. We will update you in 24 hours.', PHONEPE,
    { type: 'pending', amount: 118_000, party: 'BESCOM', rail: 'upi_merchant' }],
  ['swiggy-app-failed', 'Your Swiggy payment of ₹649 failed. ₹649 debited from your account will be refunded within 5-7 business days.', SWIGGY,
    { type: 'failed', amount: 64_900, party: 'Swiggy', merchant: 'swiggy', debited: true }],

  /* ------------------------------------------------------------------ money back */
  ['bank-reversed', 'Rs 349.00 reversed to ICICI Bank Acct XX902 on 22-Oct-26 for failed UPI txn 629420551206.', null,
    { type: 'reversal', amount: 34_900, ref: '629420551206', date: '2026-10-22', account: 'XX902' }],
  ['bank-upi-rev', 'Your A/c XX4821 is credited with INR 499.00 on 01-11-26. Info: UPI-REV-630512340987. Avl Bal INR 12,000.00 -HDFC Bank', null,
    { type: 'reversal', amount: 49_900, ref: '630512340987', date: '2026-11-01' }],
  ['bank-upi-ret', 'Rs.1,000.00 credited to your A/c XX3367 on 31/10/26 towards UPI/RET/630411112222 for failed transaction. -SBI', null,
    { type: 'reversal', amount: 100_000, ref: '630411112222', date: '2026-10-31' }],
  ['bank-reversal-of-upi', 'Rs.1,200.00 credited to your A/c XX3367 on 01-11-26 towards reversal of UPI txn 630577889900. -SBI', null,
    { type: 'reversal', amount: 120_000, ref: '630577889900', date: '2026-11-01' }],
  ['bank-txn-reversed','INR 500 credited to your A/c XX1234 (transaction reversed). -Yes Bank', null,
    { type: 'reversal', amount: 50_000 }],
  ['card-reversed', 'Transaction Reversed!On HDFC Bank CREDIT Card xx5555 Amt: Rs.862.16 By AMAZON                000 On 2026-10-30:05:20:26', null,
    { type: 'reversal', amount: 86_216, party: 'Amazon', merchant: 'amazon', account: 'XX5555', date: '2026-10-30' }],
  ['neft-returned', 'Dear Customer, Your NEFT of Rs 10,000 to RAJESH KUMAR has been returned. Amount credited back to A/c XX4821 -HDFC Bank', null,
    { type: 'reversal', amount: 1_000_000, party: 'Rajesh Kumar' }],
  ['paytm-refunded-failed', 'Refund Successful\n₹240 refunded to your bank account for failed payment to Chai Point. UPI Ref No: 630399001122', PAYTM,
    { type: 'reversal', amount: 24_000, party: 'Chai Point', ref: '630399001122' }],
  ['gpay-money-back', 'Your money is back\n₹500 from your failed payment to Riya Sharma has been credited back to your account', GPAY,
    { type: 'reversal', amount: 50_000, party: 'Riya Sharma' }],
  ['bank-refund-credited', 'Refund of Rs.420.00 from ZOMATO has been credited to your HDFC Bank A/c XX4821 on 20-10-26. UPI Ref 629322117845', null,
    { type: 'refund_credited', amount: 42_000, party: 'Zomato', merchant: 'zomato', ref: '629322117845', date: '2026-10-20' }],
  ['card-refund-credited', 'Dear Customer, refund of INR 250 from Swiggy Limited Banga has been credited to your IndusInd Bank Credit Card XX1234 on 31-Oct-26 - IndusInd Bank', null,
    { type: 'refund_credited', amount: 25_000, party: 'Swiggy', merchant: 'swiggy', bank: 'indusind', date: '2026-10-31' }],
  ['card-refunded-from', 'INR 2,150 from AIRPORT LOUNGE refunded to your Kotak Credit Card x8848 on 30-Oct-2026.', null,
    { type: 'refund_credited', amount: 215_000, party: 'Airport Lounge', merchant: null }],
  ['bank-towards-refund', 'Your A/c no. 9753 is credited with INR 750.00 on 24-10-2026 towards Refund. Current Bal is INR 5,000.00 CR', null,
    { type: 'refund_credited', amount: 75_000, party: null, date: '2026-10-24' }],
  ['card-refund-from-amazon', 'Rs.899.00 credited to HDFC Bank Card XX9034 on 02-11-26 towards refund from AMAZON PAY INDIA PRIVA', null,
    { type: 'refund_credited', amount: 89_900, party: 'Amazon', merchant: 'amazon' }],
  ['swiggy-refund-credited', 'Your refund of ₹249 has been credited to your bank account', SWIGGY,
    { type: 'refund_credited', amount: 24_900, merchant: 'swiggy' }],
  ['blinkit-wallet-refund', 'Refund credited\n₹120 has been refunded to your Blinkit Money.', 'com.grofers.customerapp',
    { type: 'refund_credited', amount: 12_000, merchant: 'blinkit' }],
  ['amazon-balance-refund', 'Refund of ₹299 credited to your Amazon Pay balance for order 405-7654321-1234567', AMAZON,
    { type: 'refund_credited', amount: 29_900, merchant: 'amazon' }],

  /* ------------------------------------------------------------------ refunds a business has started */
  ['swiggy-initiated', 'Refund initiated\nYour refund of ₹249 for order #148293651 has been initiated and will be credited to your original payment method in 5-7 business days.', SWIGGY,
    { type: 'refund_initiated', amount: 24_900, party: 'Swiggy', merchant: 'swiggy', orderId: '148293651', promisedBy: '2026-11-11', date: TODAY }],
  ['zomato-processed', 'Refund processed\n₹412 for your order ID 5123987654 has been refunded to your UPI account. It may take 5-7 working days to reflect.', 'com.application.zomato',
    { type: 'refund_initiated', amount: 41_200, merchant: 'zomato', orderId: '5123987654', promisedBy: '2026-11-11' }],
  ['flipkart-initiated', 'Refund of Rs.1,299 for your order OD432198765432100 has been initiated. It will reflect in your account in 5-7 business days.', 'com.flipkart.android',
    { type: 'refund_initiated', amount: 129_900, party: 'Flipkart', orderId: 'OD432198765432100', promisedBy: '2026-11-11' }],
  ['irctc-processed', 'Refund of Rs. 1,435.60 for PNR 4521367890 (Transaction ID 100004312345) has been processed and will be credited to your account within 7 working days.', 'cris.org.in.prs.ima',
    { type: 'refund_initiated', amount: 143_560, party: 'IRCTC', merchant: 'irctc', orderId: '4521367890', ref: '100004312345', promisedBy: '2026-11-11' }],
  ['indigo-processed', 'Your refund of INR 4,500 for PNR K7XQ2M has been processed to the original form of payment. It should reflect within 7 days.', 'in.goindigo.android',
    { type: 'refund_initiated', amount: 450_000, merchant: 'indigo', orderId: 'K7XQ2M', promisedBy: '2026-11-09' }],
  ['mmt-by-date', 'Refund of ₹3,240 for Booking ID NF7A1234567890 has been initiated. Expected credit by 12 Nov 2026.', 'com.makemytrip',
    { type: 'refund_initiated', amount: 324_000, merchant: 'makemytrip', orderId: 'NF7A1234567890', promisedBy: '2026-11-12' }],
  ['amazon-issued', 'Refund issued\nYour refund of ₹899.00 for order 404-1234567-7654321 has been issued. It will be credited to your HDFC Bank card in 3-5 business days.', AMAZON,
    { type: 'refund_initiated', amount: 89_900, party: 'Amazon', merchant: 'amazon', orderId: '404-1234567-7654321', promisedBy: '2026-11-09' }],
  ['myntra-cancelled', 'Your order has been cancelled. ₹1,799 will be refunded to your original payment mode within 7 days.', 'com.myntra.android',
    { type: 'refund_initiated', amount: 179_900, merchant: 'myntra', orderId: null, promisedBy: '2026-11-09' }],
  ['swiggy-on-its-way', 'Refund of ₹500 for your order #1234 is on its way', SWIGGY,
    { type: 'refund_initiated', amount: 50_000, merchant: 'swiggy', orderId: '1234', promisedBy: null }],
  ['flipkart-approved', 'Your refund request for ₹1,299 has been approved. Amount will be credited in 5-7 business days.', 'com.flipkart.android',
    { type: 'refund_initiated', amount: 129_900, merchant: 'flipkart', promisedBy: '2026-11-11' }],
  ['bank-processed', 'Refund of INR 1,999.00 for BOOKMYSHOW has been processed to your YES BANK Card X5590 on 22-10-2026. It will reflect in 5-7 days.', null,
    { type: 'refund_initiated', amount: 199_900, party: 'BookMyShow', merchant: 'bookmyshow', date: '2026-10-22', promisedBy: '2026-10-29' }],
  ['card-refund-initiated', 'Refund initiated: Amt: Rs.3,274.66 on HDFC Bank Credit Card 1111. To receive your Refund,please update your Bank details: TnC.', null,
    { type: 'refund_initiated', amount: 327_466, party: null, merchant: null, account: 'XX1111' }],

  /* ------------------------------------------------------------------ money that left (pairing only) */
  ['hdfc-sent', 'Sent Rs.250.00\nFrom HDFC Bank A/C *4821\nTo SWIGGY\nOn 01/11/26\nRef 630512345678\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808', null,
    { type: 'debit', amount: 25_000, party: 'Swiggy', ref: '630512345678', date: '2026-11-01' }],
  ['sbi-debited', 'Dear UPI user A/C X6299 debited by 58.00 on date 01Nov26 trf to Suresh Setia Refno 630555771455-SBI', null,
    { type: 'debit', amount: 5_800, party: 'Suresh Setia', ref: '630555771455', account: 'XX6299' }],
  ['icici-debited', 'ICICI Bank Acct XX051 debited for Rs 180.00 on 31-Oct-26; DINDIGUL CAFE credited. UPI:630569174081. Call 18002662 for dispute.', null,
    { type: 'debit', amount: 18_000, party: 'Dindigul Cafe', ref: '630569174081' }],
  ['kotak-sent', 'Sent Rs.51.00 from XXXXXX9722 to DINESH KUMAR on 30/10/2026. UPI ref no. 630404626824. Not you? Call 18602662666 -Kotak', null,
    { type: 'debit', amount: 5_100, ref: '630404626824', date: '2026-10-30' }],
  ['atm-maybe-reversed', 'INR 2,000 debited from A/c XX1234 for ATM withdrawal on 30-10-26. If cash is not dispensed, amount will be reversed within 24 hours.', null,
    { type: 'debit', amount: 200_000 }],
  ['fee-processing', 'Processing fee of Rs.499 debited from A/c XX4821 for your loan. -HDFC Bank', null, { type: 'debit', amount: 49_900 }],

  /* ------------------------------------------------------------------ went through (only to clear a pending one) */
  ['gpay-paid', 'Payment successful\n₹1,049 paid to BigBasket\nUPI Ref: 629315542103', GPAY, { type: 'success', amount: 104_900, party: 'BigBasket', ref: '629315542103', app: 'gpay' }],
  ['gpay-paid-person', '₹500 paid to Riya Sharma\nUPI transaction ID: 630611112299', GPAY, { type: 'success', amount: 50_000, party: 'Riya Sharma', ref: '630611112299' }],
  ['phonepe-sent', '₹500 sent to Riya Sharma', PHONEPE, { type: 'success', amount: 50_000, party: 'Riya Sharma', app: 'phonepe' }],
  ['paytm-successful', 'Your payment of ₹500 to Swiggy is successful', PAYTM, { type: 'success', amount: 50_000, party: 'Swiggy' }],
  ['bhim-successful', 'Payment of Rs 320.00 to annapoorna.mess@sbi is successful. UPI Ref No: 630421771088. -BHIM', null,
    { type: 'success', amount: 32_000, vpa: 'annapoorna.mess@sbi', ref: '630421771088', app: 'bhim' }],

  /* ------------------------------------------------------------------ never anything */
  ['otp', '481923 is your OTP for UPI refund of Rs.250.00 at SWIGGY. Do not share it with anyone', null, null],
  ['promo-cashback', 'Get ₹100 cashback on your first UPI payment! Pay now on PhonePe.', PHONEPE, null],
  ['promo-refunds', 'Big Billion Days Sale! Up to ₹5,000 off + instant refunds. Shop now', 'com.flipkart.android', null],
  ['promo-won', 'Congratulations! You have won a ₹500 refund voucher. Claim it today', null, null],
  ['scratch-card', 'You won a scratch card worth ₹10 for your payment to Swiggy', GPAY, null],
  ['cashback-credited', 'Dear Customer, Cashback of Rs.50.00 has been credited to your A/c XX902 on 01-Nov-26 for your UPI payment. -ICICI Bank', null, null],
  ['cashback-reversed', 'Cashback of ₹25 reversed due to order cancellation', PHONEPE, null],
  ['friend-paid-you', 'Riya Sharma paid you ₹420', GPAY, null],
  ['friend-received', 'Received Rs.350.00 in your Kotak Bank AC X7702 from neha.v@okhdfcbank on 01-11-26.UPI Ref:630504112890.', null, null],
  ['incoming-failed', 'Payment of ₹500 from Kabir Mehta failed. Ask them to try again.', GPAY, null],
  ['request', 'Riya Sharma requested ₹450\nPay now', GPAY, null],
  ['collect-pending', 'Collect request of Rs.2,500.00 from rentals.pg@ybl is pending. Pay before it expires. -HDFC Bank', null, null],
  ['refund-request-asked', 'Riya has requested a refund of ₹500 for "Movie tickets"', null, null],
  ['refund-request-raised', 'Refund request of ₹1,299 raised for order OD123456789012345. We will review it in 2 days.', 'com.flipkart.android', null],
  ['autopay-setup', 'Dear Customer, your UPI AutoPay mandate for Rs 649.00 towards NETFLIX is created successfully. It will be debited monthly from Acct XX902. -ICICI Bank', null, null],
  ['autopay-setup-failed', 'UPI AutoPay mandate creation for Rs 649 failed', null, null],
  ['balance', 'Dear Customer, Avl Bal in your Kotak Bank AC X7702 is Rs.9,401.22 as on 01-11-26 08:00 hrs.', null, null],
  ['statement', 'HDFC Bank Credit Card XX9034 Statement: Total Amt Due Rs.18,432.00, Min Amt Due Rs.920.00, Due by 05-11-26.', null, null],
  ['insufficient', 'Hi, txn of Rs. 1500.00 using card XX**3456 failed due to insufficient funds. -Federal Bank', null, null],
  ['wrong-pin', 'Your UPI PIN was entered incorrectly. Payment of ₹500 to Riya Sharma failed.', GPAY, null],
  ['limit', 'Dear Customer, UPI transaction of INR 249.00 to ZEPTO declined. Reason: Exceeds daily limit. - Axis Bank', null, null],
  ['declined-card', 'Your credit card transaction of RS. 50000 on amazon.in was declined.', null, null],
  ['declined-mandate', 'Hi, payment of INR 199.00 via e-mandate declined for ID: NX789XYZABC on Federal Bank Debit Card 3456.', null, null],
  ['autopay-insufficient', 'Payment of ₹649 to Netflix via UPI AutoPay failed due to insufficient balance', null, null],
  ['order-delivered', 'Your order is on its way! Total ₹412. Track it in the app', 'com.application.zomato', null],
  ['no-amount', 'Your refund has been initiated and will reach you in 5-7 business days.', SWIGGY, null],
]

describe('readStuckMessage — the corpus', () => {
  it('has plenty of cases, with unique ids', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(60)
    expect(new Set(CASES.map(([id]) => id)).size).toBe(CASES.length)
  })

  it.each(CASES)('%s', (_, text, app, expected) => {
    const signal = readStuckMessage(text, { today: TODAY, app, at: app === null ? undefined : AT })
    if (expected === null) expect(signal).toBeNull()
    else expect(signal).toMatchObject(expected)
  })
})

describe('the SMS corpus (src/features/sharein): nothing that went through is ever stuck', () => {
  it.each(SMS_CORPUS)('%s', (_, text, expected) => {
    const signal = readStuckMessage(text, { today: CORPUS_TODAY })
    if (expected.kind === 'txn' && expected.refund) expect(['reversal', 'refund_credited', 'refund_initiated']).toContain(signal?.type)
    else if (expected.kind === 'txn' && expected.dir === 'debit') {
      expect(signal).toMatchObject({ amount: expected.amount, ref: expected.ref, account: expected.account })
      // A UPI app's receipt, or "successful", went through; a bank's own debit SMS only says the money left.
      expect(signal?.type).toBe(expected.app !== null || /success/i.test(text) ? 'success' : 'debit')
    }
    else if (expected.kind === 'ignored' && expected.reason === 'failed') expect(signal === null || signal.type === 'failed').toBe(true)
    else expect(signal).toBeNull()
  })
})

describe('did the money leave?', () => {
  it.each([
    ['Payment of ₹500 to Swiggy failed. Any amount debited will be reversed in 48 hrs.', false],
    ['Payment of ₹500 to Swiggy failed. Amount if debited will be refunded.', false],
    ['Payment of ₹500 to Swiggy failed. Money, if debited, will be refunded within 3 days.', false],
    ['Payment of ₹500 to Swiggy failed. The amount debited, if any, will be reversed.', false],
    ['Payment of ₹500 to Swiggy failed. In case your account was debited, it will be reversed.', false],
    ['Payment of ₹500 to Swiggy failed.', false],
    ['₹500 has been debited from your account but the payment to Swiggy failed.', true],
    ['Payment of ₹500 to Swiggy failed. Money deducted from your account will be refunded in 3-5 days.', true],
    ['Rs.500 debited from A/c XX4821. UPI txn to SWIGGY failed. Amount will be reversed.', true],
    ['Payment of ₹500 to Swiggy failed. The amount debited will be refunded in 5 days.', true],
  ])('%s → %s', (text, debited) => {
    expect(readStuckMessage(text, { today: TODAY })).toMatchObject({ type: 'failed', debited })
  })
})

describe('dates', () => {
  it('a notification without a date is about the day it was posted', () => {
    const lateLastNight = new Date(2026, 10, 1, 23, 50).getTime()
    expect(readStuckMessage('Payment failed\n₹500 to Riya Sharma', { today: TODAY, app: GPAY, at: lateLastNight })).toMatchObject({ date: '2026-11-01', at: lateLastNight })
  })

  it('a pasted message without one is about today', () => {
    expect(readStuckMessage('Payment of ₹500 to Riya Sharma failed', { today: TODAY })).toMatchObject({ date: TODAY })
  })

  it('a promised day without a year is the next one to come', () => {
    expect(readStuckMessage('Refund of ₹500 for order 98765 has been initiated. It will be credited by 3 Jan.', { today: '2026-12-28' })).toMatchObject({
      date: '2026-12-28',
      promisedBy: '2027-01-03',
    })
  })

  it('hours become days, and working days skip the weekend', () => {
    expect(readStuckMessage('Refund of ₹500 for order 98765 has been initiated and will reach you within 48 hrs', { today: TODAY })).toMatchObject({ promisedBy: '2026-11-04' })
    // Friday + 3 working days = Wednesday.
    expect(readStuckMessage('Refund of ₹500 for order 98765 initiated. It will be credited in 3 working days.', { today: '2026-11-06' })).toMatchObject({ promisedBy: '2026-11-11' })
  })

  it('a promise is never read as the day the money left', () => {
    expect(readStuckMessage('UPI txn of Rs 500 to SWIGGY failed. Amount will be reversed by 02-11-2026.', { today: TODAY })).toMatchObject({ date: TODAY })
  })
})

describe('readStuckMessage — anything at all', () => {
  it.each([[''], ['   '], ['₹'], ['Rs.'], ['refund failed pending'], [String(null)], ['x'.repeat(5000)]])('%j is nothing', (text) => {
    expect(readStuckMessage(text, { today: TODAY })).toBeNull()
  })

  it('never throws, whatever it is given', () => {
    expect(readStuckMessage(undefined as unknown as string, { today: TODAY })).toBeNull()
    expect(readStuckMessage('Payment of ₹500 to Swiggy failed', { today: 'not a day' })).not.toBeUndefined()
  })
})

describe('signalToDraft', () => {
  const read = (text: string, app: string | null = null) => readStuckMessage(text, { today: TODAY, app, at: AT }) as StuckSignal

  it('a failure the bank says took the money is confirmed', () => {
    expect(signalToDraft(read('Rs.640.00 debited from HDFC Bank A/c XX4821 on 30-10-26 for UPI txn to SWIGGY. Txn failed. UPI Ref 630412345678'), 'alert')).toEqual({
      kind: 'failed',
      rail: 'upi_merchant',
      party: 'Swiggy',
      merchant: 'swiggy',
      amount: 64_000,
      date: '2026-10-30',
      promisedBy: null,
      ref: '630412345678',
      orderId: null,
      bank: 'hdfc',
      account: 'XX4821',
      app: null,
      source: 'alert',
      confirmed: true,
    })
  })

  it('one that only may have taken it, or is pending, waits for a tap', () => {
    expect(signalToDraft(read('Payment failed\n₹500 to Riya Sharma', GPAY), 'alert')).toMatchObject({ kind: 'failed', confirmed: false, rail: 'upi_person', app: 'gpay' })
    expect(signalToDraft(read('Payment pending\n₹500 to Riya Sharma', GPAY), 'sms')).toMatchObject({ kind: 'failed', confirmed: false, source: 'sms' })
  })

  it('a refund started is a refund owed, with its order and promise', () => {
    expect(signalToDraft(read('Refund of Rs.1,299 for your order OD432198765432100 has been initiated. It will reflect in 5-7 business days.', 'com.flipkart.android'), 'alert')).toMatchObject({
      kind: 'refund',
      rail: null,
      party: 'Flipkart',
      merchant: 'flipkart',
      orderId: 'OD432198765432100',
      promisedBy: '2026-11-11',
      date: TODAY,
      confirmed: true,
    })
  })

  it('a payment that went through is never a stuck payment', () => {
    expect(signalToDraft(read('₹500 paid to Riya Sharma\nUPI transaction ID: 630611112299', GPAY), 'alert')).toBeNull()
  })

  it('a refund from no one in particular, money coming back and plain debits are not new stuck payments', () => {
    expect(signalToDraft(read('Refund initiated: Amt: Rs.3,274.66 on HDFC Bank Credit Card 1111.'), 'sms')).toBeNull()
    expect(signalToDraft(read('Rs 349.00 reversed to ICICI Bank Acct XX902 for failed UPI txn 629420551206.'), 'sms')).toBeNull()
    expect(signalToDraft(read('Refund of Rs.420.00 from ZOMATO has been credited to your A/c XX4821'), 'sms')).toBeNull()
    expect(signalToDraft(read('Sent Rs.250.00 From HDFC Bank A/C *4821 To SWIGGY On 01/11/26 Ref 630512345678'), 'sms')).toBeNull()
  })

  it('keeps every field within what the store accepts', () => {
    const long = readStuckMessage(`Payment of ₹500 to ${'A'.repeat(30)} ${'B'.repeat(30)} failed`, { today: TODAY })
    const draft = long && signalToDraft({ ...long, party: 'P'.repeat(300), ref: 'R'.repeat(80) }, 'sms')
    expect(draft?.party).toHaveLength(120)
    expect(draft?.ref).toHaveLength(40)
  })
})

describe('the apps it reads', () => {
  it('every business app is a business Settle knows', () => {
    for (const id of Object.values(MERCHANT_APPS)) expect(merchantById(id)).not.toBeNull()
  })

  it('the Android listener listens to the same apps', () => {
    const java = source('../../../android/app/src/main/java/in/settleupi/app/PaymentAlertsListener.java')
    for (const pkg of [...Object.keys(UPI_APP_IDS), ...Object.keys(MERCHANT_APPS)]) expect(java).toContain(`"${pkg}"`)
  })

  it('uses no regex lookbehind (Safari < 16.4 cannot parse it)', () => {
    for (const file of ['./detect.ts', './track.ts']) {
      expect(source(file).includes('(?<=')).toBe(false)
      expect(source(file).includes('(?<!')).toBe(false)
    }
  })
})
