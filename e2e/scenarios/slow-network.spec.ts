/**
 * Scenario (b): a budget phone on a slow network. First visits to /app and /pay on "Slow 3G"
 * with the CPU four times slower (Chrome DevTools emulation over CDP). The first screen must
 * become usable within a generous budget, and the key screens must not jump while they load
 * (cumulative layout shift below 0.1, measured by the browser itself).
 */
import type { CDPSession } from '@playwright/test'
import { copyPayLink, onboard, splitEqually } from '../support/app'
import { expect, test } from '../support/fixtures'

/** Milliseconds taken by `fn`. */
async function timed(fn: () => Promise<void>): Promise<{ ms: number }> {
  const started = Date.now()
  await fn()
  return { ms: Date.now() - started }
}

/** Chrome DevTools' "Slow 3G": 400 ms latency, 400 kbit/s each way. Four times slower CPU. */
const SLOW_3G = { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 }

/** Generous budgets: the point is that a first visit is usable, not that it is fast on this rig. */
const FIRST_SCREEN_MS = 45_000
const PAY_SCREEN_MS = 45_000
const MAX_CLS = 0.1

/** Collects layout shifts that were not caused by the user, before any page script runs. */
const COLLECT_SHIFTS = () => {
  const shifts = { total: 0, sources: [] as string[] }
  ;(window as unknown as { __shifts: typeof shifts }).__shifts = shifts
  const name = (node: Node | null): string => {
    if (!(node instanceof Element)) return String(node?.nodeName ?? 'unknown')
    const cls = typeof node.className === 'string' ? (node.className.split(' ')[0] ?? '') : ''
    return node.tagName.toLowerCase() + (cls ? '.' + cls : '')
  }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: Array<{ node?: Node | null }> }>) {
        if (!entry.hadRecentInput) {
          shifts.total += entry.value
          for (const source of entry.sources ?? []) shifts.sources.push(name(source.node ?? null) + ' +' + entry.value.toFixed(3) + ' at ' + Math.round(entry.startTime) + 'ms')
        }
      }
    }).observe({ type: 'layout-shift', buffered: true })
  } catch {
    // Not supported here: the shift budget is then not measured on this browser.
  }
}

async function throttle(session: CDPSession): Promise<void> {
  await session.send('Network.enable')
  await session.send('Network.emulateNetworkConditions', SLOW_3G)
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 })
}

async function unthrottle(session: CDPSession): Promise<void> {
  await session.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => undefined)
  await session.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }).catch(() => undefined)
}

test.describe('slow network, slow phone', () => {
  test.describe.configure({ timeout: 300_000 })

  test('a first visit to /app is usable and does not jump', async ({ openPhone }) => {
    const phone = await openPhone()
    await phone.context.addInitScript(COLLECT_SHIFTS)
    const session = await phone.context.newCDPSession(phone.page)
    await throttle(session)
    try {
      const { ms } = await timed(async () => {
        await phone.page.goto('/app')
        // The first screen a new phone sees: the language choice, with its Continue button.
        await expect(phone.page.getByRole('heading', { name: 'Choose your language' })).toBeVisible({ timeout: FIRST_SCREEN_MS })
      })
      expect(ms, 'time to the first screen on slow 3G').toBeLessThan(FIRST_SCREEN_MS)
      await expect(phone.page.getByRole('button', { name: 'Continue' })).toBeEnabled()

      // Nothing on the first screen moved after it was drawn.
      await phone.page.waitForLoadState('load')
      const shifts = await phone.page.evaluate(() => (window as unknown as { __shifts?: { total: number; sources: string[] } }).__shifts ?? { total: 0, sources: [] })
      expect(shifts.total, 'cumulative layout shift on the first screen: ' + shifts.sources.join('; ')).toBeLessThan(MAX_CLS)
    } finally {
      await unthrottle(session)
    }
  })

  test('a pay link opened for the first time on slow 3G shows the choice in time', async ({ page, shared, openPhone }) => {
    await onboard(page)
    await splitEqually(page, { amount: '1000', title: 'Goa cab', people: ['Riya', 'Sam'] })
    const link = await copyPayLink(page, async () => (await shared()).clipboard)

    const friend = await openPhone()
    const session = await friend.context.newCDPSession(friend.page)
    await throttle(session)
    try {
      const { ms } = await timed(async () => {
        await friend.page.goto(link)
        await expect(friend.page.getByRole('heading', { name: 'Which one are you?' })).toBeVisible({ timeout: PAY_SCREEN_MS })
      })
      expect(ms, 'time to the pay page on slow 3G').toBeLessThan(PAY_SCREEN_MS)
    } finally {
      await unthrottle(session)
    }
  })

  test('a pay link opened for the first time on slow 3G does not jump', async ({ page, shared, openPhone }) => {
    await onboard(page)
    await splitEqually(page, { amount: '1000', title: 'Goa cab', people: ['Riya', 'Sam'] })
    const link = await copyPayLink(page, async () => (await shared()).clipboard)

    const friend = await openPhone()
    await friend.context.addInitScript(COLLECT_SHIFTS)
    const session = await friend.context.newCDPSession(friend.page)
    await throttle(session)
    try {
      await friend.page.goto(link)
      await expect(friend.page.getByRole('heading', { name: 'Which one are you?' })).toBeVisible({ timeout: PAY_SCREEN_MS })
      await friend.page.waitForLoadState('load')
      const shifts = await friend.page.evaluate(() => (window as unknown as { __shifts?: { total: number; sources: string[] } }).__shifts ?? { total: 0, sources: [] })
      expect(shifts.total, 'cumulative layout shift on the pay page: ' + shifts.sources.join('; ')).toBeLessThan(MAX_CLS)
    } finally {
      await unthrottle(session)
    }
  })
})
