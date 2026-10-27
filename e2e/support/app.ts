/**
 * Journeys through the app the way a person takes them — by role and visible name, never by CSS
 * class — so a test reads like what someone does on their phone.
 */
import { expect, type Page } from '@playwright/test'

export interface Owner {
  name: string
  upiId?: string
}

export const OWNER: Required<Owner> = { name: 'Ayush', upiId: 'ayush@okicici' }

/** First launch: skip the intro, say who you are, land on Home. */
export async function onboard(page: Page, owner: Owner = OWNER): Promise<void> {
  await page.goto('/app')
  await expect(page).toHaveURL(/\/app\/welcome/)
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByRole('heading', { name: 'Let’s set you up' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Your name' }).fill(owner.name)
  if (owner.upiId) await page.getByRole('textbox', { name: 'Your UPI ID (optional)' }).fill(owner.upiId)
  await page.getByRole('button', { name: 'Start splitting' }).click()
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByRole('heading', { level: 1, name: `Hi, ${owner.name}` })).toBeVisible()
}

export interface SplitInput {
  /** Typed as a person would ("1200", "849.50"). */
  amount: string
  title: string
  /** Friends to add by name (new ones are created on the way). */
  people: string[]
}

/** Home → "Split an expense" (or "Split amount") → fill → Save → the expense's own page. */
export async function splitEqually(page: Page, split: SplitInput): Promise<void> {
  const first = page.getByRole('button', { name: 'Split an expense' })
  if (await first.isVisible()) await first.click()
  else await page.getByRole('button', { name: 'Split amount' }).click()
  await expect(page).toHaveURL(/\/app\/split\/new/)

  await page.getByRole('textbox', { name: 'Amount' }).fill(split.amount)
  await page.getByRole('textbox', { name: "What's it for?" }).fill(split.title)
  const search = page.getByRole('textbox', { name: 'Search or add people' })
  for (const name of split.people) {
    await search.fill(name)
    await search.press('Enter')
    await expect(page.getByRole('button', { name: `Remove ${name}` })).toBeVisible()
  }
  await expect(page.getByRole('radio', { name: 'Equally' })).toBeChecked()
  await page.getByRole('button', { name: 'Save split' }).click()
  await expect(page.getByRole('dialog', { name: 'Split saved' })).toBeVisible()
  await expect(page).toHaveURL(/\/app\/expense\//, { timeout: 15_000 })
  await expect(page.getByRole('heading', { level: 1, name: split.title })).toBeVisible()
}

/** On an expense: Share pay link → Copy link. Returns the link the app copied. */
export async function copyPayLink(page: Page, readClipboard: () => Promise<string[]>): Promise<string> {
  await page.getByRole('button', { name: 'Share pay link' }).click()
  const sheet = page.getByRole('dialog', { name: 'Share split' })
  await expect(sheet).toBeVisible()
  const copy = sheet.getByRole('button', { name: 'Copy link' })
  await expect(copy).toBeEnabled()
  await copy.click()
  await expect(page.getByText('Pay link copied')).toBeVisible()
  const copied = await readClipboard()
  const link = copied.at(-1)
  if (!link) throw new Error('The app did not copy a pay link')
  return link
}

/**
 * The UPI payment a pay page's QR encodes (`upi://pay?…`). A phone shows the QR on request
 * ("Show QR for another phone"). Settle never links to a person's UPI ID — UPI apps refuse
 * a payment to a person started from a link (NPCI OC 76C) — so the QR is where the payment lives.
 */
export async function upiQrLink(page: Page): Promise<string> {
  const show = page.getByRole('button', { name: 'Show QR for another phone' })
  if (await show.isVisible()) await show.click()
  const qr = page.locator('[data-qr-value^="upi://pay"]').first()
  await expect(qr).toBeVisible()
  return (await qr.getAttribute('data-qr-value')) ?? ''
}

/** Links that would start a UPI payment to a person (none may exist). */
export const UPI_PAYMENT_LINKS = 'a[href^="upi:"], a[href^="intent:"], a[href*="://upi/pay"]'

/** A `upi://pay?…` link, decoded. */
export function readUpiLink(href: string): { scheme: string; target: string; params: Record<string, string> } {
  const url = new URL(href)
  return { scheme: url.protocol, target: url.host || url.pathname, params: Object.fromEntries(url.searchParams) }
}
