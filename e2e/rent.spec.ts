/**
 * Rent & HRA receipts, in a real browser: set up a flat's rent (three flatmates, custom shares,
 * the landlord's UPI ID and PAN), send this month's rent link, open it on a flatmate's phone and
 * see the landlord collecting their exact share with the UPI apps ready, then make HRA receipts
 * for the financial year — accessible, and fitting a 320 px phone.
 */
import { expectAccessible } from './support/a11y'
import { onboard, readUpiLink, UPI_PAYMENT_LINKS, upiQrLink } from './support/app'
import { expectNoSideScroll } from './support/claims'
import { expect, test } from './support/fixtures'

test('rent: set up, send the link, a flatmate pays the landlord directly, receipts for HRA', async ({ page, shared, openPhone }) => {
  await onboard(page)
  await page.goto('/app/rent')
  await expect(page.getByRole('heading', { name: 'Rent, split right' })).toBeVisible()
  await expectAccessible(page)
  await page.getByRole('button', { name: 'Set up your rent' }).click()

  await page.getByRole('textbox', { name: 'What do you call the flat?' }).fill('Flat 302, Koramangala')
  await page.getByRole('textbox', { name: 'Full address' }).fill('302, Sunrise Apartments, Koramangala, Bengaluru 560095')
  await page.getByRole('textbox', { name: 'Rent a month' }).fill('42000')
  const search = page.getByRole('textbox', { name: 'Search or add flatmates' })
  for (const name of ['Riya', 'Sam']) {
    await search.fill(name)
    await search.press('Enter')
    await expect(page.getByRole('button', { name: `Remove ${name}` })).toBeVisible()
  }
  await expect(page.getByRole('textbox', { name: 'Your share' })).toHaveValue('14,000')
  await page.getByRole('textbox', { name: 'Your share' }).fill('16000')
  await page.getByRole('textbox', { name: 'Riya’s share' }).fill('13000')
  await page.getByRole('textbox', { name: 'Sam’s share' }).fill('13000')
  await expect(page.getByText('Adds up to the rent ✓')).toBeVisible()
  await page.getByRole('textbox', { name: 'Landlord’s name' }).fill('Ramesh Kumar')
  await page.getByRole('textbox', { name: 'Landlord’s UPI ID (optional)' }).fill('ramesh.kumar@okhdfcbank')
  await page.getByRole('textbox', { name: 'Landlord’s PAN (optional)' }).fill('ABCDE1234F')
  await expectAccessible(page)
  await page.getByRole('button', { name: 'Save rent' }).click()

  await expect(page).toHaveURL(/\/app\/rent\/[^/]+$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Flat 302, Koramangala' })).toBeVisible()
  await expectAccessible(page)
  await page.getByRole('button', { name: 'Send rent link' }).click()
  await expect
    .poll(async () => {
      const { clipboard, sheets } = await shared()
      return [...clipboard, ...sheets.map((s) => `${s.text ?? ''} ${s.url ?? ''}`)].join('\n')
    })
    .toMatch(/\/pay#\S{20,}/)
  const { clipboard, sheets } = await shared()
  const text = [...clipboard, ...sheets.map((s) => `${s.text ?? ''} ${s.url ?? ''}`)].join('\n')
  const link = /https?:\/\/\S+\/pay#\S+/.exec(text)?.[0] ?? ''
  expect(text).toMatch(/tap your name and pay Ramesh Kumar your share directly/)

  // A flatmate opens it: the landlord collects, Riya pays her ₹13,000 straight to him.
  const friend = await openPhone()
  await friend.page.goto(link)
  await expect(friend.page.getByRole('heading', { level: 1, name: /^Ramesh Kumar requested money for Rent · / })).toBeVisible()
  await friend.page.getByRole('button', { name: /Riya/ }).click()
  // Over ₹2,000 to a person: pay by UPI ID (or scan the QR from another phone) — never a payment link.
  await expect(friend.page.getByText('Enter ₹13,000')).toBeVisible()
  await expect(friend.page.getByText(/For more than ₹2,000 to a person/)).toBeVisible()
  await expect(friend.page.locator(UPI_PAYMENT_LINKS)).toHaveCount(0)
  const upi = readUpiLink(await upiQrLink(friend.page))
  expect(upi.params).toMatchObject({ pa: 'ramesh.kumar@okhdfcbank', pn: 'Ramesh Kumar', am: '13000.00', cu: 'INR' })

  // Receipts for HRA: one a month for the financial year, for your own share.
  await page.getByRole('button', { name: 'Get rent receipts' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Rent receipts' })).toBeVisible()
  const receipts = page.getByRole('article')
  await expect(receipts).toHaveCount(12)
  await expect(receipts.first()).toContainText('Received with thanks from Ayush the sum of ₹16,000.00 (Rupees Sixteen Thousand Only)')
  await expect(receipts.first()).toContainText('PAN of landlord: ABCDE1234F')
  await page.getByRole('radio', { name: 'a quarter' }).click()
  await expect(receipts).toHaveCount(4)
  await expect(page.getByText('4 receipts · ₹1,92,000 in all')).toBeVisible()
  await expectAccessible(page)

  await page.setViewportSize({ width: 320, height: 720 })
  await expectNoSideScroll(page)
})
