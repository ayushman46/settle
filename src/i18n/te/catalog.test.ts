/**
 * Telugu reads like Telugu: every namespace is there, Undo never says "take it back", "you" put
 * into a name slot never doubles its ending or flips who owes whom, and where a complaint goes
 * takes no loose "కి".
 */
import { describe, expect, it } from 'vitest'
import { formatMessage } from '../format'
import type { Messages } from '../types'
import { TE } from './index'

const english = import.meta.glob<Record<string, Messages>>(['../en/*.ts', '!../en/index.ts', '!../en/eager.ts'], { eager: true })
const telugu = import.meta.glob<Record<string, Messages>>(['./*.ts', '!./index.ts', '!./*.test.ts'], { eager: true })
const fileName = (path: string): string => path.split('/').at(-1) ?? path
const say = (key: string, vars: Record<string, string | number> = {}): string => formatMessage(TE[key] ?? '', vars, 'te-IN')

describe('the Telugu catalog', () => {
  it('has every namespace English has, all merged into the catalog', () => {
    const missing = Object.keys(english).map(fileName).filter((name) => !Object.keys(telugu).map(fileName).includes(name))
    expect(missing).toEqual([])
    const unmerged = Object.values(telugu).flatMap((mod) => Object.values(mod).flatMap((messages) => Object.keys(messages).filter((key) => TE[key] === undefined)))
    expect(unmerged).toEqual([])
  })

  it('says Undo as రద్దు, not “take it back”, beside money that comes back', () => {
    expect(say('common.action.undo')).toBe('రద్దు')
    const takeBack = Object.entries(TE).filter(([, message]) => message.includes('వెనక్కి తీసుకో'))
    expect(takeBack.map(([key]) => key)).toEqual([])
  })

  it('never puts “you” where an ending would double it or flip who owes whom', () => {
    const you = say('kit.name.you.object')
    const filled = [
      say('kit.split.amountFor', { name: you }),
      say('kit.split.percentFor', { name: you }),
      say('kit.split.sharesFor', { name: you }),
      say('kit.split.hadFor', { name: you }),
      say('kit.collect.waiting', { names: you }),
      say('kit.transfer.record.aria', { amount: '₹500', from: 'Sravani', to: you }),
      say('kit.transfer.record.aria', { amount: '₹500', from: you, to: 'Sravani' }),
      say('bill.result.person.owes', { name: you, amount: '₹500' }),
    ]
    for (const line of filled) expect(line).not.toMatch(/మీ(కు|రు) (కు|కి|గారి|నుంచి)/)
    expect(say('bill.result.person.owes', { name: you, amount: '₹500' })).toBe('మీరు అందుకోవాల్సింది ₹500')

    // "Owes Sravani" says who gets the money; when you paid, the row has its own words.
    expect(say('kit.shares.status.owes', { name: 'Sravani' })).toBe('Sravani కు ఇవ్వాలి')
    expect(say('kit.shares.status.owesYou')).toBe('మీకు ఇవ్వాలి')
    expect(say('kit.shares.tick.you.aria', { name: 'Sravani' })).toBe('Sravani మీకు తిరిగి ఇచ్చారు')
    expect(say('kit.shares.qr.aria', { name: 'Sravani', amount: '₹400' })).toContain('Sravani మీకు ₹400')
  })

  it('names where a complaint goes without a loose ending, and dates with తేదీన', () => {
    const bank = say('stuck.place.bank')
    for (const [key, message] of Object.entries(TE)) {
      if (!key.startsWith('stuck')) continue
      expect(message, key).not.toMatch(/\{(place|was)\} (కి|కు)/)
      expect(message, key).not.toMatch(/\{date\} న[ ',.]/)
      if (message.includes('{place}')) expect(say(key, { place: bank, date: '2 నవం', count: 3, amount: '₹500' }), key).not.toContain(`${bank} కి`)
    }
    expect(say('stuck.now.raise', { place: bank })).toBe('మీ బ్యాంక్ దగ్గర ఫిర్యాదు చేయండి')
  })
})
