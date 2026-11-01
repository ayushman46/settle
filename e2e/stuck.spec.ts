/**
 * "Stuck money", in a real browser — what banks and businesses owe you back:
 *
 * - a failed ₹649 UPI payment to Swiggy, added by hand: its page counts the RBI's deadline (T+5),
 *   the days late and the ₹100 a day; "Raise it with your bank" has the letter (the circular, the
 *   amount) and "I've raised it" keeps the complaint number; "It's back" closes it (Undo puts it
 *   back), and the list moves it to "Got back";
 * - a Flipkart refund past the day it was promised: raised with Flipkart, and a week after that
 *   (a complaint dated in the past) the National Consumer Helpline, on WhatsApp, the message typed in;
 * - a pasted bank SMS: a failed payment opens Add filled in, a reversal ticks an open one back;
 * - a mix of every kind in its section, the "did it leave your account?" Yes / No in the row (with
 *   Undo), and the ways in: Home's card, the More sheet and You's shortcuts;
 * - a 320 px phone and axe, on the list, a payment and its raise sheet.
 *
 * The clock is fixed at Monday 2 Nov 2026, 11 am in India, so every deadline and day count is exact.
 */
import type { Locator, Page } from '@playwright/test'
import type { StuckPayment } from '../src/data/stores'
import { expectAccessible, settleAnimations } from './support/a11y'
import { expectNoSideScroll } from './support/claims'
import { expect, test } from './support/fixtures'
import { seed } from './support/seed'

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
/** One of each: overdue, to check, on its way, back, set aside. */
const MIX = [SWIGGY, RIYA_CHECK, INDIGO, FLIPKART_BACK, RAPIDO_ASIDE]

/** HDFC's SMS for a failed UPI payment that took the money. */
const FAILED_SMS =
  'Rs.640.00 debited from HDFC Bank A/c XX4821 on 30-10-26 for UPI txn to SWIGGY. Txn failed at beneficiary bank; amount will be reversed by 04-11-26. UPI Ref 630412345678'
/** HDFC's SMS for the money coming back (a UPI reversal), on 1 Nov. */
const REVERSAL_SMS = 'Your A/c XX4821 is credited with INR 499.00 on 01-11-26. Info: UPI-REV-630512340987. Avl Bal INR 12,000.00 -HDFC Bank'

/** Fixes the clock, puts `stuck` on the phone and opens `path`. */
async function open(page: Page, path: string, list?: StuckPayment[]): Promise<void> {
  await page.clock.setFixedTime(NOW)
  await seed(page, list ? { stuck: list } : {})
  await page.goto(path)
}

const nowCard = (page: Page) => page.getByRole('region', { name: 'What to do now' })
const clockCard = (page: Page) => page.getByRole('region', { name: 'The clock' })
const summary = (page: Page) => page.getByRole('region', { name: 'What you’re owed' })
/** A part of the list, by its heading and count: "Needs you 2". */
const section = (page: Page, name: string | RegExp) => page.getByRole('region', { name })
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
  test('a failed UPI payment to Swiggy: added, 3 days late, raised with the bank, then back (with Undo)', async ({ page, shared }) => {
    await open(page, '/app/stuck')
    await expect(page.getByRole('heading', { level: 1, name: 'Stuck money' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Money stuck with a bank or a shop?' })).toBeVisible()
    await page.getByRole('button', { name: 'Add one' }).click()

    // Add: what it is, how much, how it was paid (the RBI's deadline shows), to whom, when, the reference.
    await expect(page).toHaveURL(/\/app\/stuck\/new$/)
    await expect(page.getByRole('heading', { level: 1, name: 'What’s stuck?' })).toBeVisible()
    await page.getByRole('radio', { name: /^A payment failed but took my money/ }).click()
    await page.getByRole('textbox', { name: 'How much?' }).fill('649')
    await page.getByRole('radio', { name: /^UPI to a shop/ }).click()
    await page.getByRole('textbox', { name: 'Paid to (optional)' }).fill('Swiggy')
    await page.getByLabel(/^When did the money leave\?/).fill('2026-10-25')
    await expect(page.getByText('Due back by 30 Oct, by the RBI’s rules. After that, your bank owes you ₹100 a day.')).toBeVisible()
    await page.getByRole('textbox', { name: 'UPI reference or transaction ID (optional)' }).fill('630412345678')
    await page.getByRole('button', { name: 'Start tracking' }).click()

    // Its page: the deadline, the days late, what the wait is worth.
    await expect(page).toHaveURL(/\/app\/stuck\/[^/]+$/)
    await expect(page.getByText('Tracking it — Settle will count the days')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Swiggy' })).toBeVisible()
    await expect(page.getByText('UPI to a shop', { exact: true }).first()).toBeVisible()
    await expect(nowCard(page)).toContainText('3 days late — your bank owes you ₹300')
    await expect(nowCard(page)).toContainText('The RBI’s rules say it had to be back by 30 Oct')
    await expect(clockCard(page)).toContainText('Due back by 30 Oct')
    await expect(clockCard(page)).toContainText('The RBI’s rule for UPI to a shop: back within 5 days.')
    await expect(clockCard(page)).toContainText('₹300 for the wait so far · ₹100 more each day')

    // Raise it with the bank: the letter names the circular and the amount, and copies whole.
    await nowCard(page).getByRole('button', { name: 'Raise it with your bank' }).click()
    const raise = page.getByRole('dialog', { name: 'Raise it with your bank' })
    await expect(raise).toBeVisible()
    const letter = raise.getByRole('region', { name: 'The letter' })
    await expect(letter).toContainText('Reversal and compensation: failed UPI payment of ₹649 on 25 Oct 2026 (UPI ref 630412345678)')
    await expect(letter).toContainText('RBI/2019-20/67')
    await expect(letter).toContainText('₹649 was debited from my account for a UPI payment to Swiggy')
    await expect(letter).toContainText('the compensation due so far is ₹300 (3 days x ₹100)')
    await letter.getByRole('button', { name: 'Copy', exact: true }).click()
    await expect(letter.getByRole('button', { name: 'Copied', exact: true })).toBeVisible()
    const copied = (await shared()).clipboard.at(-1) ?? ''
    expect(copied).toContain('RBI/2019-20/67')
    expect(copied).toContain('Amount: ₹649')
    expect(copied).toContain('UPI reference (RRN/UTR): 630412345678')

    // "I've raised it", with the complaint number: the next 30 days are the bank's.
    await noteRaised(page, 'Complaint number', 'CMP-4471')
    await expect(page.getByText('Noted: raised with your bank on 2 Nov')).toBeVisible()
    await expect(nowCard(page)).toContainText('Raised with your bank on 2 Nov')
    await expect(nowCard(page)).toContainText('They have till 2 Dec to sort it out.')
    await expect(clockCard(page)).toContainText('Complaint no. CMP-4471')
    await expect(clockCard(page)).toContainText('Waiting on your bank till 2 Dec')

    // The list: what's owed, and Swiggy on its way.
    await back(page).click()
    await expect(page).toHaveURL(/\/app\/stuck$/)
    await expect(summary(page)).toContainText('Banks and shops owe you')
    await expect(summary(page)).toContainText('₹649')
    await expect(summary(page)).toContainText('+ ₹300')
    const onWay = section(page, 'On its way 1')
    await expect(onWay).toContainText('Raised with your bank · they have till 2 Dec')
    await onWay.getByRole('button', { name: /^Swiggy/ }).click()

    // It's back, without the ₹300: the toast says it's still owed — and Undo takes it back.
    await nowCard(page).getByRole('button', { name: 'It’s back' }).click()
    const backSheet = page.getByRole('dialog', { name: 'It’s back' })
    await expect(backSheet.getByRole('textbox', { name: 'How much came back?' })).toHaveValue('649')
    await expect(backSheet).toContainText('The RBI’s rules say ₹300: 3 days late at ₹100 a day.')
    await backSheet.getByRole('button', { name: 'Mark it back' }).click()
    await expect(page.getByText('₹649 from Swiggy is back — 3 days late, so your bank owes you ₹300 for the wait')).toBeVisible()
    await expect(nowCard(page).getByRole('button', { name: 'They’ve paid the ₹300' })).toBeVisible()
    await page.getByRole('button', { name: /^Undo: ₹649 from Swiggy is back/ }).click()
    await expect(nowCard(page).getByRole('button', { name: 'It’s back' })).toBeVisible()
    await expect(nowCard(page)).toContainText('Raised with your bank on 2 Nov')

    // Back for real, with the ₹300 for the wait.
    await nowCard(page).getByRole('button', { name: 'It’s back' }).click()
    await backSheet.getByRole('textbox', { name: 'Compensation paid with it (optional)' }).fill('300')
    await backSheet.getByRole('button', { name: 'Mark it back' }).click()
    await expect(page.getByText('₹649 from Swiggy is back', { exact: true })).toBeVisible()
    await expect(nowCard(page)).toContainText('All back')
    await expect(nowCard(page)).toContainText('₹649 came back on 2 Nov, with ₹300 for the wait.')

    // The list: under "Got back", and nothing stuck.
    await back(page).click()
    await expect(section(page, 'Got back 1')).toContainText('Back on 2 Nov · + ₹300 for the wait')
    await expect(section(page, /^Needs you/)).toHaveCount(0)
    await expect(section(page, /^On its way/)).toHaveCount(0)
    await expect(summary(page)).toContainText('Nothing stuck right now')
    await expect(summary(page)).toContainText('Got back so far')
    await expect(summary(page)).toContainText('₹949')
  })

  test('a Flipkart refund past the promised day: asked of Flipkart, with the ticket number', async ({ page }) => {
    await open(page, '/app/stuck')
    await page.getByRole('button', { name: 'Add stuck money' }).click()
    await page.getByRole('radio', { name: /^A refund hasn’t come/ }).click()
    await page.getByRole('textbox', { name: 'How much?' }).fill('1299')
    await page.getByRole('radiogroup', { name: 'Who owes the refund?' }).getByRole('radio', { name: 'Flipkart' }).click()
    await page.getByLabel(/^When did they start the refund\?/).fill('2026-10-21')
    await page.getByRole('button', { name: 'Add a date' }).click()
    await page.getByLabel(/^They said by/).fill('2026-10-28')
    await expect(page.getByText('Due back by 28 Oct, as they said.')).toBeVisible()
    await page.getByRole('textbox', { name: 'Order or booking number (optional)' }).fill('OD432198765432100')
    await page.getByRole('button', { name: 'Start tracking' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Flipkart' })).toBeVisible()
    await expect(nowCard(page)).toContainText('5 days late')
    await expect(nowCard(page)).toContainText('Flipkart said it would be back by 28 Oct. Ask them for it — the message is ready.')
    await expect(clockCard(page)).toContainText('Past their own deadline')

    await nowCard(page).getByRole('button', { name: 'Raise it with Flipkart' }).click()
    const sheet = page.getByRole('dialog', { name: 'Ask Flipkart for the refund' })
    await expect(sheet.getByRole('link', { name: 'Open Flipkart help (opens in a new tab)' })).toHaveAttribute('href', 'https://www.flipkart.com/helpcentre')
    const message = sheet.getByRole('region', { name: 'The message' })
    await expect(message).toContainText('Refund of ₹1,299 for order OD432198765432100 not received')
    await expect(message).toContainText('It is now 5 days past that date')

    await noteRaised(page, 'Ticket number', 'FK-88231')
    await expect(page.getByText('Noted: raised with Flipkart on 2 Nov')).toBeVisible()
    await expect(nowCard(page)).toContainText('Raised with Flipkart on 2 Nov')
    await expect(nowCard(page)).toContainText('They have till 9 Nov to sort it out.')
    await expect(clockCard(page)).toContainText('Complaint no. FK-88231')
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
    const needs = section(page, 'Needs you 1')
    await expect(needs).toContainText('Time to take it to the National Consumer Helpline')
    await needs.getByRole('button', { name: /^Flipkart/ }).click()

    await expect(nowCard(page)).toContainText('It’s still not sorted after the time Flipkart had to fix it.')
    await nowCard(page).getByRole('button', { name: 'Take it to the National Consumer Helpline' }).click()
    const sheet = page.getByRole('dialog', { name: 'National Consumer Helpline' })
    const whatsapp = sheet.getByRole('link', { name: 'Send on WhatsApp (opens in a new tab)' })
    await expect(whatsapp).toBeVisible()
    const href = new URL((await whatsapp.getAttribute('href')) ?? '')
    expect(`${href.origin}${href.pathname}`).toBe('https://wa.me/918800001915')
    const text = href.searchParams.get('text') ?? ''
    expect(text).toContain('Complaint: refund of ₹1,299 from Flipkart not received.')
    expect(text).toContain('Order: OD432198765432100.')
    expect(text).toContain('Refund started 14 Oct 2026, due by 21 Oct 2026; not received as of 2 Nov 2026.')
    expect(text).toContain('I complained to Flipkart on 23 Oct 2026 (ticket FK-88231); not resolved.')
    await expect(sheet.getByRole('link', { name: 'Call 1915' })).toHaveAttribute('href', 'tel:1915')

    await noteRaised(page, 'Docket number', 'NCH-2611-0042')
    await expect(page.getByText('Noted: raised with the National Consumer Helpline on 2 Nov')).toBeVisible()
    await expect(nowCard(page)).toContainText('Raised with the National Consumer Helpline on 2 Nov')
    await expect(nowCard(page)).toContainText('They have till 2 Dec to sort it out.')
  })

  test('a pasted bank SMS for a failed payment opens Add, filled in', async ({ page }) => {
    await open(page, '/app/stuck')
    await page.getByRole('button', { name: 'Paste a message' }).click()
    const sheet = page.getByRole('dialog', { name: 'Paste a message' })
    const box = sheet.getByRole('textbox', { name: 'Paste the bank SMS or app message' })
    await box.fill('Your OTP for login is 482913. Do not share it with anyone. -HDFC Bank')
    await sheet.getByRole('button', { name: 'Read it' }).click()
    await expect(sheet.getByText('Couldn’t find a stuck payment in that')).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Add it yourself' })).toBeVisible()

    await box.fill(FAILED_SMS)
    await sheet.getByRole('button', { name: 'Read it' }).click()
    await expect(page).toHaveURL(/\/app\/stuck\/new$/)
    await expect(page.getByText('Filled in from the message. Check it and save.')).toBeVisible()
    await expect(page.getByRole('radio', { name: /^A payment failed but took my money/ })).toBeChecked()
    await expect(page.getByRole('textbox', { name: 'How much?' })).toHaveValue('640')
    await expect(page.getByRole('radio', { name: /^UPI to a shop/ })).toBeChecked()
    await expect(page.getByRole('textbox', { name: 'Paid to (optional)' })).toHaveValue('Swiggy')
    await expect(page.getByLabel(/^When did the money leave\?/)).toHaveValue('2026-10-30')
    await expect(page.getByRole('textbox', { name: 'UPI reference or transaction ID (optional)' })).toHaveValue('630412345678')
    await page.getByRole('button', { name: 'Start tracking' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Swiggy' })).toBeVisible()
    await expect(nowCard(page)).toContainText('Nothing to do yet')
    await expect(nowCard(page)).toContainText('Your bank has till 4 Nov to put it back.')
    const details = page.getByRole('region', { name: 'Details' })
    await expect(details).toContainText('HDFC ••4821')
    await expect(details).toContainText('A bank SMS')
  })

  test('a pasted reversal SMS ticks back the open payment it belongs to', async ({ page }) => {
    const riya = stuck('riya-late', { kind: 'failed', rail: 'upi_person', party: 'Riya Sharma', amount: 499_00, date: '2026-10-26', ref: '630512340987', bank: 'hdfc', account: 'XX4821' })
    await open(page, '/app/stuck', [riya])
    const needs = section(page, 'Needs you 1')
    await expect(needs).toContainText('6 days late · your bank owes you ₹600')

    await page.getByRole('button', { name: 'Paste a message' }).click()
    const sheet = page.getByRole('dialog', { name: 'Paste a message' })
    await sheet.getByRole('textbox', { name: 'Paste the bank SMS or app message' }).fill(REVERSAL_SMS)
    await sheet.getByRole('button', { name: 'Read it' }).click()
    await expect(sheet).toBeHidden()
    // Back on 1 Nov, 5 days after the 27 Oct deadline: ₹500 for the wait, still to claim.
    await expect(page.getByText('₹499 from Riya Sharma is back — 5 days late, so your bank owes you ₹500 for the wait')).toBeVisible()
    await expect(needs).toContainText('Back 5 days late · your bank owes you ₹500')
    await needs.getByRole('button', { name: /^Riya Sharma/ }).click()
    await expect(nowCard(page)).toContainText('Back, but 5 days late')
    await expect(nowCard(page).getByRole('button', { name: 'Claim ₹500 from your bank' })).toBeVisible()
  })

  test('a mix: each in its section, Yes or No right in the row (with Undo), and Home, More and You lead here', async ({ page }) => {
    await open(page, '/app/stuck', MIX)
    await expect(summary(page)).toContainText('Banks and shops owe you')
    await expect(summary(page)).toContainText('₹5,149')
    await expect(summary(page)).toContainText('+ ₹300')
    await expect(summary(page)).toContainText('₹1,299')
    await expect(summary(page)).toContainText('2 need you')

    const needs = section(page, 'Needs you 2')
    await expect(needs.getByRole('listitem')).toHaveCount(2)
    await expect(needs.getByRole('listitem').first()).toContainText('Swiggy 3 days late · your bank owes you ₹300')
    await expect(needs.getByRole('listitem').nth(1)).toContainText('Did ₹500 leave your account?')
    await expect(section(page, 'On its way 1')).toContainText('IndiGo Due back by 9 Nov')
    await expect(section(page, 'Got back 1')).toContainText('Flipkart Back on 26 Oct')
    const aside = section(page, 'Set aside 1')
    const toggle = aside.getByRole('button', { name: 'Set aside 1' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(aside.getByRole('button', { name: /^Rapido/ })).toBeHidden()
    await toggle.click()
    await expect(aside.getByRole('button', { name: /^Rapido/ })).toBeVisible()

    // Yes: the money left, so Settle counts the days (due back today: UPI to a person is T+1). Undo.
    const toCheck = () => section(page, 'Needs you 2').getByRole('listitem').filter({ hasText: 'Did ₹500 leave your account?' })
    await toCheck().getByRole('button', { name: /^Yes\b/ }).click()
    await expect(page.getByText('Got it — Settle’s counting the days')).toBeVisible()
    await expect(section(page, 'On its way 2')).toContainText('Riya Sharma Due back today')
    await expect(summary(page)).toContainText('₹5,649')
    await page.getByRole('button', { name: /^Undo: Got it/ }).click()
    await expect(section(page, 'Needs you 2')).toContainText('Did ₹500 leave your account?')
    await expect(summary(page)).toContainText('₹5,149')

    // No: it never left, so it's set aside.
    await toCheck().getByRole('button', { name: /^No\b/ }).click()
    await expect(page.getByText('Good — set aside, nothing to chase')).toBeVisible()
    await expect(section(page, 'Needs you 1')).not.toContainText('Riya Sharma')
    await expect(section(page, 'Set aside 2')).toContainText('Riya Sharma Set aside')

    // Home: the card says what's owed and opens the list.
    await back(page).click()
    await expect(page).toHaveURL(/\/app$/)
    const card = page.getByRole('region', { name: 'Stuck money' })
    await expect(card).toContainText('₹5,149 stuck with banks and shops')
    await expect(card).toContainText('1 needs you · + ₹300 for the wait')
    await card.getByRole('button').click()
    await expect(page).toHaveURL(/\/app\/stuck$/)

    // Home's More sheet has the tile.
    await back(page).click()
    await page.getByRole('button', { name: 'More' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Stuck money' }).click()
    await expect(page).toHaveURL(/\/app\/stuck$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Stuck money' })).toBeVisible()

    // You → Shortcuts.
    await page.goto('/app/you')
    const row = page.getByRole('list', { name: 'Shortcuts' }).getByRole('button', { name: /^Stuck money/ })
    await expect(row).toContainText('₹5,149 with banks and shops')
    await row.click()
    await expect(page).toHaveURL(/\/app\/stuck$/)
  })

  test.describe('on a 320 px phone, and with axe', () => {
    test('the list', async ({ page }) => {
      await open(page, '/app/stuck', MIX)
      await expect(section(page, 'Needs you 2')).toBeVisible()
      await section(page, 'Set aside 1').getByRole('button', { name: 'Set aside 1' }).click()
      await expectFits320(page, page.getByRole('main'))
      await expectAccessible(page)
    })

    test('a payment’s page', async ({ page }) => {
      await open(page, '/app/stuck', MIX)
      await section(page, 'Needs you 2').getByRole('button', { name: /^Swiggy/ }).click()
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
