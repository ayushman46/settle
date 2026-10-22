import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Send } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { ExpenseActionsSheet } from './ExpenseActionsSheet'

describe('ExpenseActionsSheet', () => {
  it('lists actions features add just above Delete', async () => {
    const onClaim = vi.fn()
    render(
      <ExpenseActionsSheet
        open
        onClose={() => {}}
        title="Dinner at Toit"
        itemized
        onEdit={() => {}}
        onDuplicate={() => {}}
        onDelete={() => {}}
        extra={[{ key: 'claim', icon: <Send />, label: 'Let friends claim items', detail: 'Send one link; their picks come back to you', onSelect: onClaim }]}
      />,
    )
    const sheet = screen.getByRole('dialog', { name: 'Dinner at Toit' })
    const names = within(sheet)
      .getAllByRole('button')
      .map((b) => b.textContent ?? '')
    const order = ['Edit the bill', 'Duplicate', 'Let friends claim items', 'Delete'].map((label) => names.findIndex((n) => n.startsWith(label)))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((x, y) => x - y)).toEqual(order)
    await userEvent.click(within(sheet).getByRole('button', { name: /Let friends claim items/ }))
    expect(onClaim).toHaveBeenCalledOnce()
  })

  it('shows just its own actions without extras', () => {
    render(<ExpenseActionsSheet open onClose={() => {}} title="Cab" itemized={false} onEdit={() => {}} onDuplicate={() => {}} onDelete={() => {}} />)
    expect(screen.getByRole('button', { name: /^Edit/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /claim/ })).not.toBeInTheDocument()
  })
})
