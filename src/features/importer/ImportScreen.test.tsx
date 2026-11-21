import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, expensesStore, groupsStore, updateProfile } from '../../data'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import ImportScreen, { nameFromFile } from './ImportScreen'

vi.setConfig({ testTimeout: 30_000 })

const GOA = [
  'Date,Description,Category,Cost,Currency,Ayush,Riya,Sam',
  '2026-10-01,Villa,Hotel,24000.00,INR,16000.00,-8000.00,-8000.00',
  '2026-10-03,Riya paid Ayush,Payment,6000.00,INR,-6000.00,6000.00,0.00',
  '2026-10-31,Total balance, , ,INR,10000.00,-2000.00,-8000.00',
].join('\n')

beforeEach(() => {
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
})

describe('nameFromFile', () => {
  it('names the group from Splitwise’s file name', () => {
    expect(nameFromFile('goa-trip_2026-11-21_export.csv')).toBe('Goa trip')
    expect(nameFromFile('flat_302.csv')).toBe('Flat 302')
  })
})

describe('ImportScreen', () => {
  it('reads the file, matches people, brings the group over and says the balances match', async () => {
    const user = userEvent.setup()
    const riya = addFriend({ name: 'Riya Sharma' }).id
    renderAt('/app/import', <ImportScreen />)
    await user.upload(screen.getByLabelText('Pick the Splitwise file'), new File([GOA], 'goa-trip_2026-11-21_export.csv', { type: 'text/csv' }))

    await screen.findByRole('heading', { name: 'Check it, then bring it over' })
    expect(screen.getByRole('textbox', { name: 'Group name' })).toHaveValue('Goa trip')
    // You were found by name; Riya is your Riya Sharma; Sam is someone new.
    expect(screen.getByRole('radio', { name: 'Ayush' })).toBeChecked()
    const who = screen.getByRole('region', { name: 'Who’s who' })
    expect(who).toHaveTextContent('Riya Sharma')
    expect(who).toHaveTextContent('Someone new')
    expect(screen.getByText('Everyone’s balance will match Splitwise')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Bring over 1 bills and 1 payments' }))
    await screen.findByText('Every balance matches Splitwise, to the paisa')
    const group = groupsStore.get().find((g) => g.name === 'Goa trip')
    expect(group?.memberIds).toContain(riya)
    expect(expensesStore.get().filter((e) => e.groupId === group?.id)).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Open the group' }))
    expect(currentUrl()).toBe(`/app/groups/${group?.id}`)
  })

  it('says so when the file isn’t a Splitwise export', async () => {
    const user = userEvent.setup()
    renderAt('/app/import', <ImportScreen />)
    await user.upload(screen.getByLabelText('Pick the Splitwise file'), new File(['name,amount\nRiya,200'], 'x.csv', { type: 'text/csv' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That doesn’t look like a Splitwise export.')
  })

  it('undo takes it all back', async () => {
    const user = userEvent.setup()
    renderAt('/app/import', <ImportScreen />)
    await user.upload(screen.getByLabelText('Pick the Splitwise file'), new File([GOA], 'goa.csv', { type: 'text/csv' }))
    await user.click(await screen.findByRole('button', { name: /^Bring over/ }))
    await user.click(await screen.findByRole('button', { name: 'Undo — take it all back' }))
    await waitFor(() => expect(groupsStore.get()).toEqual([]))
    expect(within(document.body).getByRole('button', { name: 'Pick the Splitwise file' })).toBeInTheDocument()
  })
})
