/**
 * No bill, and nobody asking "did you pay?" — in a real browser: split a dinner by what each
 * person had (tax and tip shared in proportion), ask each friend with their own link, a friend
 * opens it straight on their share and sends back "I've paid" with the UPI reference, and the
 * reply ticks them off on the payer's phone. Accessible, and fitting a 320 px phone.
 */
import { expectAccessible } from './support/a11y'
import { onboard } from './support/app'
import { expectNoSideScroll } from './support/claims'
import { expect, test } from './support/fixtures'

test('what each had → ask each person → "I’ve paid" reply ticks them off', async ({ page, shared, openPhone }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Split an expense' }).click()
  await expect(page).toHaveURL(/\/app\/split\/new/)
  await page.getByRole('textbox', { name: "What's it for?" }).fill('Dinner at Bastian')
  const search = page.getByRole('textbox', { name: 'Search or add people' })
  for (const name of ['Riya', 'Sam']) {
    await search.fill(name)
    await search.press('Enter')
    await expect(page.getByRole('button', { name: `Remove ${name}` })).toBeVisible()
  }

  // No bill: what each had, and the total from that.
  await page.getByRole('radio', { name: 'What each had' }).click()
  await expect(page.getByText(/No bill\? Type what each person had/)).toBeVisible()
  await page.getByRole('textbox', { name: 'What you had' }).fill('400')
  await page.getByRole('textbox', { name: 'What Riya had' }).fill('300')
  await page.getByRole('textbox', { name: 'What Sam had' }).fill('500')
  await page.getByRole('button', { name: 'Use ₹1,200' }).click()
  await expect(page.getByRole('textbox', { name: 'Amount' })).toHaveValue('1,200')

  // ₹180 of tax and tip on top: shared in proportion.
  await page.getByRole('textbox', { name: 'Amount' }).fill('1380')
  await expect(page.getByText('₹180 tax & tip shared in proportion')).toBeVisible()
  await expect(page.getByText('Pays ₹575')).toBeVisible()
  await expectAccessible(page)
  await page.setViewportSize({ width: 320, height: 720 })
  await expectNoSideScroll(page)
  await page.setViewportSize({ width: 390, height: 844 })

  await page.getByRole('button', { name: 'Save split' }).click()
  await expect(page).toHaveURL(/\/app\/expense\//, { timeout: 15_000 })
  await expect(page.getByRole('heading', { level: 1, name: 'Dinner at Bastian' })).toBeVisible()

  // Ask each person with their own link.
  await page.getByRole('button', { name: 'Share pay link' }).click()
  const each = page.getByRole('region', { name: 'Or ask each person' })
  await expect(each).toBeVisible()
  const ask = each.getByRole('link', { name: 'Ask Sam on WhatsApp' })
  await expect(ask).toBeVisible()
  const message = new URL((await ask.getAttribute('href')) ?? '').searchParams.get('text') ?? ''
  expect(message).toContain('Hi Sam! Your share of Dinner at Bastian is ₹575 🧾')
  const link = /https?:\/\/\S+\/pay#\S+/.exec(message)?.[0] ?? ''
  expect(link).not.toBe('')
  await expectAccessible(page)
  await page.keyboard.press('Escape')

  // Sam opens his own link: straight on his share — no "which one are you?".
  const friend = await openPhone()
  await friend.page.goto(link)
  await expect(friend.page.getByRole('heading', { level: 2, name: 'Sam’s share' })).toBeVisible()
  await expect(friend.page.getByRole('region', { name: 'Which one are you?' })).toHaveCount(0)

  // Paid by UPI: he adds the reference and tells Ayush.
  await friend.page.getByLabel('UPI reference (optional)').fill('4321 5678 9012')
  const tell = friend.page.getByRole('button', { name: 'Tell Ayush you’ve paid' })
  await expect(tell).toBeEnabled()
  await expectAccessible(friend.page)
  await tell.click()
  await expect
    .poll(async () => {
      const { clipboard, sheets } = await shared(friend.page)
      return [...clipboard, ...sheets.map((s) => `${s.text ?? ''} ${s.url ?? ''}`)].join('\n')
    })
    .toMatch(/\/app\/paid#\S+/)
  const { clipboard, sheets } = await shared(friend.page)
  const sent = [...clipboard, ...sheets.map((s) => `${s.text ?? ''} ${s.url ?? ''}`)].join('\n')
  expect(sent).toContain('UPI ref: 4321 5678 9012')
  const reply = /https?:\/\/\S+\/app\/paid#\S+/.exec(sent)?.[0] ?? ''

  // Ayush taps the reply: one tap and Sam is ticked off.
  await page.goto(reply)
  await expect(page.getByRole('heading', { name: 'Sam says they’ve paid ₹575' })).toBeVisible()
  await expect(page.getByText(/ref 4321 5678 9012/)).toBeVisible()
  await expectAccessible(page)
  await page.getByRole('button', { name: 'Mark Sam as paid' }).click()
  await expect(page).toHaveURL(/\/app\/expense\//)
  await expect(page.getByText('Sam is marked as paid')).toBeVisible()
})
