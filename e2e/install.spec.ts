import type { Page } from '@playwright/test'
/**
 * Install Settle: the Home card appears once there's a split (never on first paint), uses the
 * browser's own install prompt where one is offered, can be dismissed for good, and on iPhone opens
 * the two Share → Add to Home Screen steps instead.
 */
import { expect, test } from './support/fixtures'
import { friend, seed } from './support/seed'
import type { Expense } from '../src/domain/types'

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'

/** A ₹840 dinner split equally, so the phone has a first split. */
function dinner(): Expense {
  return {
    id: 'dinner',
    kind: 'split',
    title: 'Dinner',
    category: 'food',
    currency: 'INR',
    total: 84_000,
    date: '2026-10-20',
    createdAt: 1_792_000_000_000,
    updatedAt: 1_792_000_000_000,
    payerId: 'me',
    mode: 'equal',
    participants: [
      { friendId: 'me', input: null },
      { friendId: 'riya', input: null },
    ],
    shares: { me: 42_000, riya: 42_000 },
    roundedToWhole: false,
    note: null,
    groupId: null,
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
  }
}

/** What Chrome does once the app is installable: it offers its install prompt. */
async function offerInstallPrompt(page: Page) {
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
    event.prompt = async () => undefined
    event.userChoice = Promise.resolve({ outcome: 'dismissed' })
    window.dispatchEvent(event)
  })
}

test.describe('install settle', () => {
  test('after a first split, Chrome offers the install card; Not now hides it for good', async ({ page }) => {
    await seed(page, { friends: [friend('riya', 'Riya')], expenses: [dinner()] })
    await page.goto('/app')
    await expect(page.getByRole('heading', { name: 'Install Settle' })).toHaveCount(0)

    await offerInstallPrompt(page)
    await expect(page.getByRole('heading', { name: 'Install Settle' })).toBeVisible()
    await expect(page.getByText('Opens like an app, works offline.')).toBeVisible()

    await page.getByRole('button', { name: 'Not now' }).click()
    await expect(page.getByRole('heading', { name: 'Install Settle' })).toHaveCount(0)

    // Remembered on this phone: it stays away after a reload too.
    await page.reload()
    await offerInstallPrompt(page)
    await expect(page.getByRole('heading', { name: 'Install Settle' })).toHaveCount(0)
  })

  test('on iPhone the card opens the two Add to Home Screen steps', async ({ page }) => {
    await page.addInitScript((ua: string) => {
      Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => ua })
    }, IPHONE_UA)
    await seed(page, { friends: [friend('riya', 'Riya')], expenses: [dinner()] })
    await page.goto('/app')

    await expect(page.getByRole('heading', { name: 'Install Settle' })).toBeVisible()
    await page.getByRole('button', { name: 'How to install' }).click()
    const sheet = page.getByRole('dialog', { name: 'Add Settle to your Home Screen' })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByText('Tap Share')).toBeVisible()
    await expect(sheet.getByText('Tap Add to Home Screen')).toBeVisible()
    await sheet.getByRole('button', { name: 'Got it' }).click()
    await expect(sheet).toBeHidden()
  })

  test('a phone with no split and only one visit sees no card at all', async ({ page }) => {
    await seed(page, { friends: [friend('riya', 'Riya')] })
    await page.goto('/app')
    await offerInstallPrompt(page)
    await expect(page.getByRole('heading', { name: 'Install Settle' })).toHaveCount(0)
  })
})
