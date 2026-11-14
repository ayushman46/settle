import { describe, expect, it } from 'vitest'
import type { Group } from '../../domain/types'
import { fakeMeasure } from '../../share/card/testMeasure'
import { slideText, slideWords, storyText, type CopyContext } from './copy'
import type { Slide } from './engine'
import { layoutSlidePicture } from './image'

const group: Pick<Group, 'name' | 'emoji' | 'currency'> = { name: 'Goa', emoji: '🏖️', currency: 'INR' }
const names: Record<string, string> = { me: 'You', riya: 'Riya' }
const app: CopyContext = { group, nameOf: (id) => names[id] ?? id, youLabel: 'You' }
const out: CopyContext = { group, nameOf: (id) => (id === 'me' ? 'Ayush' : (names[id] ?? id)), youLabel: 'Ayush' }

const slides: Slide[] = [
  { kind: 'headline', total: 4_218_000, days: 5, people: 4, count: 23, from: '2026-11-01', to: '2026-11-05' },
  { kind: 'categories', shares: [{ id: 'food', total: 3, percent: 50 }, { id: 'travel', total: 2, percent: 33 }, { id: null, total: 1, percent: 17 }] },
  { kind: 'bigBill', title: 'Hotel', total: 1_200_000, payerId: 'me', date: '2026-11-01' },
  { kind: 'repeat', title: 'Chai', count: 9, total: 81_000 },
  { kind: 'you', share: 1_000_000, paid: 1_500_000, percent: 24 },
  { kind: 'closing', payments: 3, total: 520_000 },
]

describe('slide words', () => {
  it('says each slide plainly, with amounts formatted and names as given', () => {
    expect(slideWords(slides[0]!, app)).toEqual({ eyebrow: '🏖️ Goa', big: '₹42,180', line: '5 days · 4 people · 23 bills' })
    expect(slideWords(slides[1]!, app)).toMatchObject({ big: '50% on Food & drinks', line: 'Travel & stays 33% · The rest together 17%' })
    expect(slideWords(slides[2]!, app).line).toBe('Hotel, paid by You')
    expect(slideWords(slides[2]!, out).line).toBe('Hotel, paid by Ayush')
    expect(slideWords(slides[3]!, app).big).toBe('Chai × 9')
    expect(slideWords(slides[4]!, out)).toEqual({ eyebrow: 'Ayush', big: '₹10,000', line: 'Share: 24% of the total. Paid ₹15,000 up front' })
    expect(slideWords(slides[5]!, app)).toMatchObject({ big: '3 payments', line: '₹5,200 to move, and everyone’s square' })
    expect(slideWords({ kind: 'closing', payments: 0, total: 0 }, app).big).toBe('All square')
  })

  it('the text recap has every slide, once', () => {
    const text = storyText(slides, out)
    expect(text.split('\n')[0]).toBe('🏖️ Goa: the story')
    expect(text).toContain('₹42,180: 5 days · 4 people · 23 bills')
    expect(text).toContain('On repeat: Chai × 9')
    expect(text).toContain('To settle it: 3 payments')
    expect(slideText(slides[3]!, out)).toBe('On repeat\nChai × 9: ₹810 on it in all')
  })

  it('text that leaves the app ends with the app’s name and link', () => {
    const shared: CopyContext = { ...out, site: 'https://settle.example/' }
    expect(slideText(slides[3]!, shared)).toBe('On repeat\nChai × 9: ₹810 on it in all\n\nMade with Settle: https://settle.example')
    expect(storyText(slides, shared).split('\n').at(-1)).toBe('Made with Settle: https://settle.example')
    expect(slideText(slides[3]!, { ...out, site: '' }).split('\n').at(-1)).toBe('Made with Settle')
  })

  it('an “about” figure is in whole rupees', () => {
    const words = slideWords({ kind: 'perDay', perDay: 596_500, days: 4, people: 4, perPersonPerDay: 149_125 }, out)
    expect(words).toMatchObject({ big: '₹5,965 a day', line: 'About ₹1,491 each, every day, for 4 days' })
  })

  it('the big day says when it names only some of its bills', () => {
    const day = { kind: 'bigDay', date: '2026-11-09', total: 1_058_000, count: 4, titles: ['Hotel', 'Lunch', 'Scooter rental'] } as const
    expect(slideWords({ ...day, titles: [...day.titles], all: false }, app).line).toBe('4 bills, including Hotel, Lunch, Scooter rental')
    expect(slideWords({ ...day, count: 3, titles: [...day.titles], all: true }, app).line).toBe('3 bills: Hotel, Lunch, Scooter rental')
  })
})

describe('the slide picture', () => {
  it('draws the slide’s words in its colours, fitted to the picture, with the footer only when asked', () => {
    const input = { words: slideWords(slides[0]!, out), colors: { bg: '#000000', ink: '#ffffff', glow: '#cbf266' }, groupLabel: '🏖️ Goa', position: '1 / 6' }
    const scene = layoutSlidePicture(input, { watermark: true, siteLabel: 'settle.app' }, fakeMeasure)
    const texts = scene.ops.flatMap((op) => (op.kind === 'text' ? [op] : []))
    expect(scene.ops[0]).toEqual({ kind: 'background', color: '#000000' })
    expect(texts.map((x) => x.text)).toEqual(expect.arrayContaining(['🏖️ Goa', '1 / 6', '₹42,180', 'Made with Settle · settle.app']))
    for (const x of texts) expect(fakeMeasure(x.text, x.style)).toBeLessThanOrEqual(x.maxWidth + 0.5)
    for (const x of texts) expect(x.y).toBeLessThanOrEqual(scene.height)
    const clean = layoutSlidePicture(input, { watermark: false, siteLabel: 'settle.app' }, fakeMeasure)
    expect(clean.ops.some((op) => op.kind === 'text' && op.text.startsWith('Made with'))).toBe(false)
  })

  it('a very long name still fits', () => {
    const words = { eyebrow: 'Fronted the most', big: 'Venkatanarasimharajuvaripeta Subramaniam', line: 'Covered ₹1,23,45,678 of other people’s shares' }
    const scene = layoutSlidePicture({ words, colors: { bg: '#000', ink: '#fff', glow: '#fff' }, groupLabel: 'A very long group name for a trip to the hills and back again', position: '6 / 9' }, { watermark: false, siteLabel: '' }, fakeMeasure)
    for (const op of scene.ops) if (op.kind === 'text') expect(fakeMeasure(op.text, op.style)).toBeLessThanOrEqual(op.maxWidth + 0.5)
  })
})
