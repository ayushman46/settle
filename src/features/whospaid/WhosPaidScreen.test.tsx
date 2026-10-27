import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, expensesStore, saveExpense, updateProfile } from '../../data'
import { payerAliasesStore } from '../../data/stores'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import type * as ImageModule from '../../lib/image'
import { prepareImage, type PreparedImage } from '../../lib/image'
import { readSharedPayload } from '../../lib/sharedPayload'
import { json, renderAt, resetProScreens, route } from '../pro/testing'
import { proofLedgerStore } from '../proof/proofLedger'
import { WhosPaidScreen } from './WhosPaidScreen'

vi.mock('../../lib/image', async (importOriginal) => {
  const actual: typeof ImageModule = await importOriginal()
  return { ...actual, prepareImage: vi.fn() }
})

vi.mock('../../lib/sharedPayload', () => ({ readSharedPayload: vi.fn() }))

vi.setConfig({ testTimeout: 30_000 })

const prepareMock = vi.mocked(prepareImage)
const revokeMock = vi.fn()
const originalRevoke = URL.revokeObjectURL

function preparedImage(): PreparedImage {
  return { dataUrl: 'data:image/jpeg;base64,AAAA', previewUrl: 'blob:test-shot', width: 10, height: 10, bytes: 4 }
}

let riya: string
let sam: string
let asha: string
let dinner: string

// One dinner, ₹1,680 four ways: Riya, Sam and Asha owe ₹420 each.
const STATEMENT = `Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
20/10/26,UPI-SWIGGY-SWIGGY@ICICI-ICIC0000001-629301234567-PAYMENT,0000629301234567,20/10/26,450.00,,"10,000.00"
23/10/26,UPI-RIYA SHARMA-RIYA.S@OKHDFCBANK-HDFC0000123-629618427311-GOA DINNER,0000629618427311,23/10/26,,420.00,"10,420.00"
24/10/26,UPI-ASHA IYER-ASHA.I@OKSBI-SBIN0000123-629712345678-DINNER,0000629712345678,24/10/26,,400.00,"10,820.00"
25/10/26,UPI-KARAN MALHOTRA-KARAN.M@OKICICI-ICIC0000123-629812345678-RENT,0000629812345678,25/10/26,,999.00,"11,819.00"
`

const statementFile = (text = STATEMENT) => new File([text], 'statement.csv', { type: 'text/csv' })

function pickStatement(file: File = statementFile()): void {
  fireEvent.change(screen.getByLabelText('Choose a file', { selector: 'input' }), { target: { files: [file] } })
}

const paid = (friendId: string) => expensesStore.get().find((e) => e.id === dinner)?.paidBack[friendId] !== undefined

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 27, 12))
  resetProScreens()
  payerAliasesStore.set([])
  proofLedgerStore.set([])
  updateProfile({ name: 'Ayush' })
  riya = addFriend({ name: 'Riya Sharma', upiId: 'riya.s@okhdfcbank' }).id
  sam = addFriend({ name: 'Sam' }).id
  asha = addFriend({ name: 'Asha' }).id
  dinner = saveExpense(draft({ title: 'Goa dinner', total: 168_000, date: '2026-10-22', participants: everyone(ME_ID, riya, sam, asha) })).id
  prepareMock.mockReset()
  revokeMock.mockReset()
  URL.revokeObjectURL = revokeMock
})

afterEach(() => {
  URL.revokeObjectURL = originalRevoke
  vi.useRealTimers()
})

describe('WhosPaidScreen', () => {
  it('says what is owed and offers three ways in, two of them on this phone', () => {
    renderAt('/app/whos-paid', <WhosPaidScreen />)
    expect(screen.getByRole('heading', { level: 1, name: 'Who’s paid?' })).toBeInTheDocument()
    expect(screen.getByText(/3 people owe you ₹1,260/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Screenshots of your UPI app' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Bank statement' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Bank SMS' })).toBeInTheDocument()
    expect(screen.getAllByText('Read on this phone — never uploaded')).toHaveLength(2)
  })

  it('a bank statement: the sure one is ticked, the likely one asks, the stranger is set aside — then marked, and undone', async () => {
    const { user } = renderAt('/app/whos-paid', <WhosPaidScreen />)
    pickStatement()

    expect(await screen.findByRole('heading', { level: 1, name: '3 payments to you' })).toBeInTheDocument()
    const ticked = screen.getByRole('region', { name: 'Ticked for you (1)' })
    expect(within(ticked).getByText('RIYA SHARMA')).toBeInTheDocument()
    expect(within(ticked).getByRole('checkbox', { name: 'Riya Sharma · Goa dinner' })).toBeChecked()
    expect(within(ticked).getByText(/Their UPI ID/)).toBeInTheDocument()

    const check = screen.getByRole('region', { name: 'Check these (1)' })
    const which = within(check).getByRole('radiogroup', { name: 'Who paid ₹400?' })
    expect(within(which).getByRole('radio', { name: 'Not for a split' })).toBeChecked()
    // Asha paid ₹400 of her ₹420: a part payment, which you can take as settled.
    await user.click(within(which).getByRole('radio', { name: 'Asha · Goa dinner — part of ₹420; marks it paid' }))
    expect(within(check).getByText(/Same name · Part payment/)).toBeInTheDocument()

    // Karan owes nothing: set aside, folded away.
    const unmatched = screen.getByRole('button', { name: 'Not matched (1)', expanded: false })
    expect(unmatched).toBeInTheDocument()
    // The Swiggy payment went out; it isn't one of the payments to you.
    expect(screen.getByText('1 payment you made is left out.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mark 2 as paid' }))
    expect(paid(riya)).toBe(true)
    expect(paid(asha)).toBe(true)
    expect(paid(sam)).toBe(false)
    // "ASHA IYER" is plainly Asha: nothing to learn.
    expect(payerAliasesStore.get()).toEqual([])
    expect(proofLedgerStore.get().map((r) => r.utr).sort()).toEqual(['629618427311', '629712345678'])

    expect(await screen.findByRole('heading', { level: 1, name: '2 payments ticked off' })).toBeInTheDocument()
    expect(screen.getByText('1 person still owes you')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(paid(riya)).toBe(false)
    expect(paid(asha)).toBe(false)
    expect(payerAliasesStore.get()).toEqual([])
    expect(proofLedgerStore.get()).toEqual([])
  })

  it('a name it can’t place: you say who, and it learns the bank name', async () => {
    const { user } = renderAt('/app/whos-paid', <WhosPaidScreen />)
    pickStatement(statementFile(STATEMENT.replace('UPI-ASHA IYER-ASHA.I@OKSBI-', 'UPI-A IYER-9876543210@YBL-').replace(',400.00,"10,820.00"', ',420.00,"10,840.00"').replace('999.00,"11,819.00"', '999.00,"11,839.00"')))
    await user.click(await screen.findByRole('button', { name: 'Not matched (2)', expanded: false }))
    const which = screen.getByRole('radiogroup', { name: 'Who paid ₹420?' })
    await user.click(within(which).getByRole('radio', { name: 'Asha · Goa dinner' }))
    expect(screen.getByText(/remembers “A IYER” as Asha/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mark 2 as paid' }))
    expect(paid(asha)).toBe(true)
    expect(payerAliasesStore.get()).toEqual([expect.objectContaining({ name: 'a iyer', friendId: asha })])
  })

  it('remembers a bank name: next time it is ticked for you', async () => {
    // "A IYER" alone could be anyone; once you've said it's Asha, it's her.
    payerAliasesStore.set([{ name: 'a iyer', friendId: asha, at: 1 }])
    renderAt('/app/whos-paid', <WhosPaidScreen />)
    pickStatement(statementFile(STATEMENT.replace('UPI-ASHA IYER-ASHA.I@OKSBI-', 'UPI-A IYER-9876543210@YBL-').replace(',400.00,"10,820.00"', ',420.00,"10,840.00"').replace('999.00,"11,819.00"', '999.00,"11,839.00"')))
    const ticked = await screen.findByRole('region', { name: 'Ticked for you (2)' })
    expect(within(ticked).getByRole('checkbox', { name: 'Asha · Goa dinner' })).toBeChecked()
    expect(within(ticked).getByText(/Name you confirmed before/)).toBeInTheDocument()
  })

  it('a statement whose balance doesn’t add up ticks nothing for you', async () => {
    renderAt('/app/whos-paid', <WhosPaidScreen />)
    pickStatement(statementFile(STATEMENT.replace('"10,820.00"', '"99,999.00"').replace('"11,819.00"', '"12,345.00"')))
    expect(await screen.findByText('This file’s balance didn’t add up')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /Ticked for you/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark 0 as paid' })).toBeDisabled()
  })

  it('a file that is not a statement says so and stays on the choices', async () => {
    renderAt('/app/whos-paid', <WhosPaidScreen />)
    pickStatement(new File(['hello,world\n1,2'], 'notes.csv', { type: 'text/csv' }))
    expect(await screen.findByText('Couldn’t find the transactions in that file. Use the statement’s CSV or Excel download.')).toBeInTheDocument()
    pickStatement(new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0])], 'old.xls', { type: 'application/vnd.ms-excel' }))
    expect(await screen.findByText('Couldn’t open that file. Save it as CSV or Excel (.xlsx) and try again.')).toBeInTheDocument()
  })

  it('bank SMS pasted in bulk, read on the phone', async () => {
    const { user } = renderAt('/app/whos-paid', <WhosPaidScreen />)
    await user.click(screen.getByRole('button', { name: 'Paste SMS' }))
    const box = screen.getByRole('textbox', { name: 'Bank SMS' })
    await user.click(box)
    await user.paste(
      'Rs.420.00 credited to a/c XX4821 on 23-10-26 by a/c linked to VPA riya.s@okhdfcbank (UPI Ref no 629618427311).\n\nYour a/c XX4821 is debited with Rs 450.00 on 20-10-26 towards UPI/SWIGGY.',
    )
    await user.click(screen.getByRole('button', { name: 'Read the messages' }))
    const ticked = await screen.findByRole('region', { name: 'Ticked for you (1)' })
    expect(within(ticked).getByRole('checkbox', { name: 'Riya Sharma · Goa dinner' })).toBeChecked()
  })

  it('SMS with no money received says so', async () => {
    const { user } = renderAt('/app/whos-paid', <WhosPaidScreen />)
    await user.click(screen.getByRole('button', { name: 'Paste SMS' }))
    await user.click(screen.getByRole('textbox', { name: 'Bank SMS' }))
    await user.paste('Your OTP is 123456. Do not share it.')
    await user.click(screen.getByRole('button', { name: 'Read the messages' }))
    expect(await screen.findByText('None of those messages is money received. Paste the “credited” ones.')).toBeInTheDocument()
  })

  it('screenshots: read by the server, overlapping rows counted once, a clear row ticked', async () => {
    prepareMock.mockResolvedValue(preparedImage())
    const sent: unknown[] = []
    const row = { name: 'Sam D', handle: null, amount: 420, date: '2026-10-24', status: 'success', cue: 'received_word', utr: null, cutOff: false }
    route('/api/history', (init) => {
      sent.push(JSON.parse(String(init?.body)))
      return json({ app: 'gpay', rows: [row], skippedOutgoing: 1, model: 'test' })
    })
    const { user } = renderAt('/app/whos-paid', <WhosPaidScreen />)
    const shots = [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })]
    fireEvent.change(screen.getByLabelText('Choose screenshots', { selector: 'input' }), { target: { files: shots } })

    expect(await screen.findByRole('heading', { level: 1, name: '1 payment to you' })).toBeInTheDocument()
    expect(sent).toEqual([
      { image: 'data:image/jpeg;base64,AAAA', today: '2026-10-27' },
      { image: 'data:image/jpeg;base64,AAAA', today: '2026-10-27' },
    ])
    // The previews of the originals are let go.
    expect(revokeMock).toHaveBeenCalledTimes(2)
    const ticked = screen.getByRole('region', { name: 'Ticked for you (1)' })
    expect(within(ticked).getByText('Sam D')).toBeInTheDocument()
    expect(within(ticked).getByRole('checkbox', { name: 'Sam · Goa dinner' })).toBeChecked()
    expect(screen.getByText('Someone paid on another app? Their payment may only show in your bank statement.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Back/ }))
    expect(screen.getByRole('heading', { name: 'Bank statement' })).toBeInTheDocument()
  })

  it('a row only a green colour marks as money in is never ticked for you', async () => {
    prepareMock.mockResolvedValue(preparedImage())
    const row = { name: 'Sam D', handle: null, amount: 420, date: '2026-10-24', status: 'success', cue: 'green_only', utr: null, cutOff: false }
    route('/api/history', () => json({ app: 'gpay', rows: [row], skippedOutgoing: 0, model: 'test' }))
    renderAt('/app/whos-paid', <WhosPaidScreen />)
    fireEvent.change(screen.getByLabelText('Choose screenshots', { selector: 'input' }), { target: { files: [new File(['a'], 'a.png', { type: 'image/png' })] } })
    const check = await screen.findByRole('region', { name: 'Check these (1)' })
    expect(within(check).getByRole('radio', { name: 'Not for a split' })).toBeChecked()
    expect(screen.queryByRole('region', { name: /Ticked for you/ })).not.toBeInTheDocument()
  })

  it('screenshots that aren’t a payment history say so', async () => {
    prepareMock.mockResolvedValue(preparedImage())
    route('/api/history', () => json({ error: { code: 'not_a_history', message: 'no' } }, 422))
    renderAt('/app/whos-paid', <WhosPaidScreen />)
    fireEvent.change(screen.getByLabelText('Choose screenshots', { selector: 'input' }), { target: { files: [new File(['a'], 'a.png', { type: 'image/png' })] } })
    expect(await screen.findByText(/doesn’t look like a list of payments/)).toBeInTheDocument()
  })

  it('a statement shared in from the bank’s app is read straight away', async () => {
    vi.mocked(readSharedPayload).mockResolvedValue({ title: '', text: '', url: '', files: [statementFile()] })
    renderAt('/app/whos-paid?k=abcdefghijkl', <WhosPaidScreen />)
    expect(screen.getByText('Reading…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: '3 payments to you' })).toBeInTheDocument()
    expect(vi.mocked(readSharedPayload)).toHaveBeenCalledWith('abcdefghijkl')
  })

  it('a share that’s gone says so, on the choices', async () => {
    vi.mocked(readSharedPayload).mockResolvedValue(null)
    renderAt('/app/whos-paid?k=abcdefghijkl', <WhosPaidScreen />)
    expect(await screen.findByText('Couldn’t open that file. Save it as CSV or Excel (.xlsx) and try again.')).toBeInTheDocument()
  })

  it('nobody owes you: says so', () => {
    expensesStore.set([])
    renderAt('/app/whos-paid', <WhosPaidScreen />)
    expect(screen.getByRole('heading', { name: 'Nobody owes you right now' })).toBeInTheDocument()
  })

  it('after marking, someone who paid in cash is one tap', async () => {
    const { user } = renderAt('/app/whos-paid', <WhosPaidScreen />)
    pickStatement()
    await screen.findByRole('region', { name: 'Ticked for you (1)' })
    await user.click(screen.getByRole('button', { name: 'Mark 1 as paid' }))
    await screen.findByText('2 people still owe you')
    const samRow = screen.getByText('Sam').closest('li')
    expect(samRow).not.toBeNull()
    await user.click(within(samRow as HTMLElement).getByRole('button', { name: 'Paid in cash' }))
    expect(paid(sam)).toBe(true)
    await waitFor(() => expect(screen.getByText('1 person still owes you')).toBeInTheDocument())
  })
})
