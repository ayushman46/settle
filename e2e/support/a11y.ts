/**
 * Accessibility scans with axe-core: WCAG 2.0–2.2 A and AA rules on whatever the page shows
 * now (open sheets included). Violations are reported with the rule, impact and the elements.
 */
import { AxeBuilder } from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'] as const

export interface A11yIssue {
  rule: string
  impact: string | null
  help: string
  elements: string[]
}

/**
 * Waits for the page's finite animations and transitions (a sheet sliding up, a row opening, tiles
 * rising in) to finish, so what is measured or scanned is what stays on screen. Endless ones (the
 * skeleton shimmer) are skipped; anything still running after 3 s is left as it is.
 */
export async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const finite = document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getComputedTiming().endTime !== Infinity)
    await Promise.race([Promise.allSettled(finite.map((a) => a.finished)), new Promise((resolve) => setTimeout(resolve, 3000))])
  })
}

/** axe's findings for the current page once it has settled, worst first. */
export async function a11yIssues(page: Page, options: { disableRules?: string[] } = {}): Promise<A11yIssue[]> {
  // From the top: content scrolled under the sticky top bar would count as covered tap targets.
  await page.evaluate(() => window.scrollTo(0, 0))
  await settleAnimations(page)
  const builder = new AxeBuilder({ page }).withTags([...WCAG_TAGS])
  if (options.disableRules?.length) builder.disableRules(options.disableRules)
  const { violations } = await builder.analyze()
  const order = ['critical', 'serious', 'moderate', 'minor']
  return violations
    .map((violation) => ({
      rule: violation.id,
      impact: violation.impact ?? null,
      help: violation.help,
      elements: violation.nodes.map((node) => node.target.join(' ')),
    }))
    .sort((a, b) => order.indexOf(a.impact ?? 'minor') - order.indexOf(b.impact ?? 'minor'))
}

/** Fails with a readable list when axe finds anything. */
export async function expectAccessible(page: Page, options: { disableRules?: string[] } = {}): Promise<void> {
  const issues = await a11yIssues(page, options)
  expect(issues, issues.map((issue) => `${issue.impact} ${issue.rule}: ${issue.help} → ${issue.elements.slice(0, 3).join(', ')}`).join('\n')).toEqual([])
}
