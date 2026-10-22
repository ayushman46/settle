/**
 * Cloudflare Pages Function: every `/api/*` request on the Pages site goes to the Node server on
 * Render (API_ORIGIN), so the app keeps calling its own origin. All the logic — and its tests —
 * live in server/edgeProxy.ts. Only `/api/*` runs a Function; every other file on the site is
 * served straight from Cloudflare's cache (free and unmetered).
 *
 * Pages project settings → Variables and Secrets:
 *   API_ORIGIN    https://<your-service>.onrender.com
 *   PROXY_SECRET  the same value as PROXY_SECRET on Render (type: Secret)
 */
import { proxyToApi, type EdgeProxyEnv } from '../../server/edgeProxy'

interface PagesContext {
  request: Request
  env: EdgeProxyEnv
}

export const onRequest = ({ request, env }: PagesContext): Promise<Response> => proxyToApi(request, env)
