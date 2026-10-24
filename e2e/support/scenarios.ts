/**
 * Shared checks for the scenario matrix in `e2e/scenarios/`: what every screen must satisfy
 * (no raw translation keys, no sideways scroll, no serious accessibility failure), a keyboard-only
 * way to reach a control, and seeded data big enough to matter (1,500 expenses, a dinner).
 */
import { AxeBuilder } from '@axe-core/playwright'
import { expect, type Locator, type Page } from '@playwright/test'
import type { Expense, Participant } from '../../src/domain/types'
import { WCAG_TAGS, settleAnimations } from './a11y'

/** Catalog namespaces (src/i18n/en/*.ts): a visible "ns.screen.element" is a key that was never translated. */
const NAMESPACES = [
  'activity', 'app', 'bill', 'claim', 'common', 'delivery', 'expense', 'friends', 'groups', 'home', 'insights',
  'install', 'kit', 'landing', 'legal', 'lend', 'onboarding', 'pay', 'pools', 'pro', 'proof', 'recurring',
  'rotation', 'shagun', 'share', 'sharein', 'split', 'state', 'trip', 'ui', 'voice', 'you',
]
const RAW_KEY = `\\b(?:${NAMESPACES.join('|')})\\.[a-z][A-Za-z]*\\.[A-Za-z][\\w.-]*`

/** The phone widths the spec names for small screens (320 px: the smallest; 414 px: a large phone). */
export const SMALL_WIDTHS = [320, 414] as const

/** Every raw "ns.screen.element" key visible on the page (text and aria/title/placeholder), if any. */
export async function rawKeysOn(page: Page): Promise<string[]> {
  return page.evaluate((source) => {
    const re = new RegExp(source, 'g')
    const texts: string[] = [document.body.innerText]
    for (const el of Array.from(document.querySelectorAll('*'))) {
      for (const attr of ['aria-label', 'title', 'placeholder', 'alt']) {
        const value = el.getAttribute(attr)
        if (value) texts.push(value)
      }
    }
    return texts.flatMap((text) => text.match(re) ?? [])
  }, RAW_KEY)
}

/** Fails with the raw keys it found (the page must read in its own language, not in keys). */
export async function expectNoRawKeys(page: Page): Promise<void> {
  const keys = await rawKeysOn(page)
  expect(keys, `raw translation keys on ${new URL(page.url()).pathname}`).toEqual([])
}

/**
 * Visible boxes that stick out past the right edge of the viewport and are not inside a
 * deliberately scrolling container (a chip rail, a table). Returns short descriptions, worst first.
 */
export async function overflowingBoxes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth
    const scrolls = (el: Element | null): boolean => {
      for (let node = el; node && node !== document.body; node = node.parentElement) {
        const { overflowX } = getComputedStyle(node)
        if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden' || overflowX === 'clip') return true
      }
      return false
    }
    const label = (el: Element): string => {
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : ''
      const text = el.textContent?.trim() ?? ''
      return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}${text ? ` "${text.slice(0, 40)}"` : ''}`
    }
    const found: Array<{ right: number; text: string }> = []
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      if (rect.right <= width + 1) continue
      if (scrolls(el.parentElement)) continue
      found.push({ right: Math.round(rect.right), text: label(el) })
    }
    return found
      .sort((a, b) => b.right - a.right)
      .slice(0, 5)
      .map((f) => `${f.text} (right edge ${f.right}px of ${width}px)`)
  })
}

/** No sideways scroll on the page and nothing sticking out of it. */
export async function expectNoSideScroll(page: Page): Promise<void> {
  const path = new URL(page.url()).pathname
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  const boxes = await overflowingBoxes(page)
  expect(overflow, `sideways scroll on ${path} (${boxes.join('; ')})`).toBeLessThanOrEqual(1)
  expect(boxes, `boxes past the edge on ${path}`).toEqual([])
}

export interface SeriousIssue {
  rule: string
  impact: 'serious' | 'critical'
  help: string
  elements: string[]
}

/** axe's serious and critical WCAG 2.2 A/AA findings on what the page shows now. */
export async function seriousA11y(page: Page): Promise<SeriousIssue[]> {
  await page.evaluate(() => window.scrollTo(0, 0))
  await settleAnimations(page)
  const { violations } = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze()
  const issues: SeriousIssue[] = []
  for (const v of violations) {
    if (v.impact !== 'serious' && v.impact !== 'critical') continue
    issues.push({ rule: v.id, impact: v.impact, help: v.help, elements: v.nodes.map((n) => n.target.join(' ')) })
  }
  return issues
}

/** Fails with the serious and critical findings (moderate and minor are reported by the a11y spec). */
export async function expectNoSeriousA11y(page: Page): Promise<void> {
  const issues = await seriousA11y(page)
  expect(
    issues,
    issues.map((i) => `${i.impact} ${i.rule}: ${i.help} → ${i.elements.slice(0, 3).join(', ')}`).join('\n'),
  ).toEqual([])
}

/** Presses Tab until `target` has focus (fails after `maxTabs` presses). */
export async function tabTo(page: Page, target: Locator, maxTabs = 120): Promise<void> {
  for (let i = 0; i < maxTabs; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return
    await page.keyboard.press('Tab')
  }
  throw new Error(`Tab order never reached the control within ${maxTabs} presses`)
}

/** Reaches `target` with Tab and activates it with Enter. */
export async function activateWithKeyboard(page: Page, target: Locator, maxTabs = 120): Promise<void> {
  await tabTo(page, target, maxTabs)
  await page.keyboard.press('Enter')
}

/** The payer (me) plus the named friends, equally. */
export function equalParticipants(friendIds: readonly string[]): Participant[] {
  return ['me', ...friendIds].map((friendId) => ({ friendId, input: null }))
}

/** A plain equal split saved on `date` (YYYY-MM-DD) between me and `friendIds`. */
export function equalExpense(id: string, title: string, totalMinor: number, date: string, createdAt: number, friendIds: readonly string[]): Expense {
  const people = ['me', ...friendIds]
  const base = Math.floor(totalMinor / people.length)
  const shares: Record<string, number> = Object.fromEntries(people.map((p) => [p, base]))
  shares.me = (shares.me ?? 0) + (totalMinor - base * people.length)
  return {
    id,
    kind: 'split',
    title,
    category: 'food',
    currency: 'INR',
    total: totalMinor,
    date,
    createdAt,
    updatedAt: createdAt,
    payerId: 'me',
    mode: 'equal',
    participants: equalParticipants(friendIds),
    shares,
    roundedToWhole: false,
    note: null,
    groupId: null,
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
  }
}

/**
 * `count` expenses spread over three years, newest first in the list (so the oldest is last to
 * reach). Ids are `bulk-<n>`; titles are `Bulk expense <nnnn>`, zero-padded so searches are exact.
 */
export function bulkExpenses(count: number, friendIds: readonly string[]): Expense[] {
  const day = 86_400_000
  const start = Date.UTC(2023, 0, 1)
  return Array.from({ length: count }, (_, i) => {
    const at = start + Math.floor((i * 3 * 365 * day) / count)
    const date = new Date(at).toISOString().slice(0, 10)
    const title = `Bulk expense ${String(i).padStart(4, '0')}`
    return equalExpense(`bulk-${i}`, title, 10_000 + (i % 97) * 100, date, at, friendIds)
  })
}
