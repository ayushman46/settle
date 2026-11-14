/**
 * A group's Board. Everything on it is worked out from the group's own expenses and payments:
 * the leaderboard and titles, this week's challenge, who should get the next bill, the budget's
 * forecast and the story so far. Above the expenses: a bill added twice is caught, and what the
 * group buys again and again is added in one tap.
 */
import { expect, test } from './support/fixtures'
import { friend, seed } from './support/seed'
import type { Expense, Group, Settlement } from '../src/domain/types'

const RIYA = friend('riya', 'Riya', { upiId: 'riya@ybl' })
const SAM = friend('sam', 'Sam', { color: 3 })

/** YYYY-MM-DD, `back` days before today on this machine's clock (the app's "today"). */
function day(back: number): string {
  const d = new Date()
  d.setDate(d.getDate() - back)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

let n = 0
function split(id: string, title: string, total: number, back: number, payerId: string, ids: string[] = ['me', 'riya', 'sam']): Expense {
  n++
  return {
    id,
    kind: 'split',
    title,
    category: 'food',
    currency: 'INR',
    total,
    date: day(back),
    createdAt: n,
    updatedAt: n,
    payerId,
    mode: 'equal',
    participants: ids.map((friendId) => ({ friendId, input: null })),
    shares: Object.fromEntries(ids.map((i) => [i, total / ids.length])),
    roundedToWhole: false,
    note: null,
    groupId: 'goa',
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
  }
}

const paid = (id: string, fromId: string, toId: string, amount: number, back: number): Settlement => ({ id, fromId, toId, amount, date: day(back), createdAt: 50, method: 'upi' })

const GOA: Group = {
  id: 'goa',
  name: 'Goa trip',
  emoji: '🏖️',
  kind: 'trip',
  currency: 'INR',
  memberIds: ['me', 'riya', 'sam'],
  // Riya paid Ayush back the day after the hotel: a fast payment.
  settlements: [paid('p1', 'riya', 'me', 200000, 3)],
  createdAt: 1,
  updatedAt: 1,
  archived: false,
  travelCurrency: null,
  roundSize: null,
}

const EXPENSES: Expense[] = [
  split('hotel', 'Hotel', 600000, 4, 'me'),
  split('cab1', 'Cab', 30000, 3, 'riya'),
  split('chai1', 'Chai', 9000, 2, 'me'),
  split('cab2', 'Cab', 36000, 1, 'riya'),
  split('chai2', 'Chai', 9000, 1, 'me'),
  // The same dinner, added by two people.
  split('dinner1', 'Dinner at Toit', 240000, 0, 'me'),
  split('dinner2', 'Dinner', 240000, 0, 'riya'),
  // Two different things for the same amount on the same day: not a repeat.
  split('snacks', 'Snacks', 50000, 2, 'me'),
  split('ferry', 'Ferry', 50000, 2, 'me'),
]

test.describe('a group’s Board', () => {
  test.describe.configure({ timeout: 120_000 })

  test('a bill added twice is caught; what the group buys again is one tap', async ({ page }) => {
    await seed(page, { friends: [RIYA, SAM], groups: [GOA], expenses: EXPENSES })
    await page.goto('/app/groups/goa')
    await expect(page.getByText('Added twice?', { exact: true })).toBeVisible()
    await expect(page.getByText('“Dinner at Toit” and “Dinner” are both ₹2,400 (today): the same bill added twice?')).toBeVisible()
    // The button names the one it removes: the one added second.
    await page.getByRole('button', { name: 'Remove “Dinner”' }).click()
    await expect(page.getByText('Removed the second “Dinner”')).toBeVisible()
    // Snacks and Ferry (both ₹500, the same day) were never asked about.
    await expect(page.getByText('Added twice?', { exact: true })).toHaveCount(0)

    // "Cab" and "Chai" come round again and again.
    const again = page.getByRole('group', { name: 'Add again' })
    await expect(again.getByRole('button')).toHaveCount(2)
    await again.getByRole('button', { name: 'Add Chai again: ₹90' }).click()
    await expect(page.getByText('Chai added: ₹90, split 3 ways')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => (JSON.parse(window.localStorage.getItem('settle.v3.expenses') ?? '{"data":[]}').data as Array<{ title: string }>).filter((e) => e.title === 'Chai').length)).toBe(3)
    if (process.env.TRIP_SHOTS) await page.screenshot({ path: `${process.env.TRIP_SHOTS}/board-0-shortcuts.png`, fullPage: true })
  })

  test('the leaderboard, titles, the week, who pays next, the budget and the story so far', async ({ page }) => {
    await seed(page, { friends: [RIYA, SAM], groups: [GOA], expenses: EXPENSES.filter((e) => !['dinner2', 'snacks', 'ferry'].includes(e.id)) })
    await page.goto('/app/groups/goa?tab=board')

    // My move: Sam owes me the most, since the hotel.
    await expect(page.getByText('Your move')).toBeVisible()
    await expect(page.getByText(/^Sam owes you ₹/)).toBeVisible()

    // The leaderboard: everyone, ranked, with levels.
    const rows = page.getByRole('list').filter({ has: page.getByLabel('Rank 1') }).getByRole('listitem')
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0)).toContainText('pts')
    await expect(rows.filter({ hasText: 'Sam' })).toContainText('0 pts')
    await page.getByText('How points work').click()
    await expect(page.getByText('+20 each time you pay off what you owe (part payments count once the rest is paid)')).toBeVisible()
    await expect(page.getByText('+10 for every bill of ₹50 or more you pay for the group (up to 5 a day)')).toBeVisible()

    // Titles.
    await expect(page.getByText('The banker')).toBeVisible()
    await expect(page.getByText(/^You’ve paid ₹[\d,.]+ of other people’s shares$/)).toBeVisible()
    await expect(page.getByText(/^Riya clears a debt in/)).toBeVisible()
    await expect(page.getByText('On the clock')).toBeVisible()
    await expect(page.getByText('Sam has owed for 4 days')).toBeVisible()

    // The week, and what the group has reached together.
    await expect(page.getByText('This week: square by Sunday')).toBeVisible()
    await expect(page.getByText('Milestones')).toBeVisible()
    await expect(page.getByText('1 of 8 reached')).toBeVisible()
    await expect(page.getByText('6 of 10')).toBeVisible()

    // A budget: saved on this phone, and the forecast appears.
    await page.getByRole('textbox', { name: 'Budget for this group' }).fill('20000')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Budget saved')).toBeVisible()
    await expect(page.getByText(/left of ₹20,000/)).toBeVisible()
    await expect(page.getByText(/At this pace it runs out/)).toBeVisible()
    // A slip of the thumb is not a ₹12 budget.
    await page.getByRole('textbox', { name: 'Budget for this group' }).fill('12abc')
    await expect(page.getByText('Use digits only, like 20000.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()

    // The story so far, shared as a message.
    await expect(page.getByText('The story so far')).toBeVisible()
    await expect(page.getByText('Biggest bill: Hotel, ₹6,000 (you paid)')).toBeVisible()
    await page.getByRole('button', { name: 'Share the recap' }).click()
    const sharedOut = await page.evaluate(() => window.__e2eShared)
    const message = [...(sharedOut?.sheets ?? []).map((s) => JSON.stringify(s)), ...(sharedOut?.clipboard ?? [])].join('\n')
    expect(message).toContain('Goa trip: the story so far')
    expect(message).toContain('Leaderboard: 1. Ayush')
    expect(message).not.toContain('You')
    if (process.env.TRIP_SHOTS) await page.screenshot({ path: `${process.env.TRIP_SHOTS}/board-1.png`, fullPage: true })

    // No sideways scrolling, and the tab is reachable from the group.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    await page.goto('/app/groups/goa')
    await page.getByRole('radio', { name: 'Board' }).click()
    await expect(page.getByText('Leaderboard')).toBeVisible()
  })
})
