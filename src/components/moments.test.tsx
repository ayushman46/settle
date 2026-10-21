import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetHapticsForTests } from '../lib/haptics'
import { GROUP_EMOJIS } from './emoji'
import { EmojiPicker } from './EmojiPicker'
import { overlayCount } from './overlayStack'
import { SuccessBurst } from './SuccessBurst'

const vibrate = vi.fn<(pattern: VibratePattern) => boolean>(() => true)

beforeEach(() => {
  vibrate.mockClear()
  resetHapticsForTests()
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true })
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'vibrate')
  vi.useRealTimers()
})

function Picker({ initial = '✈️', onChange }: { initial?: string; onChange?: (e: string) => void }) {
  const [emoji, setEmoji] = useState(initial)
  return (
    <EmojiPicker
      label="Group emoji"
      value={emoji}
      onChange={(next) => {
        onChange?.(next)
        setEmoji(next)
      }}
    />
  )
}

describe('EmojiPicker', () => {
  it('offers 24 curated emojis as a radiogroup', () => {
    expect(GROUP_EMOJIS).toHaveLength(24)
    expect(new Set(GROUP_EMOJIS).size).toBe(24)
    render(<Picker />)
    expect(screen.getByRole('radiogroup', { name: 'Group emoji' })).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(24)
    expect(radios.filter((r) => r.getAttribute('aria-checked') === 'true').map((r) => r.textContent)).toEqual(['✈️'])
    expect(radios.filter((r) => r.tabIndex === 0)).toHaveLength(1)
  })

  it('picks on tap with a haptic', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Picker onChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: '🍕' }))
    expect(onChange).toHaveBeenCalledWith('🍕')
    expect(screen.getByRole('radio', { name: '🍕' })).toHaveAttribute('aria-checked', 'true')
    expect(vibrate).toHaveBeenCalledTimes(1)
  })

  it('moves in two dimensions with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<Picker />)
    await user.tab()
    expect(screen.getByRole('radio', { name: '✈️' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: GROUP_EMOJIS[6] })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: GROUP_EMOJIS[7] })).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{ArrowUp}{ArrowLeft}')
    expect(screen.getByRole('radio', { name: GROUP_EMOJIS[0] })).toHaveFocus()
    await user.keyboard('{ArrowLeft}{ArrowUp}')
    expect(screen.getByRole('radio', { name: GROUP_EMOJIS[0] })).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{End}')
    expect(screen.getByRole('radio', { name: GROUP_EMOJIS[23] })).toHaveFocus()
    await user.keyboard('{ArrowDown}{ArrowRight}')
    expect(screen.getByRole('radio', { name: GROUP_EMOJIS[23] })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('radio', { name: GROUP_EMOJIS[0] })).toHaveAttribute('aria-checked', 'true')
  })

  it('shows a custom value first and dedupes options', () => {
    render(<EmojiPicker value="🦄" onChange={() => {}} options={['🍕', '🍕', '☕']} />)
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['🦄', '🍕', '☕'])
    expect(screen.getByRole('radio', { name: '🦄' })).toHaveAttribute('aria-checked', 'true')
  })

  it('keeps the first option tabbable when nothing is picked', () => {
    render(<EmojiPicker value="" onChange={() => {}} options={['🍕', '☕']} columns={2} />)
    expect(screen.getByRole('radio', { name: '🍕' }).tabIndex).toBe(0)
  })
})

describe('SuccessBurst', () => {
  it('takes focus as a named dialog, makes the page inert and plays a success haptic', () => {
    render(
      <>
        <button>Behind</button>
        <SuccessBurst title="Split saved" subtitle="Riya and Sam can pay you now" amount="₹2,766" />
      </>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Split saved' })
    expect(dialog).toHaveFocus()
    expect(dialog).toHaveTextContent('₹2,766')
    expect(dialog).toHaveTextContent('Riya and Sam can pay you now')
    expect(overlayCount()).toBe(1)
    expect(screen.getByText('Behind').closest('[inert]')).not.toBeNull()
    expect(vibrate).toHaveBeenCalledWith([12, 60, 24])
  })

  it('finishes once after its duration', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<SuccessBurst title="Pro unlocked" onDone={onDone} />)
    act(() => vi.advanceTimersByTime(1199))
    expect(onDone).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onDone).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('can be skipped with a tap or a key, and traps Tab', () => {
    const onDone = vi.fn()
    const { unmount } = render(<SuccessBurst title="Payment recorded" onDone={onDone} duration={5000} />)
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(onDone).not.toHaveBeenCalled()
    fireEvent.keyDown(dialog, { key: 'Enter' })
    expect(onDone).toHaveBeenCalledTimes(1)
    unmount()

    const onTap = vi.fn()
    render(<SuccessBurst title="All settled" onDone={onTap} duration={5000} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('releases the page and returns focus when it leaves', () => {
    function Host() {
      const [show, setShow] = useState(false)
      return (
        <>
          <button onClick={() => setShow(true)}>Save</button>
          {show && <SuccessBurst title="Saved" onDone={() => setShow(false)} />}
        </>
      )
    }
    render(<Host />)
    const save = screen.getByRole('button', { name: 'Save' })
    save.focus()
    fireEvent.click(save)
    expect(screen.getByRole('dialog')).toHaveFocus()
    fireEvent.click(screen.getByRole('dialog'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(overlayCount()).toBe(0)
    expect(save).toHaveFocus()
    expect(save.closest('[inert]')).toBeNull()
  })
})
