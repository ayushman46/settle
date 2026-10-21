import { describe, expect, it } from 'vitest'
import { ME_ID } from '../domain/types'
import { outsideName } from './names'
import { FRIENDS, makeFriend, makeProfile } from './testing'

describe('outsideName', () => {
  it("uses the owner's profile name, never \"You\"", () => {
    expect(outsideName(ME_ID, FRIENDS, makeProfile({ name: 'Ayush' }), 'Me')).toBe('Ayush')
    expect(outsideName(ME_ID, FRIENDS, makeProfile({ name: '  Ayush   K ' }), 'Me')).toBe('Ayush K')
  })

  it('falls back to the owner’s friend record, then the fallback', () => {
    const friends = { ...FRIENDS, [ME_ID]: makeFriend(ME_ID, 'Ayush Kumar') }
    for (const name of ['You', 'me', 'ME', 'Myself', 'I', '', '   ']) {
      expect(outsideName(ME_ID, friends, makeProfile({ name }), 'Me')).toBe('Ayush Kumar')
      expect(outsideName(ME_ID, FRIENDS, makeProfile({ name }), 'Your friend')).toBe('Your friend')
    }
  })

  it('names friends as saved, with a fallback for unknown ids', () => {
    expect(outsideName('neha', FRIENDS, makeProfile(), 'Friend')).toBe('Neha Sharma')
    expect(outsideName('gone', FRIENDS, makeProfile(), 'Friend')).toBe('Friend')
    expect(outsideName('blank', { blank: makeFriend('blank', '   ') }, makeProfile(), 'Friend')).toBe('Friend')
  })
})
