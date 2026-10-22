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

/** axe's findings for the current page, worst first. */
export async function a11yIssues(page: Page, options: { disableRules?: string[] } = {}): Promise<A11yIssue[]> {
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
