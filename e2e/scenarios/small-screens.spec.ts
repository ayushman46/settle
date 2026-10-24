/**
 * Scenario (d): 320 px and 414 px. On every main screen, the claim, collection, SMS, lend, trip,
 * proof and Pro screens, and the public pages, nothing scrolls sideways and nothing sticks out of
 * the phone. The install card and the Home grid are checked at 320 px too.
 */
import { expect, test } from '../support/fixtures'
import { seed } from '../support/seed'
import { expectNoRawKeys, expectNoSideScroll } from '../support/scenarios'
import { buildTour, DINNER, openPath, publicPaths, RIYA, type Tour } from './tour'

for (const width of [320, 414]) {
  test.describe(`every screen at ${width} px`, () => {
    test.use({ viewport: { width, height: width === 320 ? 640 : 800 } })
    test.describe.configure({ timeout: 480_000 })

    test(`no sideways scroll anywhere (${width} px)`, async ({ page, shared }) => {
      const tour: Tour = await buildTour(page, shared)
      const failures: string[] = []

      for (const path of [...tour.appPaths, ...publicPaths(tour)]) {
        await openPath(page, path)
        // Collect every problem on the screen instead of stopping at the first one.
        try {
          await expectNoSideScroll(page)
          await expectNoRawKeys(page)
        } catch (error) {
          failures.push(`${path}: ${(error as Error).message.split('\n')[0]}`)
        }
      }
      expect(failures, `screens that do not fit ${width} px`).toEqual([])
    })

    test(`Home's grid and the install card fit at ${width} px`, async ({ page }) => {
      // A first split, so the install card is allowed to show (never on first paint).
      await seed(page, { friends: [RIYA], expenses: [DINNER] })
      await page.goto('/app')
      await expect(page.getByRole('heading', { level: 1, name: 'Hi, Ayush' })).toBeVisible({ timeout: 30_000 })
      await expectNoSideScroll(page)
      const more = page.getByRole('button', { name: 'More' })
      await expect(more).toBeVisible()
      await more.click()
      const sheet = page.getByRole('dialog', { name: 'More ways to split' })
      await expect(sheet).toBeVisible()
      await expectNoSideScroll(page)
      await page.keyboard.press('Escape')
      await expect(sheet).toHaveCount(0)
    })
  })
}
