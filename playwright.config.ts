/**
 * End-to-end tests on the installed Microsoft Edge (no browser download), as phones.
 *
 *   npm run e2e                    the production build, served as Render serves it (port 4121)
 *   E2E_TARGET=dev npm run e2e     the Vite dev server instead (port 4120), quicker to iterate
 *   E2E_BASE_URL=https://… npm run e2e -- e2e/smoke.spec.ts
 *                                  a deployed site (nothing is started; /api/* is still mocked)
 *
 * Every test runs in four projects: 360×800 and 390×844 phones, light and dark. External
 * network is blocked and the AI and payment services are mocked (see e2e/support/fixtures.ts).
 * Ports 4120–4139 belong to these tests.
 */
import { defineConfig, type PlaywrightTestConfig } from '@playwright/test'

const DEV_PORT = 4120
const PROD_PORT = 4121

const external = process.env.E2E_BASE_URL?.trim() || null
const target = process.env.E2E_TARGET === 'dev' ? 'dev' : 'prod'
const port = target === 'dev' ? DEV_PORT : PROD_PORT
const baseURL = external ?? `http://127.0.0.1:${port}`
const ci = !!process.env.CI

/** A budget Android phone's Chrome, so the app takes its touch-first paths. */
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'

const phone = (width: number, height: number, deviceScaleFactor: number) => ({
  viewport: { width, height },
  screen: { width, height },
  deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
  userAgent: ANDROID_UA,
})

const PHONES = [
  { name: '360', device: phone(360, 800, 2) },
  { name: '390', device: phone(390, 844, 3) },
] as const
const SCHEMES = ['light', 'dark'] as const

const webServer: PlaywrightTestConfig['webServer'] = external
  ? undefined
  : target === 'dev'
    ? {
        // No NVIDIA key, even if .env has one: nothing in a test may reach the real AI.
        command: `node node_modules/vite/bin/vite.js --port ${DEV_PORT} --strictPort --host 127.0.0.1`,
        url: `${baseURL}/api/health`,
        env: { NVIDIA_API_KEY: '', RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '' },
        reuseExistingServer: process.env.E2E_REUSE === '1',
        timeout: 120_000,
      }
    : {
        command: `node e2e/support/serve.mjs --port ${PROD_PORT}`,
        url: `${baseURL}/api/health`,
        reuseExistingServer: process.env.E2E_REUSE === '1',
        // A cold production build takes a minute or two on a slow machine.
        timeout: 300_000,
      }

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  // Few workers: the machine also runs benchmarks, and phones-on-a-laptop are CPU hungry.
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : ci ? 2 : 3,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: ci ? [['github'], ['list'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    channel: 'msedge',
    headless: true,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: PHONES.flatMap(({ name, device }) =>
    SCHEMES.map((colorScheme) => ({
      name: `mobile-${name}-${colorScheme}`,
      use: { ...device, colorScheme },
    })),
  ),
  ...(webServer ? { webServer } : {}),
})
