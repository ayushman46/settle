/**
 * Scenario (a): offline after the first visit. The service worker keeps the app shell and the
 * code-split screens; with the network gone the app opens on Home, a manual split saves and shows,
 * and a pay link visited before opens again from the cache.
 *
 * Two runs of the same journey: straight after the first visit (the worker has just taken over),
 * and after one reload with the worker in control (the way most phones are when they go offline).
 */
import type { BrowserContext, Page } from '@playwright/test'
import { copyPayLink, onboard, splitEqually } from '../support/app'
import { expect, test } from '../support/fixtures'
import { expectNoRawKeys } from '../support/scenarios'

/** Waits until the service worker controls this page, so later loads come from its cache. */
async function workerInControl(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))
    }
  })
}

/** Onboard, make one split online, share its pay link, and visit that link once (its page is cached). */
async function firstVisit(page: Page, context: BrowserContext, shared: () => Promise<{ clipboard: string[] }>): Promise<string> {
  await onboard(page)
  await splitEqually(page, { amount: '1000', title: 'Goa cab', people: ['Riya', 'Sam'] })
  const link = await copyPayLink(page, async () => (await shared()).clipboard)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Share split' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL(/\/app$/)
  await workerInControl(page)

  const pay = await context.newPage()
  await pay.goto(link)
  await expect(pay.getByRole('heading', { name: 'Which one are you?' })).toBeVisible()
  await pay.close()
  return link
}

/** With the network gone: Home opens, a manual split saves and shows, and the pay link opens. */
async function offlineJourney(page: Page, context: BrowserContext, link: string): Promise<void> {
  await context.setOffline(true)
  try {
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: /^Hi, Ayush$/ })).toBeVisible({ timeout: 30_000 })
    await expectNoRawKeys(page)

    await splitEqually(page, { amount: '600', title: 'Chai and samosa', people: ['Kabir'] })
    await expect(page.getByText('Chai and samosa').first()).toBeVisible()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page).toHaveURL(/\/app$/)
    await expect(page.getByText('Chai and samosa').first()).toBeVisible()

    const offlinePay = await context.newPage()
    await offlinePay.goto(link)
    await expect(offlinePay.getByRole('heading', { name: 'Which one are you?' })).toBeVisible({ timeout: 30_000 })
    await expectNoRawKeys(offlinePay)
    await offlinePay.close()
  } finally {
    await context.setOffline(false)
  }
}

test.describe('offline after the first visit', () => {
  test.describe.configure({ timeout: 240_000 })

  test('straight after the first visit: Home, a split and the pay link work offline', async ({ page, context, shared }) => {
    const link = await firstVisit(page, context, shared)
    await offlineJourney(page, context, link)
  })

  test('after one online reload with the worker in control: Home, a split and the pay link work offline', async ({ page, context, shared }) => {
    const link = await firstVisit(page, context, shared)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: /^Hi, Ayush$/ })).toBeVisible()
    // Idle on Home, the app preloads its screens; give the worker time to keep them.
    await page.waitForTimeout(3000)
    await offlineJourney(page, context, link)
  })
})
