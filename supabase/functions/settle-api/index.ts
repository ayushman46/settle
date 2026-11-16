/**
 * settle-api — Settle accounts on Supabase. Passkey sign-up and sign-in (WebAuthn, no OTP, no
 * passwords), opaque server sessions, UPI payment destinations, groups, expenses and settlements.
 *
 * Reached through the app's own `/api/cloud/*` proxy (server/cloud.ts), which turns the session
 * cookie into the `x-settle-session` header and back. Every table is deny-all under RLS; this
 * function uses the service role and checks the session and the caller's membership itself.
 * Balances, shares and settlement states are decided here and in the database's own functions —
 * never taken from the client.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from 'npm:@simplewebauthn/server@13'
import { buildUpiUri, computeShares, isUpiShaped, MAX_PAISE, normalizeIndianPhone, normalizeUpi, simplifyDebts, type SplitMethod } from './cloud.ts'

const DEFAULT_ORIGINS = ['https://settleupi.vercel.app', 'http://localhost:5173', 'http://localhost:4173']
const ORIGINS = (Deno.env.get('SETTLE_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean)
const ALLOWED_ORIGINS = ORIGINS.length > 0 ? ORIGINS : DEFAULT_ORIGINS
const RP_NAME = 'Settle'

const SESSION_DAYS = 30
const CHALLENGE_MS = 5 * 60_000
/** Sensitive changes (payment destinations, passkeys, signing out everywhere) need a passkey check this recent. */
const FRESH_MS = 5 * 60_000
const INVITE_DAYS = 7
const MAX_PAYMENT_METHODS = 5
const MAX_PASSKEYS = 10
const MAX_BODY = 64 * 1024
/**
 * Per-address limits on signing up and in. Indian mobile networks put many people behind one address
 * (carrier-grade NAT), and friends sign up together on one Wi-Fi, so these are generous; the
 * per-number limit (5 sign-ups an hour) and passkeys themselves are what stop abuse.
 */
const IP_SIGNUPS_PER_HOUR = 60
const IP_SIGNINS_PER_10_MIN = 150
/** A sync push carries a batch of expenses (itemized bills included). */
const MAX_SYNC_BODY = 1_500_000
const SYNC_CAP = 500
const SYNC_ITEMS = 2000

const db: SupabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

/* ------------------------------------------------------------------ plumbing */

class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
  }
}

const MESSAGES: Record<string, [number, string]> = {
  bad_request: [400, 'Something was wrong with that request. Please try again.'],
  unauthenticated: [401, 'Please sign in with your passkey.'],
  reauth_required: [401, 'Confirm it’s you with your passkey first.'],
  auth_failed: [401, 'That passkey didn’t work. Try again, or use another passkey on this account.'],
  challenge_expired: [400, 'That took too long. Please try again.'],
  phone_invalid: [400, 'Enter a 10-digit Indian mobile number.'],
  phone_taken: [409, 'This number can’t be used for a new account. If you already have one, sign in with your passkey.'],
  name_invalid: [400, 'Enter a name of up to 40 characters.'],
  rate_limited: [429, 'Too many tries. Wait a few minutes and try again.'],
  not_found: [404, 'That isn’t there any more.'],
  forbidden: [403, 'You can’t do that here.'],
  not_member: [403, 'You’re not in this group.'],
  upi_invalid: [400, 'That doesn’t look like a UPI ID (name@bank).'],
  upi_unconfirmed: [400, 'Check the UPI ID and confirm it’s yours before saving.'],
  upi_exists: [409, 'That UPI ID is already saved.'],
  upi_limit: [409, `You can keep up to ${MAX_PAYMENT_METHODS} UPI IDs.`],
  last_passkey: [409, 'Add another passkey before removing your last one — otherwise you’d be locked out.'],
  passkey_limit: [409, `You can keep up to ${MAX_PASSKEYS} passkeys.`],
  group_invalid: [400, 'Give the group a name of up to 60 characters.'],
  invite_invalid: [404, 'This invite link has expired or was already replaced. Ask for a new one.'],
  balance_not_zero: [409, 'Settle up first: you can leave once you owe and are owed nothing here.'],
  expense_invalid: [400, 'Check the amount, who paid and who it’s split between.'],
  split_sum_mismatch: [400, 'The shares don’t add up to the total.'],
  split_not_member: [400, 'Everyone in the split must be in the group.'],
  payer_not_member: [400, 'Whoever paid must be in the group.'],
  more_than_owed: [409, 'That’s more than you owe here (counting payments already in progress).'],
  more_than_due: [409, 'That’s more than they’re owed here (counting payments already in progress).'],
  same_person: [400, 'You can’t pay yourself.'],
  receiver_not_member: [400, 'They’re not in this group any more.'],
  no_destination: [409, 'They haven’t added a UPI ID yet. Pay them another way and record it, or ask them to add one.'],
  destination_invalid: [400, 'Pick one of their saved UPI IDs.'],
  bad_state: [409, 'This payment has already moved on. Refresh to see where it is.'],
  reason_required: [400, 'Say briefly why this needs correcting.'],
  idempotency_conflict: [409, 'This request was already used for another payment. Please try again.'],
  internal: [500, 'Something went wrong on our side. Please try again.'],
}

function fail(code: string): never {
  const [status, message] = MESSAGES[code] ?? MESSAGES.internal!
  throw new ApiError(status, code in MESSAGES ? code : 'internal', message)
}

/** A database function's `raise exception 'code'` becomes that code's error; anything else is ours. */
function dbFail(error: { message?: string; code?: string } | null): never {
  const text = error?.message ?? ''
  if (text in MESSAGES) fail(text)
  if (error?.code === '22P02' || error?.code === '23502' || error?.code === '23514' || error?.code === '22003') fail('bad_request')
  console.error('[settle-api] db', error)
  fail('internal')
}

const enc = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromB64url(text: string): Uint8Array<ArrayBuffer> {
  const bin = atob(text.replaceAll('-', '+').replaceAll('_', '/') + '==='.slice((text.length + 3) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
  return out
}

function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)))
}

async function sha256(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function uuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) fail('bad_request')
  return value.toLowerCase()
}

function text(value: unknown, min: number, max: number, code = 'bad_request'): string {
  if (typeof value !== 'string') fail(code)
  const t = value.replace(/\s+/g, ' ').trim()
  if (Array.from(t).length < min || Array.from(t).length > max) fail(code)
  return t
}

function paise(value: unknown, code = 'expense_invalid'): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0 || value > MAX_PAISE) fail(code)
  return value
}

function idemKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(value)) fail('bad_request')
  return value
}

interface Ctx {
  req: Request
  path: string
  method: string
  ip: string
  origin: string | null
  body: Record<string, unknown>
  /** A new session token for the proxy to put in the cookie, or 'clear'. */
  setSession?: string
}

interface Session {
  id: string
  userId: string
  reauthAt: number
}

async function limit(key: string, max: number, windowSeconds: number): Promise<void> {
  const { data, error } = await db.rpc('hit_rate_limit', { p_key: key, p_max: max, p_window_seconds: windowSeconds })
  if (error) dbFail(error)
  if (data !== true) fail('rate_limited')
}

async function audit(userId: string | null, action: string, ip: string, detail: Record<string, unknown> = {}): Promise<void> {
  const { error } = await db.from('audit_log').insert({ user_id: userId, action, ip, detail })
  if (error) console.error('[settle-api] audit', error)
}

/* ------------------------------------------------------------------ sessions */

async function newSession(ctx: Ctx, userId: string): Promise<void> {
  const token = randomToken()
  const { error } = await db.from('sessions').insert({
    user_id: userId,
    token_hash: await sha256(token),
    user_agent: (ctx.req.headers.get('user-agent') ?? '').slice(0, 200),
    expires_at: new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString(),
    reauth_at: new Date().toISOString(),
  })
  if (error) dbFail(error)
  ctx.setSession = token
}

async function readSession(ctx: Ctx): Promise<Session | null> {
  const token = ctx.req.headers.get('x-settle-session') ?? ''
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null
  const { data, error } = await db
    .from('sessions')
    .select('id, user_id, reauth_at, last_seen_at, expires_at, revoked_at')
    .eq('token_hash', await sha256(token))
    .maybeSingle()
  if (error) dbFail(error)
  if (!data || data.revoked_at || Date.parse(data.expires_at) <= Date.now()) return null
  if (Date.now() - Date.parse(data.last_seen_at) > 3_600_000) {
    await db
      .from('sessions')
      .update({ last_seen_at: new Date().toISOString(), expires_at: new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString() })
      .eq('id', data.id)
  }
  return { id: data.id, userId: data.user_id, reauthAt: Date.parse(data.reauth_at) }
}

async function requireSession(ctx: Ctx): Promise<Session> {
  const session = await readSession(ctx)
  if (!session) {
    ctx.setSession = 'clear'
    fail('unauthenticated')
  }
  await limit(`user:${session.userId}`, 240, 60)
  return session
}

function requireFresh(session: Session): void {
  if (Date.now() - session.reauthAt > FRESH_MS) fail('reauth_required')
}

/* ------------------------------------------------------------------ WebAuthn */

function rpFor(ctx: Ctx): string {
  const origin = ctx.origin && ALLOWED_ORIGINS.includes(ctx.origin) ? ctx.origin : ALLOWED_ORIGINS[0]!
  return new URL(origin).hostname
}

function originsFor(rpId: string): string[] {
  return ALLOWED_ORIGINS.filter((o) => new URL(o).hostname === rpId)
}

async function saveChallenge(row: Record<string, unknown>): Promise<string> {
  // Tidy old challenges now and then; they're useless after five minutes.
  if (Math.random() < 0.05) await db.from('webauthn_challenges').delete().lt('expires_at', new Date(Date.now() - 86_400_000).toISOString())
  const { data, error } = await db
    .from('webauthn_challenges')
    .insert({ ...row, expires_at: new Date(Date.now() + CHALLENGE_MS).toISOString() })
    .select('id')
    .single()
  if (error) dbFail(error)
  return data.id
}

/** Takes a challenge once: a second use, an expired one or the wrong kind all fail. */
async function takeChallenge(id: unknown, kind: string) {
  const { data, error } = await db
    .from('webauthn_challenges')
    .update({ used_at: new Date().toISOString() })
    .eq('id', uuid(id))
    .eq('kind', kind)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('*')
    .maybeSingle()
  if (error) dbFail(error)
  if (!data) fail('challenge_expired')
  return data
}

async function credentialsOf(userId: string) {
  const { data, error } = await db
    .from('passkey_credentials')
    .select('id, credential_id, transports, nickname, device_type, backed_up, created_at, last_used_at')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('created_at')
  if (error) dbFail(error)
  return data
}

function registrationOptions(rpID: string, userName: string, displayName: string, exclude: Array<{ credential_id: string; transports: string[] }>) {
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName,
    userDisplayName: displayName,
    userID: crypto.getRandomValues(new Uint8Array(32)),
    attestationType: 'none',
    excludeCredentials: exclude.map((c) => ({ id: c.credential_id, transports: c.transports as never })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    supportedAlgorithmIDs: [-7, -257],
  })
}

async function verifyRegistration(challenge: { challenge: string; rp_id: string }, response: unknown) {
  let result
  try {
    result = await verifyRegistrationResponse({
      response: response as never,
      expectedChallenge: challenge.challenge,
      expectedOrigin: originsFor(challenge.rp_id),
      expectedRPID: challenge.rp_id,
      requireUserVerification: true,
    })
  } catch {
    fail('auth_failed')
  }
  if (!result.verified || !result.registrationInfo) fail('auth_failed')
  const { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo
  return {
    credential_id: credential.id,
    public_key: b64url(credential.publicKey),
    sign_count: credential.counter,
    transports: credential.transports ?? [],
    device_type: credentialDeviceType,
    backed_up: credentialBackedUp,
  }
}

/** Checks a signed assertion against a stored credential; returns the credential's owner. */
async function verifyAssertion(challenge: { challenge: string; rp_id: string }, response: unknown, onlyUser?: string): Promise<{ userId: string; credentialRow: string }> {
  const credentialId = (response as { id?: unknown } | null)?.id
  if (typeof credentialId !== 'string' || credentialId.length > 1024) fail('auth_failed')
  const { data: cred, error } = await db
    .from('passkey_credentials')
    .select('id, user_id, credential_id, public_key, sign_count, transports')
    .eq('credential_id', credentialId)
    .is('revoked_at', null)
    .maybeSingle()
  if (error) dbFail(error)
  if (!cred || (onlyUser && cred.user_id !== onlyUser)) fail('auth_failed')
  let result
  try {
    result = await verifyAuthenticationResponse({
      response: response as never,
      expectedChallenge: challenge.challenge,
      expectedOrigin: originsFor(challenge.rp_id),
      expectedRPID: challenge.rp_id,
      credential: { id: cred.credential_id, publicKey: fromB64url(cred.public_key), counter: Number(cred.sign_count), transports: cred.transports },
      requireUserVerification: true,
    })
  } catch {
    fail('auth_failed')
  }
  if (!result.verified) fail('auth_failed')
  await db
    .from('passkey_credentials')
    .update({ sign_count: result.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
    .eq('id', cred.id)
  return { userId: cred.user_id, credentialRow: cred.id }
}

/* ------------------------------------------------------------------ auth routes */

async function registerOptions(ctx: Ctx) {
  await limit(`ip:${ctx.ip}:register`, IP_SIGNUPS_PER_HOUR, 3600)
  const phone = normalizeIndianPhone(typeof ctx.body.phone === 'string' ? ctx.body.phone : '')
  if (!phone) fail('phone_invalid')
  const displayName = text(ctx.body.displayName, 1, 40, 'name_invalid')
  await limit(`phone:${phone}:register`, 5, 3600)
  const { data: existing, error } = await db.from('profiles').select('id').eq('phone_number', phone).maybeSingle()
  if (error) dbFail(error)
  // An unverified number can't prove anything, so a taken number never leads into its account.
  if (existing) fail('phone_taken')
  const rpID = rpFor(ctx)
  const options = await registrationOptions(rpID, phone, displayName, [])
  const challengeId = await saveChallenge({ challenge: options.challenge, kind: 'register', phone_number: phone, display_name: displayName, rp_id: rpID })
  return { challengeId, options }
}

async function registerVerify(ctx: Ctx) {
  await limit(`ip:${ctx.ip}:register-verify`, IP_SIGNUPS_PER_HOUR * 2, 3600)
  const challenge = await takeChallenge(ctx.body.challengeId, 'register')
  const credential = await verifyRegistration(challenge, ctx.body.response)
  const { data: profile, error } = await db
    .from('profiles')
    .insert({ display_name: challenge.display_name, phone_number: challenge.phone_number, phone_verified: false })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') fail('phone_taken')
    dbFail(error)
  }
  const { error: credError } = await db.from('passkey_credentials').insert({ ...credential, user_id: profile.id })
  if (credError) {
    await db.from('profiles').delete().eq('id', profile.id)
    if (credError.code === '23505') fail('auth_failed')
    dbFail(credError)
  }
  await newSession(ctx, profile.id)
  await audit(profile.id, 'account.create', ctx.ip, { device_type: credential.device_type, backed_up: credential.backed_up })
  return { me: await me(profile.id, Date.now()) }
}

async function loginOptions(ctx: Ctx) {
  await limit(`ip:${ctx.ip}:login`, IP_SIGNINS_PER_10_MIN, 600)
  const phone = typeof ctx.body.phone === 'string' && ctx.body.phone.trim() ? normalizeIndianPhone(ctx.body.phone) : null
  let allow: Array<{ credential_id: string; transports: string[] }> = []
  if (phone) {
    const { data: profile } = await db.from('profiles').select('id').eq('phone_number', phone).maybeSingle()
    if (profile) allow = await credentialsOf(profile.id)
  }
  // Unknown numbers get the same answer as known ones: the browser offers whatever passkeys it has.
  const rpID = rpFor(ctx)
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: allow.map((c) => ({ id: c.credential_id, transports: c.transports as never })),
  })
  const challengeId = await saveChallenge({ challenge: options.challenge, kind: 'login', rp_id: rpID })
  return { challengeId, options }
}

async function loginVerify(ctx: Ctx) {
  await limit(`ip:${ctx.ip}:login-verify`, IP_SIGNINS_PER_10_MIN, 600)
  const challenge = await takeChallenge(ctx.body.challengeId, 'login')
  const { userId } = await verifyAssertion(challenge, ctx.body.response)
  await newSession(ctx, userId)
  await audit(userId, 'session.create', ctx.ip)
  return { me: await me(userId, Date.now()) }
}

async function reauthOptions(ctx: Ctx, session: Session) {
  const creds = await credentialsOf(session.userId)
  const rpID = rpFor(ctx)
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: creds.map((c) => ({ id: c.credential_id, transports: c.transports as never })),
  })
  const challengeId = await saveChallenge({ challenge: options.challenge, kind: 'reauth', user_id: session.userId, session_id: session.id, rp_id: rpID })
  return { challengeId, options }
}

async function reauthVerify(ctx: Ctx, session: Session) {
  const challenge = await takeChallenge(ctx.body.challengeId, 'reauth')
  if (challenge.session_id !== session.id) fail('auth_failed')
  await verifyAssertion(challenge, ctx.body.response, session.userId)
  const { error } = await db.from('sessions').update({ reauth_at: new Date().toISOString() }).eq('id', session.id)
  if (error) dbFail(error)
  return { fresh: true }
}

async function logout(ctx: Ctx) {
  const session = await readSession(ctx)
  if (session) {
    await db.from('sessions').update({ revoked_at: new Date().toISOString() }).eq('id', session.id)
    await audit(session.userId, 'session.end', ctx.ip)
  }
  ctx.setSession = 'clear'
  return { ok: true }
}

async function logoutAll(ctx: Ctx, session: Session) {
  requireFresh(session)
  const { error } = await db.from('sessions').update({ revoked_at: new Date().toISOString() }).eq('user_id', session.userId).is('revoked_at', null)
  if (error) dbFail(error)
  await audit(session.userId, 'session.end_all', ctx.ip)
  ctx.setSession = 'clear'
  return { ok: true }
}

/* ------------------------------------------------------------------ the account */

async function paymentMethodsOf(userId: string) {
  const { data, error } = await db
    .from('payment_methods')
    .select('id, upi_id, display_name, verification_status, source, is_default, created_at, updated_at')
    .eq('user_id', userId)
    .neq('verification_status', 'disabled')
    .order('created_at')
  if (error) dbFail(error)
  return data
}

async function me(userId: string, reauthAt: number) {
  const { data: profile, error } = await db.from('profiles').select('id, display_name, phone_number, phone_verified, created_at').eq('id', userId).single()
  if (error) dbFail(error)
  const passkeys = (await credentialsOf(userId)).map((c) => ({
    id: c.id,
    nickname: c.nickname,
    deviceType: c.device_type,
    backedUp: c.backed_up,
    createdAt: c.created_at,
    lastUsedAt: c.last_used_at,
  }))
  return {
    id: profile.id,
    displayName: profile.display_name,
    phoneNumber: profile.phone_number,
    phoneVerified: profile.phone_verified,
    createdAt: profile.created_at,
    passkeys,
    paymentMethods: (await paymentMethodsOf(userId)).map(pmOut),
    freshUntil: new Date(reauthAt + FRESH_MS).toISOString(),
  }
}

function pmOut(p: { id: string; upi_id: string; display_name: string | null; verification_status: string; source: string; is_default: boolean; created_at: string }) {
  return { id: p.id, upiId: p.upi_id, displayName: p.display_name, status: p.verification_status, source: p.source, isDefault: p.is_default, createdAt: p.created_at }
}

async function updateMe(ctx: Ctx, session: Session) {
  const displayName = text(ctx.body.displayName, 1, 40, 'name_invalid')
  const { error } = await db.from('profiles').update({ display_name: displayName, updated_at: new Date().toISOString() }).eq('id', session.userId)
  if (error) dbFail(error)
  return { me: await me(session.userId, session.reauthAt) }
}

async function addPasskeyOptions(ctx: Ctx, session: Session) {
  requireFresh(session)
  const creds = await credentialsOf(session.userId)
  if (creds.length >= MAX_PASSKEYS) fail('passkey_limit')
  const { data: profile } = await db.from('profiles').select('display_name, phone_number').eq('id', session.userId).single()
  const rpID = rpFor(ctx)
  const options = await registrationOptions(rpID, profile!.phone_number, profile!.display_name, creds)
  const challengeId = await saveChallenge({ challenge: options.challenge, kind: 'add_passkey', user_id: session.userId, session_id: session.id, rp_id: rpID })
  return { challengeId, options }
}

async function addPasskeyVerify(ctx: Ctx, session: Session) {
  const challenge = await takeChallenge(ctx.body.challengeId, 'add_passkey')
  if (challenge.session_id !== session.id) fail('auth_failed')
  const credential = await verifyRegistration(challenge, ctx.body.response)
  const nickname = typeof ctx.body.nickname === 'string' && ctx.body.nickname.trim() ? text(ctx.body.nickname, 1, 40) : null
  const { error } = await db.from('passkey_credentials').insert({ ...credential, nickname, user_id: session.userId })
  if (error) {
    if (error.code === '23505') fail('auth_failed')
    dbFail(error)
  }
  await audit(session.userId, 'passkey.add', ctx.ip, { device_type: credential.device_type })
  return { me: await me(session.userId, session.reauthAt) }
}

async function revokePasskey(ctx: Ctx, session: Session, id: string) {
  requireFresh(session)
  const creds = await credentialsOf(session.userId)
  if (!creds.some((c) => c.id === id)) fail('not_found')
  if (creds.length <= 1) fail('last_passkey')
  const { error } = await db.from('passkey_credentials').update({ revoked_at: new Date().toISOString() }).eq('id', id).eq('user_id', session.userId)
  if (error) dbFail(error)
  await audit(session.userId, 'passkey.revoke', ctx.ip, { credential: id })
  return { me: await me(session.userId, session.reauthAt) }
}

async function addPaymentMethod(ctx: Ctx, session: Session) {
  requireFresh(session)
  if (typeof ctx.body.upiId !== 'string' || !isUpiShaped(ctx.body.upiId)) fail('upi_invalid')
  if (ctx.body.confirmed !== true) fail('upi_unconfirmed')
  const upiId = normalizeUpi(ctx.body.upiId)
  const displayName = typeof ctx.body.displayName === 'string' && ctx.body.displayName.trim() ? text(ctx.body.displayName, 1, 60) : null
  const source = ctx.body.source === 'qr' ? 'qr' : 'typed'
  const existing = await paymentMethodsOf(session.userId)
  if (existing.some((p) => p.upi_id === upiId)) fail('upi_exists')
  if (existing.length >= MAX_PAYMENT_METHODS) fail('upi_limit')
  const { error } = await db.from('payment_methods').insert({
    user_id: session.userId,
    upi_id: upiId,
    display_name: displayName,
    source,
    // Shape-checked and confirmed by its owner: 'validated'. Never 'verified' — no bank has said so.
    verification_status: 'validated',
    is_default: existing.length === 0,
  })
  if (error) {
    if (error.code === '23505') fail('upi_exists')
    dbFail(error)
  }
  await audit(session.userId, 'payment_method.add', ctx.ip, { upi_id: upiId, source })
  return { me: await me(session.userId, session.reauthAt) }
}

async function updatePaymentMethod(ctx: Ctx, session: Session, id: string) {
  const existing = await paymentMethodsOf(session.userId)
  const target = existing.find((p) => p.id === id)
  if (!target) fail('not_found')
  if (ctx.body.isDefault === true && !target.is_default) {
    requireFresh(session)
    await db.from('payment_methods').update({ is_default: false, updated_at: new Date().toISOString() }).eq('user_id', session.userId).eq('is_default', true)
    const { error } = await db.from('payment_methods').update({ is_default: true, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) dbFail(error)
    await audit(session.userId, 'payment_method.default', ctx.ip, { upi_id: target.upi_id })
  }
  if (typeof ctx.body.displayName === 'string') {
    const displayName = ctx.body.displayName.trim() ? text(ctx.body.displayName, 1, 60) : null
    const { error } = await db.from('payment_methods').update({ display_name: displayName, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) dbFail(error)
  }
  return { me: await me(session.userId, session.reauthAt) }
}

async function removePaymentMethod(ctx: Ctx, session: Session, id: string) {
  requireFresh(session)
  const existing = await paymentMethodsOf(session.userId)
  const target = existing.find((p) => p.id === id)
  if (!target) fail('not_found')
  const { error } = await db
    .from('payment_methods')
    .update({ verification_status: 'disabled', is_default: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) dbFail(error)
  const next = existing.find((p) => p.id !== id)
  if (target.is_default && next) await db.from('payment_methods').update({ is_default: true }).eq('id', next.id)
  await audit(session.userId, 'payment_method.disable', ctx.ip, { upi_id: target.upi_id })
  return { me: await me(session.userId, session.reauthAt) }
}

/* ------------------------------------------------------------------ groups */

async function requireMember(groupId: string, userId: string): Promise<{ role: string }> {
  const { data, error } = await db.from('group_members').select('role').eq('group_id', groupId).eq('user_id', userId).is('left_at', null).maybeSingle()
  if (error) dbFail(error)
  if (!data) fail('not_member')
  return data
}

async function balancesOf(groupId: string) {
  const { data, error } = await db.rpc('group_balances', { p_group: groupId })
  if (error) dbFail(error)
  return (data as Array<{ user_id: string; net: number; open_out: number; open_in: number }>).map((b) => ({
    userId: b.user_id,
    net: Number(b.net),
    openOut: Number(b.open_out),
    openIn: Number(b.open_in),
  }))
}

async function listGroups(session: Session) {
  const { data, error } = await db
    .from('group_members')
    .select('group_id, role, groups(id, name, updated_at)')
    .eq('user_id', session.userId)
    .is('left_at', null)
    .limit(100)
  if (error) dbFail(error)
  const groups = []
  for (const row of data as unknown as Array<{ role: string; groups: { id: string; name: string; updated_at: string } }>) {
    const balances = await balancesOf(row.groups.id)
    const mine = balances.find((b) => b.userId === session.userId)
    groups.push({ id: row.groups.id, name: row.groups.name, role: row.role, updatedAt: row.groups.updated_at, net: mine?.net ?? 0, members: balances.length })
  }
  groups.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  return groups
}

async function dashboard(session: Session) {
  const groups = await listGroups(session)
  const owe = groups.reduce((s, g) => s + (g.net < 0 ? -g.net : 0), 0)
  const owed = groups.reduce((s, g) => s + (g.net > 0 ? g.net : 0), 0)
  const { data: open, error } = await db
    .from('settlements')
    .select('id, group_id, sender_id, receiver_id, amount_paise, status, updated_at, groups(name)')
    .or(`sender_id.eq.${session.userId},receiver_id.eq.${session.userId}`)
    .not('status', 'in', '(confirmed,cancelled)')
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error) dbFail(error)
  const names = await namesOf((open ?? []).flatMap((s) => [s.sender_id, s.receiver_id]))
  return {
    owe,
    owed,
    net: owed - owe,
    groups,
    open: (open ?? []).map((s) => settlementOut(s as never, names, session.userId)),
  }
}

async function namesOf(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return new Map()
  const { data, error } = await db.from('profiles').select('id, display_name').in('id', unique)
  if (error) dbFail(error)
  return new Map(data.map((p) => [p.id, p.display_name]))
}

async function createGroup(ctx: Ctx, session: Session) {
  const name = text(ctx.body.name, 1, 60, 'group_invalid')
  const { data, error } = await db.from('groups').insert({ name, created_by: session.userId }).select('id').single()
  if (error) dbFail(error)
  const { error: memberError } = await db.from('group_members').insert({ group_id: data.id, user_id: session.userId, role: 'owner' })
  if (memberError) dbFail(memberError)
  await audit(session.userId, 'group.create', ctx.ip, { group_id: data.id })
  return { id: data.id }
}

interface SettlementRow {
  id: string
  group_id: string
  sender_id: string
  receiver_id: string
  amount_paise: number
  status: string
  created_at?: string
  updated_at: string
  groups?: { name: string } | null
  settlement_events?: Array<{ event_type: string; from_status: string | null; to_status: string | null; actor_id: string | null; created_at: string; event_data: Record<string, unknown> }>
}

function settlementOut(s: SettlementRow, names: Map<string, string>, me: string) {
  const party = s.sender_id === me || s.receiver_id === me
  return {
    id: s.id,
    groupId: s.group_id,
    groupName: s.groups?.name ?? null,
    senderId: s.sender_id,
    senderName: names.get(s.sender_id) ?? '',
    receiverId: s.receiver_id,
    receiverName: names.get(s.receiver_id) ?? '',
    amountPaise: Number(s.amount_paise),
    status: s.status,
    createdAt: s.created_at ?? null,
    updatedAt: s.updated_at,
    events: (s.settlement_events ?? [])
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
      .map((e) => ({
        type: e.event_type,
        from: e.from_status,
        to: e.to_status,
        actorId: e.actor_id,
        at: e.created_at,
        // References and reasons are between the two people paying each other.
        data: party ? e.event_data : {},
      })),
  }
}

async function groupDetail(session: Session, groupId: string) {
  const membership = await requireMember(groupId, session.userId)
  const { data: group, error } = await db.from('groups').select('id, name, created_by, created_at, updated_at').eq('id', groupId).single()
  if (error) dbFail(error)
  const { data: members, error: mError } = await db
    .from('group_members')
    .select('user_id, role, joined_at, left_at, profiles(display_name)')
    .eq('group_id', groupId)
    .order('joined_at')
  if (mError) dbFail(mError)
  const memberIds = (members as unknown as Array<{ user_id: string }>).map((m) => m.user_id)
  const { data: payable } = await db.from('payment_methods').select('user_id').in('user_id', memberIds).neq('verification_status', 'disabled')
  const withUpi = new Set((payable ?? []).map((p) => p.user_id))
  const balances = await balancesOf(groupId)
  const { data: expenses, error: eError } = await db
    .from('expenses')
    .select('id, payer_id, amount_paise, description, category, split_method, created_by, created_at, updated_at, expense_splits(user_id, share_paise)')
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200)
  if (eError) dbFail(eError)
  const { data: settlements, error: sError } = await db
    .from('settlements')
    .select('id, group_id, sender_id, receiver_id, amount_paise, status, created_at, updated_at, settlement_events(event_type, from_status, to_status, actor_id, created_at, event_data)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (sError) dbFail(sError)
  const names = new Map((members as unknown as Array<{ user_id: string; profiles: { display_name: string } }>).map((m) => [m.user_id, m.profiles.display_name]))
  // What's still to settle, after payments already confirmed; open ones are shown beside it.
  const transfers = simplifyDebts(balances.map((b) => ({ userId: b.userId, net: b.net })))
  return {
    group: { id: group.id, name: group.name, createdAt: group.created_at, updatedAt: group.updated_at },
    me: session.userId,
    myRole: membership.role,
    members: (members as unknown as Array<{ user_id: string; role: string; joined_at: string; left_at: string | null; profiles: { display_name: string } }>).map((m) => ({
      userId: m.user_id,
      displayName: m.profiles.display_name,
      role: m.role,
      joinedAt: m.joined_at,
      active: m.left_at === null,
      hasUpi: withUpi.has(m.user_id),
    })),
    balances,
    transfers,
    expenses: (expenses ?? []).map((e) => ({
      id: e.id,
      payerId: e.payer_id,
      amountPaise: Number(e.amount_paise),
      description: e.description,
      category: e.category,
      method: e.split_method,
      createdBy: e.created_by,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
      splits: (e.expense_splits as Array<{ user_id: string; share_paise: number }>).map((s) => ({ userId: s.user_id, sharePaise: Number(s.share_paise) })),
    })),
    settlements: (settlements ?? []).map((s) => settlementOut(s as never, names, session.userId)),
  }
}

async function createInvite(ctx: Ctx, session: Session, groupId: string) {
  await requireMember(groupId, session.userId)
  await limit(`user:${session.userId}:invite`, 30, 3600)
  const token = randomToken(24)
  const { error } = await db.from('group_invites').insert({
    group_id: groupId,
    token_hash: await sha256(token),
    created_by: session.userId,
    expires_at: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
  })
  if (error) dbFail(error)
  await audit(session.userId, 'group.invite', ctx.ip, { group_id: groupId })
  return { token, expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString() }
}

async function findInvite(token: unknown) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{30,40}$/.test(token)) fail('invite_invalid')
  const { data, error } = await db
    .from('group_invites')
    .select('id, group_id, expires_at, revoked_at, groups(name)')
    .eq('token_hash', await sha256(token))
    .maybeSingle()
  if (error) dbFail(error)
  if (!data || data.revoked_at || Date.parse(data.expires_at) <= Date.now()) fail('invite_invalid')
  return data as unknown as { id: string; group_id: string; groups: { name: string } }
}

async function peekInvite(ctx: Ctx, session: Session) {
  await limit(`user:${session.userId}:peek`, 30, 600)
  const invite = await findInvite(ctx.body.token)
  const { count } = await db.from('group_members').select('id', { count: 'exact', head: true }).eq('group_id', invite.group_id).is('left_at', null)
  const { data: mine } = await db.from('group_members').select('id').eq('group_id', invite.group_id).eq('user_id', session.userId).is('left_at', null).maybeSingle()
  return { groupId: invite.group_id, groupName: invite.groups.name, members: count ?? 0, alreadyIn: Boolean(mine) }
}

async function acceptInvite(ctx: Ctx, session: Session) {
  await limit(`user:${session.userId}:join`, 30, 600)
  const invite = await findInvite(ctx.body.token)
  const { data: existing } = await db.from('group_members').select('id, left_at').eq('group_id', invite.group_id).eq('user_id', session.userId).maybeSingle()
  if (existing && existing.left_at) {
    await db.from('group_members').update({ left_at: null, joined_at: new Date().toISOString() }).eq('id', existing.id)
  } else if (!existing) {
    const { error } = await db.from('group_members').insert({ group_id: invite.group_id, user_id: session.userId, role: 'member' })
    if (error && error.code !== '23505') dbFail(error)
  }
  await audit(session.userId, 'group.join', ctx.ip, { group_id: invite.group_id })
  return { groupId: invite.group_id }
}

async function leaveGroup(ctx: Ctx, session: Session, groupId: string) {
  const membership = await requireMember(groupId, session.userId)
  const mine = (await balancesOf(groupId)).find((b) => b.userId === session.userId)
  if (mine && (mine.net !== 0 || mine.openIn !== 0 || mine.openOut !== 0)) fail('balance_not_zero')
  const { error } = await db.from('group_members').update({ left_at: new Date().toISOString(), role: 'member' }).eq('group_id', groupId).eq('user_id', session.userId)
  if (error) dbFail(error)
  if (membership.role === 'owner') {
    const { data: next } = await db.from('group_members').select('id').eq('group_id', groupId).is('left_at', null).order('joined_at').limit(1).maybeSingle()
    if (next) await db.from('group_members').update({ role: 'owner' }).eq('id', next.id)
  }
  await audit(session.userId, 'group.leave', ctx.ip, { group_id: groupId })
  return { ok: true }
}

/* ------------------------------------------------------------------ expenses */

function expenseInput(body: Record<string, unknown>) {
  const description = text(body.description, 1, 120, 'expense_invalid')
  const amount = paise(body.amountPaise)
  const payerId = uuid(body.payerId)
  const method = body.method
  if (method !== 'equal' && method !== 'exact' && method !== 'percent') fail('expense_invalid')
  if (!Array.isArray(body.participants) || body.participants.length === 0 || body.participants.length > 100) fail('expense_invalid')
  const people = body.participants.map((p) => {
    const row = p as { userId?: unknown; value?: unknown }
    return { userId: uuid(row.userId), value: typeof row.value === 'number' ? row.value : 0 }
  })
  const result = computeShares(amount, method as SplitMethod, people)
  if (!result.ok) fail(result.error === 'exact_sum' || result.error === 'percent_sum' ? 'split_sum_mismatch' : 'expense_invalid')
  const category = typeof body.category === 'string' && body.category.trim() ? text(body.category, 1, 32) : null
  return {
    description,
    amount,
    payerId,
    method,
    category,
    splits: result.shares.map((s) => ({ user_id: s.userId, share_paise: s.sharePaise })),
  }
}

async function addExpense(ctx: Ctx, session: Session, groupId: string) {
  await requireMember(groupId, session.userId)
  const input = expenseInput(ctx.body)
  const { data, error } = await db.rpc('create_expense', {
    p_group: groupId,
    p_actor: session.userId,
    p_payer: input.payerId,
    p_amount: input.amount,
    p_description: input.description,
    p_category: input.category,
    p_method: input.method,
    p_splits: input.splits,
  })
  if (error) dbFail(error)
  return { id: data }
}

async function editExpense(ctx: Ctx, session: Session, expenseId: string) {
  const input = expenseInput(ctx.body)
  const { error } = await db.rpc('update_expense', {
    p_expense: expenseId,
    p_actor: session.userId,
    p_payer: input.payerId,
    p_amount: input.amount,
    p_description: input.description,
    p_category: input.category,
    p_method: input.method,
    p_splits: input.splits,
  })
  if (error) dbFail(error)
  return { ok: true }
}

async function removeExpense(session: Session, expenseId: string) {
  const { error } = await db.rpc('delete_expense', { p_expense: expenseId, p_actor: session.userId })
  if (error) dbFail(error)
  return { ok: true }
}

/* ------------------------------------------------------------------ settlements */

async function createSettlement(ctx: Ctx, session: Session, groupId: string) {
  await requireMember(groupId, session.userId)
  const { data, error } = await db.rpc('create_settlement', {
    p_group: groupId,
    p_sender: session.userId,
    p_receiver: uuid(ctx.body.receiverId),
    p_amount: paise(ctx.body.amountPaise, 'bad_request'),
    p_idempotency_key: idemKey(ctx.body.idempotencyKey),
  })
  if (error) dbFail(error)
  return { id: data }
}

async function loadSettlement(id: string, userId: string) {
  const { data, error } = await db.from('settlements').select('id, group_id, sender_id, receiver_id, amount_paise, status, groups(name)').eq('id', id).maybeSingle()
  if (error) dbFail(error)
  if (!data || (data.sender_id !== userId && data.receiver_id !== userId)) fail('not_found')
  return data as unknown as { id: string; group_id: string; sender_id: string; receiver_id: string; amount_paise: number; status: string; groups: { name: string } }
}

async function destinations(session: Session, id: string) {
  const s = await loadSettlement(id, session.userId)
  const methods = await paymentMethodsOf(s.receiver_id)
  return {
    destinations: methods.map((p) => ({ id: p.id, upiId: p.upi_id, displayName: p.display_name, status: p.verification_status, isDefault: p.is_default })),
  }
}

async function pay(ctx: Ctx, session: Session, id: string) {
  const s = await loadSettlement(id, session.userId)
  if (s.sender_id !== session.userId) fail('forbidden')
  const methods = await paymentMethodsOf(s.receiver_id)
  let method: (typeof methods)[number] | undefined = methods.find((p) => p.is_default) ?? methods[0]
  if (ctx.body.paymentMethodId !== undefined && ctx.body.paymentMethodId !== null) {
    method = methods.find((p) => p.id === uuid(ctx.body.paymentMethodId))
    if (!method) fail('destination_invalid')
  }
  if (!method) fail('no_destination')
  const { data: attemptId, error } = await db.rpc('start_settlement_attempt', {
    p_settlement: s.id,
    p_actor: session.userId,
    p_idempotency_key: idemKey(ctx.body.idempotencyKey),
    p_payment_method: method.id,
    p_upi_id: method.upi_id,
  })
  if (error) dbFail(error)
  const { data: receiver } = await db.from('profiles').select('display_name').eq('id', s.receiver_id).single()
  const payeeName = receiver?.display_name ?? 'Settle'
  const note = `Settle ${s.groups.name}`
  return {
    attemptId,
    upiId: method.upi_id,
    payeeName,
    amountPaise: Number(s.amount_paise),
    note,
    upiUri: buildUpiUri({ upiId: method.upi_id, payeeName, amountPaise: Number(s.amount_paise), note, reference: `STL${String(attemptId).replace(/-/g, '').slice(0, 16)}` }),
  }
}

const ACTIONS = new Set(['sent', 'failed', 'cancel', 'confirm', 'dispute', 'reverse'])

async function transition(ctx: Ctx, session: Session, id: string, action: string) {
  await loadSettlement(id, session.userId)
  const data: Record<string, string> = {}
  if (typeof ctx.body.transactionReference === 'string' && ctx.body.transactionReference.trim()) {
    data.transaction_reference = text(ctx.body.transactionReference, 1, 64)
  }
  if (typeof ctx.body.reason === 'string' && ctx.body.reason.trim()) data.reason = text(ctx.body.reason, 1, 200)
  const { data: status, error } = await db.rpc('settlement_transition', { p_settlement: id, p_actor: session.userId, p_action: action, p_data: data })
  if (error) dbFail(error)
  return { status }
}

/* ------------------------------------------------------------------ the phone's own data */

/** Everything that changed on the account after the `since` cursor, a page at a time. */
async function syncPull(ctx: Ctx, session: Session) {
  const since = Number(new URL(ctx.req.url).searchParams.get('since') ?? '0')
  if (!Number.isSafeInteger(since) || since < 0) fail('bad_request')
  const { data, error } = await db.rpc('sync_pull', { p_user: session.userId, p_since: since, p_cap: SYNC_CAP })
  if (error) dbFail(error)
  return data
}

/** What one phone changed. The database keeps whichever change is newer, row by row. */
async function syncPush(ctx: Ctx, session: Session) {
  const payload: Record<string, unknown[]> = {}
  let total = 0
  for (const kind of ['friends', 'groups', 'expenses', 'stores']) {
    const list = ctx.body[kind]
    if (list === undefined) continue
    if (!Array.isArray(list) || list.length > SYNC_ITEMS) fail('bad_request')
    for (const item of list) {
      const row = item as Record<string, unknown> | null
      const id = kind === 'stores' ? row?.key : row?.id
      if (typeof row !== 'object' || row === null || typeof id !== 'string' || !Number.isSafeInteger(row.updatedAt)) fail('bad_request')
    }
    payload[kind] = list
    total += list.length
  }
  if (total === 0) return { written: 0 }
  const { data, error } = await db.rpc('sync_push', { p_user: session.userId, p_payload: payload })
  if (error) dbFail(error)
  return { written: data }
}

/* ------------------------------------------------------------------ router */

type Handler = (ctx: Ctx, params: string[]) => Promise<unknown>

const withSession = (fn: (ctx: Ctx, session: Session, params: string[]) => Promise<unknown>): Handler => async (ctx, params) =>
  fn(ctx, await requireSession(ctx), params)

const ROUTES: Array<[string, string, Handler]> = [
  ['POST', '/auth/register/options', (ctx) => registerOptions(ctx)],
  ['POST', '/auth/register/verify', (ctx) => registerVerify(ctx)],
  ['POST', '/auth/login/options', (ctx) => loginOptions(ctx)],
  ['POST', '/auth/login/verify', (ctx) => loginVerify(ctx)],
  ['POST', '/auth/reauth/options', withSession((ctx, s) => reauthOptions(ctx, s))],
  ['POST', '/auth/reauth/verify', withSession((ctx, s) => reauthVerify(ctx, s))],
  ['POST', '/auth/logout', (ctx) => logout(ctx)],
  ['POST', '/auth/logout-all', withSession((ctx, s) => logoutAll(ctx, s))],
  ['GET', '/me', withSession(async (_ctx, s) => ({ me: await me(s.userId, s.reauthAt) }))],
  ['PATCH', '/me', withSession((ctx, s) => updateMe(ctx, s))],
  ['POST', '/passkeys/options', withSession((ctx, s) => addPasskeyOptions(ctx, s))],
  ['POST', '/passkeys/verify', withSession((ctx, s) => addPasskeyVerify(ctx, s))],
  ['DELETE', '/passkeys/:id', withSession((ctx, s, [id]) => revokePasskey(ctx, s, uuid(id)))],
  ['POST', '/payment-methods', withSession((ctx, s) => addPaymentMethod(ctx, s))],
  ['PATCH', '/payment-methods/:id', withSession((ctx, s, [id]) => updatePaymentMethod(ctx, s, uuid(id)))],
  ['DELETE', '/payment-methods/:id', withSession((ctx, s, [id]) => removePaymentMethod(ctx, s, uuid(id)))],
  ['GET', '/dashboard', withSession((_ctx, s) => dashboard(s))],
  ['GET', '/sync/pull', withSession((ctx, s) => syncPull(ctx, s))],
  ['POST', '/sync/push', withSession((ctx, s) => syncPush(ctx, s))],
  ['GET', '/groups', withSession(async (_ctx, s) => ({ groups: await listGroups(s) }))],
  ['POST', '/groups', withSession((ctx, s) => createGroup(ctx, s))],
  ['GET', '/groups/:id', withSession((_ctx, s, [id]) => groupDetail(s, uuid(id)))],
  ['POST', '/groups/:id/invites', withSession((ctx, s, [id]) => createInvite(ctx, s, uuid(id)))],
  ['POST', '/groups/:id/leave', withSession((ctx, s, [id]) => leaveGroup(ctx, s, uuid(id)))],
  ['POST', '/groups/:id/expenses', withSession((ctx, s, [id]) => addExpense(ctx, s, uuid(id)))],
  ['POST', '/groups/:id/settlements', withSession((ctx, s, [id]) => createSettlement(ctx, s, uuid(id)))],
  ['POST', '/invites/peek', withSession((ctx, s) => peekInvite(ctx, s))],
  ['POST', '/invites/accept', withSession((ctx, s) => acceptInvite(ctx, s))],
  ['PATCH', '/expenses/:id', withSession((ctx, s, [id]) => editExpense(ctx, s, uuid(id)))],
  ['DELETE', '/expenses/:id', withSession((_ctx, s, [id]) => removeExpense(s, uuid(id)))],
  ['GET', '/settlements/:id/destinations', withSession((_ctx, s, [id]) => destinations(s, uuid(id)))],
  ['POST', '/settlements/:id/pay', withSession((ctx, s, [id]) => pay(ctx, s, uuid(id)))],
  [
    'POST',
    '/settlements/:id/:action',
    withSession((ctx, s, [id, action]) => {
      if (!ACTIONS.has(action!)) fail('not_found')
      return transition(ctx, s, uuid(id), action!)
    }),
  ],
]

/** `/groups/:id` against `/groups/abc`: the `:` parts in order, or null when it doesn't fit. */
function matchPath(pattern: string, path: string): string[] | null {
  const want = pattern.split('/')
  const got = path.split('/')
  if (want.length !== got.length) return null
  const params: string[] = []
  for (let i = 0; i < want.length; i += 1) {
    if (want[i]!.startsWith(':')) {
      if (!got[i]) return null
      params.push(got[i]!)
    } else if (want[i] !== got[i]) {
      return null
    }
  }
  return params
}

function respond(ctx: Ctx | null, status: number, body: unknown): Response {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  if (ctx?.setSession === 'clear') headers.set('x-settle-session-clear', '1')
  else if (ctx?.setSession) headers.set('x-settle-session-set', ctx.setSession)
  return new Response(JSON.stringify(body), { status, headers })
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const at = url.pathname.indexOf('/settle-api')
  const path = (at >= 0 ? url.pathname.slice(at + '/settle-api'.length) : url.pathname) || '/'
  const ip = (req.headers.get('x-settle-client-ip') ?? req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0]!.trim().slice(0, 64)
  const ctx: Ctx = { req, path, method: req.method, ip, origin: req.headers.get('x-settle-origin'), body: {} }
  try {
    if (path === '/health') return respond(null, 200, { ok: true })
    await limit(`ip:${ip}`, 600, 60)
    if (req.method !== 'GET' && req.method !== 'DELETE') {
      const raw = await req.text()
      if (raw.length > (path === '/sync/push' ? MAX_SYNC_BODY : MAX_BODY)) fail('bad_request')
      if (raw) {
        let parsed: unknown
        try {
          parsed = JSON.parse(raw)
        } catch {
          fail('bad_request')
        }
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) fail('bad_request')
        ctx.body = parsed as Record<string, unknown>
      }
    }
    for (const [method, pattern, handler] of ROUTES) {
      if (method !== req.method) continue
      const params = matchPath(pattern, path)
      if (params) return respond(ctx, 200, await handler(ctx, params))
    }
    return respond(ctx, 404, { error: { code: 'not_found', message: MESSAGES.not_found![1] } })
  } catch (err) {
    if (err instanceof ApiError) return respond(ctx, err.status, { error: { code: err.code, message: err.message } })
    console.error('[settle-api]', err)
    return respond(ctx, 500, { error: { code: 'internal', message: MESSAGES.internal![1] } })
  }
})
