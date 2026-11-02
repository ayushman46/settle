/**
 * Kannada reads like Kannada: every namespace is there, Copy is one word everywhere, “Just say it”
 * has its Kannada name, and "you" put into a name slot never doubles its ending.
 */
import { describe, expect, it } from 'vitest'
import { formatMessage } from '../format'
import type { Messages } from '../types'
import { KN } from './index'

const english = import.meta.glob<Record<string, Messages>>(['../en/*.ts', '!../en/index.ts', '!../en/eager.ts'], { eager: true })
const kannada = import.meta.glob<Record<string, Messages>>(['./*.ts', '!./index.ts', '!./*.test.ts'], { eager: true })
const fileName = (path: string): string => path.split('/').at(-1) ?? path
const say = (key: string, vars: Record<string, string | number> = {}): string => formatMessage(KN[key] ?? '', vars, 'kn-IN')

describe('the Kannada catalog', () => {
  it('has every namespace English has, all merged into the catalog', () => {
    const missing = Object.keys(english).map(fileName).filter((name) => !Object.keys(kannada).map(fileName).includes(name))
    expect(missing).toEqual([])
    const unmerged = Object.values(kannada).flatMap((mod) => Object.values(mod).flatMap((messages) => Object.keys(messages).filter((key) => KN[key] === undefined)))
    expect(unmerged).toEqual([])
  })

  it('uses one word for Copy, and Kannada names for features', () => {
    expect(say('common.action.copy')).toBe('ನಕಲಿಸಿ')
    const mixed = Object.entries(KN).filter(([, message]) => message.includes('ಕಾಪಿ') || message.includes('Just say it'))
    expect(mixed.map(([key]) => key)).toEqual([])
    expect(say('activity.title')).toBe(say('app.tab.activity'))
  })

  it('never puts “you” where an ending would double it', () => {
    const you = say('kit.name.you.object')
    const filled = [
      say('kit.split.amountFor', { name: you }),
      say('kit.split.percentFor', { name: you }),
      say('kit.split.sharesFor', { name: you }),
      say('kit.split.hadFor', { name: you }),
      say('kit.collect.waiting', { names: you }),
      say('kit.transfer.record.aria', { amount: '₹500', from: 'Kavya', to: you }),
      say('kit.transfer.record.aria', { amount: '₹500', from: you, to: 'Kavya' }),
      say('bill.result.person.owes', { name: you, amount: '₹500' }),
    ]
    for (const line of filled) expect(line).not.toMatch(/(ನೀವು|ನಿಮ್ಮನ್ನು) (ಅವರ|ಗೆ|ಗಾಗಿ|ನಿಂದ)/)
    expect(say('bill.result.person.owes', { name: you, amount: '₹500' })).toBe('ನೀವು ಪಡೆಯಬೇಕಾದದ್ದು ₹500')
    expect(say('kit.shares.status.owesYou')).toBe('ನಿಮಗೆ ಕೊಡಬೇಕು')
    expect(say('kit.shares.qr.aria', { name: 'Kavya', amount: '₹400' })).toContain('Kavya ಅವರು ನಿಮಗೆ ₹400')
  })
})
