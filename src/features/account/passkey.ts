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
  return cloud<{ me: Me }>('POST', verifyPath, { challengeId: opts.data.challengeId, response, ...extra })
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
  return cloud<T>('POST', verifyPath, { challengeId: opts.data.challengeId, response })
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

/** Another passkey on this account (a second phone, a laptop, a security key). */
export function addPasskey(nickname: string | null): Promise<CloudResult<{ me: Me }>> {
  return register('/passkeys/options', '/passkeys/verify', {}, nickname ? { nickname } : {})
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
