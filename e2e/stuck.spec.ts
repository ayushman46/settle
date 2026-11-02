/**
 * "Stuck money", in a real browser — what banks and businesses owe you back:
 *
 * - a failed ₹649 UPI payment to Swiggy, added by hand (the day picked, never assumed; how it was paid
 *   picked too, since the deadline turns on it; the bank, app and account for the letter): its page
 *   counts the RBI's deadline (T+5) on a clock in date order, the days late and the ₹100 a day; "Raise
 *   it with your bank" has the letter (the circular, the amount, your mobile number once typed in)
 *   and "I've raised it" keeps the complaint number; "It's back" closes it (Undo puts it back), the
 *   win is there to share, and the list moves it to "Got back";
 * - a Flipkart refund past the day it was promised: raised with Flipkart, then back in two parts;
 *   and a week after asking (a complaint dated in the past) the National Consumer Helpline, on
 *   WhatsApp, the message typed in;
 * - pasted bank SMSes: a failed payment opens Add, filled in (and pasted again, opens the one already
 *   tracked); a reversal ticks an open one back; several at once are listed to track together;
 * - a mix of every kind in its section, the "did it leave your account?" Yes / No in the row (with
 *   Undo), deleting one (asked first, with Undo), and the ways in: Home's card and tile, the More
 *   sheet and You's shortcuts;
 * - who owes it and how it's said: a wallet payment's wait is the wallet company's, and an ATM
 *   withdrawal's clock and claim read as plain English;
 * - a 320 px phone and axe, on the list, the add form, a payment and its raise sheet.
 *
 * The clock is fixed at Monday 2 Nov 2026, 11 am in India, so every deadline and day count is exact.
 */
import type { Locator, Page } from '@playwright/test'
import type { StuckPayment } from '../src/data/stores'
import { expectAccessible, settleAnimations } from './support/a11y'
import { expectNoSideScroll } from './support/claims'
import { expect, test } from './support/fixtures'
import { seed, type SeedData } from './support/seed'

const NOW = new Date('2026-11-02T11:00:00+05:30')
const CREATED = new Date('2026-10-20T10:00:00+05:30').getTime()

/** A stuck payment with sensible defaults (the money left the account; nothing raised yet). */
function stuck(id: string, fields: Partial<StuckPayment> & Pick<StuckPayment, 'kind' | 'amount' | 'date'>): StuckPayment {
  return {
    id,
    rail: null,
    party: null,
    merchant: null,
    promisedBy: null,
    ref: null,
    orderId: null,
    bank: null,
    account: null,
    app: null,
    source: 'manual',
    confirmed: true,
    steps: [],
    back: null,
    dismissedAt: null,
    repliedAt: null,
    note: null,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...fields,
  }
}

/** ₹649 to Swiggy on 25 Oct by UPI: due back by 30 Oct (T+5), so 3 days late and ₹300 owed. */
const SWIGGY = stuck('swiggy', {
  kind: 'failed',
  rail: 'upi_merchant',
  party: 'Swiggy',
  merchant: 'swiggy',
  amount: 649_00,
  date: '2026-10-25',
  ref: '630412345678',
  bank: 'hdfc',
  account: 'XX4821',
  app: 'gpay',
})
/** GPay said ₹500 to Riya failed yesterday: did it leave the account? */
const RIYA_CHECK = stuck('riya', { kind: 'failed', rail: 'upi_person', party: 'Riya Sharma', amount: 500_00, date: '2026-11-01', confirmed: false, app: 'gpay', source: 'alert' })
/** An IndiGo refund promised by 9 Nov. */
const INDIGO = stuck('indigo', { kind: 'refund', party: 'IndiGo', merchant: 'indigo', amount: 4_500_00, date: '2026-10-30', promisedBy: '2026-11-09', orderId: 'K7XQ2M' })
/** A Flipkart refund that came back on 26 Oct. */
const FLIPKART_BACK = stuck('flipkart-back', {
  kind: 'refund',
  party: 'Flipkart',
  merchant: 'flipkart',
  amount: 1_299_00,
  date: '2026-10-20',
  promisedBy: '2026-10-27',
  back: { date: '2026-10-26', amount: 1_299_00, compensation: 0 },
})
/** A Rapido payment that never left the account, set aside. */
const RAPIDO_ASIDE = stuck('rapido', {
  kind: 'failed',
  rail: 'upi_merchant',
  party: 'Rapido',
  merchant: 'rapido',
  amount: 180_00,
  date: '2026-10-28',
  confirmed: false,
  dismissedAt: new Date('2026-10-28T12:00:00+05:30').getTime(),
})
/** One of each: overdue, to check, not due yet, back, set aside. */
const MIX = [SWIGGY, RIYA_CHECK, INDIGO, FLIPKART_BACK, RAPIDO_ASIDE]

/** HDFC's SMS for a failed UPI payment that took the money. */
const FAILED_SMS =
  'Rs.640.00 debited from HDFC Bank A/c XX4821 on 30-10-26 for UPI txn to SWIGGY. Txn failed at beneficiary bank; amount will be reversed by 04-11-26. UPI Ref 630412345678'
/** HDFC's SMS for the money coming back (a UPI reversal), on 1 Nov. */
const REVERSAL_SMS = 'Your A/c XX4821 is credited with INR 499.00 on 01-11-26. Info: UPI-REV-630512340987. Avl Bal INR 12,000.00 -HDFC Bank'
/** A paste of several messages: an OTP, a failed payment, a refund on its way, and a friend paying back. */
const OTP_SMS = '482913 is your OTP for txn of INR 4,500.00 at FLIPKART. Do not share it with anyone.'
const SWIGGY_FAILED_SMS = 'Your UPI payment of Rs.649.00 to SWIGGY failed. UPI Ref 430112345678.'
const AMAZON_REFUND_SMS = 'Refund of Rs.1,299 for your Amazon order 402-1234567-1234567 has been initiated. It will reach your account in 3-5 business days.'
const FRIEND_CREDIT_SMS = 'Rs.7200.00 credited to your A/c XX4821 by VPA arjun@okaxis on 01-11-26. UPI Ref 630498765432 -HDFC Bank'

/** Fixes the clock, puts `list` (and anything else in `data`) on the phone and opens `path`. */
async function open(page: Page, path: string, list?: StuckPayment[], data: SeedData = {}): Promise<void> {
  await page.clock.setFixedTime(NOW)
  await seed(page, list ? { ...data, stuck: list } : data)
  await page.goto(path)
}

const nowCard = (page: Page) => page.getByRole('region', { name: 'What to do now' })
const winCard = (page: Page) => page.getByRole('region', { name: 'All back' })
const clockCard = (page: Page) => page.getByRole('region', { name: 'The clock' })
const summary = (page: Page) => page.getByRole('region', { name: 'What you’re owed' })
/** A part of the list, by its title and count, as it's heard: "Needs you, 2 payments". */
const section = (page: Page, title: string, count: number) =>
  page.getByRole('region', { name: `${title}, ${count} ${count === 1 ? 'payment' : 'payments'}`, exact: true })
/** That part of the list with any count (to say it isn't there). */
const anySection = (page: Page, title: string) => page.getByRole('region', { name: new RegExp(`^${title}, \\d+ payments?$`) })
const back = (page: Page) => page.getByRole('button', { name: 'Back', exact: true })

/** "I've raised it" in the open raise sheet: the number they gave, then Save. */
async function noteRaised(page: Page, field: string, ref: string): Promise<void> {
  await page.getByRole('dialog').getByRole('button', { name: 'I’ve raised it' }).click()
  const sheet = page.getByRole('dialog', { name: 'When did you raise it?' })
  await expect(sheet.getByLabel(/^Raised on: Today/)).toHaveValue('2026-11-02')
  await sheet.getByRole('textbox', { name: field }).fill(ref)
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
}

/**
 * At 320 px wide the page doesn't scroll sideways and nothing in `scope` (the screen, or the open
 * sheet) reaches past the right edge — screens clip overflow, so the page alone can't tell.
 */
async function expectFits320(page: Page, scope: Locator): Promise<void> {
  const before = page.viewportSize()
  await page.setViewportSize({ width: 320, height: 720 })
  await settleAnimations(page)
  await expectNoSideScroll(page)
  const past = await scope.evaluate((root) => {
    const edge = document.documentElement.clientWidth + 0.5
    const out: string[] = []
    for (const el of [root, ...root.querySelectorAll('*')]) {
      const box = el.getBoundingClientRect()
      if (box.width > 0 && box.height > 0 && box.right > edge) out.push(`<${el.tagName.toLowerCase()}> "${(el.textContent ?? '').trim().slice(0, 48)}" ends at ${Math.round(box.right)} px`)
    }
    return out
  })
  expect(past, 'past the right edge of a 320 px phone').toEqual([])
  if (before) await page.setViewportSize(before)
}

test.describe('stuck money', () => {
  test('a failed UPI payment to Swiggy: added, 3 days late, raised with the bank, then back (with Undo) and the win to share', async ({ page, shared }) => {
    await open(page, '/app/stuck', undefined, { profile: { upiId: 'ayush@okicici' } })
    await expect(page.getByRole('heading', { level: 1, name: 'Stuck money' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Money stuck with a bank or a shop?' })).toBeVisible()
    await page.getByRole('button', { name: 'Add one' }).click()

    // Add: what it is, how much, the day it left (asked, never assumed), how it was paid (the RBI's
    // deadline shows), to whom, the reference, and the bank, app and account the letter goes to.
    await expect(page).toHaveURL(/\/app\/stuck\/new$/)
    await expect(page.getByRole('heading', { level: 1, name: 'What’s stuck?' })).toBeVisible()
    await page.getByRole('radio', { name: /^A payment failed but took my money/ }).click()
    const save = page.getByRole('button', { name: 'Start tracking' })
    await page.getByRole('textbox', { name: 'How much is stuck?' }).fill('649')
    const when = page.getByRole('group', { name: 'When did the money leave?' })
    await expect(when.getByRole('button', { pressed: true })).toHaveCount(0)
    await expect(page.getByText('Say when the money left', { exact: true })).toBeVisible()
    await expect(save).toBeDisabled()
    await when.getByRole('button', { name: 'Yesterday', exact: true }).click()
    await expect(when.getByRole('button', { name: 'Yesterday', exact: true })).toHaveAttribute('aria-pressed', 'true')
    // Nothing is picked for how it was paid: the deadline turns on it.
    const how = page.getByRole('radiogroup', { name: 'How did you pay?' })
    await expect(how.getByRole('radio', { checked: true })).toHaveCount(0)
    await expect(page.getByText('Pick how you paid to see the RBI’s deadline.')).toBeVisible()
    await expect(page.getByText('Say how you paid — or pick Not sure', { exact: true })).toBeVisible()
    await expect(save).toBeDisabled()
    // It was the 25th, in fact: another day.
    await when.getByLabel(/^Another day/).fill('2026-10-25')
    await expect(when.getByRole('button', { name: 'Yesterday', exact: true })).toHaveAttribute('aria-pressed', 'false')
    await how.getByRole('radio', { name: /^UPI to a shop/ }).click()
    await expect(page.getByText('It was due back by 30 Oct, so your bank already owes you ₹300 — and ₹100 more each day.')).toBeVisible()
    await page.getByRole('combobox', { name: 'Paid to (optional)' }).fill('Swiggy')
    await expect(page.getByText('If the Swiggy order went through and was cancelled later, it’s a refund — pick that above. If the payment itself failed, this is right.')).toBeVisible()
    await page.getByRole('textbox', { name: 'UPI reference (optional)' }).fill('630412345678')
    const paidWith = page.getByRole('region', { name: 'Your bank and app' })
    await paidWith.getByRole('button', { name: 'Google Pay', exact: true }).click()
    await paidWith.getByRole('combobox', { name: 'Your bank' }).selectOption({ label: 'HDFC' })
    await paidWith.getByRole('textbox', { name: 'Last 4 digits of your account' }).fill('4821')
    await expect(save).toBeEnabled()
    await save.click()

    // Its page: the deadline, the days late, what the wait is worth — the clock in date order.
    await expect(page).toHaveURL(/\/app\/stuck\/[^/]+$/)
    await expect(page.getByText('Tracking it — Settle will count the days')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Swiggy' })).toBeVisible()
    await expect(page.getByText('UPI to a shop · HDFC ••4821 · GPay', { exact: true })).toBeVisible()
    await expect(nowCard(page)).toContainText('3 days late — your bank owes you ₹300')
    await expect(nowCard(page)).toContainText(
      'The RBI’s rules say it had to be back by 30 Oct, and that your bank pays ₹100 for each day after, without being asked. Raise it with your bank or UPI app.',
    )
    await expect(clockCard(page).getByRole('listitem')).toHaveText([
      /^The money left your account\s*25 Oct$/,
      /^Due back by 30 Oct\s*UPI to a shop: the RBI’s rule says back within 5 days\.$/,
      /^3 days late\s*2 Nov\s*₹300 for the wait so far · ₹100 more each day$/,
    ])

    // Raise it with the bank: the GPay steps, your mobile number (asked once), and the letter — the
    // circular, the amount, the days counted — copied whole.
    await nowCard(page).getByRole('button', { name: 'Raise it with your bank' }).click()
    const raise = page.getByRole('dialog', { name: 'Raise it with your bank' })
    await expect(raise).toBeVisible()
    await expect(raise).toContainText('In Google Pay, open this payment from your transaction history, tap Having issues, then Payment issue (or Stuck payment), and create a ticket.')
    await expect(raise.getByRole('link', { name: 'UPI help website (opens in a new tab)' })).toHaveAttribute('href', 'https://www.upihelp.npci.org.in/')
    const letter = raise.getByRole('region', { name: 'The letter' })
    await expect(letter).toContainText('It asks for ₹649 back, and the ₹300 owed so far for the delay (₹100 a day).')
    await expect(letter).toContainText('Subject: Reversal and compensation: failed UPI payment of ₹649 on 25 October 2026 (UPI ref 630412345678)')
    await expect(letter).toContainText('HDFC Bank')
    await expect(letter).toContainText('RBI/2019-20/67')
    await expect(letter).toContainText('₹649 was debited from my account for a UPI payment to Swiggy, but the transaction failed.')
    await expect(letter).toContainText('the compensation due so far is ₹300 (3 days × ₹100)')
    await expect(letter).toContainText('Mobile: [your mobile number]')
    await expect(letter).toContainText('1 part in [brackets] is still to fill in. Fill it in before you send it.')
    const details = raise.getByRole('region', { name: 'Your details' })
    await details.getByRole('textbox', { name: 'Mobile number' }).fill('98765 43210')
    await expect(letter).toContainText('Mobile: 98765 43210')
    await expect(letter).not.toContainText('[brackets]')
    await raise.getByRole('button', { name: 'Copy the letter' }).click()
    await expect(raise.getByRole('button', { name: 'Copied', exact: true })).toBeVisible()
    const copied = (await shared()).clipboard.at(-1) ?? ''
    expect(copied).toContain('Subject: Reversal and compensation: failed UPI payment of ₹649 on 25 October 2026 (UPI ref 630412345678)')
    expect(copied).toContain('RBI/2019-20/67')
    expect(copied).toContain('Amount: ₹649')
    expect(copied).toContain('UPI reference (RRN/UTR): 630412345678')
    expect(copied).toContain('Account: XX4821')
    expect(copied).toContain('Paid using: Google Pay')
    expect(copied).toContain('UPI ID: ayush@okicici')
    expect(copied).toContain('Mobile: 98765 43210')

    // "I've raised it", with the complaint number: the next 30 days are the bank's, and the ₹100 a day keeps counting.
    await noteRaised(page, 'Complaint number', 'CMP-4471')
    await expect(page.getByText('Noted: raised with your bank on 2 Nov')).toBeVisible()
    await expect(nowCard(page)).toContainText('Raised with your bank on 2 Nov')
    await expect(nowCard(page)).toContainText('They have till 2 Dec to sort it out.')
    await expect(nowCard(page)).toContainText('Your bank owes you ₹300 for the wait so far, and ₹100 more each day.')
    await expect(nowCard(page).getByRole('button', { name: 'Remind me on 3 Dec' })).toBeVisible()
    await expect(clockCard(page).getByRole('listitem')).toHaveText([
      /^The money left your account/,
      /^Due back by 30 Oct/,
      /^Raised with your bank\s*2 Nov\s*Complaint no\. CMP-4471$/,
      /^3 days late/,
      /^Waiting on your bank till 2 Dec\s*Not sorted by then\? Next is the RBI Ombudsman\.$/,
      /^Last day for the RBI Ombudsman\s*2 Mar 2027$/,
    ])

    // The list: what's owed, and Swiggy waiting on the bank.
    await back(page).click()
    await expect(page).toHaveURL(/\/app\/stuck$/)
    await expect(summary(page)).toContainText('Banks and shops owe you')
    await expect(summary(page)).toContainText('₹649')
    await expect(summary(page)).toContainText('For the wait+₹300')
    const waiting = section(page, 'Waiting on them', 1)
    await expect(waiting).toContainText('Failed payment to Swiggy')
    await expect(waiting).toContainText('Raised · 3 days late · ₹300 owed so far')
    await waiting.getByRole('button', { name: /^Failed payment to Swiggy/ }).click()

    // It's back, without the ₹300: the toast says it's still owed — and Undo takes it back.
    await nowCard(page).getByRole('button', { name: 'It’s back' }).click()
    const backSheet = page.getByRole('dialog', { name: 'It’s back' })
    await expect(backSheet).toContainText('Swiggy · ₹649')
    await expect(backSheet.getByRole('textbox', { name: 'How much came back?' })).toHaveValue('649')
    await expect(backSheet).toContainText('The RBI’s rules say ₹300: 3 days late at ₹100 a day.')
    await backSheet.getByRole('button', { name: 'Mark it back' }).click()
    await expect(page.getByText('Your ₹649 to Swiggy is back in your account — 3 days late, so your bank owes you ₹300 for the wait')).toBeVisible()
    await expect(nowCard(page)).toContainText('Your ₹649 is back. Your bank still owes ₹300 for the wait')
    await expect(nowCard(page).getByRole('button', { name: 'They’ve paid the ₹300' })).toBeVisible()
    await page.getByRole('button', { name: /^Undo: Your ₹649 to Swiggy is back in your account/ }).click()
    await expect(nowCard(page).getByRole('button', { name: 'It’s back' })).toBeVisible()
    await expect(nowCard(page)).toContainText('Raised with your bank on 2 Nov')

    // Back for real, with the ₹300 for the wait: all back, a moment to enjoy, and the win to share.
    await nowCard(page).getByRole('button', { name: 'It’s back' }).click()
    await backSheet.getByRole('textbox', { name: 'Compensation paid with it (optional)' }).fill('300')
    await backSheet.getByRole('button', { name: 'Mark it back' }).click()
    const burst = page.getByRole('dialog', { name: 'All back!' })
    await expect(burst).toContainText('₹949')
    await expect(burst).toContainText('Failed payment to Swiggy')
    await expect(page.getByText('Your ₹649 to Swiggy is back in your account', { exact: true })).toBeVisible()
    await expect(burst).toBeHidden()
    await expect(nowCard(page)).toHaveCount(0)
    await expect(winCard(page)).toContainText('You got ₹649 back, plus ₹300 for the wait')
    await expect(winCard(page)).toContainText('It came back on 2 Nov, 3 days late.')
    await expect(clockCard(page)).toContainText('Worth ₹300 for the wait, under the RBI’s rules')
    await expect(clockCard(page)).toContainText('Back · ₹649')
    await expect(clockCard(page)).toContainText('+₹300 for the wait, paid')
    await winCard(page).getByRole('button', { name: 'Share the win' }).click()
    const brag = (await shared()).sheets.at(-1)?.text ?? ''
    expect(brag).toBe('HDFC paid me ₹300 for the days my money was stuck — the RBI’s ₹100-a-day rule, claimed with Settle.')

    // The list: under "Got back", and nothing stuck.
    await back(page).click()
    await expect(section(page, 'Got back', 1)).toContainText('Failed payment to Swiggy')
    await expect(section(page, 'Got back', 1)).toContainText('Back on 2 Nov · +₹300 for the wait')
    await expect(anySection(page, 'Needs you')).toHaveCount(0)
    await expect(anySection(page, 'Waiting on them')).toHaveCount(0)
    await expect(anySection(page, 'Not due yet')).toHaveCount(0)
    await expect(summary(page)).toContainText('Nothing stuck right now')
    await expect(summary(page)).toContainText('Got back so far')
    await expect(summary(page)).toContainText('₹949')
  })

  test('a Flipkart refund past the promised day: asked of Flipkart, with the ticket number, then back in two parts', async ({ page, shared }) => {
    await open(page, '/app/stuck')
    await page.getByRole('button', { name: 'Add stuck money' }).click()
    await page.getByRole('radio', { name: /^A refund hasn’t come/ }).click()
    await page.getByRole('textbox', { name: 'How much is stuck?' }).fill('1299')
    await page.getByRole('group', { name: 'When was it cancelled, or the refund started?' }).getByLabel(/^Another day/).fill('2026-10-21')
    await page.getByRole('radiogroup', { name: 'Who owes the refund?' }).getByRole('radio', { name: 'Flipkart' }).click()
    // Flipkart's own timeline first (7 working days from Wed 21 Oct), then the day they said.
    await expect(page.getByText('It was due back by 30 Oct — Flipkart says refunds take up to 7 working days.')).toBeVisible()
    await page.getByLabel(/^They said by/).fill('2026-10-28')
    await expect(page.getByText('It was due back by 28 Oct, as they said — it’s late.')).toBeVisible()
    await page.getByRole('textbox', { name: 'Order or booking number (optional)' }).fill('OD432198765432100')
    await page.getByRole('button', { name: 'Start tracking' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Flipkart' })).toBeVisible()
    // The day it started is the day it started — as Add asked it and the clock says it — not a promise (that's "They said by").
    const facts = page.getByRole('region', { name: 'Details' })
    await expect(facts).toContainText(/They said by\s*28 Oct/)
    await expect.soft(facts, 'the refund’s start date is labelled as Add and the clock name it').toContainText(/Refund started\s*21 Oct/)
    await expect(nowCard(page)).toContainText('5 days late')
    await expect(nowCard(page)).toContainText('Flipkart said it would be back by 28 Oct. Ask them for it — the message is ready.')
    await expect(clockCard(page).getByRole('listitem')).toHaveText([
      /^Refund started\s*21 Oct$/,
      /^Due back by 28 Oct\s*Flipkart said it would be back by then\.$/,
      /^5 days late\s*2 Nov\s*Past the date they gave$/,
    ])

    await nowCard(page).getByRole('button', { name: 'Raise it with Flipkart' }).click()
    const sheet = page.getByRole('dialog', { name: 'Raise it with Flipkart' })
    await expect(sheet.getByRole('link', { name: 'Open Flipkart help (opens in a new tab)' })).toHaveAttribute('href', 'https://www.flipkart.com/helpcentre')
    await expect(sheet).toContainText('Give them a week. Still not sorted? You can go to the National Consumer Helpline; you don’t have to wait the full month.')
    const message = sheet.getByRole('region', { name: 'The message' })
    await expect(message).toContainText('It asks for your ₹1,299 refund, or its reference number if it was already sent, so you can trace it.')
    await expect(message).toContainText('Subject: Refund of ₹1,299 for order OD432198765432100 not received')
    await expect(message).toContainText('You said it would reach me by 28 October 2026. It is now 5 days past that date, and the money has not reached my account.')
    await sheet.getByRole('button', { name: 'Copy the message' }).click()
    expect((await shared()).clipboard.at(-1) ?? '').toContain('Order / booking number: OD432198765432100')

    await noteRaised(page, 'Ticket number', 'FK-88231')
    await expect(page.getByText('Noted: raised with Flipkart on 2 Nov')).toBeVisible()
    await expect(nowCard(page)).toContainText('Raised with Flipkart on 2 Nov')
    await expect(nowCard(page)).toContainText('They have till 9 Nov to sort it out.')
    await expect(clockCard(page)).toContainText('Complaint no. FK-88231')
    await expect(clockCard(page)).toContainText('Waiting on Flipkart till 9 Nov')
    await expect(clockCard(page)).toContainText('Not sorted by then? Next is the National Consumer Helpline.')

    // ₹1,000 comes back: the other ₹299 is still chased.
    await nowCard(page).getByRole('button', { name: 'It’s back' }).click()
    const backSheet = page.getByRole('dialog', { name: 'It’s back' })
    await backSheet.getByRole('textbox', { name: 'How much came back?' }).fill('1000')
    await expect(backSheet).toContainText('₹299 still to come')
    await backSheet.getByRole('button', { name: 'Mark it back' }).click()
    await expect(page.getByText('₹1,000 of ₹1,299 from Flipkart is back — ₹299 still to come')).toBeVisible()
    await expect(page.getByText('₹1,000 back · ₹299 still to come', { exact: true })).toBeVisible()
    await expect(nowCard(page)).toContainText('Raised with Flipkart on 2 Nov')
    await expect(nowCard(page)).toContainText('₹1,000 of ₹1,299 came back on 2 Nov. The other ₹299 is still to come.')
    await expect(clockCard(page)).toContainText('Part back · ₹1,000 of ₹1,299')
    await back(page).click()
    const waiting = section(page, 'Waiting on them', 1)
    await expect(waiting).toContainText('Flipkart refund · Order …5432100')
    await expect(waiting).toContainText('Part back · ₹299 still to come · Raised with Flipkart · 5 days late · give them till 9 Nov')
    await expect(summary(page)).toContainText('₹299')

    // The rest: all back, and the win.
    await waiting.getByRole('button', { name: /^Flipkart refund/ }).click()
    await nowCard(page).getByRole('button', { name: 'More came back' }).click()
    const more = page.getByRole('dialog', { name: 'More came back' })
    await expect(more).toContainText('Flipkart · ₹1,000 of ₹1,299 back so far')
    await expect(more.getByRole('textbox', { name: 'How much came back this time?' })).toHaveValue('299')
    await more.getByRole('button', { name: 'Mark it back' }).click()
    await expect(page.getByText('₹1,299 from Flipkart is back', { exact: true })).toBeVisible()
    await expect(winCard(page)).toContainText('You got ₹1,299 back')
    await expect(winCard(page)).toContainText('It came back on 2 Nov, 5 days late.')
    await winCard(page).getByRole('button', { name: 'Share the win' }).click()
    expect((await shared()).sheets.at(-1)?.text).toBe('Got my ₹1,299 refund from Flipkart — Settle counted the days and told me who to ask.')
  })

  test('a week after asking Flipkart, the National Consumer Helpline is next: WhatsApp, the message typed in', async ({ page }) => {
    const flipkart = stuck('flipkart', {
      kind: 'refund',
      party: 'Flipkart',
      merchant: 'flipkart',
      amount: 1_299_00,
      date: '2026-10-14',
      promisedBy: '2026-10-21',
      orderId: 'OD432198765432100',
      steps: [{ kind: 'merchant', date: '2026-10-23', ref: 'FK-88231' }],
    })
    await open(page, '/app/stuck', [flipkart])
    const needs = section(page, 'Needs you', 1)
    await expect(needs).toContainText('Flipkart refund · Order …5432100')
    await expect(needs).toContainText('12 days late · take it to the National Consumer Helpline')
    await needs.getByRole('button', { name: /^Flipkart refund/ }).click()

    await expect(nowCard(page)).toContainText('Time to take it to the National Consumer Helpline')
    await expect(nowCard(page)).toContainText('It’s still not sorted after the time Flipkart had to fix it. The complaint is written up, ready to send.')
    await nowCard(page).getByRole('button', { name: 'Take it to the National Consumer Helpline' }).click()
    const sheet = page.getByRole('dialog', { name: 'Take it to the National Consumer Helpline' })
    await expect(sheet).toContainText('Send the message below on WhatsApp to +91 88000 01915, call 1915 or 1800-11-4000 (8 AM to 8 PM), or register it on consumerhelpline.gov.in.')
    // The helpline's message is signed with your city: asked once, here.
    const message = sheet.getByRole('region', { name: 'The message' })
    await expect(message).toContainText('Ayush, [your city and state]')
    await sheet.getByRole('region', { name: 'Your details' }).getByRole('textbox', { name: 'City and state' }).fill('Pune, Maharashtra')
    await expect(message).toContainText('Ayush, Pune, Maharashtra')

    const whatsapp = sheet.getByRole('link', { name: 'Send on WhatsApp (opens in a new tab)' })
    await expect(whatsapp).toBeVisible()
    await expect(whatsapp).toHaveAttribute('href', /Pune/)
    const href = new URL((await whatsapp.getAttribute('href')) ?? '')
    expect(`${href.origin}${href.pathname}`).toBe('https://wa.me/918800001915')
    const text = href.searchParams.get('text') ?? ''
    expect(text).toContain('Complaint: refund of ₹1,299 from Flipkart not received.')
    expect(text).toContain('Order: OD432198765432100.')
    expect(text).toContain('Refund started 14 October 2026; Flipkart said it would be back by 21 October 2026; not received as of 2 November 2026.')
    expect(text).toContain('Complained so far: 23 October 2026: complained to Flipkart (ticket FK-88231). Not resolved.')
    expect(text).toContain('Please take this up with Flipkart.')
    expect(text).toContain('Ayush, Pune, Maharashtra')
    await expect(sheet.getByRole('link', { name: 'Call 1915' })).toHaveAttribute('href', 'tel:1915')
    await expect(sheet.getByRole('link', { name: 'Call 1800-11-4000' })).toHaveAttribute('href', 'tel:1800114000')

    await noteRaised(page, 'Docket number', 'NCH-2611-0042')
    await expect(page.getByText('Noted: raised with the National Consumer Helpline on 2 Nov')).toBeVisible()
    await expect(nowCard(page)).toContainText('Raised with the National Consumer Helpline on 2 Nov')
    await expect(nowCard(page)).toContainText('They have till 2 Dec to sort it out.')
    await expect(clockCard(page)).toContainText('Complaint no. NCH-2611-0042')
  })

  test('a pasted bank SMS for a failed payment opens Add, filled in — and pasted again, the one already tracked', async ({ page }) => {
    await open(page, '/app/stuck')
    await page.getByRole('button', { name: 'Paste a message' }).click()
    const sheet = page.getByRole('dialog', { name: 'Paste a message' })
    const box = sheet.getByRole('textbox', { name: 'Paste the bank SMS or app message' })
    await box.fill('Your OTP for login is 482913. Do not share it with anyone. -HDFC Bank')
    await sheet.getByRole('button', { name: 'Read it' }).click()
    await expect(sheet.getByText('Couldn’t find a stuck payment in that')).toBeVisible()
    await expect(sheet.getByText('It doesn’t look like a failed payment or a refund. You can add it yourself in a few taps.')).toBeVisible()
    await expect(sheet.getByText('1 message skipped (OTP)')).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Add it yourself' })).toBeVisible()

    await box.fill(FAILED_SMS)
    await sheet.getByRole('button', { name: 'Read it' }).click()
    await expect(page).toHaveURL(/\/app\/stuck\/new$/)
    await expect(page.getByText('Filled in from the message. Check it and save.')).toBeVisible()
    await expect(page.getByRole('radio', { name: /^A payment failed but took my money/ })).toBeChecked()
    await expect(page.getByRole('textbox', { name: 'How much is stuck?' })).toHaveValue('640')
    // 30 Oct, three days ago: the chip for it is the one picked.
    await expect(page.getByRole('group', { name: 'When did the money leave?' }).getByRole('button', { pressed: true })).toHaveText('3 days ago')
    await expect(page.getByRole('radio', { name: /^UPI to a shop/ })).toBeChecked()
    await expect(page.getByText('The RBI says it’s due back by 4 Nov. After that, your bank owes you ₹100 a day.')).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Paid to (optional)' })).toHaveValue('Swiggy')
    await expect(page.getByRole('textbox', { name: 'UPI reference (optional)' })).toHaveValue('630412345678')
    const paidWith = page.getByRole('region', { name: 'Your bank and app' })
    await expect(paidWith.getByRole('combobox', { name: 'Your bank' })).toHaveValue('hdfc')
    await expect(paidWith.getByRole('textbox', { name: 'Last 4 digits of your account' })).toHaveValue('4821')
    await page.getByRole('button', { name: 'Start tracking' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Swiggy' })).toBeVisible()
    await expect(nowCard(page)).toContainText('Nothing to do yet')
    await expect(nowCard(page)).toContainText('Your bank has till 4 Nov to put it back.')
    await expect(nowCard(page).getByRole('button', { name: 'Remind me on 5 Nov' })).toBeVisible()
    await expect(clockCard(page).getByRole('listitem')).toHaveText([/^The money left your account\s*30 Oct$/, /^3 days so far\s*2 Nov$/, /^Due back by 4 Nov/])
    const details = page.getByRole('region', { name: 'Details' })
    await expect(details).toContainText('HDFC ••4821')
    await expect(details).toContainText('A message you pasted or shared')
    const payment = page.url()

    // The same SMS again: the one already tracked opens, not a second one.
    await back(page).click()
    await expect(section(page, 'Not due yet', 1)).toContainText('Failed payment to Swiggy')
    await page.getByRole('button', { name: 'Paste a message' }).click()
    await sheet.getByRole('textbox', { name: 'Paste the bank SMS or app message' }).fill(FAILED_SMS)
    await sheet.getByRole('button', { name: 'Read it' }).click()
    await expect(page.getByText('You’re already tracking this — here it is')).toBeVisible()
    expect(page.url()).toBe(payment)
    await back(page).click()
    await expect(section(page, 'Not due yet', 1)).toBeVisible()
  })

  test('a pasted reversal SMS ticks back the open payment it belongs to', async ({ page }) => {
    const riya = stuck('riya-late', { kind: 'failed', rail: 'upi_person', party: 'Riya Sharma', amount: 499_00, date: '2026-10-26', ref: '630512340987', bank: 'hdfc', account: 'XX4821' })
    await open(page, '/app/stuck', [riya])
    await expect(section(page, 'Needs you', 1)).toContainText('Failed payment to Riya Sharma')
    await expect(section(page, 'Needs you', 1)).toContainText('6 days late · your bank owes you ₹600')

    await page.getByRole('button', { name: 'Paste a message' }).click()
    const sheet = page.getByRole('dialog', { name: 'Paste a message' })
    await sheet.getByRole('textbox', { name: 'Paste the bank SMS or app message' }).fill(REVERSAL_SMS)
    await sheet.getByRole('button', { name: 'Read it' }).click()
    await expect(sheet).toBeHidden()
    // Back on 1 Nov, 5 days after the 27 Oct deadline: ₹500 for the wait, still to claim.
    await expect(page.getByText('Your ₹499 to Riya Sharma is back in your account — 5 days late, so your bank owes you ₹500 for the wait')).toBeVisible()
    const needs = section(page, 'Needs you', 1)
    await expect(needs).toContainText('Back 5 days late · your bank owes you ₹500')
    await needs.getByRole('button', { name: /^Failed payment to Riya Sharma/ }).click()
    await expect(page.getByText('Back · your bank still owes ₹500 for the wait', { exact: true })).toBeVisible()
    await expect(nowCard(page)).toContainText('Back, but 5 days late')
    await expect(nowCard(page)).toContainText('The RBI’s rules say your bank owes you ₹500 for the wait, paid without being asked. If it hasn’t come, claim it.')
    await expect(nowCard(page).getByRole('button', { name: 'Claim ₹500 from your bank' })).toBeVisible()
  })

  test('several messages pasted at once: each read on its own, the stuck ones tracked together (with Undo)', async ({ page }) => {
    await open(page, '/app/stuck')
    await page.getByRole('button', { name: 'Paste a message' }).click()
    const sheet = page.getByRole('dialog', { name: 'Paste a message' })
    await sheet.getByRole('textbox', { name: 'Paste the bank SMS or app message' }).fill([OTP_SMS, SWIGGY_FAILED_SMS, AMAZON_REFUND_SMS, FRIEND_CREDIT_SMS].join('\n\n'))
    await sheet.getByRole('button', { name: 'Read it' }).click()
    const found = sheet.getByRole('region', { name: 'Found 2 stuck payments' })
    await expect(found.getByRole('checkbox', { name: /^Swiggy · ₹649/ })).toBeChecked()
    await expect(found.getByRole('checkbox', { name: /^Amazon · ₹1,299/ })).toBeChecked()
    await expect(found.getByRole('button', { name: 'Check first: Swiggy' })).toBeVisible()
    await expect(sheet.getByText('2 messages skipped (OTP, money in)')).toBeVisible()
    await sheet.getByRole('button', { name: 'Track these 2' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByText('Tracking 2 stuck payments — Settle will count the days')).toBeVisible()
    // The failure didn't say the money left: it's asked. Amazon's "3-5 business days" runs to Mon 9 Nov.
    await expect(section(page, 'Needs you', 1)).toContainText('Failed payment to Swiggy Did ₹649 leave your account?')
    await expect(section(page, 'Not due yet', 1)).toContainText('Amazon refund · Order …1234567 Due back by 9 Nov')
    await expect(summary(page)).toContainText('Banks and shops owe you₹1,299')

    await page.getByRole('button', { name: /^Undo: Tracking 2 stuck payments/ }).click()
    await expect(page.getByRole('heading', { name: 'Money stuck with a bank or a shop?' })).toBeVisible()
  })

  test('a mix: each in its section, Yes or No right in the row (with Undo), and Home, More and You lead here', async ({ page }) => {
    await open(page, '/app/stuck', MIX)
    await expect(summary(page)).toContainText('Banks and shops owe you')
    await expect(summary(page)).toContainText('₹5,149')
    await expect(summary(page)).toContainText('For the wait+₹300')
    await expect(summary(page)).toContainText('Got back so far₹1,299')
    await expect(summary(page)).toContainText('2 need you')

    const needs = section(page, 'Needs you', 2)
    await expect(needs.getByRole('listitem')).toHaveCount(2)
    await expect(needs.getByRole('listitem').first()).toContainText('Failed payment to Swiggy 3 days late · your bank owes you ₹300')
    await expect(needs.getByRole('listitem').nth(1)).toContainText('Failed payment to Riya Sharma Did ₹500 leave your account?')
    await expect(section(page, 'Not due yet', 1)).toContainText('IndiGo refund')
    await expect(section(page, 'Not due yet', 1)).toContainText('K7XQ2M')
    await expect(section(page, 'Not due yet', 1)).toContainText('Due back by 9 Nov')
    // A 6-character PNR is shown whole: an ellipsis would say part of it is cut off.
    await expect.soft(section(page, 'Not due yet', 1), 'no ellipsis before a booking reference shown in full').not.toContainText('…K7XQ2M')
    await expect(section(page, 'Got back', 1)).toContainText('Flipkart refund Back on 26 Oct')
    const aside = section(page, 'Set aside', 1)
    const toggle = aside.getByRole('button', { name: 'Set aside, 1 payment' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(aside.getByRole('button', { name: /^Failed payment to Rapido/ })).toBeHidden()
    await toggle.click()
    await expect(aside.getByRole('button', { name: /^Failed payment to Rapido/ })).toBeVisible()

    // Yes: the money left, so Settle counts the days (due back today: UPI to a person is T+1). Undo.
    await needs.getByRole('button', { name: 'Yes, it left — ₹500 to Riya Sharma' }).click()
    await expect(page.getByText('Got it — Settle’s counting the days')).toBeVisible()
    await expect(section(page, 'Not due yet', 2)).toContainText('Failed payment to Riya Sharma Due back today')
    await expect(summary(page)).toContainText('₹5,649')
    await page.getByRole('button', { name: /^Undo: Got it/ }).click()
    await expect(section(page, 'Needs you', 2)).toContainText('Did ₹500 leave your account?')
    await expect(summary(page)).toContainText('₹5,149')

    // No: it never left, so it's set aside.
    await section(page, 'Needs you', 2).getByRole('button', { name: 'No — ₹500 to Riya Sharma' }).click()
    await expect(page.getByText('Good — set aside, nothing to chase')).toBeVisible()
    await expect(section(page, 'Needs you', 1)).not.toContainText('Riya Sharma')
    await expect(section(page, 'Set aside', 2)).toContainText('Failed payment to Riya Sharma Set aside')

    // Home: the card says what's owed and opens the list.
    await back(page).click()
    await expect(page).toHaveURL(/\/app$/)
    const card = page.getByRole('region', { name: 'Stuck money' })
    await expect(card).toContainText('₹5,149 stuck with banks and shops')
    await expect(card).toContainText('1 to act on · ₹300 owed for the wait')
    await card.getByRole('button').click()
    await expect(page).toHaveURL(/\/app\/stuck$/)

    // Home's grid has the tile.
    await back(page).click()
    await page.getByRole('list', { name: 'Quick actions' }).getByRole('button', { name: 'Stuck money', exact: true }).click()
    await expect(page).toHaveURL(/\/app\/stuck$/)

    // Home's More sheet has it too, first among the ways to get your money back.
    await back(page).click()
    await page.getByRole('list', { name: 'Quick actions' }).getByRole('button', { name: 'More', exact: true }).click()
    const moreSheet = page.getByRole('dialog', { name: 'More' })
    await moreSheet.getByRole('region', { name: 'Get your money back' }).getByRole('button', { name: 'Stuck money', exact: true }).click()
    await expect(page).toHaveURL(/\/app\/stuck$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Stuck money' })).toBeVisible()

    // You → Shortcuts.
    await page.goto('/app/you')
    const row = page.getByRole('list', { name: 'Shortcuts' }).getByRole('button', { name: /^Stuck money/ })
    await expect(row).toContainText('₹5,149 with banks and shops')
    await row.click()
    await expect(page).toHaveURL(/\/app\/stuck$/)
  })

  test('deleting one is asked first, offers to set it aside instead, and has Undo', async ({ page }) => {
    await open(page, '/app/stuck/swiggy', MIX)
    await expect(page.getByRole('heading', { level: 1, name: 'Swiggy' })).toBeVisible()
    const deleteFromMenu = async (): Promise<Locator> => {
      await page.getByRole('button', { name: 'More options' }).click()
      await page.getByRole('dialog', { name: 'Swiggy' }).getByRole('button', { name: 'Delete' }).click()
      return page.getByRole('dialog', { name: 'Delete Swiggy?' })
    }

    // Asked first: Keep it changes nothing.
    let confirm = await deleteFromMenu()
    await expect(confirm).toContainText('It goes from this phone for good. Just not worth chasing? Set it aside instead — it stays here, not counted.')
    await confirm.getByRole('button', { name: 'Keep it' }).click()
    await expect(confirm).toBeHidden()
    await expect(page.getByRole('heading', { level: 1, name: 'Swiggy' })).toBeVisible()

    // Delete: the list, without it — and Undo puts it back.
    confirm = await deleteFromMenu()
    await confirm.getByRole('button', { name: 'Delete' }).click()
    await expect(page).toHaveURL(/\/app\/stuck$/)
    await expect(page.getByText('Swiggy deleted')).toBeVisible()
    await expect(section(page, 'Needs you', 1)).not.toContainText('Swiggy')
    await expect(summary(page)).toContainText('₹4,500')
    await page.getByRole('button', { name: /^Undo: Swiggy deleted/ }).click()
    await expect(section(page, 'Needs you', 2)).toContainText('Failed payment to Swiggy')
    await expect(summary(page)).toContainText('₹5,149')
  })

  test('a failed wallet payment: the wallet company owes the ₹100 a day, not your bank', async ({ page }) => {
    const zomato = stuck('zomato', { kind: 'failed', rail: 'wallet', party: 'Zomato', merchant: 'zomato', amount: 350_00, date: '2026-10-29', app: 'paytm' })
    await open(page, '/app/stuck', [zomato])
    // Paid from the Paytm wallet on 29 Oct: due back 30 Oct (T+1), 3 days late, ₹300 — owed by the wallet's company.
    const needs = section(page, 'Needs you', 1)
    await expect(needs).toContainText('Failed payment to Zomato 3 days late')
    await expect.soft(needs, 'the list row names who owes the wait').not.toContainText('your bank')
    await needs.getByRole('button', { name: /^Failed payment to Zomato/ }).click()
    await expect(page.getByText('Wallet · Paytm', { exact: true })).toBeVisible()
    await expect(nowCard(page)).toContainText('3 days late')
    await expect(nowCard(page)).toContainText('Raise it with Paytm.')
    await expect.soft(nowCard(page), '"What to do now" names who owes the wait').not.toContainText('your bank')
    await nowCard(page).getByRole('button', { name: 'Raise it with Paytm' }).click()
    const sheet = page.getByRole('dialog', { name: 'Raise it with Paytm' })
    await expect(sheet).toContainText('The RBI’s rules say the wallet company must put it back by the next day, and pay ₹100 for each day it’s late.')
    await expect(sheet.getByRole('region', { name: 'The letter' })).toContainText('Beyond that, the wallet issuer is to pay compensation of ₹100 for each day of delay')
  })

  test('an ATM withdrawal that came back late: its clock and its claim read as plain English', async ({ page }) => {
    const atm = stuck('atm', { kind: 'failed', rail: 'atm', amount: 2_000_00, date: '2026-10-20', bank: 'icici', account: 'XX5555', back: { date: '2026-10-31', amount: 2_000_00, compensation: 0 } })
    await open(page, '/app/stuck/atm', [atm])
    // T+5 for an ATM: due 25 Oct, back 31 Oct, 6 days late — ₹600 still owed for the wait.
    await expect(nowCard(page)).toContainText('Back, but 6 days late')
    await expect(nowCard(page)).toContainText('The RBI’s rules say your bank owes you ₹600 for the wait, paid without being asked. If it hasn’t come, claim it.')
    await expect(clockCard(page)).toContainText('Due back by 25 Oct')
    await expect(clockCard(page)).toContainText('Worth ₹600 for the wait, under the RBI’s rules')
    // The way it was paid in a sentence, not the tile's label ("The RBI’s rule for ATM, no cash came out: …").
    await expect.soft(clockCard(page), 'the RBI’s rule, in a sentence').not.toContainText('rule for ATM, no cash came out')
    await nowCard(page).getByRole('button', { name: 'Claim ₹600 from your bank' }).click()
    const letter = page.getByRole('dialog', { name: 'Ask for the ₹600 compensation' }).getByRole('region', { name: 'The letter' })
    await expect(letter).toContainText('It asks for the ₹600 owed for the days the money was late (₹100 a day).')
    await expect(letter).toContainText('The reversal came 6 days after 25 October 2026, the date the circular required, so the compensation due is ₹600 (6 days × ₹100).')
    await expect(letter).toContainText('Subject: Compensation for late reversal:')
    await expect.soft(letter, 'the subject line reads as English').not.toContainText('ATM cash not dispensed of ₹2,000')
  })

  test.describe('on a 320 px phone, and with axe', () => {
    test('the list', async ({ page }) => {
      await open(page, '/app/stuck', MIX)
      await expect(section(page, 'Needs you', 2)).toBeVisible()
      await section(page, 'Set aside', 1).getByRole('button', { name: 'Set aside, 1 payment' }).click()
      await expectFits320(page, page.getByRole('main'))
      await expectAccessible(page)
    })

    test('the add form, filled in', async ({ page }) => {
      await open(page, '/app/stuck/new', MIX)
      await page.getByRole('radio', { name: /^A payment failed but took my money/ }).click()
      await page.getByRole('textbox', { name: 'How much is stuck?' }).fill('649')
      await page.getByRole('group', { name: 'When did the money leave?' }).getByRole('button', { name: '3 days ago' }).click()
      await page.getByRole('button', { name: 'More ways' }).click()
      await page.getByRole('radiogroup', { name: 'How did you pay?' }).getByRole('radio', { name: /^UPI to a shop/ }).click()
      await page.getByRole('combobox', { name: 'Paid to (optional)' }).fill('Swiggy')
      await page.getByRole('region', { name: 'Your bank and app' }).getByRole('button', { name: 'Google Pay', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Start tracking' })).toBeEnabled()
      await expectFits320(page, page.getByRole('main'))
      await expectAccessible(page)
    })

    test('a payment’s page', async ({ page }) => {
      await open(page, '/app/stuck', MIX)
      await section(page, 'Needs you', 2).getByRole('button', { name: /^Failed payment to Swiggy/ }).click()
      await expect(page.getByRole('heading', { level: 1, name: 'Swiggy' })).toBeVisible()
      await expectFits320(page, page.getByRole('main'))
      await expectAccessible(page)
    })

    test('the raise sheet, with its letter', async ({ page }) => {
      await open(page, '/app/stuck/swiggy', MIX)
      await expect(page.getByRole('heading', { level: 1, name: 'Swiggy' })).toBeVisible()
      await nowCard(page).getByRole('button', { name: 'Raise it with your bank' }).click()
      const sheet = page.getByRole('dialog', { name: 'Raise it with your bank' })
      await expect(sheet.getByRole('region', { name: 'The letter' })).toBeVisible()
      await expectFits320(page, sheet)
      await expectAccessible(page)
    })
  })
})
