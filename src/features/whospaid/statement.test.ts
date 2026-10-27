import { describe, expect, it } from 'vitest'
import { creditsFromSms, splitMessages } from './sms'
import { parseAmount, parseDate, parseDelimited, parseHtmlTable, readNarration, readStatement } from './statement'
import { readXlsx } from './xlsx'

describe('narrations (synthetic, one payment five ways)', () => {
  it.each([
    ['HDFC', 'UPI-RIYA SHARMA-RIYA.S@OKHDFCBANK-HDFC0000123-629618427311-STL R7K GOA TRIP', 'RIYA SHARMA'],
    ['SBI', 'BY TRANSFER-UPI/CR/629618427311/RIYA SHA/HDFC/riya.s@okhd/STL R7K--', 'RIYA SHA'],
    ['Axis', 'UPI/P2A/629618427311/RIYA SHARMA/HDFC BANK/STL R7K Goa tri', 'RIYA SHARMA'],
    ['Kotak', 'UPI/RIYA SHARMA/629618427311/STL R7K Goa trip', 'RIYA SHARMA'],
  ])('%s: the reference and the name', (_, text, name) => {
    const read = readNarration(text)
    expect(read.utr).toBe('629618427311')
    expect(read.names[0]).toBe(name)
    expect(read.notPerson).toBe(false)
  })

  it('ICICI prints no name: the note and the UPI ID are what there is', () => {
    const read = readNarration('UPI/629618427311/STL R7K Goa tr/riya.s@okhdfcban/HDFC BANK LTD/ICI0a1b2c3d4e5f60718293a4b5c6d7e8f')
    expect(read).toMatchObject({ utr: '629618427311', vpa: 'riya.s@okhdfcban', names: ['STL R7K Goa tr'] })
  })

  it('keeps a masked UPI ID, drops the default "Payment from PhonePe" note', () => {
    const read = readNarration('UPI-SAMEER KHAN-******4821@YBL-YESB0000123-629721055184-PAYMENT FROM PHONEPE')
    expect(read).toMatchObject({ vpa: '******4821@ybl', names: ['SAMEER KHAN'] })
  })

  it('refunds, cashback, interest and merchants are not a person paying back', () => {
    for (const text of ['UPI/P2M/629618427311/SWIGGY/REFUND', 'CASHBACK RECEIVED', 'INT.PD:01-07-2026 TO 30-09-2026', 'REV-UPI/629618427311']) {
      expect(readNarration(text).notPerson).toBe(true)
    }
  })
})

describe('values', () => {
  it('reads Indian money with its sign', () => {
    expect(parseAmount('1,25,000.50')).toEqual({ paise: 12_500_050, sign: 0 })
    expect(parseAmount('₹ 1,250 Cr')).toEqual({ paise: 125_000, sign: 1 })
    expect(parseAmount('-420.00')).toEqual({ paise: 42_000, sign: -1 })
    expect(parseAmount('Rs.99 Dr')).toEqual({ paise: 9900, sign: -1 })
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('n/a')).toBeNull()
  })

  it('reads dates day first, in every way statements print them', () => {
    expect(parseDate('23/10/26')).toBe('2026-10-23')
    expect(parseDate('23-10-2026')).toBe('2026-10-23')
    expect(parseDate('23 Oct 2026')).toBe('2026-10-23')
    expect(parseDate('23-OCT-26')).toBe('2026-10-23')
    expect(parseDate('Oct 23, 2026')).toBe('2026-10-23')
    expect(parseDate('2026-10-23')).toBe('2026-10-23')
    expect(parseDate('46318')).toBe('2026-10-23')
    expect(parseDate('31/02/2026')).toBeNull()
  })
})

const HDFC_CSV = `HDFC BANK Ltd.,Statement of account
Account No,XXXXXXXX1234

Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
20/10/26,UPI-SWIGGY-SWIGGY@ICICI-ICIC0000001-629301234567-PAYMENT,0000629301234567,20/10/26,450.00,,"10,000.00"
23/10/26,UPI-RIYA SHARMA-RIYA.S@OKHDFCBANK-HDFC0000123-629618427311-STL R7K GOA TRIP,0000629618427311,23/10/26,,"1,250.00","11,250.00"
24/10/26,UPI-ASHA IYER-ASHA.I@OKSBI-SBIN0000123-629712345678-GOA,0000629712345678,24/10/26,,420.00,"11,670.00"
25/10/26,UPI/P2M/629812345678/AMAZON/REFUND,0000629812345678,25/10/26,,199.00,"11,869.00"

STATEMENT SUMMARY
`

describe('readStatement', () => {
  it('reads an HDFC CSV: the header row found, only money from people kept, the balance agrees', () => {
    const read = readStatement(parseDelimited(HDFC_CSV))
    expect(read?.trusted).toBe(true)
    expect(read?.debits).toBe(1)
    expect(read?.credits.map((c) => [c.amount, c.date, c.name, c.vpa, c.utr])).toEqual([
      [125_000, '2026-10-23', 'RIYA SHARMA', 'riya.s@okhdfcbank', '629618427311'],
      [42_000, '2026-10-24', 'ASHA IYER', 'asha.i@oksbi', '629712345678'],
    ])
  })

  it('a balance that doesn’t add up means nothing is ticked for you', () => {
    const wrong = HDFC_CSV.replace('"11,670.00"', '"99,999.00"').replace('"11,869.00"', '"12,345.00"')
    const read = readStatement(parseDelimited(wrong))
    expect(read?.trusted).toBe(false)
    expect(read?.credits.every((c) => !c.sure)).toBe(true)
  })

  it('reads an amount with a Cr/Dr column (SBI-style) and newest-first order', () => {
    const rows = [
      ['Txn Date', 'Description', 'Ref No./Cheque No.', 'Amount', 'Dr/Cr', 'Balance'],
      ['24 Oct 2026', 'BY TRANSFER-UPI/CR/629712345678/ASHA IYER/SBIN/asha.i@oksbi/GOA--', 'TRANSFER FROM 0000', '420.00', 'CR', '11,670.00'],
      ['23 Oct 2026', 'BY TRANSFER-UPI/CR/629618427311/RIYA SHA/HDFC/riya.s@okhd/STL R7K--', 'TRANSFER FROM 0000', '1,250.00', 'CR', '11,250.00'],
      ['20 Oct 2026', 'TO TRANSFER-UPI/DR/629301234567/SWIGGY/ICIC/swiggy@icici/PAYMENT--', '', '450.00', 'DR', '10,000.00'],
    ]
    const read = readStatement(rows)
    expect(read?.trusted).toBe(true)
    expect(read?.credits.map((c) => c.name)).toEqual(['ASHA IYER', 'RIYA SHA'])
  })

  it('reads the HTML table inside a bank’s ".xls"', () => {
    const html = `<html><body><table><tr><td>Tran Date</td><td>Particulars</td><td>DR</td><td>CR</td><td>BAL</td></tr>
      <tr><td>23-10-2026</td><td>UPI/P2A/629618427311/RIYA SHARMA/HDFC BANK/Goa</td><td></td><td>1250.00</td><td>11250.00</td></tr></table></body></html>`
    expect(readStatement(parseHtmlTable(html))?.credits[0]).toMatchObject({ amount: 125_000, name: 'RIYA SHARMA', utr: '629618427311' })
  })

  it('says so when there’s no statement in the file', () => {
    expect(readStatement(parseDelimited('hello,world\n1,2'))).toBeNull()
  })
})

/** A ZIP with stored (uncompressed) entries — enough for an .xlsx in a test. */
function zip(files: Record<string, string>): Uint8Array {
  const encoder = new TextEncoder()
  const chunks: number[] = []
  const central: number[] = []
  const le = (n: number, bytes: number) => Array.from({ length: bytes }, (_, i) => (n >>> (8 * i)) & 0xff)
  let count = 0
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = [...encoder.encode(name)]
    const data = [...encoder.encode(text)]
    const offset = chunks.length
    chunks.push(...le(0x04034b50, 4), ...le(20, 2), ...le(0, 2), ...le(0, 2), ...le(0, 4), ...le(0, 4), ...le(data.length, 4), ...le(data.length, 4), ...le(nameBytes.length, 2), ...le(0, 2), ...nameBytes, ...data)
    central.push(...le(0x02014b50, 4), ...le(20, 2), ...le(20, 2), ...le(0, 2), ...le(0, 2), ...le(0, 4), ...le(0, 4), ...le(data.length, 4), ...le(data.length, 4), ...le(nameBytes.length, 2), ...le(0, 2), ...le(0, 2), ...le(0, 2), ...le(0, 2), ...le(0, 4), ...le(offset, 4), ...nameBytes)
    count++
  }
  const centralAt = chunks.length
  return new Uint8Array([...chunks, ...central, ...le(0x06054b50, 4), ...le(0, 2), ...le(0, 2), ...le(count, 2), ...le(count, 2), ...le(central.length, 4), ...le(centralAt, 4), ...le(0, 2)])
}

describe('readXlsx', () => {
  it('reads the first sheet: shared strings, numbers and Excel day numbers', () => {
    const file = zip({
      'xl/workbook.xml': '<workbook/>',
      'xl/sharedStrings.xml':
        '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Date</t></si><si><t>Narration</t></si><si><t>Deposit Amt.</t></si><si><r><t>UPI-RIYA SHARMA-</t></r><r><t>riya.s@okhdfcbank-629618427311</t></r></si></sst>',
      'xl/worksheets/sheet1.xml':
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row><row r="2"><c r="A2"><v>46318</v></c><c r="B2" t="s"><v>3</v></c><c r="D2"><v>9</v></c><c r="C2"><v>1250</v></c></row></sheetData></worksheet>',
    })
    const rows = readXlsx(file)
    expect(rows?.[0]).toEqual(['Date', 'Narration', 'Deposit Amt.'])
    expect(readStatement(rows ?? [])?.credits[0]).toMatchObject({ amount: 125_000, date: '2026-10-23', name: 'RIYA SHARMA', utr: '629618427311' })
  })

  it('is null for something that isn’t a ZIP', () => {
    expect(readXlsx(new TextEncoder().encode('not a zip at all'))).toBeNull()
  })
})

describe('bank SMS pasted in bulk', () => {
  const PASTE = `Rs.420.00 credited to a/c XX4821 on 23-10-26 by a/c linked to VPA riya.s@okhdfcbank (UPI Ref no 629618427311).

Your a/c XX4821 is debited with Rs 450.00 on 20-10-26 towards UPI/SWIGGY. Avl bal Rs 10000.00

INR 250.00 credited to A/c no. XX4821 on 24-10-26 (UPI Ref no 629712345678) from SAM DSOUZA.`

  it('splits the paste into alerts and keeps only money received', () => {
    expect(splitMessages(PASTE)).toHaveLength(3)
    const { credits, read } = creditsFromSms(PASTE, '2026-10-27')
    expect(read).toBe(3)
    expect(credits.map((c) => [c.amount, c.utr])).toEqual([
      [42_000, '629618427311'],
      [25_000, '629712345678'],
    ])
  })
})
