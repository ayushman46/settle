/**
 * The screen tour shared by the small-screen, accessibility and language scenarios: every main
 * screen and public page, with the data it needs (friends, a trip group, a 1-dinner history, and
 * a claim round and a collection made through the app, so their links are real).
 */
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { settleAnimations } from '../support/a11y'
import { copyPayLink } from '../support/app'
import { sampleBillToPeople } from '../support/claims'
import { seed, friend } from '../support/seed'
import type { Expense, Group } from '../../src/domain/types'
import { equalExpense } from '../support/scenarios'

export const RIYA = friend('riya', 'Riya')
export const SAM = friend('sam', 'Sam')
export const KABIR = friend('kabir', 'Kabir')

/** A trip with Goa costs in Thai baht as well: the group, and one expense that uses the trip currency. */
export const TRIP: Group = {
  id: 'g1',
  name: 'Goa trip',
  emoji: '🌴',
  kind: 'trip',
  currency: 'INR',
  memberIds: ['me', 'riya', 'sam'],
  settlements: [],
  createdAt: 1_792_000_000_000,
  updatedAt: 1_792_000_000_000,
  archived: false,
  travelCurrency: 'THB',
}

export const DINNER: Expense = equalExpense('dinner', 'Dinner at Toit', 120_000, '2026-10-20', 1_792_000_000_000, ['riya'])

export interface Tour {
  /** Paths on this phone's origin, in the order they are visited. */
  appPaths: string[]
  /** Public links made by the app (their full URLs, on this origin). */
  payLink: string
  claimLink: string
  poolLink: string
}

/**
 * Seeds the phone, makes a claim round and a collection through the app, and copies the three
 * public links. The phone is left on Home.
 */
export async function buildTour(page: Page, shared: () => Promise<{ clipboard: string[] }>): Promise<Tour> {
  await seed(page, {
    profile: { upiId: 'ayush@okicici' },
    friends: [RIYA, SAM, KABIR],
    groups: [TRIP],
    expenses: [DINNER],
  })

  // A claim round from the sample bill.
  await page.goto('/app')
  await expect(page.getByRole('heading', { level: 1, name: 'Hi, Ayush' })).toBeVisible({ timeout: 30_000 })
  await sampleBillToPeople(page, ['Riya', 'Sam'])
  await page.getByRole('button', { name: 'Let everyone pick their own' }).click()
  await expect(page).toHaveURL(/\/app\/claims\/[A-Za-z0-9_-]{10}$/, { timeout: 45_000 })
  const claimPath = new URL(page.url()).pathname
  await expect(page.getByRole('heading', { level: 1, name: 'Who had what?' })).toBeVisible({ timeout: 45_000 })
  await page.getByRole('button', { name: 'Copy link' }).click()
  const claimLink = (await shared()).clipboard.at(-1) ?? ''
  expect(claimLink).toContain('/claim#')

  // A collection (farewell, ₹500 × 3).
  await page.goto('/app/pools/new')
  await expect(page.getByRole('heading', { level: 1, name: "What's it for?" })).toBeVisible()
  await page.getByRole('radio', { name: 'Farewell' }).click()
  await page.getByRole('textbox', { name: 'For whom or what?' }).fill('Riya')
  await page.getByRole('radio', { name: '₹500' }).click()
  for (const name of ['Sam', 'Kabir']) await page.getByRole('checkbox', { name }).click()
  await page.getByRole('button', { name: 'Create collection' }).click()
  await expect(page).toHaveURL(/\/app\/pools\/[^/?]+\?share=1$/)
  const poolPath = new URL(page.url()).pathname
  await expect(page.getByRole('heading', { level: 1, name: "Riya's farewell" })).toBeVisible()
  await page.getByRole('button', { name: 'Copy link' }).click()
  const poolLink = (await shared()).clipboard.at(-1) ?? ''
  expect(poolLink).toContain('/pool#')

  // The pay link of the dinner.
  await page.goto('/app/expense/dinner')
  await expect(page.getByRole('heading', { level: 1, name: 'Dinner at Toit' })).toBeVisible()
  const payLink = await copyPayLink(page, async () => (await shared()).clipboard)
  await page.keyboard.press('Escape')

  return {
    appPaths: [
      '/app',
      '/app/split/new',
      '/app/split/dinner/edit',
      '/app/expense/dinner',
      '/app/groups',
      '/app/groups/g1',
      '/app/groups/g1/settle',
      '/app/activity',
      '/app/you',
      '/app/friends',
      '/app/friends/riya',
      '/app/insights',
      '/app/recurring',
      '/app/recurring/new',
      '/app/pools',
      '/app/pools/new',
      poolPath,
      `${poolPath}/edit`,
      claimPath,
      '/app/claims/in',
      '/app/lend',
      '/app/proof',
      '/app/share',
      '/app/pro',
      '/app/bill',
    ],
    payLink,
    claimLink,
    poolLink,
  }
}

/** Opens a path and waits until the page has drawn (its main landmark) and finished its entrance animations. */
export async function openPath(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await expect(page.locator('main').first()).toBeVisible({ timeout: 30_000 })
  await page.waitForLoadState('load')
  await settleAnimations(page)
}

/** The public pages, once each, on this origin (a link keeps its fragment). */
export function publicPaths(tour: Tour): string[] {
  const local = (url: string) => {
    const u = new URL(url)
    return `${u.pathname}${u.search}${u.hash}`
  }
  return ['/', '/privacy', '/terms', local(tour.payLink), local(tour.claimLink), local(tour.poolLink)]
}
