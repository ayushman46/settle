/**
 * Vercel Web Analytics: page views only, no cookies, no personal data. On the live site only (not
 * in tests, local builds or the Android app), and every address is stripped before it's sent:
 * no query or hash (pay links and invites carry UPI IDs, amounts and tokens there), and ids or
 * tokens inside the path become placeholders.
 */
import { inject, type BeforeSendEvent } from '@vercel/analytics'

/** Where analytics runs: the production site on Vercel. */
export function analyticsHost(hostname: string): boolean {
  return /(^|\.)settleupi\.vercel\.app$/.test(hostname)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** A path segment that is an id, token, number or code, not a page name. */
function isIdentifier(segment: string): boolean {
  return UUID.test(segment) || /\d/.test(segment) || segment.length > 24 || /[^a-z-]/.test(segment)
}

/** `https://x/app/cloud/3f2…?token=abc#k` → `https://x/app/cloud/:id`. */
export function cleanAddress(url: string): string {
  const u = new URL(url)
  const path = u.pathname
    .split('/')
    .map((segment) => (segment && isIdentifier(segment) ? ':id' : segment))
    .join('/')
  return `${u.origin}${path}`
}

export function startAnalytics(): void {
  if (!import.meta.env.PROD || typeof window === 'undefined' || !analyticsHost(window.location.hostname)) return
  inject({
    mode: 'production',
    beforeSend: (event: BeforeSendEvent) => ({ ...event, url: cleanAddress(event.url) }),
  })
}
