/**
 * Scenario (h): 1,500 expenses on one phone. Activity and a group open quickly, and scrolling
 * down reaches the oldest expense (a windowed list must still bring every row into view). The
 * timings are attached to the report; the budgets are generous enough for a budget phone.
 */
import type { Page } from '@playwright/test'
import { expect, test } from '../support/fixtures'
import { seed } from '../support/seed'
import { bulkExpenses, expectNoRawKeys } from '../support/scenarios'
import { RIYA, SAM, TRIP } from './tour'

const COUNT = 1500
const OLDEST = 'Bulk expense 0000'
const NEWEST = 'Bulk expense 1499'

/** Scrolls down a few screens at a time until `text` is on screen. Returns the number of steps. */
async function scrollUntilVisible(page: Page, text: string, maxSteps = 600): Promise<number> {
  const target = page.getByText(text, { exact: true }).first()
  for (let step = 0; step < maxSteps; step++) {
    if (await target.isVisible().catch(() => false)) return step
    await page.mouse.wheel(0, 2500)
    await page.waitForTimeout(40)
  }
  throw new Error(`"${text}" never came into view after ${maxSteps} scrolls`)
}

test.describe('1,500 expenses', () => {
  test.describe.configure({ timeout: 360_000 })

  test('Activity opens with the newest first and scrolls to the oldest', async ({ page }, testInfo) => {
    await seed(page, { friends: [RIYA, SAM], expenses: bulkExpenses(COUNT, ['riya', 'sam']) })
    const started = Date.now()
    await page.goto('/app/activity')
    await expect(page.getByText(NEWEST, { exact: true }).first()).toBeVisible({ timeout: 60_000 })
    const opened = Date.now() - started
    await expectNoRawKeys(page)

    const scrolled = Date.now()
    const steps = await scrollUntilVisible(page, OLDEST)
    const reached = Date.now() - scrolled
    testInfo.annotations.push({ type: 'activity-open-ms', description: String(opened) }, { type: 'activity-oldest-ms', description: `${reached} (${steps} steps)` })
    expect(opened, 'Activity with 1,500 expenses opens within 30 s').toBeLessThan(30_000)
    expect(reached, 'scrolling to the oldest expense takes under 90 s').toBeLessThan(90_000)
    await expect(page.getByText(OLDEST, { exact: true }).first()).toBeVisible()
  })

  test('a group with 1,500 expenses opens and scrolls to the oldest', async ({ page }, testInfo) => {
    const group = { ...TRIP, memberIds: ['me', 'riya', 'sam'] }
    const expenses = bulkExpenses(COUNT, ['riya', 'sam']).map((e) => ({ ...e, groupId: group.id }))
    await seed(page, { friends: [RIYA, SAM], groups: [group], expenses })
    const started = Date.now()
    await page.goto('/app/groups/g1')
    await expect(page.getByRole('heading', { level: 1, name: 'Goa trip' })).toBeVisible({ timeout: 60_000 })
    const opened = Date.now() - started
    await expectNoRawKeys(page)

    const scrolled = Date.now()
    const steps = await scrollUntilVisible(page, OLDEST)
    const reached = Date.now() - scrolled
    testInfo.annotations.push({ type: 'group-open-ms', description: String(opened) }, { type: 'group-oldest-ms', description: `${reached} (${steps} steps)` })
    expect(opened, 'the group with 1,500 expenses opens within 30 s').toBeLessThan(30_000)
    expect(reached, 'scrolling the group to the oldest expense takes under 90 s').toBeLessThan(90_000)
  })
})
