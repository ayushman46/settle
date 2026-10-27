/**
 * "To collect", in a real browser: from Home's balance card ("Get paid back") to everyone who owes
 * you, longest wait first; a reminder copied is remembered (and the next one says to wait), and
 * Paid ticks someone off with Undo. Accessible, and fitting a 320 px phone.
 */
import type { Expense } from '../src/domain/types'
import { expectAccessible } from './support/a11y'
import { expectNoSideScroll } from './support/claims'
import { expect, test } from './support/fixtures'
import { friend, seed } from './support/seed'

function split(id: string, title: string, date: string, people: string[], total: number): Expense {
  const share = total / (people.length + 1)
  return {
    id,
    kind: 'split',
    title,
    category: 'food',
    currency: 'INR',
    total,
    date,
    createdAt: 1_792_000_000_000,
    updatedAt: 1_792_000_000_000,
    payerId: 'me',
    mode: 'equal',
    participants: ['me', ...people].map((friendId) => ({ friendId, input: null })),
    shares: Object.fromEntries(['me', ...people].map((p) => [p, share])),
    roundedToWhole: false,
    note: null,
    groupId: null,
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
  }
}

test('to collect: from Home, remind someone and tick off someone who paid', async ({ page, shared }) => {
  await seed(page, {
    friends: [friend('riya', 'Riya Sharma'), friend('sam', 'Sam')],
    expenses: [split('dinner', 'Dinner', '2026-10-10', ['riya', 'sam'], 90_000), split('cab', 'Cab', '2026-10-20', ['sam'], 40_000)],
  })
  await page.goto('/app')
  await page.getByRole('region', { name: 'Your balance' }).getByRole('button', { name: /Get paid back/ }).click()
  await expect(page).toHaveURL(/\/app\/collect$/)
  await expect(page.getByRole('heading', { level: 1, name: 'To collect' })).toBeVisible()
  await expect(page.getByText(/₹800 from 2 people/)).toBeVisible()
  await expectAccessible(page)
  await page.setViewportSize({ width: 320, height: 720 })
  await expectNoSideScroll(page)
  await page.setViewportSize({ width: 390, height: 844 })

  await page.getByRole('button', { name: 'Remind Riya Sharma' }).click()
  const sheet = page.getByRole('dialog', { name: 'Nudge Riya' })
  await expect(sheet.getByRole('radio', { name: /Friendly/ })).toHaveAttribute('aria-checked', 'true')
  await sheet.getByRole('button', { name: 'Copy' }).click()
  expect((await shared()).clipboard.at(-1)).toContain('₹300')
  await page.keyboard.press('Escape')
  const riya = page.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Remind Riya Sharma' }) })
  await expect(riya).toContainText('Reminded today · give it a day')

  await page.getByRole('button', { name: 'Sam paid you' }).click()
  await expect(page.getByText('Sam marked paid')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remind Sam' })).toHaveCount(0)
  await expect(page.getByText(/₹300 from 1 person/)).toBeVisible()
})
