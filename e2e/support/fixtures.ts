/**
 * The `test` every spec uses. On top of Playwright's own fixtures, each browser context:
 *
 * - can only reach the app's own origin: anything else is blocked (and listed in `blocked`), so a
 *   test can never call NVIDIA, Razorpay, a font CDN or analytics by accident;
 * - has the AI and payment services mocked (`api`, see mocks.ts);
 * - records what the app copies to the clipboard or hands to the share sheet (`shared`), so tests
 *   can read a pay link without OS permissions;
 * - fails the test on any uncaught page error.
 *
 * `openPhone()` opens another phone — a friend with their own empty storage — set up the same way.
 */
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test'
import { installMockApi, type MockApi } from './mocks'

export { expect }

/** What the app shared: clipboard writes and share-sheet payloads, oldest first. */
export interface Shared {
  clipboard: string[]
  sheets: Array<{ title?: string; text?: string; url?: string }>
}

interface PhoneSetup {
  api: MockApi
  blocked: string[]
  pageErrors: string[]
}

declare global {
  interface Window {
    __e2eShared?: Shared
  }
}

/**
 * Runs before any page script: keeps a copy of everything written to the clipboard or shared,
 * and makes the share sheet "succeed" instantly (headless browsers have no share UI).
 */
function recordSharing(): void {
  const shared: Shared = { clipboard: [], sheets: [] }
  window.__e2eShared = shared
  const clipboard = navigator.clipboard
  if (clipboard && typeof clipboard.writeText === 'function') {
    const write = clipboard.writeText.bind(clipboard)
    Object.defineProperty(clipboard, 'writeText', {
      configurable: true,
      value: async (text: string) => {
        shared.clipboard.push(text)
        try {
          await write(text)
        } catch {
          // No clipboard permission in a headless test: the recorded copy is what matters.
        }
      },
    })
  }
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: async (data: ShareData) => {
      shared.sheets.push({ title: data.title, text: data.text, url: data.url })
    },
  })
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true })
}

async function preparePhone(context: BrowserContext, baseURL: string | undefined): Promise<PhoneSetup> {
  const own = baseURL ? new URL(baseURL).origin : null
  const blocked: string[] = []
  const pageErrors: string[] = []

  // Registered first, so every mock below (registered later) is asked before it.
  await context.route('**/*', (route) => {
    const url = route.request().url()
    if (own !== null && url.startsWith(own)) return route.fallback()
    blocked.push(url)
    return route.abort('blockedbyclient')
  })
  const api = await installMockApi(context)
  await context.addInitScript(recordSharing)
  context.on('weberror', (error) => pageErrors.push(error.error().stack ?? String(error.error())))
  return { api, blocked, pageErrors }
}

interface Fixtures {
  /** The mocked AI and payment endpoints of the main phone. */
  api: MockApi
  /** External URLs the main phone tried to load (all blocked). */
  blocked: string[]
  /** Opens another phone with empty storage (a friend), set up like the main one. */
  openPhone: () => Promise<{ context: BrowserContext; page: Page; api: MockApi }>
  /** What the main phone shared or copied, read from the page. */
  shared: (page?: Page) => Promise<Shared>
  /** Internal: the main phone's setup. */
  phone: PhoneSetup
}

export const test = base.extend<Fixtures>({
  phone: async ({ context, baseURL }, use) => {
    const setup = await preparePhone(context, baseURL)
    await use(setup)
    expect(setup.pageErrors, 'uncaught errors in the page').toEqual([])
  },
  // Every test's `page` belongs to the prepared context.
  page: async ({ page, phone }, use) => {
    void phone
    await use(page)
  },
  api: async ({ phone }, use) => {
    await use(phone.api)
  },
  blocked: async ({ phone }, use) => {
    await use(phone.blocked)
  },
  shared: async ({ page }, use) => {
    await use(async (target = page) => (await target.evaluate(() => window.__e2eShared)) ?? { clipboard: [], sheets: [] })
  },
  openPhone: async ({ browser, baseURL, contextOptions, viewport, colorScheme, locale, timezoneId, isMobile, hasTouch, deviceScaleFactor, userAgent }, use) => {
    const opened: Array<{ context: BrowserContext; setup: PhoneSetup }> = []
    const open = async () => {
      // The same phone as the test's own (Playwright doesn't apply the project's options here).
      const context = await browser.newContext({
        ...contextOptions,
        baseURL,
        viewport,
        colorScheme,
        locale,
        timezoneId,
        isMobile,
        hasTouch,
        deviceScaleFactor,
        userAgent,
      })
      const setup = await preparePhone(context, baseURL)
      opened.push({ context, setup })
      return { context, page: await context.newPage(), api: setup.api }
    }
    await use(open)
    for (const { context, setup } of opened) {
      await context.close()
      expect(setup.pageErrors, "uncaught errors on the other phone's page").toEqual([])
    }
  },
})
