/**
 * Passkeys: create an account, sign in, and "confirm it's you" before a sensitive change. The
 * browser and the phone's own lock (fingerprint, face, PIN) do the signing; only the public key
 * ever reaches the server. No OTP, no password.
 */
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser'
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'
import { t } from '../../i18n'
import { cloud, type CloudResult, type Me } from './api'

export function passkeysSupported(): boolean {
  return typeof window !== 'undefined' && browserSupportsWebAuthn()
}

type Fail = Extract<CloudResult<never>, { ok: false }>

/** What the browser said, as a result: cancelled (or timed out), already on this phone, or broken. */
function passkeyFailure(error: unknown): Fail {
  const name = typeof error === 'object' && error !== null ? (error as { name?: unknown }).name : null
  if (name === 'NotAllowedError' || name === 'AbortError') return { ok: false, status: 0, code: 'cancelled', message: t('account.passkey.cancelled') }
  if (name === 'InvalidStateError') return { ok: false, status: 0, code: 'exists', message: t('account.passkey.exists') }
  return { ok: false, status: 0, code: 'passkey_error', message: t('account.passkey.error') }
}

/* ------------------------------------------------------------------ what this phone is */

interface UaData {
  platform?: string
  mobile?: boolean
  brands?: Array<{ brand: string }>
  getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string; platform?: string }>
}

const BROWSERS: Array<[RegExp, string]> = [
  [/SamsungBrowser/i, 'Samsung Internet'],
  [/EdgA?\/|Edg\//i, 'Edge'],
  [/OPR\/|Opera/i, 'Opera'],
  [/Firefox|FxiOS/i, 'Firefox'],
  [/CriOS|Chrome/i, 'Chrome'],
  [/Safari/i, 'Safari'],
]
const SYSTEMS: Array<[RegExp, string]> = [
  [/iPhone/i, 'iPhone'],
  [/iPad/i, 'iPad'],
  [/Android/i, 'Android'],
  [/Windows/i, 'Windows'],
  [/Mac OS X|Macintosh/i, 'Mac'],
  [/CrOS/i, 'Chromebook'],
  [/Linux/i, 'Linux'],
]

/** "Chrome on Android", from the browser's description of itself. */
export function describeUserAgent(ua: string): string | null {
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1]
  const system = SYSTEMS.find(([re]) => re.test(ua))?.[1]
  if (browser && system) return `${browser} on ${system}`
  return system ?? browser ?? null
}

/**
 * This phone in a few words, for naming its passkey when the password manager doesn't say who it
 * is: "Chrome on Android (SM-A155F)" where the browser shares the model, else "Safari on iPhone".
 */
export async function deviceDescription(): Promise<string | null> {
  if (typeof navigator === 'undefined') return null
  const base = describeUserAgent(navigator.userAgent)
  const data = (navigator as Navigator & { userAgentData?: UaData }).userAgentData
  if (!data?.getHighEntropyValues) return base
  try {
    const { model } = await Promise.race([
      data.getHighEntropyValues(['model']),
      new Promise<{ model?: string }>((resolve) => setTimeout(() => resolve({}), 800)),
    ])
    const clean = (model ?? '').replace(/[^\p{L}\p{N} ._-]/gu, '').trim()
    return base && clean ? `${base} (${clean.slice(0, 16)})` : base
  } catch {
    return base
  }
}

/* ------------------------------------------------------------------ telling the password manager */

interface SignalApi {
  signalUnknownCredential?: (options: { rpId: string; credentialId: string }) => Promise<void>
}

/**
 * Tells this phone's password manager that these passkeys no longer work here, so it stops
 * offering them (Chrome and others that support the WebAuthn Signal API; elsewhere nothing happens).
 */
export async function forgetPasskeys(credentialIds: readonly string[]): Promise<void> {
  const api = typeof window !== 'undefined' ? (window.PublicKeyCredential as unknown as SignalApi | undefined) : undefined
  if (!api?.signalUnknownCredential) return
  for (const credentialId of credentialIds) {
    try {
      await api.signalUnknownCredential({ rpId: window.location.hostname, credentialId })
    } catch {
      // Not ours to worry about: the passkey just stays listed.
    }
  }
}

/* ------------------------------------------------------------------ ceremonies */

interface Challenge<O> {
  challengeId: string
  options: O
}

async function register(optionsPath: string, verifyPath: string, input: Record<string, unknown>, extra: Record<string, unknown> = {}): Promise<CloudResult<{ me: Me }>> {
  const opts = await cloud<Challenge<PublicKeyCredentialCreationOptionsJSON>>('POST', optionsPath, input)
  if (!opts.ok) return opts
  let response
  try {
    response = await startRegistration({ optionsJSON: opts.data.options })
  } catch (error) {
    return passkeyFailure(error)
  }
  const deviceLabel = await deviceDescription()
  return cloud<{ me: Me }>('POST', verifyPath, { challengeId: opts.data.challengeId, response, ...(deviceLabel ? { deviceLabel } : {}), ...extra })
}

async function assert<T>(optionsPath: string, verifyPath: string, input: Record<string, unknown>): Promise<CloudResult<T>> {
  const opts = await cloud<Challenge<PublicKeyCredentialRequestOptionsJSON>>('POST', optionsPath, input)
  if (!opts.ok) return opts
  let response
  try {
    response = await startAuthentication({ optionsJSON: opts.data.options })
  } catch (error) {
    return passkeyFailure(error)
  }
  const result = await cloud<T>('POST', verifyPath, { challengeId: opts.data.challengeId, response })
  // A passkey that was removed (or whose account was deleted): stop the phone offering it.
  if (!result.ok && result.code === 'passkey_unknown') void forgetPasskeys([response.id])
  return result
}

/** A new account: the number (kept unverified) and a name, then a passkey on this phone. */
export function createAccount(phone: string, displayName: string): Promise<CloudResult<{ me: Me }>> {
  return register('/auth/register/options', '/auth/register/verify', { phone, displayName })
}

/** Sign in with a passkey; the number, when given, narrows which passkeys the phone offers. */
export function signIn(phone?: string): Promise<CloudResult<{ me: Me }>> {
  return assert<{ me: Me }>('/auth/login/options', '/auth/login/verify', phone ? { phone } : {})
}

/** A passkey check for a sensitive change; good for five minutes. */
export function confirmItsYou(): Promise<CloudResult<{ fresh: boolean }>> {
  return assert<{ fresh: boolean }>('/auth/reauth/options', '/auth/reauth/verify', {})
}

/** Where the new passkey lives: this phone's lock, another phone (a QR code), or a security key. */
export type PasskeyKind = 'this' | 'other' | 'key'

/** Another passkey on this account (a second phone, a laptop, a security key). */
export async function addPasskey(kind: PasskeyKind, nickname: string | null): Promise<CloudResult<{ me: Me }>> {
  const res = await register('/passkeys/options', '/passkeys/verify', { kind }, nickname ? { nickname } : {})
  // The browser found one of this account's passkeys already there.
  if (!res.ok && res.code === 'exists') return { ...res, message: t('account.passkeys.add.exists') }
  return res
}

/**
 * Runs a sensitive change; when the server asks for a recent passkey check, does one and tries
 * once more. `step` runs the change itself (it may itself start a passkey ceremony).
 */
export async function withFreshAuth<T>(step: () => Promise<CloudResult<T>>): Promise<CloudResult<T>> {
  const first = await step()
  if (first.ok || first.code !== 'reauth_required') return first
  const check = await confirmItsYou()
  if (!check.ok) return check
  return step()
}
