/**
 * Udhaar in a real browser: Home → Lend / borrow → I gave → a new person, Riya → ₹500 → Save,
 * and Home says Riya owes you ₹500; I got → Sam → ₹120 → Auto → Save, and both show on Home;
 * on Riya's entry, Got some back ₹200 leaves ₹300 still to come, and the reminder says "the ₹300
 * I lent you". Plus a keyboard-only run, and axe on the screen.
 */
import { expectAccessible } from './support/a11y'
import { expect, test } from './support/fixtures'
import { friend, seed } from './support/seed'

const SLOW = { timeout: 30_000 }

test('lends to someone new, borrows from Sam, then takes some back', async ({ page }) => {
  await seed(page, { friends: [friend('sam', 'Sam')] })
  await page.goto('/app')
  await page.getByRole('button', { name: 'Lend / borrow' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Lend or borrow' })).toBeVisible(SLOW)
  await expect(page.getByRole('radio', { name: 'I gave' })).toHaveAttribute('aria-checked', 'true')

  // A new person, from "Someone else".
  await page.getByRole('radio', { name: 'Someone else' }).click()
  const sheet = page.getByRole('dialog', { name: 'Someone else' })
  await sheet.getByLabel('Search or add a person').fill('Riya')
  await sheet.getByLabel('Search or add a person').press('Enter')
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('radio', { name: 'Riya' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByLabel('Amount', { exact: true })).toBeFocused()
  await page.keyboard.type('500')
  await expect(page.getByText('Riya will owe you ₹500')).toBeVisible()
  await expectAccessible(page)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Noted!' })).toBeVisible()
  await expect(page).toHaveURL(/\/app\/expense\//, SLOW)
  const riyaEntry = page.url()

  await page.goto('/app')
  await expect(page.getByRole('link', { name: 'Riya, owes you ₹500' })).toBeVisible(SLOW)

  // I got: Sam paid for my auto.
  await page.getByRole('button', { name: 'Lend / borrow' }).click()
  await page.getByRole('radio', { name: 'I got' }).click()
  await page.getByRole('radio', { name: 'Sam' }).click()
  await page.getByLabel('Amount', { exact: true }).fill('120')
  await page.getByRole('radio', { name: 'Auto' }).click()
  await expect(page.getByText("You'll owe Sam ₹120")).toBeVisible()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/expense\//, SLOW)
  await page.goto('/app')
  await expect(page.getByRole('link', { name: 'Riya, owes you ₹500' })).toBeVisible(SLOW)
  await expect(page.getByRole('link', { name: 'Sam, you owe ₹120' })).toBeVisible()

  // Riya returns ₹200.
  await page.goto(riyaEntry)
  const card = page.getByRole('region', { name: /^Cash · You lent Riya ₹500 on d{1,2} [A-Z][a-z]{2}$/ })
  await expect(card).toContainText('₹500 still to come', SLOW)
  await card.getByRole('button', { name: 'Got some back from Riya' }).click()
  const repay = page.getByRole('dialog', { name: 'How much did Riya return?' })
  await repay.getByLabel('Amount returned').fill('200')
  await repay.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('₹200 back · ₹300 still to come')).toBeVisible()
  await expect(card).toContainText('₹300 still to come')

  await card.getByRole('button', { name: 'Remind Riya' }).click()
  const nudge = page.getByRole('dialog', { name: 'Nudge Riya' })
  await nudge.getByRole('radio', { name: /Firm/ }).click()
  await expect(nudge.getByRole('figure', { name: 'Message to Riya' })).toContainText('the ₹300 I lent you')
})

test('saves with the keyboard alone', async ({ page }) => {
  await seed(page, { friends: [friend('riya', 'Riya', { lastUsedAt: 5 }), friend('sam', 'Sam', { lastUsedAt: 4 })] })
  await page.goto('/app/lend')
  await expect(page.getByRole('heading', { level: 1, name: 'Lend or borrow' })).toBeVisible(SLOW)
  // Direction → the people → (arrow to Riya, which picks her and moves on to the amount).
  await page.getByRole('radio', { name: 'I gave' }).focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('radio', { name: 'Riya' })).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page.getByRole('radio', { name: 'Riya' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByLabel('Amount', { exact: true })).toBeFocused()
  await page.keyboard.type('250')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Noted!' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Noted!' })).toContainText('Riya owes you ₹250')
})

test.describe('at 320 px', () => {
  test.use({ viewport: { width: 320, height: 640 } })

  test('fits without sideways scrolling', async ({ page }) => {
    await seed(page, { friends: [friend('riya', 'Riya Sharma-Venkataraman'), friend('sam', 'Sam')] })
    await page.goto('/app/lend?friend=riya&amount=50000')
    await expect(page.getByText('Riya Sharma-Venkataraman will owe you ₹500')).toBeVisible(SLOW)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
