import { describe, expect, it } from 'vitest'
import { ME_ID } from '../../domain/types'
import { withOwnerAvatar } from './ownerAvatar'

describe('withOwnerAvatar', () => {
  const people = [
    { id: ME_ID, name: 'You', color: 0 },
    { id: 'r', name: 'Riya', color: 1 },
  ]

  it("gives the owner their own initials' name and leaves everyone else alone", () => {
    expect(withOwnerAvatar(people, 'Ayush')).toEqual([
      { id: ME_ID, name: 'You', color: 0, avatarName: 'Ayush' },
      { id: 'r', name: 'Riya', color: 1 },
    ])
  })

  it('keeps the label "You" so screen readers still hear it', () => {
    expect(withOwnerAvatar(people, 'Ayush')[0]?.name).toBe('You')
  })

  it('changes nothing while the owner has no saved name', () => {
    expect(withOwnerAvatar(people, null)).toEqual(people)
  })
})
