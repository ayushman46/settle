import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, removeFriend, resetDataForTests, updateFriend, updateProfile } from '../data'
import { ME_ID, type Friend } from '../domain/types'
import { FriendAvatar } from './FriendAvatar'
import { FriendChip } from './FriendChip'
import { friendLabel, friendObjectLabel, ME_LABEL, UNKNOWN_FRIEND_LABEL } from './friendName'

beforeEach(() => {
  resetDataForTests()
})

afterEach(() => {
  resetDataForTests()
})

const riyaRecord: Friend = {
  id: 'f-riya',
  name: 'Riya Sharma',
  color: 3,
  upiId: null,
  phone: null,
  createdAt: 1,
  lastUsedAt: 1,
}

describe('friendLabel', () => {
  it('calls the owner "You", a friend by name and a missing person "Someone"', () => {
    expect(friendLabel(ME_ID, { name: 'Ayush' })).toBe(ME_LABEL)
    expect(friendLabel(ME_ID, null)).toBe('You')
    expect(friendLabel('x', { name: '  Riya ' })).toBe('Riya')
    expect(friendLabel('x', null)).toBe(UNKNOWN_FRIEND_LABEL)
    expect(friendLabel('x', { name: '   ' })).toBe('Someone')
    expect(friendLabel(undefined, undefined)).toBe('Someone')
  })

  it('has a lower-case object form for phrases', () => {
    expect(friendObjectLabel(ME_ID, { name: 'Ayush' })).toBe('you')
    expect(friendObjectLabel('x', { name: 'Riya' })).toBe('Riya')
    expect(friendObjectLabel('x', null)).toBe('Someone')
  })
})

describe('FriendAvatar', () => {
  it('looks a friend up by id and shows their initials and colour', () => {
    const riya = addFriend({ name: 'Riya Sharma' })
    const { container } = render(<FriendAvatar friendId={riya.id} decorative={false} />)
    expect(screen.getByRole('img', { name: 'Riya Sharma' })).toBeInTheDocument()
    expect(container).toHaveTextContent('RS')
  })

  it('is decorative unless asked otherwise', () => {
    const riya = addFriend({ name: 'Riya' })
    const { container } = render(<FriendAvatar friendId={riya.id} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('names the owner "You" while keeping their own initials', () => {
    updateProfile({ name: 'Ayush Mitra' })
    const { container } = render(<FriendAvatar friendId={ME_ID} showName />)
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(container).toHaveTextContent('AM')
  })

  it('shows a removed friend as a neutral "Someone"', () => {
    const { container } = render(<FriendAvatar friendId="gone" showName />)
    expect(screen.getByText('Someone')).toBeInTheDocument()
    expect(container).toHaveTextContent('?')
  })

  it('treats friend={null} as someone removed, without a lookup', () => {
    const riya = addFriend({ name: 'Riya' })
    render(<FriendAvatar friend={null} friendId={riya.id} decorative={false} />)
    expect(screen.getByRole('img', { name: 'Someone' })).toBeInTheDocument()
  })

  it('uses a passed record as is', () => {
    render(<FriendAvatar friend={riyaRecord} showName />)
    expect(screen.getByText('Riya Sharma')).toBeInTheDocument()
  })

  it('follows renames and removals live', () => {
    const sam = addFriend({ name: 'Sam' })
    render(<FriendAvatar friendId={sam.id} showName />)
    expect(screen.getByText('Sam')).toBeInTheDocument()
    act(() => {
      updateFriend(sam.id, { name: 'Samir' })
    })
    expect(screen.getByText('Samir')).toBeInTheDocument()
    act(() => {
      removeFriend(sam.id)
    })
    expect(screen.getByText('Someone')).toBeInTheDocument()
  })

  it('marks a selected person', () => {
    const riya = addFriend({ name: 'Riya' })
    const { container } = render(<FriendAvatar friendId={riya.id} showName selected />)
    // Avatar draws its check badge only when selected.
    expect(container.querySelector('svg')).not.toBeNull()
  })
})

describe('FriendChip', () => {
  it('shows the person and removes them with a labelled ✕', async () => {
    const user = userEvent.setup()
    const riya = addFriend({ name: 'Riya' })
    const onRemove = vi.fn()
    render(<FriendChip friendId={riya.id} onRemove={onRemove} />)
    expect(screen.getByText('Riya')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove Riya' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('says "Remove You" for the owner and "Remove Someone" for a removed friend', () => {
    render(
      <>
        <FriendChip friendId={ME_ID} onRemove={() => {}} />
        <FriendChip friendId="gone" onRemove={() => {}} />
      </>,
    )
    expect(screen.getByRole('button', { name: 'Remove You' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Someone' })).toBeInTheDocument()
  })

  it('can be a button itself, with trailing detail', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<FriendChip friend={riyaRecord} onClick={onClick} trailing="₹540" />)
    const chip = screen.getByRole('button', { name: /Riya Sharma/ })
    expect(chip).toHaveTextContent('₹540')
    await user.click(chip)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is plain text without handlers', () => {
    render(<FriendChip friend={riyaRecord} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
