/**
 * A Goa trip on three phones. Ayush makes the group with two names and invites; Riya and Sam open
 * the link on phones that have never seen Settle, pick their names and join. From then on the group
 * is the same on every phone by itself: Riya adds the cab, Sam the beers, and everyone's balances
 * agree. Riya settles up — "Pay ₹… with Google Pay" hands the payment to her UPI app — and the
 * payment she records shows on Ayush's phone without anyone sending anything.
 */
import type { Page } from '@playwright/test'
import { expect, test } from './support/fixtures'
import { friend, seed } from './support/seed'
import type { Expense, Group } from '../src/domain/types'

const RIYA = friend('riya', 'Riya')
const SAM = friend('sam', 'Sam', { color: 3 })
const GOA: Group = { id: 'goa', name: 'Goa trip', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: ['me', 'riya', 'sam'], settlements: [], createdAt: 1, updatedAt: 1, archived: false, travelCurrency: null, roundSize: null }

function local(url: string): string {
  const u = new URL(url)
  return `${u.pathname}${u.search}${u.hash}`
}

async function copied(page: Page): Promise<string> {
  const shared = await page.evaluate(() => window.__e2eShared)
  const link = shared?.clipboard.at(-1)
  if (!link) throw new Error('Nothing was copied')
  return link
}

/** Adds an equal split to the group on screen, paid by this phone's owner. */
async function addExpense(page: Page, title: string, amount: string): Promise<void> {
  await page.getByRole('button', { name: /^Add (?:an |the first )?expense$/ }).first().click()
  await expect(page).toHaveURL(/\/app\/split\/new/)
  await page.getByRole('textbox', { name: 'Amount' }).fill(amount)
  await page.getByRole('textbox', { name: "What's it for?" }).fill(title)
  await page.getByRole('button', { name: 'Save split' }).click()
  await expect(page).toHaveURL(/\/app\/expense\//, { timeout: 15_000 })
}

async function join(page: Page, link: string, name: string, upiId: string | null): Promise<void> {
  await page.goto(local(link))
  await expect(page.getByRole('heading', { level: 1, name: 'Goa trip' })).toBeVisible()
  await page.getByRole('radio', { name: new RegExp(`^${name[0]}?${name}`) }).click()
  await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveValue(name)
  if (upiId) await page.getByRole('textbox', { name: 'Your UPI ID (optional)' }).fill(upiId)
  if (process.env.TRIP_SHOTS) await page.screenshot({ path: `${process.env.TRIP_SHOTS}/2-join-${name}.png`, fullPage: true })
  await page.getByRole('button', { name: 'Join Goa trip' }).click()
  await expect(page).toHaveURL(/\/app\/groups\/[^/?]+/)
  await expect(page.getByRole('heading', { level: 1, name: 'Goa trip' })).toBeVisible()
}

test.describe('a trip on three phones', () => {
  test.describe.configure({ timeout: 240_000 })

  test('invite, join, add expenses on any phone, see the same balances, pay through the UPI app', async ({ page, openPhone }) => {
    // Ayush: the group, one expense, the invite.
    await seed(page, { profile: { name: 'Ayush', upiId: 'ayush@okicici' }, friends: [RIYA, SAM], groups: [GOA] })
    await page.goto('/app/groups/goa')
    await expect(page.getByRole('heading', { level: 2, name: 'Add your friends to this group' })).toBeVisible()
    await addExpense(page, 'Villa', '9000')
    await page.goto('/app/groups/goa')
    await page.getByRole('button', { name: 'Invite friends' }).click()
    const sheet = page.getByRole('dialog', { name: 'Invite to Goa trip' })
    await expect(sheet.getByText('Not yet')).toHaveCount(2)
    if (process.env.TRIP_SHOTS) await page.screenshot({ path: `${process.env.TRIP_SHOTS}/1-invite.png`, fullPage: true })
    await sheet.getByRole('button', { name: 'Copy the link' }).click()
    const link = await copied(page)
    expect(link).toMatch(/\/join#/)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('status').filter({ hasText: 'Live: everyone sees this group' })).toBeVisible({ timeout: 20_000 })

    // Riya, on a phone that has never opened Settle: the link, her name, her UPI ID. She's in.
    const riya = (await openPhone()).page
    await join(riya, link, 'Riya', 'riya@ybl')
    await expect(riya.getByText('Villa')).toBeVisible()
    await expect(riya.getByRole('heading', { level: 2, name: 'You owe' })).toBeVisible()
    await expect(riya.getByText('₹3,000').first()).toBeVisible()

    // Sam too.
    const sam = (await openPhone()).page
    await join(sam, link, 'Sam', null)
    await expect(sam.getByText('Villa')).toBeVisible()

    // Riya pays for the cab, Sam for the beers: each on their own phone.
    await addExpense(riya, 'Cab to Baga', '1200')
    await addExpense(sam, 'Beers', '600')

    // Ayush sees both without doing anything, and that both have joined.
    await expect(page.getByText('Cab to Baga')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Beers')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('3 of 3 joined')).toBeVisible()
    // 9000 + 1200 + 600 = 10,800: ₹3,600 each. Ayush paid 9,000: owed 5,400.
    await expect(page.getByRole('heading', { level: 2, name: 'You’re owed' })).toBeVisible()
    await expect(page.getByText('₹5,400').first()).toBeVisible()

    // Riya settles up: she owes 3,600 − 1,200 = 2,400, to Ayush, whose UPI ID came with the group.
    await riya.goto(riya.url().replace(/\/app\/expense\/.*/, '/app/groups'))
    await riya.getByRole('link', { name: /Goa trip/ }).or(riya.getByRole('button', { name: /Goa trip/ })).first().click()
    await expect(riya.getByText('Beers')).toBeVisible({ timeout: 30_000 })
    await riya.getByRole('button', { name: /Settle up/ }).click()
    await expect(riya).toHaveURL(/\/settle$/)
    await riya.getByRole('button', { name: /^Pay/ }).first().click()
    const pay = riya.getByRole('dialog')
    await expect(pay.getByText('ayush@okicici').first()).toBeVisible()
    await expect(pay.getByRole('button', { name: 'Pay ₹2,400 with Google Pay' })).toBeVisible()
    // Above ₹2,000: the UPI ID is copied for her UPI app.
    await pay.getByRole('button', { name: 'Pay ₹2,400 with Google Pay' }).click()
    await expect(pay.getByText('UPI ID copied. In Google Pay: Pay UPI ID, paste, enter ₹2,400.')).toBeVisible()
    if (process.env.TRIP_SHOTS) await riya.screenshot({ path: `${process.env.TRIP_SHOTS}/3-pay.png`, fullPage: true })
    expect(await copied(riya)).toBe('ayush@okicici')
    await pay.getByRole('button', { name: /I’ve paid/ }).click()

    // Ayush's phone shows her payment, and what he's still owed.
    await expect(page.getByText('₹3,000').first()).toBeVisible({ timeout: 30_000 })
  })
})

test.describe('paying, saying it, getting the app', () => {
  test.describe.configure({ timeout: 180_000 })
  const PAYEE = friend('riya', 'Riya', { upiId: 'riya@ybl' })
  const DINNER: Expense = {
    id: 'dinner',
    kind: 'split',
    title: 'Dinner',
    category: 'food',
    currency: 'INR',
    total: 90000,
    date: '2026-11-10',
    createdAt: 5,
    updatedAt: 5,
    payerId: 'riya',
    mode: 'equal',
    participants: [
      { friendId: 'me', input: null },
      { friendId: 'riya', input: null },
      { friendId: 'sam', input: null },
    ],
    shares: { me: 30000, riya: 30000, sam: 30000 },
    roundedToWhole: false,
    note: null,
    groupId: 'goa',
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
  }

  test('up to ₹2,000: “Pay ₹300 with PhonePe” hands the payee’s QR to the app, and the choice is remembered', async ({ page, shared }) => {
    await seed(page, { friends: [PAYEE, SAM], groups: [GOA], expenses: [DINNER] })
    await page.goto('/app/groups/goa/settle')
    await page.getByRole('button', { name: /^Pay/ }).first().click()
    const pay = page.getByRole('dialog')
    await pay.getByRole('radio', { name: 'PhonePe' }).click()
    await expect(pay.getByText('Opens PhonePe with Riya’s UPI ID and ₹300 filled in.')).toBeVisible()
    const before = (await shared()).sheets.length
    await pay.getByRole('button', { name: 'Pay ₹300 with PhonePe' }).click()
    await expect(pay.getByText('Pick PhonePe in the list: it opens on the payment to Riya, all filled in.')).toBeVisible()
    expect((await shared()).sheets.length).toBe(before + 1)
    // The labelled try is the only payment link, and it goes to the chosen app.
    await expect(pay.getByRole('link', { name: 'Or try the direct link to PhonePe' })).toHaveAttribute('href', /package=com\.phonepe\.app/)
    await pay.getByRole('button', { name: /I’ve paid/ }).click()
    await expect(page.getByText('Payment recorded')).toBeVisible()
    // Next time, PhonePe is already picked.
    await page.goto('/app/groups/goa')
    expect(await page.evaluate(() => window.localStorage.getItem('settle.v8.pay-app'))).toBe('phonepe')
  })

  test('“Say it” on a group’s page puts the expense in that group', async ({ page }) => {
    await seed(page, { friends: [RIYA, SAM], groups: [GOA] })
    await page.goto('/app/groups/goa')
    await page.getByRole('button', { name: 'Say it' }).click()
    const sheet = page.getByRole('dialog')
    await sheet.getByRole('textbox', { name: 'Describe the expense' }).fill('Cab 840 with Riya and Sam, Sam pays double')
    await sheet.getByRole('button', { name: 'Read it' }).click()
    await sheet.getByRole('button', { name: 'Looks right' }).click()
    await expect(page).toHaveURL(/\/app\/split\/new\?from=describe&group=goa/)
    await page.getByRole('button', { name: 'Save split' }).click()
    await expect(page).toHaveURL(/\/app\/expense\//, { timeout: 15_000 })
    await page.goto('/app/groups/goa')
    await expect(page.getByText('Cab')).toBeVisible()
    await expect(page.getByText('₹840 spent · 1 expense')).toBeVisible()
  })

  test('/get: how to install on Android and on iPhone, from the landing page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Get the app: Android & iPhone' }).first().click()
    await expect(page).toHaveURL(/\/get$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Get Settle on your phone' })).toBeVisible()
    await expect(page.getByText('Tap Install app')).toBeVisible()
    await page.getByRole('radio', { name: 'iPhone' }).click()
    await expect(page.getByText('Tap Add to Home Screen')).toBeVisible()
    await page.getByRole('link', { name: 'Open Settle' }).click()
    await expect(page).toHaveURL(/\/app/)
  })

  test('a late joiner gets everything from the first invite; a cut-off link says so', async ({ page, openPhone }) => {
    await seed(page, { profile: { name: 'Ayush', upiId: 'ayush@okicici' }, friends: [RIYA, SAM], groups: [GOA] })
    await page.goto('/app/groups/goa')
    await page.getByRole('button', { name: 'Invite friends' }).click()
    await page.getByRole('dialog', { name: 'Invite to Goa trip' }).getByRole('button', { name: 'Copy the link' }).click()
    const link = await copied(page)
    await page.keyboard.press('Escape')
    // Two expenses after the link went out.
    await addExpense(page, 'Scooters', '1500')
    await page.goto('/app/groups/goa')
    await addExpense(page, 'Ferry', '600')
    await page.goto('/app/groups/goa')
    await expect(page.getByRole('status').filter({ hasText: 'Live: everyone sees this group' })).toBeVisible({ timeout: 20_000 })

    const sam = (await openPhone()).page
    await join(sam, link, 'Sam', 'sam@oksbi')
    await expect(sam.getByText('Scooters')).toBeVisible({ timeout: 30_000 })
    await expect(sam.getByText('Ferry')).toBeVisible()
    // Sam's UPI ID reaches Ayush.
    await expect(page.getByText('2 of 3 joined')).toBeVisible({ timeout: 30_000 })
    // (Saved a moment after it's applied.)
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('settle.v3.friends')), { timeout: 15_000 }).toContain('sam@oksbi')

    const stranger = (await openPhone()).page
    await stranger.goto(local(link).slice(0, 40))
    await expect(stranger.getByRole('heading', { name: 'This invite can’t be opened' })).toBeVisible()
  })
})
