import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, expensesStore, groupsStore, saveExpense, setPaidBack, updateProfile } from '../../data'
import { saveLoan } from '../../data/loans'
import { draft } from '../../data/testKit'
import { ME_ID, type Expense } from '../../domain/types'
import { overallSummary } from '../../engine/balances'
import type { UpiPaySheetProps } from '../../kit/UpiPaySheet'
import type * as NativeApp from '../../lib/nativeApp'
import { printPage } from '../../lib/nativeApp'
import type * as ShareLib from '../../lib/share'
import { shareResult } from '../../lib/share'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { ByaajDetailScreen } from './ByaajDetailScreen'
import { ByaajRow } from './ByaajRow'
import { ByaajScreen } from './ByaajScreen'
import { byaajPath } from './paths'
import { byaajPlanFor, setByaaj, setByaajDueOn } from './store'

vi.setConfig({ testTimeout: 30_000 })

vi.mock('../../lib/share', async (original) => ({ ...(await original<typeof ShareLib>()), shareResult: vi.fn(async () => 'copied') }))
vi.mock('../../lib/nativeApp', async (original) => ({ ...(await original<typeof NativeApp>()), printPage: vi.fn() }))
// The real sheet hands off to a UPI app; here "paid" is one button that calls back as it would.
vi.mock('../../kit/UpiPaySheet', () => ({
  UpiPaySheet: ({ open, onClose, payee, amount, onMarkPaid }: UpiPaySheetProps) =>
    open ? (
      <div role="dialog" aria-label={`Pay ${payee.name}`}>
        <span>{amount}</span>
        <button
          type="button"
          onClick={() => {
            onMarkPaid?.()
            onClose()
          }}
        >
          I’ve paid
        </button>
      </div>
    ) : null,
}))

const rupees = (n: number): number => n * 100
const owes = (friendId: string): number => overallSummary(expensesStore.get(), groupsStore.get(), ME_ID, 'INR').byFriend[friendId] ?? 0

let riya: string
let loan: Expense

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 15, 12))
  resetProScreens()
  vi.mocked(shareResult).mockClear()
  vi.mocked(printPage).mockClear()
  updateProfile({ name: 'Ayush Kumar', currency: 'INR' })
  riya = addFriend({ name: 'Riya Sharma' }).id
  // ₹50,000 lent to Riya on 15 Aug: three months ago today.
  loan = saveLoan({ direction: 'lent', friendId: riya, amount: rupees(50_000), currency: 'INR', what: 'cash', date: '2026-08-15' })
})

afterEach(() => {
  vi.useRealTimers()
})

const addInterest = (): (() => void) => setByaaj(loan.id, { rate: { bp: 100, per: 'month' }, principal: rupees(50_000), now: Date.now() })
const status = () => screen.getByRole('status', { name: 'Where it stands today' })
const statement = () => within(screen.getByRole('list', { name: 'Statement, oldest first' })).getAllByRole('listitem')

describe('ByaajDetailScreen: adding interest', () => {
  it('one tap on a rate adds interest from the loan’s date, and Undo takes it off again', async () => {
    const { user } = renderAt(byaajPath(loan.id), <ByaajDetailScreen />)
    expect(screen.getByRole('heading', { name: 'Add interest' })).toBeInTheDocument()
    expect(screen.getByText('You lent Riya ₹50,000 on 15 Aug 2026. Pick a rate, and Settle counts simple interest from that day.')).toBeInTheDocument()
    expect(screen.getByText('A part payment pays the interest first, then the amount lent. Interest is never charged on interest.')).toBeInTheDocument()
    for (const name of ['1% a month', '2% a month', '12% a year', 'Other']) expect(screen.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'false')

    await user.click(screen.getByRole('radio', { name: '1% a month' }))
    expect(byaajPlanFor(loan.id)).toMatchObject({ bp: 100, per: 'month', principal: rupees(50_000) })
    expect(screen.getByText('Interest added: 1% a month, from 15 Aug 2026')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Lent to Riya' })).toBeInTheDocument()
    expect(status()).toHaveTextContent('As of today: ₹50,000 lent, ₹1,500 interest (3 months at 1% a month), ₹51,500 in all')

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(byaajPlanFor(loan.id)).toBeNull()
    expect(screen.getByRole('heading', { name: 'Add interest' })).toBeInTheDocument()
  })

  it('"Other" takes your own rate, a month or a year, and says what is wrong with one that can’t be set', async () => {
    const { user } = renderAt(byaajPath(loan.id), <ByaajDetailScreen />)
    await user.click(screen.getByRole('radio', { name: 'Other' }))
    await user.click(screen.getByRole('button', { name: 'Set rate' }))
    expect(screen.getByText('Type a rate between 0.01 and 100.')).toBeInTheDocument()
    expect(byaajPlanFor(loan.id)).toBeNull()

    await user.type(screen.getByLabelText('Rate in percent'), '18')
    // Leaving the field does not set it yet: "a year" still has to be chosen.
    await user.click(screen.getByRole('radio', { name: 'a year' }))
    expect(byaajPlanFor(loan.id)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Set rate' }))
    expect(byaajPlanFor(loan.id)).toMatchObject({ bp: 1800, per: 'year' })
    // 92 days at 18% a year on ₹50,000: ₹2,268.49 → ₹2,268.
    expect(status()).toHaveTextContent('As of today: ₹50,000 lent, ₹2,268 interest (92 days at 18% a year), ₹52,268 in all')
    expect(screen.getByRole('radio', { name: 'Other: 18% a year' })).toHaveAttribute('aria-checked', 'true')
  })

  it('money you borrowed reads from your side', async () => {
    const mine = saveLoan({ direction: 'borrowed', friendId: riya, amount: rupees(20_000), currency: 'INR', what: 'cash', date: '2026-10-15' })
    const { user } = renderAt(byaajPath(mine.id), <ByaajDetailScreen />)
    expect(screen.getByText('You borrowed ₹20,000 from Riya on 15 Oct 2026. Pick a rate, and Settle counts simple interest from that day.')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '2% a month' }))
    expect(screen.getByRole('heading', { name: 'Borrowed from Riya' })).toBeInTheDocument()
    expect(status()).toHaveTextContent('As of today: ₹20,000 borrowed, ₹400 interest (1 month at 2% a month), ₹20,400 in all')
  })

  it('an entry that is not a loan, or is gone: says so and leads back to the list', async () => {
    const dinner = saveExpense(draft({ title: 'Dinner', with: [riya] }))
    const { user } = renderAt(byaajPath(dinner.id), <ByaajDetailScreen />)
    expect(screen.getByRole('heading', { name: 'No loan to show' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'See loans with interest' }))
    expect(currentUrl()).toBe('/app/byaaj')
  })

  it('a loan already paid back has nothing to add interest to', () => {
    setPaidBack(loan.id, riya, true)
    renderAt(byaajPath(loan.id), <ByaajDetailScreen />)
    expect(screen.getByRole('heading', { name: 'This loan is already paid back' })).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })
})

describe('ByaajDetailScreen: a loan with interest', () => {
  beforeEach(() => {
    addInterest()
  })

  it('says what is due, states its rules, and lists the statement', () => {
    renderAt(byaajPath(loan.id), <ByaajDetailScreen />)
    expect(screen.getByText('₹50,000 lent on 15 Aug 2026')).toBeInTheDocument()
    expect(status()).toHaveTextContent('Due in all')
    expect(status()).toHaveTextContent('₹51,500')
    const rules = within(screen.getByRole('region', { name: 'How it is counted' }))
    expect(rules.getByText('Simple interest at 1% a month, from 15 Aug 2026.')).toBeInTheDocument()
    expect(rules.getByText('Every whole month counts as a month; the days left over count as days out of 30.')).toBeInTheDocument()
    expect(rules.getByText('A part payment pays the interest first, then the amount lent. Interest is never charged on interest.')).toBeInTheDocument()
    expect(rules.getByText('Interest is rounded to the nearest ₹1.')).toBeInTheDocument()
    const lines = statement()
    expect(lines).toHaveLength(2)
    expect(lines[0]).toHaveTextContent('15 Aug 2026You lent Riya ₹50,000Interest at 1% a month starts.')
    expect(lines[1]).toHaveTextContent('15 Nov 2026Today₹1,500 interest for 3 months. Due in all: ₹51,500.')
  })

  it('records a payment: everything due is filled in, the split is shown before saving, balances follow, and Undo puts it all back', async () => {
    const { user } = renderAt(byaajPath(loan.id), <ByaajDetailScreen />)
    await user.click(screen.getByRole('button', { name: 'Record a payment' }))
    const sheet = within(await screen.findByRole('dialog', { name: 'Record a payment' }))
    expect(sheet.getByText('What did Riya give you? Interest is paid first, then the amount lent.')).toBeInTheDocument()
    const amount = sheet.getByLabelText('Amount paid')
    expect(amount).toHaveValue('51,500')
    expect(sheet.getByRole('status')).toHaveTextContent('₹1,500 goes to interest and ₹50,000 comes off the amount. That clears it.')

    await user.clear(amount)
    await user.type(amount, '5000')
    expect(sheet.getByRole('status')).toHaveTextContent('₹1,500 goes to interest and ₹3,500 comes off the amount. After this, ₹46,500 is left.')
    await user.click(sheet.getByRole('button', { name: 'Save payment' }))

    expect(await screen.findByText('Written down: ₹5,000. ₹1,500 interest, ₹3,500 off the amount.')).toBeInTheDocument()
    expect(status()).toHaveTextContent('As of today: ₹46,500 still to come back, ₹0 interest due, ₹46,500 in all')
    expect(owes(riya)).toBe(rupees(46_500))
    const lines = statement()
    expect(lines).toHaveLength(3)
    expect(lines[1]).toHaveTextContent('Riya paid ₹5,000')
    expect(lines[1]).toHaveTextContent('₹1,500 interest for 3 months. ₹1,500 went to interest, ₹3,500 came off the amount. Left: ₹46,500, and ₹0 interest.')

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(owes(riya)).toBe(rupees(50_000))
    expect(expensesStore.get()).toHaveLength(1)
    expect(byaajPlanFor(loan.id)?.payments).toEqual([])
    expect(status()).toHaveTextContent('₹51,500 in all')
    expect(statement()).toHaveLength(2)
  })

  it('more than is due, or nothing: the sheet says so and stays; what was typed is still there when it is opened again', async () => {
    const { user } = renderAt(byaajPath(loan.id), <ByaajDetailScreen />)
    await user.click(screen.getByRole('button', { name: 'Record a payment' }))
    let sheet = within(await screen.findByRole('dialog', { name: 'Record a payment' }))
    await user.clear(sheet.getByLabelText('Amount paid'))
    await user.click(sheet.getByRole('button', { name: 'Save payment' }))
    expect(sheet.getByText('Type what was paid.')).toBeInTheDocument()
    await user.type(sheet.getByLabelText('Amount paid'), '60000')
    expect(sheet.getByText('That is more than the ₹51,500 due on that day.')).toBeInTheDocument()
    await user.click(sheet.getByRole('button', { name: 'Save payment' }))
    expect(byaajPlanFor(loan.id)?.payments).toEqual([])
    expect(owes(riya)).toBe(rupees(50_000))

    // Only the interest, in one tap.
    await user.click(sheet.getByRole('button', { name: 'Only the interest: ₹1,500' }))
    expect(sheet.getByLabelText('Amount paid')).toHaveValue('1,500')
    await user.click(sheet.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Record a payment' })).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Record a payment' }))
    sheet = within(await screen.findByRole('dialog', { name: 'Record a payment' }))
    expect(sheet.getByLabelText('Amount paid')).toHaveValue('1,500')
    await user.click(sheet.getByRole('button', { name: 'Save payment' }))
    expect(byaajPlanFor(loan.id)?.payments).toMatchObject([{ interest: rupees(1_500), principal: 0 }])
    expect(owes(riya)).toBe(rupees(50_000))
  })

  it('money you borrowed can be paid by UPI: it is recorded once you say it is paid', async () => {
    const mine = saveLoan({ direction: 'borrowed', friendId: riya, amount: rupees(20_000), currency: 'INR', what: 'cash', date: '2026-09-15' })
    setByaaj(mine.id, { rate: { bp: 200, per: 'month' }, principal: rupees(20_000), now: Date.now() })
    setPaidBack(loan.id, riya, true)
    const { user } = renderAt(byaajPath(mine.id), <ByaajDetailScreen />)
    await user.click(screen.getByRole('button', { name: 'Record a payment' }))
    const sheet = within(await screen.findByRole('dialog', { name: 'Record a payment' }))
    await user.click(sheet.getByRole('button', { name: 'Pay Riya by UPI' }))
    const upi = within(await screen.findByRole('dialog', { name: 'Pay Riya' }))
    expect(upi.getByText(String(rupees(20_800)))).toBeInTheDocument()
    expect(byaajPlanFor(mine.id)?.payments).toEqual([])
    await user.click(upi.getByRole('button', { name: 'I’ve paid' }))
    expect(byaajPlanFor(mine.id)?.payments).toMatchObject([{ interest: rupees(800), principal: rupees(20_000) }])
    expect(owes(riya)).toBe(0)
    expect(status()).toHaveTextContent('All paid back, with the interest.')
    expect(screen.queryByRole('button', { name: 'Record a payment' })).not.toBeInTheDocument()
  })

  it('shares a message written to the other person, and prints a loan note with both names and the amount in words', async () => {
    setByaajDueOn(loan.id, '2026-12-31')
    const { user } = renderAt(byaajPath(loan.id), <ByaajDetailScreen />)
    await user.click(screen.getByRole('button', { name: 'Share with Riya' }))
    expect(vi.mocked(shareResult).mock.calls[0]?.[0]).toBe(
      [
        'Hi Riya, this is about the ₹50,000 I lent you on 15 Aug 2026, at 1% a month simple interest.',
        'As of 15 Nov 2026: ₹50,000 of the amount is still out and ₹1,500 interest is due. ₹51,500 in all.',
        'To be paid back by 31 Dec 2026.',
        'Every whole month counts as a month; the days left over count as days out of 30. A part payment pays the interest first, then the amount.',
        'A record between the two of us, not a legal document.',
      ].join('\n'),
    )
    expect(await screen.findByText('Message copied. Paste it in a chat.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Print the loan note' }))
    expect(printPage).toHaveBeenCalledWith('Loan note')
    const note = screen.getByRole('article', { name: 'Loan note', hidden: true })
    expect(note).toHaveTextContent('LenderAyush Kumar')
    expect(note).toHaveTextContent('BorrowerRiya Sharma')
    expect(note).toHaveTextContent('Amount₹50,000.00')
    expect(note).toHaveTextContent('In wordsRupees fifty thousand only')
    expect(note).toHaveTextContent('Date of the loan15 Aug 2026')
    expect(note).toHaveTextContent('Interest1% a month')
    expect(note).toHaveTextContent('To be paid back by31 Dec 2026')
    expect(note).toHaveTextContent('Lender’s signature')
    expect(note).toHaveTextContent('Borrower’s signature')
    expect(note).toHaveTextContent('A record between the two of you, not a legal document.')
  })

  it('a date to pay it back by is one tap, shows on the loan, and can be cleared; each with Undo', async () => {
    const { user } = renderAt(byaajPath(loan.id), <ByaajDetailScreen />)
    await user.click(screen.getByRole('button', { name: 'Set a date to pay it back by' }))
    expect(byaajPlanFor(loan.id)?.dueOn).toBe('2026-12-15')
    expect(status()).toHaveTextContent('To be paid back by 15 Dec 2026.')
    await user.click(screen.getByRole('button', { name: 'No date' }))
    expect(byaajPlanFor(loan.id)?.dueOn).toBeNull()
    await user.click(screen.getAllByRole('button', { name: /^Undo/ }).at(-1)!)
    expect(byaajPlanFor(loan.id)?.dueOn).toBe('2026-12-15')
  })

  it('past its date and still due: says it was to be paid back', () => {
    setByaajDueOn(loan.id, '2026-11-01')
    renderAt(byaajPath(loan.id), <ByaajDetailScreen />)
    expect(status()).toHaveTextContent('Was to be paid back by 1 Nov 2026.')
  })

  it('changing the rate recounts from the loan’s date; removing interest leaves the loan alone; both with Undo', async () => {
    const { user } = renderAt(byaajPath(loan.id), <ByaajDetailScreen />)
    await user.click(screen.getByRole('radio', { name: '2% a month' }))
    expect(status()).toHaveTextContent('₹3,000 interest (3 months at 2% a month), ₹53,000 in all')
    expect(screen.getByText('Rate is now 2% a month, counted from the loan’s date')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(status()).toHaveTextContent('₹51,500 in all')

    await user.click(screen.getByRole('button', { name: 'Remove interest' }))
    expect(byaajPlanFor(loan.id)).toBeNull()
    expect(owes(riya)).toBe(rupees(50_000))
    expect(screen.getByRole('heading', { name: 'Add interest' })).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /^Undo/ }).at(-1)!)
    expect(byaajPlanFor(loan.id)).toMatchObject({ bp: 100, per: 'month' })
    expect(status()).toHaveTextContent('₹51,500 in all')
  })
})

describe('ByaajScreen', () => {
  it('empty: sells it in a sentence and sends you to write down a loan', async () => {
    resetProScreens()
    const { user } = renderAt('/app/byaaj', <ByaajScreen />)
    expect(screen.getByRole('heading', { name: 'Interest on a loan' })).toBeInTheDocument()
    expect(screen.getByText(/^Byaaj is interest\./)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Lent or borrowed with interest?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Write down a loan' }))
    expect(currentUrl()).toBe('/app/lend')
  })

  it('offers open loans for interest, and lists the ones that have it with what is due today', async () => {
    const other = saveLoan({ direction: 'borrowed', friendId: riya, amount: rupees(2_000), currency: 'INR', what: 'cash', date: '2026-10-15' })
    const { user } = renderAt('/app/byaaj', <ByaajScreen />)
    const offered = within(screen.getByRole('region', { name: 'Add interest to a loan' }))
    expect(offered.getAllByRole('button')).toHaveLength(2)
    expect(offered.getByRole('button', { name: /Riya · ₹2,000 borrowed 15 Oct 2026 · no interest yet/ })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Loans with interest' })).not.toBeInTheDocument()

    addInterest()
    setByaajDueOn(loan.id, '2026-12-31')
    const listed = within(await screen.findByRole('region', { name: 'Loans with interest' }))
    const row = listed.getByRole('button', { name: /Riya · ₹50,000 lent/ })
    expect(row).toHaveTextContent('1% a month · ₹51,500 due in all · by 31 Dec 2026')
    expect(within(screen.getByRole('region', { name: 'Add interest to a loan' })).getAllByRole('button')).toHaveLength(1)
    await user.click(row)
    expect(currentUrl()).toBe(`/app/byaaj/${loan.id}`)
    expect(other.id).not.toBe(loan.id)
  })
})

describe('ByaajRow', () => {
  it('on a loan without interest: "Add interest", one tap to the rates', async () => {
    const { user } = renderAt(`/app/expense/${loan.id}`, <ByaajRow expenseId={loan.id} />)
    const row = screen.getByRole('button', { name: /Add interest/ })
    expect(row).toHaveTextContent('Lent with byaaj (interest)? Pick a rate, and Settle counts it by the day.')
    await user.click(row)
    expect(currentUrl()).toBe(`/app/byaaj/${loan.id}`)
  })

  it('on a loan with interest: the rate and what is due', () => {
    addInterest()
    renderAt(`/app/expense/${loan.id}`, <ByaajRow expenseId={loan.id} />)
    expect(screen.getByRole('button', { name: /Interest: 1% a month/ })).toHaveTextContent('₹1,500 interest due · ₹51,500 in all')
  })

  it('shows nothing for a split, for an entry that is gone, or for a loan paid back that never had interest', () => {
    const dinner = saveExpense(draft({ title: 'Dinner', with: [riya] }))
    expect(renderAt('/app', <ByaajRow expenseId={dinner.id} />).container).toBeEmptyDOMElement()
    expect(renderAt('/app', <ByaajRow expenseId="nope" />).container).toBeEmptyDOMElement()
    setPaidBack(loan.id, riya, true)
    expect(renderAt('/app', <ByaajRow expenseId={loan.id} />).container).toBeEmptyDOMElement()
  })
})
