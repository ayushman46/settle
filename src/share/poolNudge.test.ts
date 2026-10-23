import { describe, expect, it } from 'vitest'
import { poolReminderText, poolRemindAllText, poolShareText, poolTellText, shortDay } from './poolNudge'

const LINK = 'https://settle.example/pool#abc'

describe('pool share text', () => {
  it('fixed: per person, progress and the link (spec 05 §2.4)', () => {
    expect(
      poolShareText({
        title: "Riya's farewell",
        emoji: '👋',
        currency: 'INR',
        mode: 'fixed',
        perPerson: 50000,
        goal: 500000,
        collected: 350000,
        deadline: null,
        link: LINK,
      }),
    ).toBe(`👋 Riya's farewell — ₹500 each\n₹3,500 of ₹5,000 in so far. Chip in here (any UPI app):\n${LINK}`)
  })

  it('target with a goal and a deadline; nothing in yet', () => {
    expect(
      poolShareText({
        title: 'Diwali party',
        emoji: '🪔',
        currency: 'INR',
        mode: 'target',
        perPerson: null,
        goal: 1000000,
        collected: 0,
        deadline: '2026-10-30',
        link: LINK,
      }),
    ).toBe(`🪔 Diwali party — Chip in what you like — goal ₹10,000 · by 30 Oct\nChip in here (any UPI app):\n${LINK}`)
  })

  it('open list: what is in, no goal', () => {
    expect(
      poolShareText({ title: 'Team', emoji: '🏢', currency: 'INR', mode: 'target', perPerson: null, goal: null, collected: 25050, deadline: null, link: LINK }),
    ).toBe(`🏢 Team — Chip in what you like\n₹250.50 in so far. Chip in here (any UPI app):\n${LINK}`)
  })
})

describe('pool reminders (spec 05 §2.4)', () => {
  const base = {
    toName: 'Sam',
    amount: 50000,
    currency: 'INR',
    title: "Riya's farewell",
    emoji: '👋',
    forName: 'Riya',
    inCount: 7,
    expected: 10,
    deadline: '2026-10-30',
    link: LINK,
  }

  it('friendly', () => {
    expect(poolReminderText({ ...base, tone: 'friendly' })).toBe(
      `Hi Sam! We're chipping in ₹500 for Riya's farewell 👋 — 7 of 10 done. Here's the link: ${LINK}`,
    )
  })

  it('funny', () => {
    expect(poolReminderText({ ...base, tone: 'funny' })).toBe(`Sam, the gift for Riya is almost wrapped 🎁 — just your ₹500 missing! ${LINK}`)
    expect(poolReminderText({ ...base, tone: 'funny', forName: null, title: 'Diwali party', emoji: '🪔' })).toBe(
      `Sam, Diwali party 🪔 is almost sorted — just your ₹500 missing! ${LINK}`,
    )
  })

  it('firm, with and without a deadline', () => {
    expect(poolReminderText({ ...base, tone: 'firm' })).toBe(`Hi Sam, a reminder to send ₹500 for Riya's farewell by 30 Oct: ${LINK}`)
    expect(poolReminderText({ ...base, tone: 'firm', deadline: null })).toBe(`Hi Sam, a reminder to send ₹500 for Riya's farewell: ${LINK}`)
  })

  it('target mode says "what you like"', () => {
    expect(poolReminderText({ ...base, tone: 'friendly', amount: null })).toBe(
      `Hi Sam! We're chipping in what you like for Riya's farewell 👋 — 7 of 10 done. Here's the link: ${LINK}`,
    )
    expect(poolReminderText({ ...base, tone: 'funny', amount: null })).toBe(`Sam, the gift for Riya is almost wrapped 🎁 — just your share missing! ${LINK}`)
  })

  it('a partial payer is reminded of what is left; open lists count who is in', () => {
    expect(poolReminderText({ ...base, tone: 'friendly', amount: 20000, expected: null })).toBe(
      `Hi Sam! We're chipping in ₹200 for Riya's farewell 👋 — 7 chipped in so far. Here's the link: ${LINK}`,
    )
  })

  it('remind all', () => {
    expect(poolRemindAllText({ title: "Riya's farewell", emoji: '👋', names: ['Sam', 'Kabir', 'Neha'], inCount: 7, expected: 10, link: LINK })).toBe(
      `Riya's farewell 👋 — 7 of 10 in! Still to chip in: Sam, Kabir, Neha. ${LINK}`,
    )
    const many = Array.from({ length: 15 }, (_, i) => `P${i + 1}`)
    expect(poolRemindAllText({ title: 'Turf', emoji: '🏏', names: many, inCount: 0, expected: 15, link: LINK })).toBe(
      `Turf 🏏 — 0 of 15 in! Still to chip in: ${many.slice(0, 12).join(', ')} and 3 more. ${LINK}`,
    )
  })
})

describe('tell text and dates', () => {
  it('builds the contributor’s reply message', () => {
    expect(
      poolTellText({ amount: 50000, currency: 'INR', title: "Riya's farewell", emoji: '👋', name: 'Sam', link: 'https://settle.example/app/pools/in#xyz' }),
    ).toBe("Chipped in ₹500 for Riya's farewell 👋 — Sam\nTick me off: https://settle.example/app/pools/in#xyz")
  })

  it('formats short days', () => {
    expect(shortDay('2026-10-30')).toBe('30 Oct')
    expect(shortDay('2027-01-05')).toBe('5 Jan')
    expect(shortDay(null)).toBe('')
    expect(shortDay('soon')).toBe('')
  })
})
