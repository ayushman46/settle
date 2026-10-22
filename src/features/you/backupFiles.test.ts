import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, exportBackup, parseBackup, resetDataForTests, saveExpense, updateProfile } from '../../data'
import { draft } from '../../data/testKit'
import { relativeDateLabel } from '../../kit/index-a'
import {
  backupBlob,
  backupContents,
  backupDateLabel,
  backupFilename,
  clearLastBackup,
  csvBlob,
  csvFilename,
  LAST_BACKUP_KEY,
  lastBackupAt,
  MAX_BACKUP_BYTES,
  readBackupFile,
  resetLastBackupForTests,
  savedWhen,
  setLastBackupAt,
  useLastBackupAt,
} from './backupFiles'

const OCT_22 = new Date(2026, 9, 22, 12)

beforeEach(() => {
  resetDataForTests()
  resetLastBackupForTests()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(OCT_22)
})

afterEach(() => {
  vi.useRealTimers()
  resetLastBackupForTests()
})

describe('file names', () => {
  it('dates backups and exports by the local day', () => {
    expect(backupFilename()).toBe('settle-backup-2026-10-22.json')
    expect(csvFilename(new Date(2027, 0, 5, 23, 59))).toBe('settle-expenses-2027-01-05.csv')
  })
})

describe('making files', () => {
  it('writes a backup that reads back as the same data', async () => {
    updateProfile({ name: 'Ayush', currency: 'INR' })
    const riya = addFriend({ name: 'Riya' })
    saveExpense(draft({ with: [riya.id] }))
    const blob = backupBlob(exportBackup())
    expect(blob.type).toBe('application/json')
    const back = parseBackup(await blob.text())
    expect(back?.expenses).toHaveLength(1)
    expect(back?.friends.map((f) => f.name)).toContain('Riya')
  })

  it('starts the CSV with a byte-order mark so Excel reads ₹ and accents', async () => {
    const riya = addFriend({ name: 'Rénuka' })
    const e = saveExpense(draft({ title: 'Chai ₹', with: [riya.id] }))
    const blob = csvBlob([e], { [riya.id]: riya }, {})
    expect(blob.type).toBe('text/csv;charset=utf-8')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const text = new TextDecoder().decode(bytes.slice(3))
    expect(text.startsWith('Date,Title,Category')).toBe(true)
    expect(text).toContain('Rénuka')
    expect(text).toContain('Chai ₹')
  })
})

describe('readBackupFile', () => {
  it('accepts a Settle backup', async () => {
    saveExpense(draft())
    const file = new File([JSON.stringify(exportBackup())], 'b.json', { type: 'application/json' })
    const result = await readBackupFile(file)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.backup.expenses).toHaveLength(1)
  })

  it('turns away other files, gently', async () => {
    expect(await readBackupFile(new File(['{"hello":1}'], 'x.json'))).toEqual({ ok: false, reason: 'not_backup' })
    expect(await readBackupFile(new File(['not json at all'], 'x.txt'))).toEqual({ ok: false, reason: 'not_backup' })
  })

  it('refuses files far too big to be a backup, without reading them', async () => {
    const text = vi.fn()
    const huge = { size: MAX_BACKUP_BYTES + 1, text } as unknown as Blob
    expect(await readBackupFile(huge)).toEqual({ ok: false, reason: 'too_big' })
    expect(text).not.toHaveBeenCalled()
  })

  it('says when a file cannot be read', async () => {
    const broken = { size: 10, text: () => Promise.reject(new Error('NotReadableError')) } as unknown as Blob
    expect(await readBackupFile(broken)).toEqual({ ok: false, reason: 'unreadable' })
  })
})

describe('describing a backup', () => {
  it('lists only what it holds, in words', () => {
    const riya = addFriend({ name: 'Riya' })
    addFriend({ name: 'Sam' })
    saveExpense(draft({ with: [riya.id] }))
    expect(backupContents(exportBackup())).toBe('1 expense · 2 people')
  })

  it('says when a backup is empty', () => {
    expect(backupContents(exportBackup())).toBe('Nothing in it yet')
  })

  it('says when it was saved', () => {
    expect(backupDateLabel(new Date(2026, 9, 22, 9).toISOString())).toBe('Saved today')
    expect(backupDateLabel(new Date(2026, 9, 21, 9).toISOString())).toBe('Saved yesterday')
    expect(backupDateLabel(new Date(2026, 8, 30, 9).toISOString())).toBe(`Saved on ${relativeDateLabel('2026-09-30', '2026-10-22')}`)
    expect(backupDateLabel('')).toBeNull()
  })

  it('words "last saved" relative to today', () => {
    expect(savedWhen(new Date(2026, 9, 22, 1).getTime())).toBe('today')
    expect(savedWhen(new Date(2026, 9, 21, 23).getTime())).toBe('yesterday')
    expect(savedWhen(new Date(2025, 11, 31, 12).getTime())).toBe(`on ${relativeDateLabel('2025-12-31', '2026-10-22')}`)
    expect(savedWhen(new Date(2025, 11, 31, 12).getTime())).toMatch(/2025/)
  })
})

describe('the last backup', () => {
  it('is remembered on the phone and forgotten on request', () => {
    expect(lastBackupAt()).toBeNull()
    setLastBackupAt(1_700_000_000_000)
    expect(lastBackupAt()).toBe(1_700_000_000_000)
    expect(window.localStorage.getItem(LAST_BACKUP_KEY)).toBe('1700000000000')
    resetLastBackupForTests()
    expect(lastBackupAt()).toBe(1_700_000_000_000)
    clearLastBackup()
    expect(lastBackupAt()).toBeNull()
    expect(window.localStorage.getItem(LAST_BACKUP_KEY)).toBeNull()
  })

  it('ignores junk in storage', () => {
    window.localStorage.setItem(LAST_BACKUP_KEY, 'soon')
    expect(lastBackupAt()).toBeNull()
  })

  it('updates the screen when it changes, here or in another tab', () => {
    const { result } = renderHook(() => useLastBackupAt())
    expect(result.current).toBeNull()
    act(() => setLastBackupAt(42_000))
    expect(result.current).toBe(42_000)
    act(() => {
      window.localStorage.setItem(LAST_BACKUP_KEY, '84000')
      window.dispatchEvent(new StorageEvent('storage', { key: LAST_BACKUP_KEY }))
    })
    expect(result.current).toBe(84_000)
  })
})
