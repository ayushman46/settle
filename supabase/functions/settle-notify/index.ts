/**
 * settle-notify — pay requests between Settle accounts. When you split something with a friend
 * whose phone number is on a Settle account, they're asked to pay their share: in their own
 * Settle (GET /requests) and, once they've allowed it, as a phone notification (Web Push).
 *
 * Reached through the app's `/api/cloud/requests*` and `/api/cloud/push/*` (server/cloud.ts sends
 * those here instead of to settle-api), with the same passkey session. Uses the service role; the
 * tables (pay_requests, push_subscriptions) are deny-all under RLS. Kept apart from settle-api so
 * it can change without touching sign-in.
 *
 * Phone notifications need VAPID keys in this function's secrets: SETTLE_VAPID_PUBLIC_KEY and
 * SETTLE_VAPID_PRIVATE_KEY (`npx web-push generate-vapid-keys`), optionally SETTLE_VAPID_SUBJECT.
 * Without them the requests still show in the app.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const db: SupabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const VAPID_PUBLIC = Deno.env.get('SETTLE_VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('SETTLE_VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('SETTLE_VAPID_SUBJECT') ?? 'https://settleupi.vercel.app'
const MAX_BODY = 8 * 1024
const MAX_PUSH_SUBSCRIPTIONS = 10
const ANSWERS = new Set(['paid', 'dismissed'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOKEN = /^[A-Za-z0-9_-]{40,64}$/

class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
  }
}

const MESSAGES: Record<string, [number, string]> = {
  bad_request: [400, 'Something was wrong with that request. Please try again.'],
  unauthenticated: [401, 'Please sign in with your passkey.'],
  rate_limited: [429, 'Too many tries. Wait a few minutes and try again.'],
  not_found: [404, 'That isn’t there any more.'],
  internal: [500, 'Something went wrong on our side. Please try again.'],
}

function fail(code: string): never {
  const [status, message] = MESSAGES[code] ?? MESSAGES.internal!
  throw new ApiError(status, code in MESSAGES ? code : 'internal', message)
}

function dbFail(error: unknown): never {
  console.error('[settle-notify] db', error)
  fail('internal')
}

async function sha256(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** The signed-in person, from the same session settle-api issued. */
async function requireUser(req: Request): Promise<string> {
  const token = req.headers.get('x-settle-session') ?? ''
  if (!TOKEN.test(token)) fail('unauthenticated')
  const { data, error } = await db
    .from('sessions')
    .select('user_id, expires_at, revoked_at')
    .eq('token_hash', await sha256(token))
    .maybeSingle()
  if (error) dbFail(error)
  if (!data || data.revoked_at || Date.parse(data.expires_at) <= Date.now()) fail('unauthenticated')
  await limit(`notify:${data.user_id}`, 240, 60)
  return data.user_id
}

async function limit(key: string, max: number, windowSeconds: number): Promise<void> {
  const { data, error } = await db.rpc('hit_rate_limit', { p_key: key, p_max: max, p_window_seconds: windowSeconds })
  if (error) dbFail(error)
  if (data !== true) fail('rate_limited')
}

function str(value: unknown, min: number, max: number): string {
  if (typeof value !== 'string') fail('bad_request')
  const t = value.trim()
  if (t.length < min || t.length > max) fail('bad_request')
  return t
}

/* ------------------------------------------------------------------ UPI */

/** Letters, digits, spaces and plain punctuation only (UPI apps reject emoji), capped. */
function upiText(value: string, max: number): string {
  const cleaned = value.normalize('NFC').replace(/[^\p{L}\p{M}\p{N} .,'&()/-]/gu, ' ').replace(/\s+/g, ' ').trim()
  return Array.from(cleaned).slice(0, max).join('').trim()
}

function upiUri(upiId: string, payeeName: string, paise: number, note: string): string {
  const am = `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, '0')}`
  const params: Array<[string, string]> = [['pa', upiId.replace(/\s+/g, '').toLowerCase()]]
  const name = upiText(payeeName, 50)
  if (name) params.push(['pn', name])
  params.push(['am', am], ['cu', 'INR'], ['tn', upiText(note, 50) || 'Settle'])
  return `upi://pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`
}

function rupees(paise: number): string {
  const whole = paise % 100 === 0
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`
}

/* ------------------------------------------------------------------ raising and pushing */

interface Raised {
  id: string
  to_user: string
  title: string
  amount: number
  currency: string
}

/** The parts of the web-push library used here. */
interface WebPush {
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void
  sendNotification(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string, options: { TTL: number; urgency: string }): Promise<unknown>
}
let webPush: WebPush | null = null

/**
 * After the phone synced: the database raises requests for friends on Settle in this person's new
 * splits (and closes or updates old ones), then they're told. Returns how many were asked.
 */
async function raise(userId: string) {
  await limit(`notify:${userId}:raise`, 30, 60)
  const { data, error } = await db.rpc('raise_pay_requests', { p_user: userId })
  if (error) dbFail(error)
  const raised = (data ?? []) as Raised[]
  if (raised.length > 0) {
    try {
      await push(userId, raised)
    } catch (err) {
      console.error('[settle-notify] push', err)
    }
  }
  return { notified: raised.length }
}

async function push(fromUser: string, raised: Raised[]): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return
  if (!webPush) {
    const loaded = (await import('npm:web-push@3.6.7')) as unknown as { default: WebPush }
    webPush = loaded.default
    webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
  }
  const { data: sender } = await db.from('profiles').select('display_name').eq('id', fromUser).single()
  const from = sender?.display_name ?? 'A friend'
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', [...new Set(raised.map((r) => r.to_user))])
  for (const request of raised) {
    const share = request.currency === 'INR' ? rupees(request.amount) : `${request.currency} ${(request.amount / 100).toFixed(2)}`
    const payload = JSON.stringify({
      title: `${from} split ${request.title || 'a bill'} with you`,
      body: `Your share is ${share}. Tap to pay with any UPI app.`,
      url: '/app',
      tag: `pay-request-${request.id}`,
    })
    let sent = false
    for (const sub of (subs ?? []).filter((s) => s.user_id === request.to_user)) {
      try {
        await webPush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 86_400, urgency: 'normal' })
        sent = true
        await db.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', sub.id)
      } catch (err) {
        // Gone or expired: the browser dropped this subscription.
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('id', sub.id)
        else console.error('[settle-notify] push send', status)
      }
    }
    if (sent) await db.from('pay_requests').update({ pushed_at: new Date().toISOString() }).eq('id', request.id)
  }
}

/* ------------------------------------------------------------------ the person asked */

/** Requests waiting on me, newest first, each with who asked and where to pay them. */
async function list(userId: string) {
  const { data, error } = await db
    .from('pay_requests')
    .select('id, from_user, title, amount, currency, created_at')
    .eq('to_user', userId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) dbFail(error)
  const rows = data ?? []
  const senders = [...new Set(rows.map((r) => r.from_user as string))]
  const names = new Map<string, string>()
  const upis = new Map<string, string>()
  if (senders.length > 0) {
    const { data: people } = await db.from('profiles').select('id, display_name').in('id', senders)
    for (const p of people ?? []) names.set(p.id, p.display_name)
    const { data: methods } = await db
      .from('payment_methods')
      .select('user_id, upi_id, is_default, created_at')
      .in('user_id', senders)
      .neq('verification_status', 'disabled')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })
    for (const m of methods ?? []) if (!upis.has(m.user_id)) upis.set(m.user_id, m.upi_id)
  }
  return {
    requests: rows.map((r) => {
      const fromName = names.get(r.from_user) ?? 'A friend'
      const upiId = upis.get(r.from_user) ?? null
      const amount = Number(r.amount)
      return {
        id: r.id,
        fromName,
        title: r.title,
        amount,
        currency: r.currency,
        createdAt: r.created_at,
        upiId,
        upiUri: upiId && r.currency === 'INR' ? upiUri(upiId, fromName, amount, `Settle ${r.title}`) : null,
      }
    }),
  }
}

/** I paid it (off my list; the sender ticks it off in their Settle) or I'm hiding it. */
async function answer(userId: string, id: string, action: string) {
  if (!UUID.test(id) || !ANSWERS.has(action)) fail('not_found')
  const { data, error } = await db
    .from('pay_requests')
    .update({ status: action, updated_at: new Date().toISOString() })
    .eq('id', id.toLowerCase())
    .eq('to_user', userId)
    .eq('status', 'open')
    .select('id')
  if (error) dbFail(error)
  if (!data || data.length === 0) fail('not_found')
  return { ok: true }
}

/* ------------------------------------------------------------------ this browser's notifications */

async function subscribe(userId: string, body: Record<string, unknown>) {
  const endpoint = str(body.endpoint, 12, 1000)
  if (!endpoint.startsWith('https://')) fail('bad_request')
  const keys = (body.keys ?? {}) as Record<string, unknown>
  const p256dh = str(keys.p256dh, 20, 200)
  const auth = str(keys.auth, 8, 100)
  const { count } = await db.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  if ((count ?? 0) >= MAX_PUSH_SUBSCRIPTIONS) {
    // The oldest browser makes room.
    const { data: oldest } = await db.from('push_subscriptions').select('id').eq('user_id', userId).order('created_at').limit(1)
    if (oldest?.[0]) await db.from('push_subscriptions').delete().eq('id', oldest[0].id)
  }
  const { error } = await db.from('push_subscriptions').upsert({ user_id: userId, endpoint, p256dh, auth }, { onConflict: 'endpoint' })
  if (error) dbFail(error)
  return { ok: true }
}

async function unsubscribe(userId: string, body: Record<string, unknown>) {
  const endpoint = str(body.endpoint, 12, 1000)
  await db.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', userId)
  return { ok: true }
}

/* ------------------------------------------------------------------ router */

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const at = url.pathname.indexOf('/settle-notify')
  const path = (at >= 0 ? url.pathname.slice(at + '/settle-notify'.length) : url.pathname) || '/'
  try {
    if (path === '/health') return respond(200, { ok: true })
    let body: Record<string, unknown> = {}
    if (req.method === 'POST') {
      const raw = await req.text()
      if (raw.length > MAX_BODY) fail('bad_request')
      if (raw) {
        try {
          const parsed: unknown = JSON.parse(raw)
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) fail('bad_request')
          body = parsed as Record<string, unknown>
        } catch (err) {
          if (err instanceof ApiError) throw err
          fail('bad_request')
        }
      }
    }
    const parts = path.split('/').filter(Boolean)
    if (req.method === 'GET' && path === '/push/key') return respond(200, { key: VAPID_PUBLIC || null })
    const userId = await requireUser(req)
    if (req.method === 'GET' && path === '/requests') return respond(200, await list(userId))
    if (req.method === 'POST' && path === '/requests/raise') return respond(200, await raise(userId))
    if (req.method === 'POST' && parts.length === 3 && parts[0] === 'requests') return respond(200, await answer(userId, parts[1]!, parts[2]!))
    if (req.method === 'POST' && path === '/push/subscribe') return respond(200, await subscribe(userId, body))
    if (req.method === 'POST' && path === '/push/unsubscribe') return respond(200, await unsubscribe(userId, body))
    fail('not_found')
  } catch (err) {
    if (err instanceof ApiError) return respond(err.status, { error: { code: err.code, message: err.message } })
    console.error('[settle-notify]', err)
    return respond(500, { error: { code: 'internal', message: MESSAGES.internal![1] } })
  }
})
