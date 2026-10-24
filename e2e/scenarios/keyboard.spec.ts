/**
 * Scenario (c): keyboard only. A new phone is set up with the keyboard alone (the language step
 * included), a split is made, saved, turned into a pay link, and the link is copied, with no mouse
 * or touch. Every control is reached with Tab and used with Enter or Space.
 */
import { expect, test } from '../support/fixtures'
import { activateWithKeyboard, expectNoRawKeys, tabTo } from '../support/scenarios'

test.describe('keyboard only', () => {
  test.describe.configure({ timeout: 240_000 })

  test('onboarding (language included) → split → expense → share, without a pointer', async ({ page, shared }) => {
    await page.goto('/app')
    await expect(page).toHaveURL(/\/app\/welcome/)

    // The language step: choose English with the keyboard, then Continue.
    await expect(page.getByRole('heading', { name: 'Choose your language' })).toBeVisible()
    const english = page.getByRole('radio', { name: /English/ }).first()
    await tabTo(page, english)
    await page.keyboard.press('Space')
    await expect(english).toBeChecked()
    await activateWithKeyboard(page, page.getByRole('button', { name: 'Continue' }))

    // The intro slides: Next twice, then Get started.
    await expect(page.getByRole('heading', { name: 'Snap the bill' })).toBeVisible()
    await activateWithKeyboard(page, page.getByRole('button', { name: 'Next' }))
    await activateWithKeyboard(page, page.getByRole('button', { name: 'Next' }))
    await activateWithKeyboard(page, page.getByRole('button', { name: 'Get started' }))

    // Your details: type the name and UPI ID, then Start splitting.
    await expect(page.getByRole('heading', { name: 'Let’s set you up' })).toBeVisible()
    await tabTo(page, page.getByRole('textbox', { name: 'Your name' }))
    await page.keyboard.type('Ayush')
    await tabTo(page, page.getByRole('textbox', { name: 'Your UPI ID (optional)' }))
    await page.keyboard.type('ayush@okicici')
    await activateWithKeyboard(page, page.getByRole('button', { name: 'Start splitting' }))
    await expect(page).toHaveURL(/\/app$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Hi, Ayush' })).toBeVisible()
    await expectNoRawKeys(page)

    // A split, from Home, with the keyboard.
    await activateWithKeyboard(page, page.getByRole('button', { name: 'Split an expense' }))
    await expect(page).toHaveURL(/\/app\/split\/new/)
    await tabTo(page, page.getByRole('textbox', { name: 'Amount' }))
    await page.keyboard.type('1000')
    await tabTo(page, page.getByRole('textbox', { name: "What's it for?" }))
    await page.keyboard.type('Goa cab')
    const people = page.getByRole('textbox', { name: 'Search or add people' })
    for (const name of ['Riya', 'Sam']) {
      await tabTo(page, people)
      await page.keyboard.type(name)
      await page.keyboard.press('Enter')
      await expect(page.getByRole('button', { name: `Remove ${name}` })).toBeVisible()
    }
    await activateWithKeyboard(page, page.getByRole('button', { name: 'Save split' }))
    await expect(page.getByRole('dialog', { name: 'Split saved' })).toBeVisible()
    await expect(page).toHaveURL(/\/app\/expense\//, { timeout: 15_000 })
    await expect(page.getByRole('heading', { level: 1, name: 'Goa cab' })).toBeVisible()

    // The share sheet, the copy, and Escape to close.
    await activateWithKeyboard(page, page.getByRole('button', { name: 'Share pay link' }))
    const sheet = page.getByRole('dialog', { name: 'Share split' })
    await expect(sheet).toBeVisible()
    await activateWithKeyboard(page, sheet.getByRole('button', { name: 'Copy link' }))
    await expect(page.getByText('Pay link copied')).toBeVisible()
    const copied = (await shared()).clipboard.at(-1) ?? ''
    expect(copied).toMatch(/\/pay#/)

    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
  })
})
