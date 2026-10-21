import { createRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetHapticsForTests } from '../lib/haptics'
import { currencySymbol } from '../lib/money'
import { AmountInput } from './AmountInput'
import { Button } from './Button'
import { Chip } from './Chip'
import { IconButton } from './IconButton'
import { PersonToggle } from './PersonToggle'
import { Stepper } from './Stepper'
import { TextField } from './TextField'

const vibrate = vi.fn<(pattern: VibratePattern) => boolean>(() => true)

beforeEach(() => {
  vibrate.mockClear()
  resetHapticsForTests()
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true })
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'vibrate')
})

describe('Button', () => {
  it('defaults to type="button" and forwards clicks', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Next</Button>)
    const button = screen.getByRole('button', { name: 'Next' })
    expect(button).toHaveAttribute('type', 'button')
    await user.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('loading disables the button and marks it busy', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Share the split
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Share the split' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders every variant as a plain button', () => {
    render(
      <>
        {(['primary', 'secondary', 'tonal', 'ghost', 'danger', 'accent'] as const).map((variant) => (
          <Button key={variant} variant={variant} size="md">
            {variant}
          </Button>
        ))}
      </>,
    )
    expect(screen.getAllByRole('button')).toHaveLength(6)
    expect(screen.getByRole('button', { name: 'tonal' })).toHaveAttribute('type', 'button')
  })

  it('forwards refs and keeps icons out of the accessible name', () => {
    const ref = createRef<HTMLButtonElement>()
    render(
      <Button ref={ref} iconStart={<svg data-testid="icon" />}>
        Scan a bill
      </Button>,
    )
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Scan a bill' }))
    expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('IconButton', () => {
  it('is named by its label', () => {
    render(
      <IconButton label="Remove Ben">
        <svg />
      </IconButton>,
    )
    expect(screen.getByRole('button', { name: 'Remove Ben' })).toBeInTheDocument()
  })
})

describe('Stepper', () => {
  function Controlled({ initial = 1, min = 1, max = 3 }: { initial?: number; min?: number; max?: number }) {
    const [value, setValue] = useState(initial)
    return <Stepper label="Quantity" value={value} min={min} max={max} onChange={setValue} />
  }

  it('is a labelled group with named buttons and a live value', () => {
    render(<Controlled />)
    expect(screen.getByRole('group', { name: 'Quantity' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('1')
  })

  it('stays within bounds', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    const dec = screen.getByRole('button', { name: 'Decrease quantity' })
    const inc = screen.getByRole('button', { name: 'Increase quantity' })
    const value = screen.getByRole('status')

    expect(dec).toHaveAttribute('aria-disabled', 'true')
    await user.click(dec)
    expect(value).toHaveTextContent('1')

    await user.click(inc)
    await user.click(inc)
    expect(value).toHaveTextContent('3')
    expect(inc).toHaveAttribute('aria-disabled', 'true')
    await user.click(inc)
    expect(value).toHaveTextContent('3')
    expect(dec).not.toHaveAttribute('aria-disabled')
  })

  it('never calls onChange at a bound and keeps focus on the button', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Stepper label="Shares for Aisha" value={20} min={1} max={20} onChange={onChange} />)
    const inc = screen.getByRole('button', { name: 'Increase shares for Aisha' })
    await user.click(inc)
    expect(onChange).not.toHaveBeenCalled()
    expect(inc).toHaveFocus()
  })

  it('supports arrow keys and plays a tap haptic per change', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    screen.getByRole('button', { name: 'Increase quantity' }).focus()
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('status')).toHaveTextContent('2')
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getByRole('status')).toHaveTextContent('1')
    expect(vibrate).toHaveBeenCalledTimes(2)
    expect(vibrate).toHaveBeenCalledWith(8)
  })
})

describe('AmountInput', () => {
  function Controlled({ onText }: { onText?: (text: string) => void }) {
    const [value, setValue] = useState('')
    return (
      <AmountInput
        label="Amount paid"
        currency="INR"
        value={value}
        placeholder="2,299.00"
        onChange={(text) => {
          onText?.(text)
          setValue(text)
        }}
      />
    )
  }

  it('emits the typed text with a decimal keypad', async () => {
    const user = userEvent.setup()
    const onText = vi.fn()
    render(<Controlled onText={onText} />)
    const input = screen.getByRole('textbox', { name: 'Amount paid' })
    expect(input).toHaveAttribute('inputmode', 'decimal')

    await user.type(input, '1,234.5')
    expect(onText).toHaveBeenLastCalledWith('1,234.5')
    expect(input).toHaveValue('1,234.5')
  })

  it('drops characters that cannot be part of an amount', async () => {
    const user = userEvent.setup()
    const onText = vi.fn()
    render(<Controlled onText={onText} />)
    const input = screen.getByRole('textbox', { name: 'Amount paid' })
    await user.click(input)
    await user.paste('₹ 2,299.00 only')
    expect(input).toHaveValue('2,299.00')
    // Handed back plain (no grouping comma), like a typed amount.
    expect(onText).toHaveBeenLastCalledWith('2299.00')
  })

  it('reads a pasted amount as a whole, the way bank and UPI messages write it', async () => {
    const user = userEvent.setup()
    const onText = vi.fn()
    render(<Controlled onText={onText} />)
    const input = screen.getByRole('textbox', { name: 'Amount paid' })

    for (const [pasted, raw] of [
      ['₹2,299', '2299'],
      ['Rs 1,500', '1500'],
      ['2,299/-', '2299'],
      ['1,234.50', '1234.50'],
      ['₹ 2,299.00 only', '2299.00'],
    ] as const) {
      await user.clear(input)
      await user.paste(pasted)
      expect(onText).toHaveBeenLastCalledWith(raw)
    }
    expect(input).toHaveValue('2,299.00')
  })

  it('keeps typing keystroke by keystroke: a comma typed after one digit is a decimal point', async () => {
    const user = userEvent.setup()
    const onText = vi.fn()
    render(<Controlled onText={onText} />)
    await user.type(screen.getByRole('textbox', { name: 'Amount paid' }), '1,500')
    expect(onText).toHaveBeenLastCalledWith('1,500')
  })

  it('shows the currency symbol and the placeholder', () => {
    render(<Controlled />)
    expect(screen.getAllByText(currencySymbol('INR')).length).toBeGreaterThan(0)
    expect(screen.getByRole('textbox', { name: 'Amount paid' })).toHaveAttribute('placeholder', '2,299.00')
  })

  it('selects everything on focus so typing replaces the prefilled value', async () => {
    function Prefilled() {
      const [value, setValue] = useState('2299.00')
      return <AmountInput label="Amount paid" currency="INR" value={value} onChange={setValue} />
    }
    render(<Prefilled />)
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Amount paid' })
    input.focus()
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    expect(input).toHaveValue('2,299.00')
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe('2,299.00'.length)
  })

  it('groups the digits as they are typed but hands back the raw amount', async () => {
    const user = userEvent.setup()
    const onText = vi.fn()
    function Typed() {
      const [value, setValue] = useState('')
      return (
        <AmountInput
          label="Amount paid"
          currency="INR"
          value={value}
          onChange={(text) => {
            onText(text)
            setValue(text)
          }}
        />
      )
    }
    render(<Typed />)
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Amount paid' })
    // (Grouped the same way in en-US and en-IN.)
    await user.type(input, '12345.5')
    expect(input).toHaveValue('12,345.5')
    expect(onText).toHaveBeenLastCalledWith('12345.5')

    // Backspace over a grouping separator takes the digit before it, like payments apps.
    await user.clear(input)
    await user.type(input, '2299')
    expect(input).toHaveValue('2,299')
    input.setSelectionRange(2, 2) // "2,|299"
    await user.keyboard('{Backspace}')
    expect(input).toHaveValue('299')
    expect(onText).toHaveBeenLastCalledWith('299')
  })

  it('can show the amount exactly as typed', async () => {
    const user = userEvent.setup()
    function Ungrouped() {
      const [value, setValue] = useState('')
      return <AmountInput label="Amount paid" currency="INR" value={value} onChange={setValue} grouping={false} />
    }
    render(<Ungrouped />)
    const input = screen.getByRole('textbox', { name: 'Amount paid' })
    await user.type(input, '2299')
    expect(input).toHaveValue('2299')
  })

  it('wires the error message to the input', () => {
    render(<AmountInput label="Price" size="field" currency="USD" value="" onChange={() => {}} error="Enter a price" />)
    const input = screen.getByRole('textbox', { name: 'Price' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Enter a price')
  })

  it('shows a visible label in field size', () => {
    render(<AmountInput label="Price for this line" size="field" currency="USD" value="" onChange={() => {}} />)
    expect(screen.getByText('Price for this line')).not.toHaveClass('visually-hidden')
  })
})

describe('TextField', () => {
  it('associates the visible label and hint', () => {
    render(<TextField label="Name" hint="Up to 24 characters" />)
    const input = screen.getByRole('textbox', { name: 'Name' })
    expect(input).toHaveAccessibleDescription('Up to 24 characters')
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('marks errors as invalid and describes them instead of the hint', () => {
    render(<TextField label="Name" hint="Up to 24 characters" error="Ben is already here" />)
    const input = screen.getByRole('textbox', { name: 'Name' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Ben is already here')
    expect(screen.queryByText('Up to 24 characters')).not.toBeInTheDocument()
  })

  it('forwards refs and input props, and renders adornments', async () => {
    const user = userEvent.setup()
    const ref = createRef<HTMLInputElement>()
    const onAdd = vi.fn()
    render(
      <TextField
        ref={ref}
        label="Name"
        enterKeyHint="done"
        endAdornment={
          <IconButton label="Add person" onClick={onAdd}>
            <svg />
          </IconButton>
        }
      />,
    )
    expect(ref.current).toBe(screen.getByRole('textbox', { name: 'Name' }))
    expect(ref.current).toHaveAttribute('enterkeyhint', 'done')
    await user.click(screen.getByRole('button', { name: 'Add person' }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })
})

describe('Chip', () => {
  it('is a plain action without `selected`', () => {
    render(<Chip>Aisha</Chip>)
    expect(screen.getByRole('button', { name: 'Aisha' })).not.toHaveAttribute('aria-pressed')
  })

  it('is a toggle with `selected` and plays a select haptic', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Chip selected={false} onClick={onClick}>
        Everyone
      </Chip>,
    )
    const chip = screen.getByRole('button', { name: 'Everyone' })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    await user.click(chip)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(vibrate).toHaveBeenCalledWith(12)
  })
})

describe('PersonToggle', () => {
  it('toggles aria-pressed and shows meta', async () => {
    const user = userEvent.setup()
    function Controlled() {
      const [on, setOn] = useState(false)
      return (
        <PersonToggle
          name="Aisha Khan"
          color={2}
          selected={on}
          onToggle={() => setOn(!on)}
          meta={on ? '₹247.50' : undefined}
        />
      )
    }
    render(<Controlled />)
    const toggle = screen.getByRole('button', { name: /Aisha Khan/ })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(toggle).toHaveAccessibleName('Aisha Khan ₹247.50')
    expect(vibrate).toHaveBeenCalledWith(12)
  })

  it('renders trailing controls outside the toggle button', () => {
    render(
      <PersonToggle
        name="Ben"
        color={0}
        selected
        onToggle={() => {}}
        trailing={<Stepper label="Shares for Ben" value={1} onChange={() => {}} />}
      />,
    )
    const toggle = screen.getByRole('button', { name: /Ben/, pressed: true })
    expect(toggle).not.toContainElement(screen.getByRole('group', { name: 'Shares for Ben' }))
  })
})
