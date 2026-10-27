/**
 * Fair bijli, in a real browser: a Delhi flat's 450-unit bill, one flatmate on AC every night.
 * The light users pay ₹199 each; the AC user pays their units and the ₹800 subsidy the flat lost
 * by crossing 400 units. Saved as an ordinary split. Accessible, and fitting a 320 px phone.
 */
import { expectAccessible } from './support/a11y'
import { onboard } from './support/app'
import { expectNoSideScroll } from './support/claims'
import { expect, test } from './support/fixtures'

test('Fair bijli: a Delhi bill split by AC nights, with the lost subsidy on the AC user', async ({ page }) => {
  await onboard(page)
  await page.goto('/app/bijli')
  await expect(page.getByRole('heading', { level: 1, name: 'Split the electricity bill fairly' })).toBeVisible()

  await page.getByRole('textbox', { name: 'Units on the bill' }).fill('450')
  await page.getByRole('textbox', { name: /^Amount on the bill/ }).fill('2592.19')
  const search = page.getByRole('textbox', { name: 'Search or add flatmates' })
  for (const name of ['Riya', 'Sam']) {
    await search.fill(name)
    await search.press('Enter')
    await expect(page.getByRole('button', { name: `Remove ${name}` })).toBeVisible()
  }
  const nights = page.getByRole('group', { name: 'Your AC nights' })
  await nights.getByRole('button', { name: 'Increase your AC nights' }).click()
  for (let i = 0; i < 29; i++) await nights.press('ArrowUp')
  await expect(nights).toContainText('30')
  await page.getByRole('textbox', { name: 'Everyday units for the flat' }).fill('270')

  const result = page.getByRole('region', { name: 'The fair split' })
  await expect(result.getByRole('listitem').first()).toContainText('₹2,193.65')
  await expect(result.getByRole('listitem').first()).toContainText('Subsidy lost ₹800')
  await expect(result.getByRole('listitem').nth(1)).toContainText('₹199.27')
  await expect(result.getByText('Without the extra units, the bill would have been about ₹597.81.')).toBeVisible()
  await expectAccessible(page)
  await page.setViewportSize({ width: 320, height: 720 })
  await expectNoSideScroll(page)
  await page.setViewportSize({ width: 390, height: 844 })

  await page.getByRole('button', { name: 'Save split' }).click()
  await expect(page).toHaveURL(/\/app\/expense\//, { timeout: 15_000 })
  await expect(page.getByRole('heading', { level: 1, name: /^Electricity · / })).toBeVisible()
})
