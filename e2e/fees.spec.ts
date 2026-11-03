/**
 * "Bank charges", in a real browser — charges your bank took that the RBI's rules don't allow:
 *
 * - an HDFC statement (CSV) read on the phone: a minimum-balance charge that took the balance below
 *   zero, an NEFT charge on a transfer sent from net banking, and an ATM charge in a month when only
 *   one withdrawal went through (the failed one isn't counted) — one question settles it; the
 *   account's two answers (regular savings, ₹10,000) add HDFC's own schedule as a reason; "Claim it
 *   back" writes the letter with each rule's paragraph, "I've sent it" keeps the day and number;
 * - Home's card and tile, and You's row, lead there;
 * - an SBI statement: minimum-balance charges after SBI stopped levying them, a UPI charge, SMS
 *   charges kept as allowed-but-avoidable, and the letter asking to switch to a Basic Savings account;
 * - a claim past the bank's 30 days: the RBI Ombudsman's fields and complaint, then "It's back";
 * - pasted SMS (three charges and a reversal), a PDF (not read yet, said so), Undo;
 * - a 320 px phone and axe, on the screen and the letter.
 *
 * The clock is fixed at Tuesday 3 Nov 2026, 11 am in India.
 */
import { readFileSync } from 'node:fs'
import type { Locator, Page } from '@playwright/test'
import { expectAccessible, settleAnimations } from './support/a11y'
import { expectNoSideScroll } from './support/claims'
import { expect, test } from './support/fixtures'
import { seed, type SeedData } from './support/seed'

const NOW = new Date('2026-11-03T11:00:00+05:30')
const fixture = (name: string) => readFileSync(`e2e/fixtures/statements/${name}`)

async function open(page: Page, path: string, data: SeedData = {}): Promise<void> {
  await page.clock.setFixedTime(NOW)
  await seed(page, data)
  await page.goto(path)
}

async function addStatement(page: Page, name: string, mimeType = 'text/csv'): Promise<void> {
  await page.getByLabel('Check a statement', { exact: true }).setInputFiles({ name, mimeType, buffer: fixture(name) })
}

const region = (page: Page, name: string | RegExp) => page.getByRole('region', { name })
/** The dark card at the top, named by what it shows. */
const hero = (page: Page) => page.getByRole('region', { name: /^(?:Your bank owes you|Charges checked|Back from your bank)$/ })

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

/** A claim raised with HDFC on 25 Sep (39 days ago): the bank's 30 days are up. */
const RAISED = {
  charges: [
    {
      id: 'c1',
      date: '2026-09-02',
      kind: 'minbal',
      amount: 600_00,
      gst: 108_00,
      reversed: 0,
      text: 'AMB CHRG INCL GST FOR AUG2026',
      bank: 'hdfc',
      account: 'XX4821',
      balanceBefore: 200_00,
      balanceAfter: -508_00,
      monthAtm: null,
      onFailed: false,
      online: null,
      avg: null,
      idleDays: null,
      monthWithdrawals: null,
      source: 'statement',
      addedAt: 1,
    },
  ],
  accounts: {},
  claims: [{ id: 'k1', bank: 'hdfc', account: 'XX4821', chargeIds: ['c1'], amount: 508_00, steps: [{ kind: 'bank', date: '2026-09-25', ref: 'HDFC-77812' }], repliedAt: null, back: null, dismissedAt: null, createdAt: 1, updatedAt: 1 }],
  checks: [{ at: 1, from: '2026-08-01', to: '2026-09-30', bank: 'hdfc', account: 'XX4821', lines: 40, charges: 1 }],
  dismissed: [],
  answers: {},
  notices: [],
}

test.describe('bank charges', () => {
  test('an HDFC statement: below zero, online NEFT and an ATM month with one withdrawal; answered, claimed and sent', async ({ page }) => {
    await open(page, '/app/fees')
    await expect(page.getByRole('heading', { level: 1, name: 'Bank charges' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Is your bank charging you what it shouldn’t?' })).toBeVisible()
    await expect(page.getByText('Read on this phone. Settle keeps only the charges, never the rest of your statement.')).toBeVisible()

    await addStatement(page, 'hdfc-oct-2026.csv')
    await expect(page.getByRole('status').or(page.getByText('4 charges found · 11 lines, 1 Oct 2026 to 3 Nov 2026')).first()).toBeVisible()
    await expect(hero(page)).toContainText('Your bank owes you')
    await expect(hero(page)).toContainText('₹641.04')
    await expect(hero(page)).toContainText('2 charges break the RBI’s rules')
    // The ATM charge, and whether HDFC warned before the minimum-balance charge (no warning: all ₹708 of it, not just the part below zero).
    await expect(hero(page)).toContainText('2 charges need one answer')

    // The claim, per bank: each charge with why and the rule.
    const claim = region(page, /^Claim back/)
    await expect(claim).toContainText('HDFC Bank owes you ₹641.04')
    await expect(claim).toContainText('It took your balance below zero, from ₹69.91 to −⁠₹638.09. That isn’t allowed.')
    await expect(claim).toContainText('Rule: RBI/DOR/2025-26/170, para 160(6)')
    await expect(claim).toContainText('NEFT sent online from a savings account is free.')

    // One question: no balance checks at other banks' ATMs that month, so the ATM charge is claimable too.
    const ask = region(page, /^One question each/)
    await expect(ask).toContainText('Only 1 withdrawal went through that month (failed ones don’t count). Your first 3 a month are free at any bank’s ATM (5 at your own bank’s).')
    await ask.getByRole('button', { name: 'None', exact: true }).click()
    await expect(page.getByText('Added to what you can claim back')).toBeVisible()
    await expect(hero(page)).toContainText('₹668.18')
    const warned = region(page, /^One question each/)
    await expect(warned).toContainText('Answer this and ₹69.91 more can be claimed')
    await warned.getByRole('button', { name: 'Yes, it warned me' }).click()
    await expect(region(page, /^One question each/)).toHaveCount(0)
    await expect(hero(page)).toContainText('₹668.18')

    // The account's two answers: the card folds to one line.
    const account = region(page, 'About your account')
    await account.getByRole('button', { name: 'Regular savings' }).click()
    await account.getByRole('button', { name: '₹10,000' }).click()
    await expect(account).toContainText('Regular savings · needs ₹10,000 average')
    await expect(claim).toContainText('+ 1 more reason')

    // Claim it: the letter, your mobile number, sent.
    await claim.getByRole('button', { name: 'Claim ₹668.18 back' }).click()
    const sheet = page.getByRole('dialog', { name: 'Write to HDFC Bank' })
    await expect(sheet).toBeVisible()
    const letter = sheet.getByTestId('fee-letter')
    await expect(letter).toContainText('To: The Branch Manager / Grievance Redressal Officer, HDFC Bank')
    await expect(letter).toContainText('Reversal of 3 charges wrongly debited from my savings account ending 4821')
    await expect(letter).toContainText('para 160(6)')
    await expect(letter).toContainText('HDFC Bank\'s own published schedule of charges allows at most ₹300')
    await expect(letter).toContainText('RBI/2019-20/116')
    await expect(letter).toContainText('RBI/2019-20/41')
    await expect(letter).toContainText('Total to be reversed: ₹668.18')
    await sheet.getByRole('textbox', { name: /Mobile/ }).fill('98450 12345')
    await expect(letter).toContainText('Mobile: 98450 12345')
    await sheet.getByRole('button', { name: 'I’ve sent it' }).click()
    const sent = page.getByRole('dialog', { name: 'When did you send it?' })
    await sent.getByRole('textbox', { name: 'Complaint number' }).fill('HDFC-99812')
    await sent.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Noted. Settle tells you when the bank’s 30 days are up.')).toBeVisible()
    await expect(region(page, /^Your claims/)).toContainText('Sent on 3 Nov 2026. The bank has till 3 Dec 2026 to fix it.')

    // Home and You lead back here.
    await page.goto('/app')
    const home = region(page, 'Bank charges')
    await expect(home).toContainText('Waiting on your bank: ₹668.18')
    await page.getByRole('list', { name: 'Quick actions' }).getByRole('button', { name: 'Bank charges' }).click()
    await expect(page).toHaveURL(/\/app\/fees$/)
    await page.goto('/app/you')
    await expect(page.getByRole('list', { name: 'Money owed to you' })).toContainText('Bank charges')
  })

  test('an SBI statement: minimum balance after SBI stopped charging it, a UPI charge, and the switch to Basic Savings', async ({ page }) => {
    await open(page, '/app/fees')
    await addStatement(page, 'sbi-2026.csv')
    const claim = region(page, /^Claim back/)
    await expect(claim).toContainText('State Bank of India owes you ₹259.60')
    await expect(claim).toContainText('State Bank of India stopped charging for minimum balance on savings accounts from 11 Mar 2020.')
    await expect(claim).toContainText('UPI payments couldn’t be charged for at all on this date.')
    const avoid = region(page, 'Allowed, but avoidable')
    await expect(claim).toContainText('State Bank of India stopped charging for SMS alerts on savings accounts from 11 Mar 2020.')
    await expect(avoid).toContainText('₹236 on debit card fees.')
  })

  test('the ICICI .xls banks email, on a Basic Savings account: what must be free', async ({ page }) => {
    await open(page, '/app/fees')
    await addStatement(page, 'icici-basic.xls', 'application/vnd.ms-excel')
    // The statement says it's a Basic Savings account: no question, the answer shown.
    await expect(region(page, 'About your account')).toContainText('Basic Savings (BSBD) or Jan Dhan · no minimum balance')
    const claim = region(page, /^Claim back/)
    await expect(claim).toContainText('ICICI Bank owes you ₹676.14')
    await expect(claim).toContainText('A Basic Savings account can’t be charged for minimum balance.')
    await expect(claim).toContainText('A Basic Savings account gets 4 free withdrawals a month. You made 2.')
    await expect(claim).toContainText('This is free on a Basic Savings account.')
  })

  test('past the bank’s 30 days: the RBI Ombudsman, then the money back', async ({ page }) => {
    await open(page, '/app/fees', { fees: RAISED })
    const claims = region(page, /^Your claims/)
    await expect(claims).toContainText('No fix in 30 days. Take it to the RBI Ombudsman by 23 Jan 2027.')
    await claims.getByRole('button', { name: 'Take it to the RBI Ombudsman' }).click()
    const sheet = page.getByRole('dialog', { name: 'Take it to the RBI Ombudsman' })
    await expect(sheet.getByRole('link', { name: /Open cms\.rbi\.org\.in/ })).toHaveAttribute('href', 'https://cms.rbi.org.in')
    await expect(sheet).toContainText('25 September 2026, HDFC-77812')
    await expect(sheet.getByTestId('fee-letter')).toContainText('I complained to HDFC Bank on 25 September 2026 (complaint number HDFC-77812)')
    await sheet.getByRole('button', { name: 'Close' }).click()
    await claims.getByRole('button', { name: 'It’s back' }).click()
    const back = page.getByRole('dialog', { name: 'How much came back?' })
    await back.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('₹508 back from your bank. Nice.')).toBeVisible()
    await expect(region(page, /^Your claims/)).toContainText('HDFC Bank put back ₹508')
    await expect(region(page, /^Your claims/)).toContainText('₹508 back on 3 Nov 2026')
    await expect(hero(page)).toContainText('Back from your bank')
  })

  test('pasted SMS: three charges, one put back; a PDF is said to be unreadable; Undo', async ({ page }) => {
    await open(page, '/app/fees')
    await page.getByRole('button', { name: 'Paste bank SMS' }).click()
    const paste = page.getByRole('dialog', { name: 'Paste your bank’s SMS' })
    await paste.getByRole('textbox', { name: 'Bank SMS' }).fill(fixture('charge-sms.txt').toString())
    await paste.getByRole('button', { name: 'Check them' }).click()
    // The reversal SMS is dated 5 Nov, after today: it hasn't happened yet, so nothing is put back.
    await expect(page.getByText('3 charges added', { exact: true })).toBeVisible()
    await expect(region(page, /^All charges/)).toBeVisible()

    await page.getByLabel('Check a statement', { exact: true }).setInputFiles({ name: 'statement.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') })
    await expect(page.getByText('PDF statements can’t be read yet. Download it as Excel or CSV from your bank’s app or net banking.')).toBeVisible()
  })

  test.describe('on a 320 px phone, and with axe', () => {
    test('the screen and the letter', async ({ page }) => {
      await open(page, '/app/fees')
      await expectAccessible(page)
      await addStatement(page, 'hdfc-oct-2026.csv')
      await expect(hero(page)).toContainText('₹641.04')
      await expectFits320(page, page.getByRole('main'))
      await expectAccessible(page)
      await region(page, /^Claim back/).getByRole('button', { name: /^Claim ₹/ }).click()
      const sheet = page.getByRole('dialog', { name: 'Write to HDFC Bank' })
      await expect(sheet).toBeVisible()
      await expectFits320(page, sheet)
      await expectAccessible(page)
    })
  })
})
