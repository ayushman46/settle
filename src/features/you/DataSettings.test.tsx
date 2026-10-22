import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addFriend,
  createGroup,
  expensesStore,
  exportBackup,
  friendsStore,
  groupsStore,
  parseBackup,
  profileStore,
  resetDataForTests,
  saveExpense,
  updateProfile,
} from '../../data'
import { draft } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { licenseToken } from '../../pro'
import { SESSION_KEY } from '../../state/persist'
import { forgetActivityView, rememberActivityView, rememberedActivityView } from '../activity/viewMemory'
import { paywallState } from '../pro/paywall'
import { currentUrl, installPro, renderAt, resetProScreens, serveBilling, testSigner } from '../pro/testing'
import { LAST_BACKUP_KEY, lastBackupAt, resetLastBackupForTests, setLastBackupAt } from './backupFiles'
import { YouScreen } from './YouScreen'

const OCT_22 = new Date(2026, 9, 22, 12)

/** What left the phone as a download: the file and its name. */
const downloads: Array<{ blob: Blob; name: string }> = []
let pendingBlob: Blob | null = null

beforeAll(() => {
  // jsdom has no object URLs and can't follow a download link: catch them instead.
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: (blob: Blob) => {
      pendingBlob = blob
      return 'blob:settle-test'
    },
  })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => {} })
})

beforeEach(async () => {
  resetProScreens()
  resetLastBackupForTests()
  forgetActivityView()
  downloads.length = 0
  pendingBlob = null
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    if (pendingBlob) downloads.push({ blob: pendingBlob, name: this.download })
    pendingBlob = null
  })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(OCT_22)
  await testSigner()
  serveBilling({ checkout: 'razorpay', keyId: 'rzp' })
  updateProfile({ name: 'Ayush', currency: 'INR', onboarded: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  resetProScreens()
  resetLastBackupForTests()
  forgetActivityView()
})

function renderYou() {
  return renderAt('/app/you', <YouScreen />)
}

const row = (name: RegExp) => screen.getByRole('button', { name })
const fileInput = (container: HTMLElement) => container.querySelector<HTMLInputElement>('input[type="file"]')!

/** Builds a backup in a scratch state, then puts the phone back to `local` (empty when omitted). */
function backupFile(build: () => void, local?: () => void): File {
  resetDataForTests()
  build()
  const json = JSON.stringify(exportBackup())
  resetDataForTests()
  updateProfile({ name: 'Ayush', currency: 'INR', onboarded: true })
  local?.()
  return new File([json], 'settle-backup-2026-10-01.json', { type: 'application/json' })
}

describe('YouScreen — backups', () => {
  it('saves a backup file that holds everything, and remembers when', async () => {
    const riya = addFriend({ name: 'Riya' })
    saveExpense(draft({ with: [riya.id] }))
    const { user } = renderYou()
    expect(row(/^Save a backup/)).toHaveTextContent('Not backed up yet — keep a copy somewhere safe')
    await user.click(row(/^Save a backup/))
    expect(await screen.findByText('Backup saved to your downloads')).toBeInTheDocument()
    expect(downloads).toHaveLength(1)
    expect(downloads[0]!.name).toBe('settle-backup-2026-10-22.json')
    const saved = parseBackup(await downloads[0]!.blob.text())
    expect(saved?.expenses).toHaveLength(1)
    expect(saved?.profile.name).toBe('Ayush')
    expect(row(/^Save a backup/)).toHaveTextContent('Last saved today')
    expect(window.localStorage.getItem(LAST_BACKUP_KEY)).toBe(String(OCT_22.getTime()))
  })

  it('says plainly when the file could not be saved', async () => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: () => {
        throw new Error('blocked')
      },
    })
    const { user } = renderYou()
    try {
      await user.click(row(/^Save a backup/))
      expect(await screen.findByText("Couldn't save the backup. Try again.")).toBeInTheDocument()
      expect(lastBackupAt()).toBeNull()
    } finally {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: (blob: Blob) => {
          pendingBlob = blob
          return 'blob:settle-test'
        },
      })
    }
  })

  it('restores a backup onto an empty phone in one step', async () => {
    const file = backupFile(() => {
      const riya = addFriend({ name: 'Riya' })
      saveExpense(draft({ title: 'Goa villa', with: [riya.id] }))
    })
    const { user, container } = renderYou()
    await user.upload(fileInput(container), file)
    const sheet = await screen.findByRole('dialog', { name: 'Restore this backup?' })
    expect(sheet).toHaveAccessibleDescription('Saved today · 1 expense · 1 person')
    expect(within(sheet).queryByRole('radiogroup')).not.toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Restore backup' }))
    expect(expensesStore.get().map((e) => e.title)).toEqual(['Goa villa'])
    expect(await screen.findByText('Backup restored')).toBeInTheDocument()
  })

  it('merges a backup into what is here, and can undo it', async () => {
    const file = backupFile(
      () => {
        const riya = addFriend({ name: 'Riya' })
        saveExpense(draft({ title: 'From backup', with: [riya.id] }))
      },
      () => {
        const sam = addFriend({ name: 'Sam' })
        saveExpense(draft({ title: 'Already here', with: [sam.id] }))
      },
    )
    const { user, container } = renderYou()
    await user.upload(fileInput(container), file)
    const sheet = await screen.findByRole('dialog', { name: 'Restore this backup?' })
    const modes = within(sheet).getByRole('radiogroup', { name: 'How to restore' })
    expect(within(modes).getByRole('radio', { name: /^Merge/ })).toHaveAttribute('aria-checked', 'true')
    await user.click(within(sheet).getByRole('button', { name: 'Merge backup' }))

    expect(expensesStore.get().map((e) => e.title).sort()).toEqual(['Already here', 'From backup'])
    expect(await screen.findByText('Backup merged — 2 added')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(expensesStore.get().map((e) => e.title)).toEqual(['Already here'])
    expect(friendsStore.get().map((f) => f.name)).not.toContain('Riya')
    expect(await screen.findByText('Restore undone')).toBeInTheDocument()
  })

  it('replaces everything when asked, after a clear warning', async () => {
    const file = backupFile(
      () => {
        updateProfile({ name: 'Old phone me', upiId: 'old@okaxis' })
        saveExpense(draft({ title: 'From backup' }))
      },
      () => {
        saveExpense(draft({ title: 'Already here' }))
      },
    )
    const { user, container } = renderYou()
    await user.upload(fileInput(container), file)
    const sheet = await screen.findByRole('dialog', { name: 'Restore this backup?' })
    await user.click(within(sheet).getByRole('radio', { name: /^Replace/ }))
    expect(within(sheet).getByText('This replaces everything here')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Replace everything' }))

    expect(expensesStore.get().map((e) => e.title)).toEqual(['From backup'])
    expect(profileStore.get()).toMatchObject({ name: 'Old phone me', upiId: 'old@okaxis' })
    await user.click(await screen.findByRole('button', { name: /^Undo/ }))
    expect(expensesStore.get().map((e) => e.title)).toEqual(['Already here'])
    expect(profileStore.get().name).toBe('Ayush')
  })

  it('moves between merge and replace with the arrow keys', async () => {
    const file = backupFile(() => saveExpense(draft()), () => saveExpense(draft()))
    const { user, container } = renderYou()
    await user.upload(fileInput(container), file)
    const sheet = await screen.findByRole('dialog', { name: 'Restore this backup?' })
    const merge = within(sheet).getByRole('radio', { name: /^Merge/ })
    merge.focus()
    await user.keyboard('{ArrowDown}')
    expect(within(sheet).getByRole('radio', { name: /^Replace/ })).toHaveAttribute('aria-checked', 'true')
    expect(within(sheet).getByRole('radio', { name: /^Replace/ })).toHaveFocus()
  })

  it('turns away a file that is not a backup, without changing anything', async () => {
    saveExpense(draft({ title: 'Mine' }))
    const { user, container } = renderYou()
    await user.upload(fileInput(container), new File(['{"hello":"world"}'], 'notes.json', { type: 'application/json' }))
    expect(await screen.findByText("That file isn't a Settle backup. Pick the .json file Settle saved.")).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Restore this backup?' })).not.toBeInTheDocument()
    expect(expensesStore.get().map((e) => e.title)).toEqual(['Mine'])
  })

  it('lets the same file be picked again', async () => {
    const { container } = renderYou()
    const input = fileInput(container)
    const file = new File(['nope'], 'x.json')
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText(/isn't a Settle backup/)).toBeInTheDocument()
    expect(input.value).toBe('')
  })
})

describe('YouScreen — CSV export', () => {
  it('is a Pro feature', async () => {
    saveExpense(draft())
    const { user } = renderYou()
    const csv = row(/^Export to CSV/)
    expect(csv).toHaveTextContent('Pro')
    await user.click(csv)
    expect(paywallState()).toMatchObject({ open: true, request: { feature: 'export' } })
    expect(downloads).toHaveLength(0)
  })

  it('waits until there is something to export', () => {
    renderYou()
    expect(row(/^Export to CSV/)).toBeDisabled()
    expect(row(/^Export to CSV/)).toHaveTextContent('Nothing to export yet')
  })

  it('exports every expense for Excel, with Pro', async () => {
    await installPro()
    const riya = addFriend({ name: 'Riya' })
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya.id] })
    saveExpense(draft({ title: 'Villa', groupId: goa.id, with: [riya.id] }))
    saveExpense(draft({ title: 'Chai', date: '2026-10-01' }))
    const { user } = renderYou()
    await user.click(row(/^Export to CSV/))
    expect(await screen.findByText('2 expenses saved to your downloads as CSV')).toBeInTheDocument()
    const [file] = downloads
    expect(file!.name).toBe('settle-expenses-2026-10-22.csv')
    const bytes = new Uint8Array(await file!.blob.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const lines = new TextDecoder().decode(bytes.slice(3)).trim().split('\r\n')
    expect(lines[0]).toBe('Date,Title,Category,Group,Total,Currency,Paid by,Your share,Split,People,Note,Kind,Paid amount,Paid currency,Rate')
    expect(lines[1]).toMatch(/^2026-10-21,Villa,Food & drinks,Goa,1000\.00,INR,You,500\.00,/)
    expect(lines[2]).toMatch(/^2026-10-01,Chai,/)
  })
})

describe('YouScreen — clear all data', () => {
  function seedEverything() {
    const riya = addFriend({ name: 'Riya' })
    saveExpense(draft({ with: [riya.id] }))
    createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya.id] })
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ v: 1 }))
    setLastBackupAt(OCT_22.getTime() - 86_400_000)
    rememberActivityView({ filter: 'pay', query: 'cab', limit: 80 })
  }

  it('asks first, offering a backup', async () => {
    seedEverything()
    const { user } = renderYou()
    await user.click(row(/^Clear all data/))
    const sheet = await screen.findByRole('dialog', { name: 'Clear everything?' })
    expect(sheet).toHaveAccessibleDescription(/Your profile, people, expenses, groups, recurring splits and any bill in progress/)
    await user.click(within(sheet).getByRole('button', { name: 'Save a backup first' }))
    expect(await screen.findByText('Backup saved to your downloads')).toBeInTheDocument()
    expect(downloads).toHaveLength(1)
    await user.click(within(sheet).getByRole('button', { name: 'Keep my data' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Clear everything?' })).not.toBeInTheDocument())
    expect(expensesStore.get()).toHaveLength(1)
  })

  it('clears everything on this phone, sends you to the welcome, and can undo it', async () => {
    seedEverything()
    const { user } = renderYou()
    await user.click(row(/^Clear all data/))
    const sheet = await screen.findByRole('dialog', { name: 'Clear everything?' })
    expect(within(sheet).queryByRole('switch')).not.toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Clear everything' }))

    expect(expensesStore.get()).toEqual([])
    expect(groupsStore.get()).toEqual([])
    expect(friendsStore.get().map((f) => f.id)).toEqual([ME_ID])
    expect(profileStore.get()).toMatchObject({ name: '', onboarded: false })
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull()
    expect(lastBackupAt()).toBeNull()
    expect(rememberedActivityView()).toMatchObject({ filter: 'all', query: '' })
    await waitFor(() => expect(currentUrl()).toBe('/app/welcome'))

    await user.click(await screen.findByRole('button', { name: /^Undo/ }))
    expect(expensesStore.get()).toHaveLength(1)
    expect(groupsStore.get()).toHaveLength(1)
    expect(profileStore.get()).toMatchObject({ name: 'Ayush', onboarded: true })
    expect(lastBackupAt()).toBe(OCT_22.getTime() - 86_400_000)
    await waitFor(() => expect(currentUrl()).toBe('/app/you'))
    expect(await screen.findByText('Everything is back')).toBeInTheDocument()
  })

  it('keeps a Pro pass unless asked to remove it', async () => {
    await installPro()
    seedEverything()
    const { user } = renderYou()
    await user.click(row(/^Clear all data/))
    const sheet = await screen.findByRole('dialog', { name: 'Clear everything?' })
    const removePro = within(sheet).getByRole('switch', { name: 'Remove Pro from this phone too' })
    expect(removePro).toHaveAttribute('aria-checked', 'false')
    await user.click(within(sheet).getByRole('button', { name: 'Clear everything' }))
    expect(expensesStore.get()).toEqual([])
    expect(licenseToken()).not.toBeNull()
  })

  it('removes Pro too when asked, and brings it back on Undo', async () => {
    const token = await installPro()
    seedEverything()
    const { user } = renderYou()
    await user.click(row(/^Clear all data/))
    const sheet = await screen.findByRole('dialog', { name: 'Clear everything?' })
    await user.click(within(sheet).getByRole('switch', { name: 'Remove Pro from this phone too' }))
    await user.click(within(sheet).getByRole('button', { name: 'Clear everything' }))
    expect(licenseToken()).toBeNull()
    expect(await screen.findByText('Everything is cleared, Pro included')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    await waitFor(() => expect(licenseToken()).toBe(token))
  })
})
