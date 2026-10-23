/** Claim-link journeys for `e2e/claims.spec.ts`: start a round from a bill, pick as a friend, read reply links. */
import { expect, type Page } from '@playwright/test'

const slowExpect = expect.configure({ timeout: 30_000 })

/** Home → Scan bill → "Try a sample bill" → items → paid → Who's splitting? with `people` added. */
export async function sampleBillToPeople(page: Page, people: readonly string[]): Promise<void> {
  await page.getByRole('button', { name: 'Scan bill' }).click()
  await slowExpect(page).toHaveURL(/\/app\/bill/)
  await page.getByRole('button', { name: /^Try a sample/ }).click()
  await page.getByRole('button', { name: 'Looks good' }).click()
  await page.getByRole('button', { name: 'Next: who’s splitting' }).or(page.getByRole('button', { name: "Next: who's splitting" })).click()
  await slowExpect(page.getByRole('heading', { name: "Who's splitting?" })).toBeVisible()
  const search = page.getByRole('textbox', { name: 'Search or add people at the table' })
  for (const name of people) {
    await search.fill(name)
    await search.press('Enter')
    await slowExpect(page.getByRole('button', { name: `Remove ${name}` })).toBeVisible()
  }
}

/** The reply link inside a "Send my picks" WhatsApp href. */
export function replyLinkIn(href: string): string {
  const text = decodeURIComponent(href.slice(href.indexOf('?text=') + '?text='.length))
  const match = /https?:\/\/\S+\/app\/claims\/in#\S+/.exec(text)
  if (!match) throw new Error(`No reply link in: ${text}`)
  return match[0]
}

/** No horizontal scroll at the current width. */
export async function expectNoSideScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  slowExpect(overflow).toBeLessThanOrEqual(0)
}
