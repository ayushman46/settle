import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { encode } from 'uqr'
import { formatMoney } from '../lib/money'
import { ActionBar } from './ActionBar'
import { AppFrame } from './AppFrame'
import { Avatar } from './Avatar'
import { AvatarStack } from './AvatarStack'
import { Banner } from './Banner'
import { Card } from './Card'
import { EmptyState } from './EmptyState'
import { avatarColorIndex, describePeople, qrPath } from './helpers'
import { List, ListRow } from './ListRow'
import { Money } from './Money'
import { PageTitle } from './PageTitle'
import { Progress } from './Progress'
import { QrCode } from './QrCode'
import { Receipt } from './Receipt'
import { Screen, ScreenTransition } from './Screen'
import { Skeleton, SkeletonRows } from './Skeleton'
import { Spinner } from './Spinner'
import { SuccessCheck } from './SuccessCheck'
import { TopBar } from './TopBar'

const people = [
  { id: 'a', name: 'Aisha Khan', color: 0 },
  { id: 'b', name: 'Ben', color: 1 },
  { id: 'c', name: 'Chen Li', color: 2 },
  { id: 'd', name: 'Dev', color: 3 },
  { id: 'e', name: 'Ema', color: 4 },
  { id: 'f', name: 'Fay', color: 5 },
]

describe('helpers', () => {
  it('wraps avatar colours into the palette', () => {
    expect(avatarColorIndex(0)).toBe(0)
    expect(avatarColorIndex(7)).toBe(7)
    expect(avatarColorIndex(8)).toBe(0)
    expect(avatarColorIndex(-1)).toBe(7)
    expect(avatarColorIndex(Number.NaN)).toBe(0)
  })

  it('describes groups of people readably', () => {
    expect(describePeople([])).toBe('Nobody')
    expect(describePeople(['Aisha'])).toBe('Aisha')
    expect(describePeople(['Aisha', 'Ben'])).toBe('Aisha and Ben')
    expect(describePeople(['Aisha', 'Ben', 'Chen'])).toBe('Aisha, Ben and Chen')
    expect(describePeople(['Aisha', 'Ben', 'Chen', 'Dev'])).toBe('Aisha, Ben and 2 others')
    expect(describePeople(['Aisha', 'Ben', 'Chen', 'Dev'], 3)).toBe('Aisha, Ben, Chen and Dev')
  })

  it('merges QR module runs into one path', () => {
    expect(qrPath([[true, true, false, true]])).toBe('M0 0h2v1h-2zM3 0h1v1h-1z')
    expect(qrPath([[false], [true]], 2)).toBe('M2 3h1v1h-1z')
    expect(qrPath([])).toBe('')
  })
})

describe('Avatar', () => {
  it('shows initials and is decorative by default', () => {
    const { container } = render(<Avatar name="Aisha Khan" color={3} />)
    const avatar = container.firstElementChild
    expect(avatar).toHaveTextContent('AK')
    expect(avatar).toHaveAttribute('aria-hidden', 'true')
  })

  it('can be exposed as an image and shows a check badge when selected', () => {
    const { container } = render(<Avatar name="Ben" color={1} decorative={false} selected />)
    expect(screen.getByRole('img', { name: 'Ben' })).toBeInTheDocument()
    expect(container.querySelector('svg')).not.toBeNull()
  })
})

describe('AvatarStack', () => {
  it('shows everyone when within the limit', () => {
    render(<AvatarStack people={people.slice(0, 4)} />)
    const stack = screen.getByRole('img', { name: 'Aisha Khan, Ben, Chen Li and Dev' })
    expect(stack).toHaveTextContent('AKBCLD')
    expect(stack).not.toHaveTextContent('+')
  })

  it('caps the circles with a +N counter', () => {
    render(<AvatarStack people={people} max={4} />)
    const stack = screen.getByRole('img', { name: 'Aisha Khan, Ben, Chen Li and 3 others' })
    expect(stack).toHaveTextContent('+3')
  })
})

describe('Money', () => {
  it('formats minor units with the shared formatter', () => {
    render(<Money value={123450} currency="INR" />)
    expect(screen.getByText(formatMoney(123450, 'INR'))).toBeInTheDocument()
  })

  it('sizes the xl amount to fit from its final value, so counting up never resizes it', () => {
    const fitOf = (el: Element | null) => Number((el as HTMLElement | null)?.style.getPropertyValue('--money-fit-em'))
    const { container, rerender } = render(<Money value={0} fitValue={987654321} currency="INR" size="xl" />)
    const counting = fitOf(container.querySelector('[aria-hidden="true"]'))
    rerender(<Money value={987654321} currency="INR" size="xl" />)
    const settled = fitOf(container.querySelector('[aria-hidden="true"]'))
    expect(counting).toBe(settled)

    rerender(<Money value={230} currency="INR" size="xl" />)
    expect(fitOf(container.querySelector('[aria-hidden="true"]'))).toBeLessThan(settled)
  })

  it('passes sign and trimZeros through', () => {
    render(
      <>
        <Money value={-23050} currency="INR" sign="always" tone="positive" />
        <Money value={120000} currency="INR" trimZeros />
      </>,
    )
    expect(screen.getByText(formatMoney(-23050, 'INR', { sign: 'always' }))).toBeInTheDocument()
    expect(screen.getByText(formatMoney(120000, 'INR', { trimZeros: true }))).toBeInTheDocument()
  })

  it('keeps one readable text node for the xl hero amount', () => {
    render(<Money value={229900} currency="INR" size="xl" />)
    expect(screen.getByText(formatMoney(229900, 'INR'))).toHaveClass('visually-hidden')
  })
})

describe('Banner', () => {
  it('uses role=alert for errors and role=status otherwise', () => {
    render(
      <>
        <Banner tone="error" title="Couldn't read the bill">
          Try again
        </Banner>
        <Banner tone="warning">Check the items</Banner>
      </>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't read the billTry again")
    expect(screen.getByRole('status')).toHaveTextContent('Check the items')
  })

  it('offers dismiss and an action', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    const onAction = vi.fn()
    render(
      <Banner tone="info" onDismiss={onDismiss} action={{ label: 'Assign', onAction }}>
        2 items weren&apos;t assigned
      </Banner>,
    )
    await user.click(screen.getByRole('button', { name: 'Assign' }))
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

describe('ListRow', () => {
  it('renders a button when clickable and a plain row otherwise', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Card padding="none">
        <ListRow title="Butter Chicken" subtitle="× 2" trailing="₹495.00" onClick={onClick} chevron />
        <ListRow title="Items total" trailing="₹2,305.00" />
      </Card>,
    )
    await user.click(screen.getByRole('button', { name: /Butter Chicken/ }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /Items total/ })).not.toBeInTheDocument()
  })

  it('keeps title, subtitle and trailing apart in the accessible name', () => {
    render(<ListRow title="Gulab Jamun" subtitle="× 2" trailing="₹190.00" onClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'Gulab Jamun × 2 ₹190.00' })).toBeInTheDocument()
  })

  it('becomes list items inside a List', () => {
    render(
      <List aria-label="Items">
        <ListRow title="Paneer Tikka" />
        <ListRow title="Dal Makhani" pending />
      </List>,
    )
    const list = screen.getByRole('list', { name: 'Items' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  })
})

describe('Progress', () => {
  it('exposes the step as a progressbar', () => {
    render(<Progress current={2} total={5} />)
    const bar = screen.getByRole('progressbar', { name: 'Step 2 of 5' })
    expect(bar).toHaveAttribute('aria-valuenow', '2')
    expect(bar).toHaveAttribute('aria-valuemax', '5')
  })

  it('clamps nonsense input', () => {
    render(<Progress current={9} total={3} variant="dots" />)
    expect(screen.getByRole('progressbar', { name: 'Step 3 of 3' })).toBeInTheDocument()
  })
})

describe('QrCode', () => {
  const link = 'upi://pay?pa=aisha%40okaxis&pn=Aisha&am=712.40&cu=INR&tn=Saffron%20Table'

  it('draws the whole code as one crisp path with a 2-module quiet zone', () => {
    const { container } = render(<QrCode value={link} label="QR code to pay Aisha" />)
    const svg = screen.getByRole('img', { name: 'QR code to pay Aisha' })
    expect(container.querySelectorAll('path')).toHaveLength(1)
    const modules = encode(link, { ecc: 'M', border: 0 }).data.length
    expect(svg).toHaveAttribute('viewBox', `0 0 ${modules + 4} ${modules + 4}`)
    expect(svg).toHaveAttribute('shape-rendering', 'crispEdges')
    expect(container.querySelector('path')?.getAttribute('d')).toMatch(/^M2 2h/)
  })
})

describe('Receipt', () => {
  it('composes rows and dashed dividers', () => {
    render(
      <Receipt aria-label="Your split">
        <Receipt.Row label="Items" value="₹2,305.00" />
        <Receipt.Divider />
        <Receipt.Row label="Total" value="₹2,299.00" emphasis="strong" />
      </Receipt>,
    )
    expect(screen.getByLabelText('Your split')).toHaveTextContent('Items₹2,305.00Total₹2,299.00')
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })
})

describe('feedback & layout', () => {
  it('SuccessCheck is decorative unless labelled', () => {
    const { container, rerender } = render(<SuccessCheck />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    rerender(<SuccessCheck label="All settled" />)
    expect(screen.getByRole('img', { name: 'All settled' })).toBeInTheDocument()
  })

  it('Skeleton placeholders are hidden from assistive tech', () => {
    const { container } = render(
      <>
        <Skeleton width={120} />
        <SkeletonRows count={4} />
      </>,
    )
    const hidden = container.querySelectorAll('[aria-hidden="true"]')
    expect(hidden.length).toBeGreaterThanOrEqual(2)
    expect(container.firstElementChild).toHaveStyle({ width: '120px' })
  })

  it('Spinner is only announced when labelled', () => {
    const { container, rerender } = render(<Spinner />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    rerender(<Spinner label="Reading the bill" />)
    expect(screen.getByRole('status', { name: 'Reading the bill' })).toBeInTheDocument()
  })

  it('EmptyState renders title, text and action', () => {
    render(<EmptyState title="Add the first item" text="Type what's on the bill." action={<button>Add item</button>} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Add the first item' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add item' })).toBeInTheDocument()
  })

  it('EmptyState shows an illustration instead of the icon disc', () => {
    const { container } = render(
      <EmptyState
        icon={<svg data-testid="icon" />}
        illustration={<svg data-testid="art" />}
        title="No groups yet"
        headingLevel={3}
      />,
    )
    expect(screen.getByRole('heading', { level: 3, name: 'No groups yet' })).toBeInTheDocument()
    expect(screen.getByTestId('art').parentElement).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByTestId('icon')).toBeNull()
    expect(container.querySelectorAll('svg')).toHaveLength(1)
  })

  it('AppFrame marks the app column for the desktop frame', () => {
    render(
      <AppFrame className="extra">
        <p>Inside</p>
      </AppFrame>,
    )
    const frame = screen.getByText('Inside').parentElement
    expect(frame).toHaveAttribute('data-app-frame')
    expect(frame).toHaveClass('extra')
  })

  it('ScreenTransition passes a tab cross-fade through', () => {
    render(
      <ScreenTransition direction="fade">
        <Screen>
          <PageTitle title="Groups" />
        </Screen>
      </ScreenTransition>,
    )
    expect(screen.getByRole('main').closest('[data-nav]')).toHaveAttribute('data-nav', 'fade')
  })

  it('Screen renders header, main and a toast-anchored footer, and focuses the h1', () => {
    render(
      <ScreenTransition direction="forward">
        <Screen
          header={<TopBar onBack={() => {}} progress={{ current: 1, total: 5 }} />}
          footer={
            <ActionBar hint="Add at least one item">
              <button>Looks good</button>
            </ActionBar>
          }
        >
          <PageTitle title="Check the items" subtitle="Tap anything that looks off." />
        </Screen>
      </ScreenTransition>,
    )
    const heading = screen.getByRole('heading', { level: 1, name: 'Check the items' })
    expect(heading).toHaveFocus()
    expect(screen.getByRole('main')).toContainElement(heading)
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Step 1 of 5' })).toBeInTheDocument()
    expect(screen.getByText('Add at least one item')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('button', { name: 'Looks good' }).closest('[data-toast-anchor]')).not.toBeNull()
    expect(screen.getByRole('main').closest('[data-nav]')).toHaveAttribute('data-nav', 'forward')
  })
})
