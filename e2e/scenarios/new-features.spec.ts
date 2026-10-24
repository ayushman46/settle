/**
 * Scenario (j): the new features, end to end with the AI mocked. A payment screenshot from the More
 * sheet marks the right person paid; the shagun book has no screen in this build yet (its rule is
 * unit-tested), so its scenario is skipped with the reason; the install card is covered at 320 px
 * in small-screens.spec.ts and in install.spec.ts.
 */
import { SAMPLE_PROOF } from '../support/mocks'
import { expect, test } from '../support/fixtures'
import { seed, friend } from '../support/seed'
import { equalExpense, expectNoRawKeys } from '../support/scenarios'

/** A 1×1 PNG: the picked file is read by the browser; the reply comes from the mock. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const SCREENSHOT = { name: 'payment.png', mimeType: 'image/png', buffer: PNG }

test.describe('new features with the AI mocked', () => {
  test.describe.configure({ timeout: 180_000 })

  test('Paid? Drop the screenshot: from More, a payment screenshot marks Riya’s ₹420 paid', async ({ page, api }) => {
    // Riya owes ₹420 of a ₹840 dinner.
    const dinner = equalExpense('dinner', 'Dinner', 84_000, '2026-10-20', 1_792_000_000_000, ['riya'])
    await seed(page, { friends: [friend('riya', 'Riya Sharma')], expenses: [dinner] })
    await page.goto('/app')
    await page.getByRole('button', { name: 'More' }).click()
    await page.getByRole('button', { name: 'Paid? Drop the screenshot' }).click()
    await expect(page).toHaveURL(/\/app\/proof$/)
    await expectNoRawKeys(page)

    await page.locator('input[type="file"]').setInputFiles(SCREENSHOT)
    await expect(page.getByText("Mark Riya Sharma's ₹420 as paid?")).toBeVisible()
    await expect(page.getByText('UPI ref 431287654321')).toBeVisible()
    expect(api.calls.proof).toHaveLength(1)

    await page.getByRole('button', { name: 'Mark as paid' }).click()
    await expect(page.getByText("Marked Riya Sharma's ₹420 as paid.").first()).toBeVisible()
    expect(SAMPLE_PROOF.amount).toBe(420)
  })

  test('shagun book: record a gift, see the balance, ask "what should I give?"', async () => {
    test.skip(true, 'shagun book has no screen in this build yet (069bb09 has the suggestion rule only); unit-tested in src/features/shagun')
  })
})
