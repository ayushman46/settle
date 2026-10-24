/**
 * Scenario (g): languages. A phone set to Hindi (hi-IN) reads Hindi on Home, a split, a group and
 * the pay page; no raw "ns.screen.key" ever shows; ₹ and lakh grouping stay intact; at 320 px no
 * Devanagari or Tamil is clipped. You → Language switches the whole app to Tamil and back.
 */
import type { Page } from '@playwright/test'
import { expect, test } from '../support/fixtures'
import { seed } from '../support/seed'
import { expense as hiExpense } from '../../src/i18n/hi/expense'
import { kit as hiKit } from '../../src/i18n/hi/kit'
import { equalExpense, expectNoRawKeys, expectNoSideScroll } from '../support/scenarios'
import { DINNER, openPath, RIYA, TRIP } from './tour'
import type { Expense } from '../../src/domain/types'

const hi: Record<string, string> = { ...hiExpense, ...hiKit }

const DEVANAGARI = /[ऀ-ॿ]/
const TAMIL = /[஀-௿]/

/** Shares the pay link on a Hindi phone: the Hindi labels come from the catalog, not from English text. */
async function copyPayLinkInHindi(page: Page, clipboard: () => Promise<string[]>): Promise<string> {
  await page.getByRole('button', { name: hi['expense.primary.payLink.cta'] ?? '' }).click()
  const sheet = page.getByRole('dialog').first()
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: hi['kit.share.copyLink'] ?? '' }).click()
  await expect(page.getByText(hi['kit.share.linkCopied.toast'] ?? '')).toBeVisible()
  const link = (await clipboard()).at(-1)
  if (!link) throw new Error('The Hindi phone did not copy a pay link')
  return link
}

/** A ₹2,40,000 trip expense: lakh grouping shows on its page and in the owed amount. */
const BIG: Expense = equalExpense('big', 'Goa villa', 24_000_000, '2026-10-19', 1_791_900_000_000, ['riya'])

/**
 * Text that is cut off by its own box: a leaf element whose glyphs overflow vertically or
 * horizontally while it hides them (ellipsis and line clamps are deliberate and skipped).
 */
async function clippedText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = []
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      if (el.children.length > 0) continue
      const text = el.textContent?.trim() ?? ''
      if (!text) continue
      // Screen-reader-only copies (1 px boxes, the kit's visually-hidden class) are clipped on purpose.
      const box = el.getBoundingClientRect()
      if (box.width <= 1 || box.height <= 1 || el.closest('[class*="visually-hidden"]')) continue
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      if (style.textOverflow === 'ellipsis' || style.webkitLineClamp !== 'none' && style.webkitLineClamp !== '') continue
      if (style.overflow === 'visible' && style.overflowX === 'visible' && style.overflowY === 'visible') continue
      const tall = el.scrollHeight > el.clientHeight + 2
      const wide = el.scrollWidth > el.clientWidth + 2
      if (tall || wide) out.push(`${text.slice(0, 30)} (${tall ? 'tall' : ''}${wide ? ' wide' : ''})`)
    }
    return out
  })
}

test.describe('Hindi phone (hi-IN)', () => {
  test.describe.configure({ timeout: 300_000 })
  test.use({ locale: 'hi-IN' })

  test('Home, a split, a group and the pay page read in Hindi, with ₹ and lakh grouping', async ({ page, shared, openPhone }) => {
    await seed(page, { friends: [RIYA], groups: [TRIP], expenses: [DINNER, BIG] })
    await page.goto('/app')
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
    await expect(page.locator('main').first()).toBeVisible({ timeout: 30_000 })
    expect(await page.locator('body').innerText()).toMatch(DEVANAGARI)
    await expectNoRawKeys(page)
    // Owed by Riya: ₹1,20,000 (the trip villa) + ₹600 (the dinner), in lakh grouping.
    await expect(page.getByText(/₹\s?1,20,\d{3}/).first()).toBeVisible()

    await openPath(page, '/app/split/new')
    expect(await page.locator('body').innerText()).toMatch(DEVANAGARI)
    await expectNoRawKeys(page)

    await openPath(page, '/app/groups/g1')
    expect(await page.locator('body').innerText()).toMatch(DEVANAGARI)
    await expectNoRawKeys(page)

    await openPath(page, '/app/expense/big')
    await expect(page.getByText(/₹\s?2,40,000/).first()).toBeVisible()
    await expectNoRawKeys(page)

    // The pay link: made in English on the organiser's phone, opened by a Hindi phone.
    await openPath(page, '/app/expense/dinner')
    const link = await copyPayLinkInHindi(page, async () => (await shared()).clipboard)
    const friend = await openPhone()
    await friend.page.goto(link)
    await expect(friend.page.locator('h1').first()).toBeVisible({ timeout: 30_000 })
    expect(await friend.page.locator('body').innerText()).toMatch(DEVANAGARI)
    await expectNoRawKeys(friend.page)
    await expect(friend.page.getByText(/₹\s?600/).first()).toBeVisible()
  })
})

test.describe('Hindi at 320 px', () => {
  test.describe.configure({ timeout: 300_000 })
  test.use({ locale: 'hi-IN', viewport: { width: 320, height: 640 } })

  test('nothing is clipped or sideways on Hindi screens', async ({ page, shared, openPhone }) => {
    await seed(page, { friends: [RIYA], groups: [TRIP], expenses: [DINNER, BIG] })
    const failures: string[] = []
    const check = async (path: string) => {
      await openPath(page, path)
      const clipped = await clippedText(page)
      if (clipped.length > 0) failures.push(`${path}: clipped ${clipped.slice(0, 4).join('; ')}`)
      try {
        await expectNoSideScroll(page)
      } catch (error) {
        failures.push(`${path}: ${(error as Error).message.split('\n')[0]}`)
      }
    }
    for (const path of ['/app', '/app/split/new', '/app/groups', '/app/groups/g1', '/app/activity', '/app/you', '/app/friends']) await check(path)

    await openPath(page, '/app/expense/dinner')
    const link = await copyPayLinkInHindi(page, async () => (await shared()).clipboard)
    const friend = await openPhone()
    await friend.page.goto(link)
    await expect(friend.page.locator('main').first()).toBeVisible({ timeout: 30_000 })
    const clipped = await clippedText(friend.page)
    if (clipped.length > 0) failures.push(`/pay: clipped ${clipped.slice(0, 4).join('; ')}`)
    expect(failures, 'Hindi at 320 px').toEqual([])
  })
})

test.describe('switching language in You', () => {
  test.describe.configure({ timeout: 240_000 })

  test('You → Language: Tamil and back to English', async ({ page }) => {
    await seed(page, { friends: [RIYA], expenses: [DINNER] })
    await openPath(page, '/app/you')
    await page.getByRole('button', { name: /^Language/ }).first().click()
    const grid = page.getByRole('radiogroup', { name: 'Language' })
    await expect(grid).toBeVisible()

    const tamil = grid.getByRole('radio', { name: /தமிழ்/ })
    // Until the Tamil catalog ships in this build the tile says "coming soon" and cannot be chosen.
    const available = (await tamil.isDisabled()) === false
    test.skip(!available, 'Tamil catalog is not in this build yet (tile is "coming soon")')

    // The tile is a controlled radio: it becomes checked once its catalog has loaded, so wait for that.
    await tamil.click({ force: true })
    // Once Tamil is on, the group is named in Tamil too: check the tile by its own name.
    await expect(page.getByRole('radio', { name: /தமிழ்/ })).toBeChecked({ timeout: 20_000 })
    await expect(page.locator('html')).toHaveAttribute('lang', 'ta')
    await page.keyboard.press('Escape')
    await openPath(page, '/app')
    expect(await page.locator('body').innerText()).toMatch(TAMIL)
    await expectNoRawKeys(page)

    await openPath(page, '/app/you')
    await page.getByRole('button', { name: /மொழி|Language/ }).first().click()
    // The sheet is in Tamil now, so its group is no longer named "Language": find the tile by its own name.
    const english = page.getByRole('radiogroup').getByRole('radio', { name: 'English', exact: true })
    await english.click({ force: true })
    await expect(english).toBeChecked({ timeout: 20_000 })
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.keyboard.press('Escape')
    await openPath(page, '/app')
    await expect(page.getByRole('heading', { level: 1, name: 'Hi, Ayush' })).toBeVisible()
    await expectNoRawKeys(page)
  })
})
