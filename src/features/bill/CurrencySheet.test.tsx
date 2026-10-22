import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetFlowHistory } from '../../state/backStack'
import { CurrencySheet } from './CurrencySheet'
import { historyIdle } from './screenTestKit'

beforeEach(() => {
  resetFlowHistory()
  window.history.replaceState(null, '')
})

afterEach(async () => {
  await historyIdle()
})

describe('CurrencySheet', () => {
  it('lists the current currency first and says what changing it does to a bill', () => {
    render(<CurrencySheet open currency="EUR" onClose={() => {}} onSelect={() => {}} />)
    const sheet = screen.getByRole('dialog', { name: 'Currency' })
    expect(sheet).toHaveAccessibleDescription(
      'Numbers stay the same — only the currency changes. Currencies without decimals round to whole amounts.',
    )
    const options = within(sheet).getAllByRole('button').filter((b) => b.closest('ul'))
    expect(options[0]).toHaveAttribute('aria-current', 'true')
    expect(options[0]).toHaveTextContent('EUR')
  })

  it('finds currencies by name or code, and takes any ISO code typed in full', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<CurrencySheet open currency="INR" onClose={() => {}} onSelect={onSelect} />)
    const search = screen.getByRole('searchbox', { name: 'Search currencies' })

    await user.type(search, 'dirham')
    await user.click(screen.getByRole('button', { name: /AED/ }))
    expect(onSelect).toHaveBeenCalledWith('AED')

    await user.clear(search)
    await user.type(search, 'zzzz')
    expect(screen.getByRole('heading', { name: 'No matches' })).toBeInTheDocument()
  })

  it('takes its own title and description away from a bill, or none', () => {
    const { rerender } = render(
      <CurrencySheet
        open
        currency="INR"
        onClose={() => {}}
        onSelect={() => {}}
        title="Default currency"
        description="New splits start in this currency."
      />,
    )
    expect(screen.getByRole('dialog', { name: 'Default currency' })).toHaveAccessibleDescription(
      'New splits start in this currency.',
    )
    rerender(<CurrencySheet open currency="INR" onClose={() => {}} onSelect={() => {}} description={null} />)
    expect(screen.getByRole('dialog', { name: 'Currency' })).not.toHaveAccessibleDescription()
  })
})
