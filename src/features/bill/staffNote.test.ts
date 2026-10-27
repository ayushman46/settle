import { describe, expect, it } from 'vitest'
import { checkBill, type BillFinding } from './billCheck'
import { sampleSession } from './screenTestKit'
import { hasNote, staffNote } from './staffNote'

const sample = () => checkBill(sampleSession('paid')).findings

describe('staffNote', () => {
  it('asks politely for the service charge and its GST to come off, and says why', () => {
    expect(staffNote(sample(), 'en')).toEqual([
      'Hello! Could you please take the service charge (₹115.25) and the GST worked out on it (₹5.76) off our bill?',
      "Under the Central Consumer Protection Authority's guidelines of 4 July 2022, upheld by the Delhi High Court on 28 March 2025, a service charge is optional: it can't be added to the bill by default or under another name, or have GST added on it. If we'd like to tip, we'll add it ourselves.",
      'Thank you!',
    ])
  })

  it('speaks the staff’s language, whatever the app is set to', () => {
    expect(staffNote(sample(), 'hi')[0]).toBe('नमस्ते! कृपया हमारे बिल से सर्विस चार्ज (₹115.25) और उस पर लगा GST (₹5.76) हटा दें।')
    for (const lang of ['bn', 'mr', 'ta', 'te', 'kn', 'gu'] as const) {
      const note = staffNote(sample(), lang)
      expect(note).toHaveLength(3)
      expect(note[0]).toContain('₹115.25')
      expect(note[0]).toContain('₹5.76')
      expect(note[1]).toContain('2025')
    }
  })

  it('names renamed charges and old taxes, and gives each reason once', () => {
    const findings: BillFinding[] = [
      { kind: 'renamed_charge', key: 'renamed:a', label: 'Staff contribution', amount: 5000, gst: 250, itemId: 'a', feeId: null, saving: 5250 },
      { kind: 'printed_tip', key: 'printed_tip', amount: 10000, saving: 10000 },
      { kind: 'old_tax', key: 'old_tax:t', label: 'Swachh Bharat cess', amount: 500, lineId: 't', saving: 500 },
      { kind: 'total_over', key: 'total_over', lines: 1, total: 2, over: 1, saving: 0 },
    ]
    const note = staffNote(findings, 'en')
    expect(note[0]).toBe('Hello! Could you please take “Staff contribution” (₹52.50), the tip (₹100) and “Swachh Bharat cess” (₹5) off our bill?')
    // The service-charge reason covers the tip; the old tax gets its own.
    expect(note.slice(1)).toEqual([expect.stringContaining('a service charge is optional'), 'Service tax and its cesses were replaced by GST in July 2017.', 'Thank you!'])
  })

  it('gives the tip its own reason when it’s the only thing', () => {
    const tip: BillFinding = { kind: 'printed_tip', key: 'printed_tip', amount: 10000, saving: 10000 }
    expect(staffNote([tip], 'en')).toEqual(['Hello! Could you please take the tip (₹100) off our bill?', "We'd like to decide on the tip ourselves.", 'Thank you!'])
  })

  it('explains GST on a bill of supply', () => {
    const supply: BillFinding = { kind: 'supply_gst', key: 'supply_gst', amount: 5000, saving: 5000 }
    expect(staffNote([supply], 'en')[1]).toMatch(/bill of supply/)
  })

  it('has nothing to ask when nothing can come off', () => {
    const info: BillFinding = { kind: 'hotel_rate', key: 'hotel_rate', tax: 18000, atFive: 5000, saving: 0 }
    expect(hasNote([info])).toBe(false)
    expect(staffNote([info], 'en')).toEqual([])
    expect(hasNote(sample())).toBe(true)
  })
})
