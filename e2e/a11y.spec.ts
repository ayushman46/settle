/**
 * Accessibility (axe-core, WCAG 2.2 AA) on the screens a first-time visitor and a friend with a
 * pay link see, in light and dark, at 360 and 390 px.
 */
import { expectAccessible } from './support/a11y'
import { copyPayLink, onboard, splitEqually } from './support/app'
import { expect, test } from './support/fixtures'

test.describe('accessibility', () => {
  test('the landing page and the intro slides', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectAccessible(page)

    await page.goto('/app')
    await expect(page.getByRole('heading', { name: 'Snap the bill' })).toBeVisible()
    await expectAccessible(page)
  })

  test('a new split, the saved expense and its share sheet', async ({ page, shared }) => {
    await onboard(page)
    await page.getByRole('button', { name: 'Split an expense' }).click()
    await page.getByRole('textbox', { name: 'Amount' }).fill('1000')
    await page.getByRole('textbox', { name: "What's it for?" }).fill('Goa cab')
    await expectAccessible(page)

    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByRole('button', { name: 'Discard' }).click()
    await splitEqually(page, { amount: '1000', title: 'Goa cab', people: ['Riya', 'Sam'] })
    await expectAccessible(page)

    await copyPayLink(page, async () => (await shared()).clipboard)
    await expectAccessible(page)
  })

  test("a friend's pay page, before and after picking their name", async ({ page, shared, openPhone }) => {
    await onboard(page)
    await splitEqually(page, { amount: '1000', title: 'Goa cab', people: ['Riya', 'Sam'] })
    const link = await copyPayLink(page, async () => (await shared()).clipboard)

    const friend = await openPhone()
    await friend.page.goto(link)
    await expect(friend.page.getByRole('heading', { name: 'Which one are you?' })).toBeVisible()
    await expectAccessible(friend.page)

    await friend.page.getByRole('button', { name: /Riya/ }).click()
    await expect(friend.page.getByRole('heading', { name: 'Riya’s share' })).toBeVisible()
    await expectAccessible(friend.page)
  })
})
