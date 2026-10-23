/**
 * Vercel entry: the API (server/app.ts) as one Node function behind `/api/*`; the app itself is
 * the static client build. `npm run build:vercel` (scripts/vercel-build.mjs) bundles this file
 * into `.vercel/output/functions/api.func/index.mjs` and writes the routes and headers that the
 * Node server (server/web.ts) applies itself.
 *
 * Vercel's edge sets `X-Forwarded-For` to the visitor's address (it never passes a client's own
 * value through), so one proxy is trusted by default: each visitor gets their own rate limits.
 */
import { getRequestListener } from '@hono/node-server'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createApp } from './app'
import { loadConfig } from './config'

export { linkPagePreloads, SHARE_TARGET_MISSED, SHARE_TARGET_PATH } from './web'

type Listener = ReturnType<typeof getRequestListener>

let listener: Listener | null = null

/** One app per warm instance, so the in-memory rate limits last between requests. */
export default function handler(req: IncomingMessage, res: ServerResponse): ReturnType<Listener> {
  listener ??= getRequestListener(createApp(loadConfig({ TRUST_PROXY: '1', ...process.env })).fetch)
  return listener(req, res)
}
