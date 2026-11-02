/**
 * Tamil reads like Tamil: every namespace is there, case endings fuse with their word (never
 * "உங்கள் வங்கி-இடம்"), "you" put into a name slot never flips who owes whom, and Home's greeting
 * doesn't say வணக்கம் twice.
 */
import { describe, expect, it } from 'vitest'
import { formatMessage } from '../format'
import type { Messages } from '../types'
import { TA } from './index'

const english = import.meta.glob<Record<string, Messages>>(['../en/*.ts', '!../en/index.ts', '!../en/eager.ts'], { eager: true })
const tamil = import.meta.glob<Record<string, Messages>>(['./*.ts', '!./index.ts', '!./*.test.ts'], { eager: true })
const fileName = (path: string): string => path.split('/').at(-1) ?? path
const say = (key: string, vars: Record<string, string | number> = {}): string => formatMessage(TA[key] ?? '', vars, 'ta-IN')

/** A Tamil letter, a hyphen, a Tamil letter: a case ending glued on instead of fused ("வங்கி-இடம்"). */
const GLUED = /\p{Script=Tamil}-\p{Script=Tamil}/u
/** The one Tamil hyphen that belongs: the feature's name, written like the English "Auto-settle". */
const NAMES = /ஆட்டோ-செட்டில/g

describe('the Tamil catalog', () => {
  it('has every namespace English has, all merged into the catalog', () => {
    const missing = Object.keys(english).map(fileName).filter((name) => !Object.keys(tamil).map(fileName).includes(name))
    expect(missing).toEqual([])
    const unmerged = Object.values(tamil).flatMap((mod) => Object.values(mod).flatMap((messages) => Object.keys(messages).filter((key) => TA[key] === undefined)))
    expect(unmerged).toEqual([])
  })

  it('fuses case endings with their word, with or without a place filled in', () => {
    const glued = Object.entries(TA).filter(([, message]) => GLUED.test(message.replace(NAMES, '')))
    expect(glued.map(([key]) => key)).toEqual([])

    // Where a complaint goes ("your bank", "the RBI Ombudsman", a shop's name) sits in sentences with no ending to add.
    const places = ['bank', 'ombudsman', 'nch', 'commission', 'airsewa', 'business'].map((kind) => say(`stuck.place.${kind}`)).concat('Zomato')
    for (const [key, message] of Object.entries(TA)) {
      if (!key.startsWith('stuck') || !/\{(place|was|what|field)\}/.test(message)) continue
      expect(message, key).not.toMatch(/\{(place|was|what|field)\}[- ]?(இடம்|இன்|க்கு|ஐ)(?!\p{Script=Tamil})/u)
      for (const place of places) expect(say(key, { place, was: place, what: 'குறிப்பு எண்', field: 'குறிப்பு எண்', date: '2 நவ.', count: 3, amount: '₹500' }), key).not.toMatch(GLUED)
    }
    // Names, titles and groups take their ending through a word ("Priya அவர்களுக்கு", "Goa குழுவில்"), never a loose one.
    const loose = Object.entries(TA).filter(([, message]) =>
      /\{(name|names|title|group|what|place|was|field|landlord|payer|who|category|language)\}[- ](இன்|ஐ|ஐத்|ஐப்|ஐக்|இல்|க்கு|க்குச்|க்குக்|க்கான|இடம்|இடமிருந்து|உடன்|உம்|ல்)(?!\p{Script=Tamil})/u.test(message),
    )
    expect(loose.map(([key]) => key)).toEqual([])
    expect(say('stuck.now.raise', { place: say('stuck.place.bank') })).toBe('புகார் செய்: உங்கள் வங்கி')
    expect(say('stuck.detail.copy', { what: 'குறிப்பு எண்' })).toBe('நகலெடு: குறிப்பு எண்')
  })

  it('never puts “you” where an ending would flip or double it', () => {
    const you = say('kit.name.you.object')
    const filled = [
      say('kit.split.amountFor', { name: you }),
      say('kit.split.percentFor', { name: you }),
      say('kit.split.sharesFor', { name: you }),
      say('kit.split.hadFor', { name: you }),
      say('kit.collect.waiting', { names: you }),
      say('kit.transfer.record.aria', { amount: '₹500', from: 'Priya', to: you }),
      say('kit.transfer.record.aria', { amount: '₹500', from: you, to: 'Priya' }),
      say('bill.result.person.owes', { name: you, amount: '₹500' }),
    ]
    for (const line of filled) expect(line).not.toMatch(/நீங்கள் ((இன்|ஐ|இல்|இலிருந்து|வரை)(?!\p{Script=Tamil})|அவர்)/u)
    expect(say('bill.result.person.owes', { name: you, amount: '₹500' })).toBe('நீங்கள் பெற வேண்டியது ₹500')

    // "Owes Priya" says who gets the money; when you paid, the row has its own words.
    expect(say('kit.shares.status.owes', { name: 'Priya' })).toBe('Priya அவர்களுக்குத் தர வேண்டும்')
    expect(say('kit.transfer.owes', { name: 'Priya' })).toBe('Priya அவர்களுக்குத் தர வேண்டும்')
    expect(say('kit.shares.status.owesYou')).toBe('உங்களுக்குத் தர வேண்டும்')
    expect(say('kit.shares.qr.aria', { name: 'Priya', amount: '₹600' })).toContain('Priya உங்களுக்கு ₹600')
  })

  it('greets once: the time of day, then the name', () => {
    expect(say('home.greet.evening')).toContain('வணக்கம்')
    expect(say('home.greet.hiName', { name: 'Kavya' })).not.toContain('வணக்கம்')
    expect(say('home.greet.hi')).not.toContain('வணக்கம்')
  })
})
