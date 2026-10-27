import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, exportBackup, expensesStore, friendsStore, profileStore, saveExpense, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { resetDataForTests } from '../../data/testing'
import { ME_ID } from '../../domain/types'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { RestoreBackup } from './RestoreBackup'

vi.setConfig({ testTimeout: 30_000 })

beforeEach(() => {
  resetProScreens()
})

const pick = (file: File) => fireEvent.change(screen.getByLabelText('Moving phones? Restore a backup', { selector: 'input' }), { target: { files: [file] } })

describe('RestoreBackup (first run)', () => {
  it('a backup from another phone brings everything back and opens the app', async () => {
    updateProfile({ name: 'Ayush', onboarded: true })
    const riya = addFriend({ name: 'Riya' }).id
    saveExpense(draft({ title: 'Dinner', participants: everyone(ME_ID, riya) }))
    const backup = JSON.stringify(exportBackup())
    resetDataForTests()
    expect(profileStore.get().onboarded).toBe(false)

    renderAt('/app/welcome', <RestoreBackup />)
    pick(new File([backup], 'settle-backup.json', { type: 'application/json' }))
    await waitFor(() => expect(currentUrl()).toBe('/app'))
    expect(profileStore.get()).toMatchObject({ name: 'Ayush', onboarded: true })
    expect(friendsStore.get().map((f) => f.name)).toContain('Riya')
    expect(expensesStore.get().map((e) => e.title)).toEqual(['Dinner'])
    expect(await screen.findByText('Welcome back — everything’s here')).toBeInTheDocument()
  })

  it('a file that isn’t a backup says so and stays put', async () => {
    renderAt('/app/welcome', <RestoreBackup />)
    pick(new File(['{"hello":1}'], 'notes.json', { type: 'application/json' }))
    expect(await screen.findByText('That file isn\'t a Settle backup. Pick the .json file Settle saved.')).toBeInTheDocument()
    expect(currentUrl()).toBe('/app/welcome')
    expect(profileStore.get().onboarded).toBe(false)
  })
})
