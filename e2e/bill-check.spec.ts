/**
 * Bill check, in a real browser: the sample bill's 5% service charge (with GST worked out on it
 * too) is flagged before anyone splits it — a note for the staff in their language, and one tap
 * to split without it (with Undo). Accessible, and fitting a 320 px phone.
 */
import { expectAccessible } from './support/a11y'
import { onboard } from './support/app'
import { expectNoSideScroll } from './support/claims'
import { expect, test } from './support/fixtures'

test('Bill check: a default service charge, the note for the staff, and splitting without it', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Scan bill' }).click()
  await expect(page).toHaveURL(/\/app\/bill/)
  await page.getByRole('button', { name: /^Try a sample/ }).click()
  await page.getByRole('button', { name: 'Looks good' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'What did you actually pay?' })).toBeVisible()

  const card = page.getByRole('region', { name: 'Possible saving ₹121.01' })
  await expect(card).toBeVisible()
  await expect(card.getByText('Service charge ₹115.25')).toBeVisible()
  await expect(card.getByText('About ₹5.76 of GST seems to be worked out on it too, and that comes off with it.')).toBeVisible()
  await expectAccessible(page)
  await page.setViewportSize({ width: 320, height: 720 })
  await expectNoSideScroll(page)
  await page.setViewportSize({ width: 390, height: 844 })

  // The note for the staff, in their language.
  await card.getByRole('button', { name: 'Show the staff' }).click()
  const sheet = page.getByRole('dialog', { name: 'Show this to the staff' })
  await expect(sheet.getByText('Hello! Could you please take the service charge (₹115.25) and the GST worked out on it (₹5.76) off our bill?')).toBeVisible()
  await sheet.getByRole('button', { name: 'हिन्दी' }).click()
  await expect(sheet.getByText('नमस्ते! कृपया हमारे बिल से सर्विस चार्ज (₹115.25) और उस पर लगा GST (₹5.76) हटा दें।')).toBeVisible()
  await expect(sheet.getByRole('link', { name: /Call 1915/ })).toHaveAttribute('href', 'tel:1915')
  await expectAccessible(page)
  await sheet.getByRole('button', { name: 'Done' }).click()
  await expect(sheet).toBeHidden()

  // They took it off: split without it.
  await card.getByRole('button', { name: 'Split without these' }).click()
  await expect(page.getByRole('textbox', { name: /^Amount you paid/ })).toHaveValue('2,177.99')
  await expect(page.getByText('Took ₹121.01 off the bill')).toBeVisible()
  await expect(page.getByText('Bill check: no service charge or tax surprises.')).toBeVisible()
  await page.getByRole('button', { name: 'Undo: Took ₹121.01 off the bill' }).click()
  await expect(page.getByRole('textbox', { name: /^Amount you paid/ })).toHaveValue('2,299')
  await expect(card).toBeVisible()
})
