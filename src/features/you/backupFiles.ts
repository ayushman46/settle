/**
 * The files the You tab hands out and takes back: the JSON backup (free), the CSV export (Pro),
 * and the memory of when you last saved a backup. Everything stays on the phone until the person
 * shares or saves a file themselves.
 */
import { useSyncExternalStore } from 'react'
import { CSV_BOM, exportBackup, exportCsv, parseBackup, type BackupFile } from '../../data'
import { BRAND, ME_ID, type Expense, type Friend, type Group } from '../../domain/types'
import { daysBetween, toIsoDate, today } from '../../engine/dates'
import { t, type MessageKey } from '../../i18n'
import { relativeDateLabel } from '../../kit/index-a'

/* ------------------------------------------------------------------ names */

const FILE_PREFIX = BRAND.name.toLowerCase()

/** `settle-backup-2026-10-22.json` for the local day of `now`. */
export function backupFilename(now: Date = new Date()): string {
  return `${FILE_PREFIX}-backup-${toIsoDate(now)}.json`
}

/** `settle-expenses-2026-10-22.csv`. */
export function csvFilename(now: Date = new Date()): string {
  return `${FILE_PREFIX}-expenses-${toIsoDate(now)}.csv`
}

/* ------------------------------------------------------------------ making files */

/** Everything kept on this phone, as a JSON file. */
export function backupBlob(file: BackupFile = exportBackup()): Blob {
  return new Blob([JSON.stringify(file)], { type: 'application/json' })
}

/** The expenses as a CSV that Excel opens as UTF-8 (names with accents, ₹ in notes). */
export function csvBlob(
  expenses: readonly Expense[],
  friendsById: Readonly<Record<string, Friend>>,
  groupsById: Readonly<Record<string, Group>>,
): Blob {
  return new Blob([CSV_BOM + exportCsv(expenses, friendsById, groupsById)], { type: 'text/csv;charset=utf-8' })
}

/* ------------------------------------------------------------------ reading a backup back */

/** Far bigger than any real backup (thousands of expenses are a few MB). */
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024

export type ReadBackupResult =
  | { ok: true; backup: BackupFile }
  /** not_backup: not a Settle backup (or damaged) · too_big: over `MAX_BACKUP_BYTES` · unreadable: the file couldn't be read. */
  | { ok: false; reason: 'not_backup' | 'too_big' | 'unreadable' }

/** Reads and checks a chosen file. Never throws. */
export async function readBackupFile(file: Blob): Promise<ReadBackupResult> {
  if (file.size > MAX_BACKUP_BYTES) return { ok: false, reason: 'too_big' }
  let text: string
  try {
    text = await file.text()
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
  const backup = parseBackup(text)
  return backup ? { ok: true, backup } : { ok: false, reason: 'not_backup' }
}

export const READ_BACKUP_ERRORS: Readonly<Record<Exclude<ReadBackupResult, { ok: true }>['reason'], MessageKey>> = {
  not_backup: 'you.restore.error.notBackup',
  too_big: 'you.restore.error.tooBig',
  unreadable: 'you.restore.error.unreadable',
}

/** Why a picked file can't be restored, in the UI language. */
export function readBackupError(reason: Exclude<ReadBackupResult, { ok: true }>['reason']): string {
  return t(READ_BACKUP_ERRORS[reason], { brand: BRAND.name })
}

/* ------------------------------------------------------------------ describing a backup */

function count(n: number, key: MessageKey): string | null {
  return n > 0 ? t(key, { count: n }) : null
}

/**
 * "24 expenses · 6 people · 2 groups · 1 recurring split · 2 stuck payments" (only what it has);
 * "Nothing in it yet" when empty.
 */
export function backupContents(file: Pick<BackupFile, 'expenses' | 'friends' | 'groups' | 'recurring' | 'stuck'>): string {
  const parts = [
    count(file.expenses.length, 'you.restore.contents.expenses'),
    count(file.friends.filter((f) => f.id !== ME_ID).length, 'you.restore.contents.people'),
    count(file.groups.length, 'you.restore.contents.groups'),
    count(file.recurring.length, 'you.restore.contents.recurring'),
    count(file.stuck.length, 'you.restore.contents.stuck'),
  ].filter((part): part is string => part !== null)
  return parts.length > 0 ? parts.join(' · ') : t('you.restore.contents.empty')
}

/** When a backup was made: "Saved today", "Saved on 12 Oct", or null when the file doesn't say. */
export function backupDateLabel(exportedAt: string, day: string = today()): string | null {
  const ms = Date.parse(exportedAt)
  if (!Number.isFinite(ms)) return null
  return t('you.restore.saved', savedWhen(ms, day))
}

/** "Last saved today", "Last saved yesterday", "Last saved on 12 Oct". */
export function lastSavedLine(epochMs: number, day: string = today()): string {
  return t('you.data.lastSaved', savedWhen(epochMs, day))
}

/** Which day something was saved, for the lines above: `today`, `yesterday`, or `on` with its date ("12 Oct"). */
export function savedWhen(epochMs: number, day: string = today()): { when: 'today' | 'yesterday' | 'on'; date: string } {
  const iso = toIsoDate(new Date(epochMs))
  const ago = daysBetween(iso, day)
  return { when: ago === 0 ? 'today' : ago === 1 ? 'yesterday' : 'on', date: relativeDateLabel(iso, day) }
}

/* ------------------------------------------------------------------ when the last backup was saved */

export const LAST_BACKUP_KEY = 'settle.v3.last-backup'

let cached: number | null | undefined
const listeners = new Set<() => void>()

function read(): number | null {
  try {
    const raw = window.localStorage.getItem(LAST_BACKUP_KEY)
    const value = raw === null ? NaN : Number(raw)
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

/** Epoch ms of the last backup saved or shared from this phone, or null. */
export function lastBackupAt(): number | null {
  if (cached === undefined) cached = read()
  return cached
}

function publish(value: number | null): void {
  cached = value
  try {
    if (value === null) window.localStorage.removeItem(LAST_BACKUP_KEY)
    else window.localStorage.setItem(LAST_BACKUP_KEY, String(value))
  } catch {
    // Blocked storage: remembered for this visit only.
  }
  for (const listener of listeners) listener()
}

/** Notes that a backup just left the phone (or restores an earlier note, for Undo). */
export function setLastBackupAt(epochMs: number | null): void {
  publish(epochMs)
}

/** Forgets it (after clearing all data, and between tests). */
export function clearLastBackup(): void {
  publish(null)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== LAST_BACKUP_KEY) return
    cached = read()
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function useLastBackupAt(): number | null {
  return useSyncExternalStore(subscribe, lastBackupAt, () => null)
}

/** Forgets the cached value without touching storage (tests). */
export function resetLastBackupForTests(): void {
  cached = undefined
}
