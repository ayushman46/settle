/**
 * Food-delivery splits (spec 08), in a real browser: Home → "Food order" → upload the order
 * screenshot (the scan is mocked with the spec's Swiggy order) → the four fees on review → who
 * had what → fees shared equally (Riya ₹411.72, Sam ₹355.73, you ₹122.40, Kabir nothing) or by
 * what each had (₹424.68 / ₹362.38 / ₹102.79) → saved, with each person's fees on the expense and
 * the same amounts on the pay link. Axe on the review and paid steps; also at 320 px.
 */
import type { Page } from '@playwright/test'
import { expectAccessible } from './support/a11y'
import { copyPayLink } from './support/app'
import { expect, test } from './support/fixtures'
import { SAMPLE_DELIVERY_SCAN } from './support/mocks'
import { friend, seed } from './support/seed'

const PEOPLE = [friend('riya', 'Riya'), friend('sam', 'Sam', { color: 2 }), friend('kabir', 'Kabir', { color: 3 })]

/** A real PNG "screenshot" (the scan itself is mocked). */
async function screenshotFile(page: Page): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 360
    canvas.height = 640
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 360, 640)
      ctx.fillStyle = '#fc8019'
      ctx.fillRect(0, 0, 360, 56)
      ctx.fillStyle = '#111111'
      ctx.font = '16px sans-serif'
      ctx.fillText('Behrouz Biryani — To pay ₹889.85', 16, 96)
    }
    return canvas.toDataURL('image/png')
  })
  return { name: 'swiggy-order.png', mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1] ?? '', 'base64') }
}

/** Home → Food order → upload → review with the order's items and fees. */
async function scanOrder(page: Page): Promise<void> {
  await page.goto('/app', { timeout: 90_000 })
  await page.getByRole('list', { name: 'Quick actions' }).getByRole('button', { name: 'Food order' }).click()
  await expect(page).toHaveURL(/\/app\/bill/)
  await expect(page.getByRole('heading', { level: 1, name: 'Split a food order' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Choose screenshot' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Take a photo' })).toBeVisible()
  await page.getByLabel('Choose a photo of the bill').setInputFiles(await screenshotFile(page))
  await expect(page.getByRole('heading', { level: 1, name: 'Check the items' })).toBeVisible({ timeout: 20_000 })
}

/** Assigns the order as in spec 08 §4.1 from the "Who had what?" step. */
async function assignOrder(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: 'Who had what?' })).toBeVisible()
  const picks: Array<[string, string[]]> = [
    ['Chicken Biryani', ['Riya']],
    ['Paneer Butter Masala', ['Sam']],
    ['Garlic Naan', ['Riya', 'Sam']],
    ['Gulab Jamun (2 pcs)', ['You']],
  ]
  for (const [item, names] of picks) {
    const sheet = page.getByRole('dialog', { name: item })
    await expect(sheet).toBeVisible()
    for (const name of names) await sheet.getByRole('button', { name: new RegExp(`^${name}\\b`) }).click()
    await sheet.getByRole('button', { name: item === 'Gulab Jamun (2 pcs)' ? 'Done' : /^Next/ }).click()
  }
  await expect(page.getByRole('heading', { level: 1, name: "Here's the split" })).toBeVisible()
}

function personRow(page: Page, name: string) {
  return page.getByRole('list', { name: "Everyone's share" }).getByRole('button', { name: new RegExp(`^${name},`) })
}

test.describe('food-delivery split', () => {
  test.beforeEach(async ({ page, api }) => {
    api.scan = { body: SAMPLE_DELIVERY_SCAN }
    await seed(page, { friends: PEOPLE })
  })

  test('fees shared equally or by what each had — to the paisa, saved with each person’s fees', async ({ page, shared }) => {
    test.setTimeout(150_000)
    await scanOrder(page)

    // Review: the four fees, each its own row.
    const fees = page.getByRole('region', { name: 'Fees & charges' })
    await expect(fees.getByRole('button', { name: /, edit$/ })).toHaveCount(4)
    for (const name of ['Delivery partner fee, ₹35, edit', 'Platform fee, ₹10, edit', 'Restaurant packaging, ₹25, edit', 'Rain fee, ₹20, edit']) {
      await expect(fees.getByRole('button', { name })).toBeVisible()
    }
    await expect(fees.getByText("You'll choose how to share fees on the next step.")).toBeVisible()
    await page.getByRole('button', { name: 'Looks good' }).click()

    // What you paid: the order total; fees shared equally by default.
    await expect(page.getByRole('heading', { level: 1, name: 'What did you actually pay?' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /^Amount you paid/ })).toHaveValue('889.85')
    const policy = page.getByRole('radiogroup', { name: 'How should fees be shared?' })
    await expect(policy.getByRole('radio', { name: 'Equally' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByText('₹90 in fees split equally between everyone who ordered — tax and the ₹100 coupon go by what each had.', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: "Next: who's splitting" }).click()

    // Who's splitting: Riya, Sam and Kabir (you're in already).
    const search = page.getByRole('textbox', { name: 'Search or add people at the table' })
    for (const name of ['Riya', 'Sam', 'Kabir']) {
      await search.fill(name)
      await search.press('Enter')
    }
    await page.getByRole('button', { name: 'Next: who had what' }).click()
    await assignOrder(page)

    // Equal fees: ₹30 each for the three who ordered; Kabir pays nothing.
    await expect(personRow(page, 'Riya')).toContainText('₹411.72')
    await expect(personRow(page, 'Sam')).toContainText('₹355.73')
    await expect(personRow(page, 'You')).toContainText('₹122.40')
    await expect(personRow(page, 'Kabir')).toContainText("Didn't order · ₹0")
    await personRow(page, 'Riya').click()
    const riyaLines = page.getByRole('list', { name: "Everyone's share" }).locator('li').filter({ hasText: 'Riya' })
    await expect(riyaLines).toContainText('Fees+₹30.00')
    await expect(riyaLines).toContainText('Tax, charges & offers-₹27.28')

    // Back to "What you paid": fees by what each had.
    for (const step of ['Who had what?', "Who's splitting?", 'What did you actually pay?']) {
      await page.goBack()
      await expect(page.getByRole('heading', { level: 1, name: step })).toBeVisible()
    }
    await expect(page.getByRole('heading', { level: 1, name: 'What did you actually pay?' })).toBeVisible()
    await policy.getByRole('radio', { name: 'By what each had' }).click()
    await expect(page.getByText('Fees, tax and the coupon are all shared by what each person had.', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: "Next: who's splitting" }).click()
    await page.getByRole('button', { name: 'Next: who had what' }).click()
    await page.getByRole('button', { name: 'See the split' }).click()
    await expect(personRow(page, 'Riya')).toContainText('₹424.68')
    await expect(personRow(page, 'Sam')).toContainText('₹362.38')
    await expect(personRow(page, 'You')).toContainText('₹102.79')

    // Saved: the expense lists each person's fees.
    await page.getByRole('button', { name: 'Save split' }).click()
    await expect(page).toHaveURL(/\/app\/expense\//, { timeout: 15_000 })
    const feeLines = page.getByRole('group', { name: 'Fees, by what each had' })
    await expect(feeLines).toContainText('Fees · Riya₹42.95')
    await expect(feeLines).toContainText('Fees · Sam₹36.65')
    await expect(feeLines).toContainText('Fees · You₹10.40')

    // The pay link carries the same shares.
    const link = await copyPayLink(page, async () => (await shared()).clipboard)
    const pay = await page.context().newPage()
    await pay.goto(link)
    for (const amount of ['₹424.68', '₹362.38']) await expect(pay.getByText(amount).first()).toBeVisible()
    await pay.close()
  })

  test('review and paid steps pass axe', async ({ page }) => {
    await scanOrder(page)
    await expectAccessible(page)
    await page.getByRole('button', { name: 'Platform fee, ₹10, edit' }).click()
    await expect(page.getByRole('dialog', { name: 'Fee' })).toBeVisible()
    await expectAccessible(page)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Looks good' }).click()
    await expect(page.getByRole('radiogroup', { name: 'How should fees be shared?' })).toBeVisible()
    await expectAccessible(page)
  })

  test.describe('at 320 px', () => {
    test.use({ viewport: { width: 320, height: 640 } })

    test('the fee rows and the fee policy fit without sideways scrolling', async ({ page }) => {
      await scanOrder(page)
      await expect(page.getByRole('region', { name: 'Fees & charges' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
      await page.getByRole('button', { name: 'Looks good' }).click()
      const policy = page.getByRole('radiogroup', { name: 'How should fees be shared?' })
      await expect(policy).toBeVisible()
      const box = await policy.boundingBox()
      expect((box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 999) <= 320).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
    })
  })
})
