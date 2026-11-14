/**
 * How a shared group's copy leaves the phone: as an invite link (`/join#…`, nothing reaches a
 * server), or encrypted to the group's room on the server (live groups). The secret in the invite
 * link is all there is: it names the room, proves a phone may write there, and is the encryption
 * key — the server only ever sees hashes of it and ciphertext.
 */
import type { SyncGetResponse, SyncPutResponse } from '../../../shared/api'
import { base64UrlToBytes, bytesToBase64Url } from '../../share/base64url'
import { decodeFragment, deflate, encodeFragment, inflate, MAX_FRAGMENT_LENGTH } from '../../share/fragment'
import { sha256, utf8 } from '../../share/sha256'
import { canonical, parseWire, type WireGroup } from './wire'

export const JOIN_PATH = '/join'
/** The biggest copy read from the server or a link, once unpacked. */
const MAX_COPY_BYTES = 4 * 1024 * 1024
const KEY = /^[A-Za-z0-9_-]{22,64}$/

const derive = (label: string, key: string): Uint8Array => sha256(utf8(`settle-sync-${label}|${key}`))
/** The group's room on the server. */
export const roomOf = (key: string): string => bytesToBase64Url(derive('room', key)).slice(0, 32)
/** What proves a phone may write to that room. */
export const writeTokenOf = (key: string): string => bytesToBase64Url(derive('write', key)).slice(0, 32)

/* ------------------------------------------------------------------ invite links */

export interface Invite {
  key: string
  wire: WireGroup
  /** The link carries only who's in the group: the expenses come from the server. */
  slim: boolean
}

/** The group without its expenses and payments: enough to say what you're joining. */
function slimmed(wire: WireGroup): WireGroup {
  return { ...wire, x: [], s: [], z: {} }
}

/**
 * The invite (and update) link for a copy: everything in it when it fits a link, else — or when
 * `slim` is asked for, because the server has the rest — just the group and its people.
 */
export async function inviteLink(wire: WireGroup, key: string, origin: string, slim = false): Promise<{ url: string; slim: boolean }> {
  const pack = (w: WireGroup, isSlim: boolean) => encodeFragment(JSON.stringify({ v: 1, k: key, s: isSlim ? 1 : 0, w }))
  let fragment = slim ? '' : await pack(wire, false)
  let isSlim = slim
  if (slim || fragment.length > MAX_FRAGMENT_LENGTH) {
    fragment = await pack(slimmed(wire), true)
    isSlim = true
  }
  return { url: `${origin}${JOIN_PATH}#${fragment}`, slim: isSlim }
}

/** What an invite link carries, or null when it isn't one (cut off, mangled, something else). */
export async function readInvite(hashOrUrl: string): Promise<Invite | null> {
  const json = await decodeFragment(hashOrUrl, MAX_COPY_BYTES)
  if (json === null) return null
  try {
    const raw = JSON.parse(json) as { v?: unknown; k?: unknown; s?: unknown; w?: unknown }
    if (raw.v !== 1 || typeof raw.k !== 'string' || !KEY.test(raw.k)) return null
    const wire = parseWire(raw.w)
    return wire ? { key: raw.k, wire, slim: raw.s === 1 } : null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ encrypted copies */

async function aesKey(key: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', derive('key', key) as Uint8Array<ArrayBuffer>, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/** A copy, compressed and encrypted with the group's secret: what the server keeps. */
export async function seal(text: string, key: string): Promise<string> {
  const plain = utf8(text)
  const packed = await deflate(plain)
  const body = packed && packed.length < plain.length ? packed : plain
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(key), body as Uint8Array<ArrayBuffer>))
  const out = new Uint8Array(1 + iv.length + sealed.length)
  out[0] = body === packed ? 1 : 0
  out.set(iv, 1)
  out.set(sealed, 1 + iv.length)
  return bytesToBase64Url(out)
}

/** The text inside what the server kept, or null when it wasn't made with this secret (or is damaged). */
export async function unsealText(data: string, key: string): Promise<string | null> {
  try {
    const bytes = base64UrlToBytes(data)
    if (!bytes || bytes.length < 30) return null
    const iv = bytes.slice(1, 13)
    const opened = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await aesKey(key), bytes.slice(13)))
    const plain = bytes[0] === 1 ? await inflate(opened, MAX_COPY_BYTES) : opened
    return plain ? new TextDecoder('utf-8', { fatal: true }).decode(plain) : null
  } catch {
    return null
  }
}

/** The copy inside what the server kept, or null when it wasn't made with this secret (or is damaged). */
export async function unseal(data: string, key: string): Promise<WireGroup | null> {
  try {
    const bytes = base64UrlToBytes(data)
    if (!bytes || bytes.length < 30) return null
    const iv = bytes.slice(1, 13)
    const opened = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await aesKey(key), bytes.slice(13)))
    const plain = bytes[0] === 1 ? await inflate(opened, MAX_COPY_BYTES) : opened
    if (!plain) return null
    return parseWire(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plain)))
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ the server */

export type Pulled =
  | { kind: 'copy'; wire: WireGroup; v: string }
  /** Nothing there yet, or nothing newer than what this phone has. */
  | { kind: 'same'; v: string | null }
  /** Live groups are off on this server. */
  | { kind: 'off' }
  /** Couldn't reach it (offline, busy): try again later. */
  | { kind: 'failed' }

/** The room's copy when it's newer than version `have`. Never throws. */
export async function pull(key: string, have: string | null, signal?: AbortSignal): Promise<Pulled> {
  try {
    const response = await fetch(`/api/sync/${roomOf(key)}${have ? `?have=${encodeURIComponent(have)}` : ''}`, { headers: { Accept: 'application/json' }, signal })
    if (response.status === 503) return { kind: 'off' }
    if (!response.ok) return { kind: 'failed' }
    const body = (await response.json()) as SyncGetResponse
    if (body.data === null) return { kind: 'same', v: body.v }
    const wire = await unseal(body.data, key)
    // A copy this secret can't open isn't this group's: treat the room as empty and write ours.
    return wire && body.v ? { kind: 'copy', wire, v: body.v } : { kind: 'same', v: null }
  } catch {
    return { kind: 'failed' }
  }
}

/** Leaves a copy in the room. Returns its version, or null when it couldn't. Never throws. */
export async function push(wire: WireGroup, key: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch(`/api/sync/${roomOf(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ data: await seal(canonical(wire), key), write: writeTokenOf(key) }),
      signal,
    })
    if (!response.ok) return null
    return ((await response.json()) as SyncPutResponse).v
  } catch {
    return null
  }
}
