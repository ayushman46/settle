import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Minor } from '../domain/types'
import { MAX_MINOR } from '../lib/money'
import { AmountHero, type AmountHeroProps } from './AmountHero'
import { amountInWords, indianNumberWords } from './amountWords'

describe('indianNumberWords', () => {
  it.each([
    [0, 'zero'],
    [7, 'seven'],
    [15, 'fifteen'],
    [20, 'twenty'],
    [45, 'forty-five'],
    [100, 'one hundred'],
    [101, 'one hundred one'],
    [999, 'nine hundred ninety-nine'],
    [1000, 'one thousand'],
    [1001, 'one thousand one'],
    [12_345, 'twelve thousand three hundred forty-five'],
    [1_00_000, 'one lakh'],
    [2_40_000, 'two lakh forty thousand'],
    [12_34_567, 'twelve lakh thirty-four thousand five hundred sixty-seven'],
    [1_23_45_678, 'one crore twenty-three lakh forty-five thousand six hundred seventy-eight'],
    [1_00_00_00_000, 'one hundred crore'],
    [10_00_00_00_000, 'one thousand crore'],
    [99_99_99_99_999, 'nine thousand nine hundred ninety-nine crore ninety-nine lakh ninety-nine thousand nine hundred ninety-nine'],
  ])('%i → %s', (n, words) => {
    expect(indianNumberWords(n)).toBe(words)
  })
})

describe('amountInWords', () => {
  it('reads rupees and paise', () => {
    expect(amountInWords(2_40_000, 'INR')).toBe('Two thousand four hundred rupees')
    expect(amountInWords(2_40_050, 'INR')).toBe('Two thousand four hundred rupees and fifty paise')
    expect(amountInWords(100, 'INR')).toBe('One rupee')
    expect(amountInWords(101, 'INR')).toBe('One rupee and one paisa')
    expect(amountInWords(1, 'INR')).toBe('One paisa')
    expect(amountInWords(75, 'INR')).toBe('Seventy-five paise')
    expect(amountInWords(MAX_MINOR, 'INR')).toBe('One thousand crore rupees')
  })

  it('stays quiet for other currencies and for nothing to read', () => {
    expect(amountInWords(2_40_000, 'USD')).toBeNull()
    expect(amountInWords(null, 'INR')).toBeNull()
    expect(amountInWords(0, 'INR')).toBeNull()
    expect(amountInWords(-500, 'INR')).toBeNull()
    expect(amountInWords(12.5, 'INR')).toBeNull()
  })
})

function Harness({ initial = null, onChangeSpy, ...rest }: Partial<AmountHeroProps> & { initial?: Minor | null; onChangeSpy?: (v: Minor | null) => void }) {
  const [value, setValue] = useState<Minor | null>(initial)
  return (
    <>
      <AmountHero
        currency="INR"
        {...rest}
        value={value}
        onChange={(next) => {
          onChangeSpy?.(next)
          setValue(next)
        }}
      />
      <output data-testid="value">{value === null ? 'null' : String(value)}</output>
    </>
  )
}

const amountBox = () => screen.getByRole('textbox', { name: 'Amount' })
const valueOut = () => screen.getByTestId('value').textContent

describe('AmountHero', () => {
  it('turns typing into minor units, grouped as typed, with the amount in words', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(amountBox(), '240000')
    expect(valueOut()).toBe('24000000')
    expect(amountBox()).toHaveValue('2,40,000')
    expect(screen.getByText('Two lakh forty thousand rupees')).toBeInTheDocument()
  })

  it('keeps a half-typed decimal while the amount is the same', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(amountBox(), '12.')
    expect(valueOut()).toBe('1200')
    expect(amountBox()).toHaveValue('12.')
    await user.type(amountBox(), '5')
    expect(valueOut()).toBe('1250')
    expect(amountBox()).toHaveValue('12.5')
  })

  it('never takes more decimals than the currency has', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(amountBox(), '9.999')
    expect(amountBox()).toHaveValue('9.99')
    expect(valueOut()).toBe('999')
  })

  it('reports an emptied field as null', async () => {
    const user = userEvent.setup()
    const onChangeSpy = vi.fn()
    render(<Harness initial={5000} onChangeSpy={onChangeSpy} />)
    expect(amountBox()).toHaveValue('50')
    await user.clear(amountBox())
    expect(onChangeSpy).toHaveBeenLastCalledWith(null)
    expect(valueOut()).toBe('null')
    expect(screen.queryByText(/rupees/)).not.toBeInTheDocument()
  })

  it('adopts outside changes (a prefill) and re-expresses the amount in a new currency', () => {
    const { rerender } = render(<AmountHero value={null} currency="INR" onChange={() => {}} />)
    expect(amountBox()).toHaveValue('')
    rerender(<AmountHero value={84000} currency="INR" onChange={() => {}} />)
    expect(amountBox()).toHaveValue('840')
    rerender(<AmountHero value={84050} currency="INR" onChange={() => {}} />)
    expect(amountBox()).toHaveValue('840.50')
    rerender(<AmountHero value={841} currency="JPY" onChange={() => {}} />)
    expect(amountBox()).toHaveValue('841')
    expect(screen.queryByText(/rupees/)).not.toBeInTheDocument()
  })

  it('shows values it cannot type back without looping', () => {
    const { rerender } = render(<AmountHero value={-500} currency="INR" onChange={() => {}} />)
    expect(amountBox()).toHaveValue('')
    rerender(<AmountHero value={MAX_MINOR * 10} currency="INR" onChange={() => {}} />)
    expect(amountBox()).toHaveValue('10,00,00,00,000')
    rerender(<AmountHero value={1250.4} currency="INR" onChange={() => {}} />)
    expect(amountBox()).toHaveValue('12.50')
  })

  it('offers a currency pill when the screen can change currency', async () => {
    const user = userEvent.setup()
    const onCurrencyClick = vi.fn()
    const { rerender } = render(<AmountHero value={null} currency="INR" onChange={() => {}} onCurrencyClick={onCurrencyClick} />)
    const pill = screen.getByRole('button', { name: 'Currency: INR. Change' })
    expect(pill).toHaveTextContent('₹INR')
    await user.click(pill)
    expect(onCurrencyClick).toHaveBeenCalledTimes(1)
    rerender(<AmountHero value={null} currency="INR" onChange={() => {}} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('lets a hint or an error replace the words', () => {
    const { rerender } = render(<AmountHero value={1000} currency="INR" onChange={() => {}} hint="Paid on 18 Oct" />)
    expect(screen.getByText('Paid on 18 Oct')).toBeInTheDocument()
    expect(screen.queryByText('Ten rupees')).not.toBeInTheDocument()
    rerender(<AmountHero value={1000} currency="INR" onChange={() => {}} error="Enter an amount above zero." />)
    expect(screen.getByText('Enter an amount above zero.')).toBeInTheDocument()
    expect(screen.queryByText('Ten rupees')).not.toBeInTheDocument()
    expect(amountBox()).toHaveAttribute('aria-invalid', 'true')
  })

  it('can take focus straight away and be renamed', () => {
    render(<AmountHero value={null} currency="INR" onChange={() => {}} autoFocus label="Rent amount" />)
    expect(screen.getByRole('textbox', { name: 'Rent amount' })).toHaveFocus()
  })

  it('keeps the words away from assistive tech (the digits already say it)', () => {
    render(<AmountHero value={1000} currency="INR" onChange={() => {}} />)
    expect(screen.getByText('Ten rupees')).toHaveAttribute('aria-hidden', 'true')
  })
})
