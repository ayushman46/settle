/**
 * Collections (chanda), on two phones: the organiser creates "Riya's farewell" (₹500 × 3 people) and
 * copies the link; a friend opens it, picks Sam, sees the exact UPI request, says they've paid and
 * taps "Tell Ayush"; the organiser opens that signed reply and ticks Sam off — ₹500 of ₹1,500. Then
 * "Remind all" names the other two, a pay-what-you-want collection suggests ₹1,300, everything fits
 * 320 px, and axe finds nothing on the detail and the public page.
 */
import type { Page } from '@playwright/test'
import { expectAccessible } from './support/a11y'
import { readUpiLink, UPI_PAYMENT_LINKS, upiQrLink } from './support/app'
import { expect, test } from './support/fixtures'
import { friend, seed } from './support/seed'
import type { Contribution, Pool } from '../src/domain/types'

const SAM = friend('sam', 'Sam')
const KABIR = friend('kabir', 'Kabir')
const NEHA = friend('neha', 'Neha')
const UPI = 'ayush@okicici'

async function copiedLink(page: Page): Promise<string> {
  const shared = await page.evaluate(() => window.__e2eShared)
  const link = shared?.clipboard.at(-1)
  if (!link) throw new Error('The app did not copy a link')
  return link
}

/** Path + hash of a URL on the app's origin (each phone navigates on its own base URL). */
function local(url: string): string {
  const u = new URL(url)
  return `${u.pathname}${u.search}${u.hash}`
}

async function createFarewell(page: Page): Promise<void> {
  await seed(page, { profile: { upiId: UPI }, friends: [SAM, KABIR, NEHA] })
  await page.goto('/app/pools/new')
  await expect(page.getByRole('heading', { level: 1, name: "What's it for?" })).toBeVisible()
  await page.getByRole('radio', { name: 'Farewell' }).click()
  await page.getByRole('textbox', { name: 'For whom or what?' }).fill('Riya')
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue("Riya's farewell")
  await page.getByRole('radio', { name: '₹500' }).click()
  for (const name of ['Sam', 'Kabir', 'Neha']) await page.getByRole('checkbox', { name }).click()
  await page.getByRole('button', { name: 'Create collection' }).click()
  await expect(page).toHaveURL(/\/app\/pools\/[^/]+\?share=1$/)
  await expect(page.getByRole('heading', { level: 1, name: "Riya's farewell" })).toBeVisible()
}

test.describe('collections', () => {
  // Two phones and several full page loads each (slow on a cold dev server).
  test.describe.configure({ timeout: 180_000 })

  test('create → friend chips in by UPI → signed reply ticks them off', async ({ page, openPhone }) => {
    await createFarewell(page)
    await expect(page.getByText('of ₹1,500 (3 × ₹500)')).toBeVisible()
    await expect(page.getByText('0 of 3 in · 3 to go')).toBeVisible()
    await page.getByRole('button', { name: 'Copy link' }).click()
    await expect(page.getByText('Link copied')).toBeVisible()
    const link = await copiedLink(page)
    expect(link).toMatch(/\/pool#/)

    // The friend's phone: nothing stored, just the link.
    const friendPhone = await openPhone()
    const other = friendPhone.page
    await other.goto(local(link))
    await expect(other.getByRole('heading', { level: 1 })).toHaveText("Ayush is collecting for Riya's farewell")
    await expect(other.getByText('Be the first to chip in')).toBeVisible()
    await other.getByRole('button', { name: 'Sam' }).click()
    await expect(other.getByText('Your part')).toBeVisible()

    const upi = readUpiLink(await upiQrLink(other))
    expect(upi.scheme).toBe('upi:')
    expect(upi.params).toMatchObject({ pa: UPI, am: '500.00', tn: "Chanda Riya's farewell", cu: 'INR' })
    await expect(other.locator(UPI_PAYMENT_LINKS)).toHaveCount(0)

    // Paying by UPI ID: copy it, off to the UPI app, and back — it asks whether it went through.
    await other.getByRole('radio', { name: 'UPI ID' }).click()
    await other.getByRole('button', { name: 'Copy UPI ID' }).first().click()
    await other.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await other.getByRole('button', { name: 'Yes, I have' }).click()
    await expect(other.getByRole('checkbox', { name: 'I’ve paid ₹500' })).toBeChecked()

    const tell = other.getByRole('link', { name: 'Tell Ayush you’ve chipped in' })
    await expect(tell).toHaveAttribute('href', /^https:\/\/wa\.me\//)
    const message = new URL((await tell.getAttribute('href')) ?? '').searchParams.get('text') ?? ''
    expect(message).toMatch(/^Chipped in ₹500 for Riya's farewell 👋 — Sam\nTick me off: http/)
    const reply = message.split('Tick me off: ')[1] ?? ''
    expect(reply).toMatch(/\/app\/pools\/in#/)

    // Back on the organiser's phone: open the reply, tick Sam off.
    await page.goto(local(reply))
    await expect(page.getByRole('heading', { level: 1, name: 'Sam chipped in ₹500?' })).toBeVisible()
    await page.getByRole('button', { name: 'Yes, tick Sam off' }).click()
    await expect(page.getByText('Sam ticked off ✓')).toBeVisible()
    await expect(page.getByText('₹500', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('of ₹1,500 (3 × ₹500)')).toBeVisible()
    await expect(page.getByText('1 of 3 in · 2 to go')).toBeVisible()

    // The same reply again is a duplicate.
    await page.goto(local(reply))
    await expect(page.getByRole('heading', { level: 1, name: 'Already ticked' })).toBeVisible()
    await page.getByRole('button', { name: 'Open the collection' }).click()

    // Remind all: one message naming the two still to pay.
    await page.getByRole('button', { name: 'Remind all who haven’t chipped in' }).click()
    const sheet = page.getByRole('dialog', { name: 'Remind everyone' })
    await expect(sheet.getByTestId('pool-reminder-text')).toContainText("Riya's farewell 👋 — 1 of 3 in! Still to chip in: Kabir, Neha.")
    await expectAccessible(page)
    await sheet.getByRole('button', { name: 'Close' }).click()
    await expectAccessible(page)
    await expectAccessible(other)
  })

  test('pay what you want suggests ₹1,300 to someone not on the list', async ({ page, openPhone }) => {
    const guests: Contribution[] = ['A', 'B', 'C', 'D', 'E'].map((name, i) => ({
      id: `c${i}`,
      friendId: null,
      name,
      amount: 70000,
      date: '2026-10-20',
      method: 'upi',
      via: 'tick',
      replyId: null,
      createdAt: 1_792_000_000_000 + i,
    }))
    const pool: Pool = {
      id: 'ganpati',
      title: 'Ganpati puja chanda',
      occasion: 'puja',
      emoji: '🙏',
      currency: 'INR',
      mode: 'target',
      perPerson: null,
      target: 1_000_000,
      memberIds: [],
      expectedCount: 10,
      deadline: null,
      note: null,
      showAmounts: false,
      contributions: guests,
      secret: 'q83vEjRWZq7XJ8sQ2b5r0w',
      createdAt: 1_792_000_000_000,
      updatedAt: 1_792_000_000_000,
      closedAt: null,
    }
    await seed(page, { profile: { upiId: UPI }, pools: [pool] })
    await page.goto('/app/pools/ganpati')
    await expect(page.getByText('of ₹10,000 goal')).toBeVisible()
    await page.getByRole('button', { name: 'Copy link' }).click()
    const link = await copiedLink(page)

    const other = (await openPhone()).page
    await other.goto(local(link))
    await expect(other.getByText('₹3,500 of ₹10,000 · 5 chipped in')).toBeVisible()
    await other.getByRole('button', { name: 'I’m not on the list' }).click()
    await other.getByRole('textbox', { name: 'Your name' }).fill('Priya')
    await expect(other.getByRole('radio', { name: '₹1,300 (suggested)' })).toHaveAttribute('aria-checked', 'true')
    const upi = readUpiLink(await upiQrLink(other))
    expect(upi.params).toMatchObject({ am: '1300.00', tn: 'Chanda Ganpati puja chanda' })
    await other.getByRole('radio', { name: '₹251' }).click()
    expect(readUpiLink(await upiQrLink(other)).params.am).toBe('251.00')
  })

  test.describe('at 320 px', () => {
    test.use({ viewport: { width: 320, height: 720 } })

    test('the editor, detail and public page fit without sideways scrolling', async ({ page, openPhone }) => {
      await createFarewell(page)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
      await page.getByRole('button', { name: 'Copy link' }).click()
      const link = await copiedLink(page)
      const other = (await openPhone()).page
      await other.goto(local(link))
      await other.getByRole('button', { name: 'Kabir' }).click()
      await expect(other.getByText('Your part')).toBeVisible()
      expect(await other.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
      await page.goto('/app/pools')
      await expect(page.getByRole('heading', { level: 1, name: 'Collections' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
    })
  })
})
