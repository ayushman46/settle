import { beforeEach, describe, expect, it } from 'vitest'
import { ME_ID, type Friend, type Group } from '../domain/types'
import { CSV_BOM, csvField, exportCsv } from './csv'
import { saveExpense, setPaidBack } from './expenses'
import { addFriend } from './friends'
import { createGroup } from './groups'
import { friendsStore, groupsStore } from './stores'
import { draft } from './testKit'
import { resetDataForTests } from './testing'

beforeEach(() => {
  resetDataForTests()
})

/** Minimal RFC 4180 reader for checking the output. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\r' && text[i + 1] === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
    } else field += ch
  }
  return rows
}

const byId = <T extends { id: string }>(list: T[]) => Object.fromEntries(list.map((x) => [x.id, x])) as Record<string, T>

describe('csvField', () => {
  it('quotes only when needed and doubles quotes', () => {
    expect(csvField('plain')).toBe('plain')
    expect(csvField('a,b')).toBe('"a,b"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('two\nlines')).toBe('"two\nlines"')
    expect(csvField(' padded')).toBe('" padded"')
  })

  it('neutralises spreadsheet formulas', () => {
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvField('+91 98765')).toBe("'+91 98765")
    expect(csvField('-5')).toBe("'-5")
    expect(csvField('@sum')).toBe("'@sum")
  })
})

describe('exportCsv', () => {
  it('writes a header and one row per expense with CRLF line endings', () => {
    const riya = addFriend({ name: 'Riya' })
    const g = createGroup({ name: 'Goa, 2026', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [riya.id] })
    const e = saveExpense(draft({ title: 'Dinner "Toit"', total: 123450, with: [riya.id], groupId: g.id, note: 'Line one\nLine two' }))
    const ticked = setPaidBack(e.id, riya.id, true)
    const csv = exportCsv([ticked, saveExpense(draft({ title: 'Solo', total: 5000, payerId: riya.id, with: [riya.id], mode: 'shares', participants: [{ friendId: ME_ID, input: 1 }, { friendId: riya.id, input: 4 }] }))], byId(friendsStore.get()) as Record<string, Friend>, byId(groupsStore.get()) as Record<string, Group>)
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(csv.startsWith(CSV_BOM)).toBe(false)
    const rows = parseCsv(csv)
    expect(rows[0]).toEqual(['Date', 'Title', 'Category', 'Group', 'Total', 'Currency', 'Paid by', 'Your share', 'Split', 'People', 'Note'])
    expect(rows[1]).toEqual(['2026-10-21', 'Dinner "Toit"', 'Food & drinks', 'Goa, 2026', '1234.50', 'INR', 'You', '617.25', 'Equally', 'You 617.25; Riya 617.25 (paid)', 'Line one\nLine two'])
    expect(rows[2]).toEqual(['2026-10-21', 'Solo', 'Food & drinks', '', '50.00', 'INR', 'Riya', '10.00', 'Shares', 'You 10.00; Riya 40.00', ''])
  })

  it('names people who are no longer friends and handles zero-decimal currencies', () => {
    const e = saveExpense(draft({ currency: 'JPY', total: 1001, with: [addFriend({ name: 'Kenji' }).id] }))
    const rows = parseCsv(exportCsv([e], {}))
    expect(rows[1]?.[4]).toBe('1001')
    expect(rows[1]?.[9]).toBe('You 501; Someone 500')
  })

  it('is just the header for no expenses', () => {
    expect(exportCsv([], {})).toBe('Date,Title,Category,Group,Total,Currency,Paid by,Your share,Split,People,Note\r\n')
  })
})
