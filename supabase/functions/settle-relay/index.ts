/**
 * settle-relay — live groups' relay store (server/sync.ts on Vercel keeps copies here when it has
 * no Upstash). One encrypted copy per room that nobody here can read: the value is the app
 * server's `{ w, d }` (write-token hash, data). A write is refused when the room already belongs to
 * another token, so even a direct call can't overwrite a group's copy. No accounts: friends in a
 * link group don't need one. The table is deny-all under RLS; only this function (service role) uses it.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

const ROOM = /^[A-Za-z0-9_-]{22,64}$/
const MAX_D = 420_000
const MAX_BODY = 900_000
const TTL_MAX = 400 * 86_400

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
}

const bad = () => json(400, { error: { code: 'bad_request' } })

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const room = url.pathname.split('/relay/')[1] ?? ''
  if (!ROOM.test(room)) return bad()
  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0]!.trim().slice(0, 64)
  try {
    const { data: allowed, error: limitError } = await db.rpc('hit_rate_limit', { p_key: `relay:${ip}`, p_max: 6000, p_window_seconds: 60 })
    if (limitError) throw limitError
    if (allowed !== true) return json(429, { error: { code: 'rate_limited' } })

    if (req.method === 'GET') {
      const { data, error } = await db.from('sync_rooms').select('w, d, expires_at').eq('room', room).maybeSingle()
      if (error) throw error
      if (!data || Date.parse(data.expires_at as string) < Date.now()) return json(200, { value: null })
      return json(200, { value: JSON.stringify({ w: data.w, d: data.d }) })
    }

    if (req.method === 'POST') {
      const raw = await req.text()
      if (raw.length > MAX_BODY) return bad()
      let body: { value?: unknown; ttl?: unknown }
      let kept: { w?: unknown; d?: unknown }
      try {
        body = JSON.parse(raw)
        kept = JSON.parse(String(body.value))
      } catch {
        return bad()
      }
      const { w, d } = kept
      if (typeof w !== 'string' || typeof d !== 'string' || w.length < 16 || w.length > 128 || d.length < 16 || d.length > MAX_D) return bad()
      const ttl = typeof body.ttl === 'number' && Number.isFinite(body.ttl) ? Math.min(Math.round(body.ttl), TTL_MAX) : TTL_MAX
      const { data: written, error } = await db.rpc('relay_put', { p_room: room, p_w: w, p_d: d, p_ttl_seconds: ttl })
      if (error) throw error
      if (written !== true) return json(403, { error: { code: 'forbidden' } })
      return json(200, { ok: true })
    }

    return json(405, { error: { code: 'bad_request' } })
  } catch (err) {
    console.error('[settle-relay]', err)
    return json(500, { error: { code: 'internal' } })
  }
})
