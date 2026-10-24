/**
 * Scenario (e): dark mode with reduced motion. The app is dark (its background and text colours
 * come from the dark tokens), and with "reduce motion" on, a sheet that opens over Home does not
 * animate: no finite animation or transition longer than a flash is still running.
 */
import { copyPayLink } from '../support/app'
import { expect, test } from '../support/fixtures'
import { seed } from '../support/seed'
import { expectNoRawKeys, expectNoSideScroll } from '../support/scenarios'
import { DINNER, openPath, RIYA } from './tour'

/** Relative luminance (0–1) of an rgb()/rgba() colour string. */
function luminance(css: string): number {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css)
  if (!m) return NaN
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => Number(v) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
}

test.describe('dark mode and reduced motion', () => {
  test.describe.configure({ timeout: 180_000 })
  test.use({ colorScheme: 'dark', reducedMotion: 'reduce' })

  test('Home and the pay page are dark, and sheets open without animating', async ({ page, shared, openPhone }) => {
    await seed(page, { friends: [RIYA], expenses: [DINNER] })
    await openPath(page, '/app')
    await expect(page.getByRole('heading', { level: 1, name: 'Hi, Ayush' })).toBeVisible()
    await expectNoRawKeys(page)

    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(luminance(bg), `Home background ${bg} should be dark`).toBeLessThan(0.05)
    const fg = await page.evaluate(() => getComputedStyle(document.querySelector('h1') ?? document.body).color)
    expect(luminance(fg), `Home heading colour ${fg} should be light`).toBeGreaterThan(0.5)

    // Reduced motion: the More sheet is open at once, with no long animation still running.
    await page.getByRole('button', { name: 'More' }).click()
    const sheet = page.getByRole('dialog', { name: 'More ways to split' })
    await expect(sheet).toBeVisible()
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.playState === 'running')
        .map((a) => a.effect?.getComputedTiming())
        .filter((t): t is ReturnType<NonNullable<Animation['effect']>['getComputedTiming']> => !!t && Number.isFinite(t.endTime) && Number(t.endTime) > 50)
        .map((t) => `${t.endTime}ms`),
    )
    expect(running, 'animations still running under reduced motion').toEqual([])
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)

    // The pay page, dark as well.
    await openPath(page, '/app/expense/dinner')
    const link = await copyPayLink(page, async () => (await shared()).clipboard)
    const friend = await openPhone()
    await friend.page.goto(link)
    await expect(friend.page.getByRole('heading', { name: 'Riya’s share' })).toBeVisible()
    const payBg = await friend.page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(luminance(payBg), `pay page background ${payBg} should be dark`).toBeLessThan(0.05)
    await expectNoSideScroll(friend.page)
  })
})
