/**
 * Trip currency (spec 06) in a real browser: a Bangkok trip group in rupees that spends in baht;
 * ฿1,250 split three ways is saved as ₹3,013.44 at the (mocked) ECB rate for 21 Oct, the group's
 * balances and its UPI settle-up stay in rupees; what the bank charged is taken exactly; offline,
 * the rate is added by hand. Also at 320 px, with axe on the panel and the rate sheet.
 */
import type { Page } from '@playwright/test'
import { expectAccessible } from './support/a11y'
import { expect, test } from './support/fixtures'
import { mockRates } from './support/mocks'
import { readUpiLink, upiQrLink } from './support/app'
import { friend, seed } from './support/seed'
import type { Group } from '../src/domain/types'

const RIYA = friend('riya', 'Riya', { upiId: 'riya@okicici' })
const SAM = friend('sam', 'Sam')

const BANGKOK: Group = {
  id: 'bkk',
  name: 'Bangkok',
  emoji: '✈️',
  kind: 'trip',
  currency: 'INR',
  memberIds: ['me', 'riya', 'sam'],
  settlements: [],
  createdAt: 1_792_000_000_000,
  updatedAt: 1_792_000_000_000,
  archived: false,
  travelCurrency: 'THB',
  roundSize: null,
}

test.describe('trip currency', () => {
  test.beforeEach(async ({ api }) => {
    // The ECB's latest day in these tests: 21 Oct (the fixture table of spec 06 §4).
    api.rates = { body: mockRates('2026-10-21'), headers: { 'cache-control': 'public, max-age=900' } }
  })

  test('a Bangkok trip: ฿1,250 split three ways is ₹3,013.44, settled in rupees by UPI', async ({ page, api }) => {
    await seed(page, { friends: [RIYA, SAM] })
    await page.goto('/app/groups?new=1')

    // A trip group in ₹, spending in THB.
    const create = page.getByRole('dialog', { name: 'New group' })
    await create.getByLabel('Group name').fill('Bangkok')
    const people = create.getByRole('combobox', { name: 'Add people to the group' }).or(create.getByRole('textbox', { name: 'Add people to the group' }))
    await people.fill('Riya')
    await people.press('Enter')
    await people.fill('Sam')
    await people.press('Enter')
    await create.getByRole('button', { name: /^Spending in: Same as the group/ }).click()
    const picker = page.getByRole('dialog', { name: 'Spending in' })
    await picker.getByRole('button', { name: /Thai Baht/ }).click()
    await expect(create.getByRole('button', { name: 'Spending in: Thai baht · THB. Change' })).toBeVisible()
    await create.getByRole('button', { name: 'Create group' }).click()

    // Add expense: already in baht.
    await page.getByRole('button', { name: 'Add expense' }).click()
    await expect(page.getByRole('button', { name: 'Currency: THB. Change' })).toBeVisible()
    await page.getByLabel('Amount', { exact: true }).fill('1250')
    const panel = page.getByRole('group', { name: 'Conversion' })
    await expect(panel.getByText('≈ ₹3,013.44')).toBeVisible()
    await expect(panel.getByText('1 THB = ₹2.4108')).toBeVisible()
    await expect(panel.getByText('ECB rate for 21 Oct')).toBeVisible()
    await expect(panel.getByRole('switch', { name: 'Settle in ₹ (recommended)' })).toHaveAttribute('aria-checked', 'true')
    expect(api.calls.rates.length).toBeGreaterThan(0)

    await page.getByLabel("What's it for?").fill('Dinner at Jay Fai')
    await page.getByRole('button', { name: /Paid by/ }).click()
    await page.getByRole('dialog', { name: 'Who paid?' }).getByRole('radio', { name: /Riya/ }).click()
    await expect(page.getByText('You’ll owe Riya ₹1,004.48')).toBeVisible()
    await page.getByRole('button', { name: 'Save split' }).click()
    await page.getByRole('dialog', { name: 'Split saved' }).click()

    // The expense: paid in baht, settled in rupees.
    await expect(page.getByRole('heading', { level: 1, name: 'Dinner at Jay Fai' })).toBeVisible()
    await expect(page.getByText('Paid ฿1,250 · 1 THB = ₹2.4108 (ECB, 21 Oct)')).toBeVisible()
    await expect(page.getByText('₹3,013.44').first()).toBeVisible()
    await expect(page.getByText('₹1,004.48').first()).toBeVisible()

    // Group balances and the settle-up are in rupees; UPI pays ₹1,004.48.
    await page.goto('/app/groups/bkk/settle'.replace('bkk', await groupId(page)))
    const pay = page.getByRole('button', { name: 'Pay Riya ₹1,004.48 via UPI' })
    await expect(pay).toBeVisible()
    await pay.click()
    expect(readUpiLink(await upiQrLink(page)).params.am).toBe('1004.48')
  })

  test('what the bank charged is taken exactly: ₹3,104.20', async ({ page }) => {
    await seed(page, { friends: [RIYA, SAM], groups: [BANGKOK] })
    await page.goto('/app/split/new?group=bkk')
    await page.getByLabel('Amount', { exact: true }).fill('1250')
    const panel = page.getByRole('group', { name: 'Conversion' })
    await expect(panel.getByText('≈ ₹3,013.44')).toBeVisible()
    await panel.getByRole('button', { name: 'Change the exchange rate' }).click()
    const sheet = page.getByRole('dialog', { name: 'Exchange rate' })
    await sheet.getByRole('radio', { name: 'What your bank charged' }).click()
    await sheet.getByLabel('Your bank charged').fill('3104.20')
    await expect(sheet.getByText('฿1,250 comes to ₹3,104.20')).toBeVisible()
    await expectAccessible(page)
    await sheet.getByRole('button', { name: 'Save' }).click()
    await expect(panel.getByText('≈ ₹3,104.20')).toBeVisible()
    await expect(panel.getByText('what your bank charged')).toBeVisible()
    await page.getByLabel("What's it for?").fill('Hotel deposit')
    await page.getByRole('button', { name: 'Save split' }).click()
    await page.getByRole('dialog', { name: 'Split saved' }).click()
    await expect(page.getByText('Paid ฿1,250 · 1 THB = ₹2.4834 (your bank: ₹3,104.20)')).toBeVisible()
  })

  test('offline: no rate, so it’s added by hand', async ({ page, api }) => {
    api.rates = null
    await seed(page, { friends: [RIYA, SAM], groups: [BANGKOK] })
    await page.goto('/app/split/new?group=bkk')
    await page.getByLabel('Amount', { exact: true }).fill('1250')
    const panel = page.getByRole('group', { name: 'Conversion' })
    await expect(panel.getByText(/^No rate for THB on \d{1,2} \w{3} — add it$/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save split' })).toBeDisabled()
    await expect(page.getByText('Add the rate to settle in ₹')).toBeVisible()
    await panel.getByRole('button', { name: 'Add rate' }).click()
    const sheet = page.getByRole('dialog', { name: 'Exchange rate' })
    await sheet.getByLabel('1 THB =').fill('2.5')
    await expect(sheet.getByText('฿1,250 comes to ₹3,125.00')).toBeVisible()
    await expectAccessible(page)
    await sheet.getByRole('button', { name: 'Save' }).click()
    await expect(panel.getByText('≈ ₹3,125.00')).toBeVisible()
    await expect(panel.getByText('your rate')).toBeVisible()
    await page.getByRole('button', { name: 'Save split' }).click()
    await page.getByRole('dialog', { name: 'Split saved' }).click()
    await expect(page.getByText('Paid ฿1,250 · 1 THB = ₹2.5 (your rate)')).toBeVisible()
  })
})

test.describe('trip currency at 320 px', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('the conversion panel fits and is accessible', async ({ page, api }) => {
    api.rates = { body: mockRates('2026-10-21') }
    await seed(page, { friends: [RIYA, SAM], groups: [BANGKOK] })
    await page.goto('/app/split/new?group=bkk')
    await page.getByLabel('Amount', { exact: true }).fill('150000')
    const panel = page.getByRole('group', { name: 'Conversion' })
    await expect(panel.getByText('≈ ₹3,61,612.68')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    const box = await panel.boundingBox()
    expect(box && box.x >= 0 && box.x + box.width <= 320).toBe(true)
    await expectAccessible(page)
  })
})

/** The id of the group on screen (from the address). */
async function groupId(page: Page): Promise<string> {
  const match = /\/app\/(?:groups\/([^/?#]+)|expense\/)/.exec(page.url())
  if (match?.[1]) return decodeURIComponent(match[1])
  // On the expense page: the only group in storage.
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('settle.v3.groups')
    const parsed = raw ? (JSON.parse(raw) as { data: Array<{ id: string; name: string }> }) : { data: [] }
    return parsed.data.find((g) => g.name === 'Bangkok')?.id ?? ''
  })
}
