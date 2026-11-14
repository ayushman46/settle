import { describe, expect, it } from 'vitest'
import { chatNameFromFile, looksLikeChat, parseChat } from './parse'
import { readChat, rowKey, type ChatRow } from './read'

const ANDROID = `12/11/2026, 21:40 - Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.
12/11/2026, 21:40 - Riya created group "Goa trip"
12/11/2026, 21:41 - Riya: paid 1200 for the cab
12/11/2026, 21:45 - Sam: Dinner at Britto's ₹2,400
13/11/2026, 09:02 - Ayush: <Media omitted>
13/11/2026, 09:05 - Ayush: I paid 3k for the hotel booking
and it includes breakfast
13/11/2026, 10:15 - Kabir: ok 👍`

const IPHONE = `‎[12/11/26, 9:41:22 PM] Riya: paid 1200 for the cab
[12/11/26, 9:45:03 PM] Sam: Dinner at Britto's ₹2,400
[13/11/26, 9:05:10 AM] Ayush: ‎image omitted
[13/11/26, 12:05:10 AM] Ayush: I paid 3k for the hotel booking`

describe('reading a chat as WhatsApp writes it out', () => {
  it('reads an Android export: who, when, what; continuation lines; the group’s name', () => {
    const chat = parseChat(ANDROID)
    expect(chat.name).toBe('Goa trip')
    expect(chat.senders).toEqual(['Riya', 'Sam', 'Ayush', 'Kabir'])
    expect(chat.messages.map((m) => [m.date, m.minutes, m.sender])).toEqual([
      ['2026-11-12', 21 * 60 + 41, 'Riya'],
      ['2026-11-12', 21 * 60 + 45, 'Sam'],
      ['2026-11-13', 9 * 60 + 5, 'Ayush'],
      ['2026-11-13', 10 * 60 + 15, 'Kabir'],
    ])
    expect(chat.messages[2]?.text).toBe('I paid 3k for the hotel booking\nand it includes breakfast')
  })

  it('reads an iPhone export: brackets, seconds, AM and PM, the marks nobody typed', () => {
    const chat = parseChat(IPHONE, 'WhatsApp Chat - Goa trip.zip')
    expect(chat.name).toBe('Goa trip')
    expect(chat.messages.map((m) => [m.date, m.minutes, m.sender])).toEqual([
      ['2026-11-12', 21 * 60 + 41, 'Riya'],
      ['2026-11-12', 21 * 60 + 45, 'Sam'],
      ['2026-11-13', 5, 'Ayush'],
    ])
  })

  it('reads messages copied in the app, and 12-hour Android times with the narrow space', () => {
    const copied = parseChat('[9:41 pm, 12/11/2026] Riya: paid 1200 for the cab\n[9:45 pm, 12/11/2026] Sam: Dinner 2400')
    expect(copied.messages.map((m) => [m.date, m.minutes, m.sender])).toEqual([
      ['2026-11-12', 21 * 60 + 41, 'Riya'],
      ['2026-11-12', 21 * 60 + 45, 'Sam'],
    ])
    const narrow = parseChat('12/11/26, 9:41 pm - Riya: paid 1200 for the cab')
    expect(narrow.messages[0]).toMatchObject({ date: '2026-11-12', minutes: 21 * 60 + 41, sender: 'Riya' })
  })

  it('takes the day first unless the chat itself shows the month first', () => {
    expect(parseChat('03/04/2026, 10:00 - A: hi\n05/04/2026, 10:00 - A: yo').messages[0]?.date).toBe('2026-04-03')
    expect(parseChat('3/25/26, 10:00 - A: hi\n3/26/26, 10:00 - A: yo').messages[0]?.date).toBe('2026-03-25')
    expect(parseChat('2026-11-12, 10:00 - A: hi').messages[0]?.date).toBe('2026-11-12')
  })

  it('names the group from the file, knows a chat when it sees one, drops what isn’t a message', () => {
    expect(chatNameFromFile('WhatsApp Chat with Goa trip.txt')).toBe('Goa trip')
    expect(chatNameFromFile('WhatsApp Chat with Flat 302 (1).txt')).toBe('Flat 302')
    expect(chatNameFromFile('_chat.txt')).toBeNull()
    expect(looksLikeChat(ANDROID)).toBe(true)
    expect(looksLikeChat(IPHONE)).toBe(true)
    expect(looksLikeChat('Rs 500 debited from a/c XX1234 on 12/11/2026, 21:41 - UPI')).toBe(false)
    expect(parseChat('hello\nthere').messages).toEqual([])
    expect(parseChat('12/11/2026, 21:41 - Riya changed the subject to "Goa: the trip"\n12/11/2026, 21:42 - Riya: hi').senders).toEqual(['Riya changed the subject to "Goa', 'Riya'])
  })
})

/** One chat among Riya, Sam, Ayush and Kabir where each line is a message from `who` (default Riya). */
function rowsOf(lines: Array<string | [string, string]>): ChatRow[] {
  const text = ['12/11/2026, 09:00 - Riya: hi', '12/11/2026, 09:00 - Sam: hi', '12/11/2026, 09:00 - Ayush: hi', '12/11/2026, 09:00 - Kabir Mehta: hi']
  lines.forEach((line, i) => {
    const [who, said] = typeof line === 'string' ? ['Riya', line] : line
    text.push(`12/11/2026, 10:${String(i).padStart(2, '0')} - ${who}: ${said}`)
  })
  return readChat(parseChat(text.join('\n'))).rows
}
const one = (line: string | [string, string]): ChatRow | undefined => rowsOf([line])[0]
const ALL = ['Riya', 'Sam', 'Ayush', 'Kabir Mehta']

describe('finding the money in a chat', () => {
  it.each([
    ['paid 1200 for the cab', 'Cab', 120000],
    ['Paid 1,200 for cab', 'Cab', 120000],
    ['I paid 3k for the hotel booking', 'Hotel booking', 300000],
    ['spent 650 on beers', 'Beers', 65000],
    ['Dinner at Britto’s ₹2,400', 'Dinner at Britto’s', 240000],
    ['Petrol - Rs. 1500', 'Petrol', 150000],
    ['paid for dinner 2400', 'Dinner', 240000],
    ['bought snacks for 340/-', 'Snacks', 34000],
    ['Booked the villa, 18000 paid', 'Villa', 1800000],
    ['maine petrol ke 1500 diye', 'Petrol', 150000],
    ['cab ke liye 300 diye', 'Cab', 30000],
    ['paid 1.5k for scooty rent', 'Scooty rent', 150000],
    ['paid 2.5 lakh for the venue', 'Venue', 25000000],
    ['Paid 500rs for parking', 'Parking', 50000],
    ['tolls + parking paid 380', 'Tolls + parking', 38000],
    ['paid 500 + 300 for cab and tolls', 'Cab and tolls', 80000],
  ])('“%s” is an expense: %s', (line, title, amount) => {
    const row = one(line)
    expect(row).toMatchObject({ kind: 'expense', sure: true, payer: 'Riya', title, amount, among: ALL })
  })

  it.each([
    ['Cab 450', 'Cab', 45000],
    ['450 cab', 'Cab', 45000],
    ['Chai 60', 'Chai', 6000],
    ['got snacks 250', 'Snacks', 25000],
  ])('a bare “%s” is offered, not assumed', (line, title, amount) => {
    expect(one(line)).toMatchObject({ kind: 'expense', sure: false, doubt: 'short', title, amount })
  })

  it('a list in one message is taken line by line, without its total', () => {
    const rows = rowsOf(['Expenses so far:\n1. Cab 450\n2. Dinner - 2400\n- Tolls 380\nTotal 3230'])
    expect(rows.map((r) => [r.title, r.amount, r.sure])).toEqual([
      ['Cab', 45000, true],
      ['Dinner', 240000, true],
      ['Tolls', 38000, true],
    ])
    expect(rowsOf(['cab 450, dinner 2400']).map((r) => [r.title, r.amount, r.sure])).toEqual([
      ['Cab', 45000, true],
      ['Dinner', 240000, true],
    ])
  })

  it.each([
    'how much was the cab? 450?',
    'did you pay 500',
    'pay me 500 for the cab',
    'please send 1200',
    'you owe me 800',
    'I owe Sam 500',
    'will pay 1200 tomorrow',
    'I’ll book it for 3000',
    'not paid the 500 yet',
    'have to pay 2000 advance',
    'lets meet at 8',
    'reaching by 10:30',
    'see you at 9pm',
    'call me on 98765 43210',
    'my number is +91 98765-43210',
    'room 302',
    'flight 6E 2134 at 0540',
    'otp 482913',
    'OTP is 4521 for the cab',
    'we are 6 people',
    '2 beers and 3 cokes',
    'booked for 3 nights',
    '12/11 works for me',
    'on 12th November',
    'it is 40% off',
    'Rs 500 debited from a/c XX1234 to VPA uber@axis',
    'total 5430',
    'so everyone pays 1357',
    'per head comes to 1357',
    'sent 500',
    'received 500 cashback',
    'got 200 back from the shop',
    'https://maps.app.goo.gl/abc12345 near km 45',
    '😂😂 100 percent',
    'haha',
    'A320 seat 23',
  ])('“%s” is not money that moved', (line) => {
    expect(rowsOf([line])).toEqual([])
  })

  it('a price being talked about is offered with a warning, never assumed', () => {
    expect(one('the villa costs ₹18,000 a night')).toMatchObject({ sure: false, doubt: 'price' })
    expect(one('scooty rent around 500')).toMatchObject({ sure: false, doubt: 'price' })
  })

  it('two amounts in one line are offered with a warning; the first is taken', () => {
    expect(one('paid 1200 for cab, driver wanted 1500')).toMatchObject({ amount: 120000, sure: false, doubt: 'amounts' })
  })

  it('knows who paid when someone else typed it', () => {
    expect(one('Sam paid 800 for lunch')).toMatchObject({ kind: 'expense', payer: 'Sam', title: 'Lunch', amount: 80000, sure: true })
    expect(one('Sam ne 800 diye lunch ke')).toMatchObject({ kind: 'expense', payer: 'Sam', title: 'Lunch', amount: 80000 })
    expect(one('Kabir has paid 2000 for the scooty')).toMatchObject({ payer: 'Kabir Mehta', title: 'Scooty' })
    expect(one(['Kabir Mehta', 'paid 90 for chai'])).toMatchObject({ payer: 'Kabir Mehta', title: 'Chai', amount: 9000 })
  })

  it('knows who shares it', () => {
    expect(one('paid 650 for beers for me and Sam')).toMatchObject({ title: 'Beers', among: ['Riya', 'Sam'] })
    expect(one('paid 900 for lunch with Sam and Kabir')).toMatchObject({ title: 'Lunch', among: ['Riya', 'Sam', 'Kabir Mehta'] })
    expect(one('paid 2400 for dinner except Ayush')).toMatchObject({ title: 'Dinner', among: ['Riya', 'Sam', 'Kabir Mehta'] })
    expect(one('paid 2400 for dinner, Ayush ko chhod ke')).toMatchObject({ among: ['Riya', 'Sam', 'Kabir Mehta'] })
    expect(one('paid 600 for auto between Sam, Ayush and me')).toMatchObject({ title: 'Auto', among: ['Riya', 'Sam', 'Ayush'] })
    expect(one('paid 500 for Sam’s cake')).toMatchObject({ among: ALL })
  })

  it('“each” means per person; “3 ways” in a chat of four is asked about', () => {
    expect(one('paid 400 each for the ferry')).toMatchObject({ title: 'Ferry', amount: 160000, sure: false, doubt: 'each' })
    expect(one('paid 900 for the boat, split in 3')).toMatchObject({ amount: 90000, sure: false, doubt: 'people', among: ALL })
    expect(one('paid 900 for the boat, split in 4')).toMatchObject({ amount: 90000, sure: true })
  })

  it.each([
    ['sent Sam 500', 'Riya', 'Sam', 50000],
    ['paid 500 to Sam', 'Riya', 'Sam', 50000],
    ['paid Sam 500 for the cab', 'Riya', 'Sam', 50000],
    ['transferred 2000 to Kabir', 'Riya', 'Kabir Mehta', 200000],
    ['gpayed Ayush 750', 'Riya', 'Ayush', 75000],
    ['Sam ko 500 bhej diye', 'Riya', 'Sam', 50000],
    ['Sam ko 500 diye', 'Riya', 'Sam', 50000],
    ['got 500 from Sam', 'Sam', 'Riya', 50000],
    ['Sam se 500 mile', 'Sam', 'Riya', 50000],
    ['Sam paid me 500', 'Sam', 'Riya', 50000],
    ['returned 300 to @Ayush', 'Riya', 'Ayush', 30000],
  ])('“%s” is a payment between two people', (line, from, to, amount) => {
    expect(one(line)).toMatchObject({ kind: 'payment', sure: true, payer: from, to, amount })
  })

  it('in a chat of two, “sent you 500” is to the other one', () => {
    const rows = readChat(parseChat('12/11/2026, 09:00 - Riya: hi\n12/11/2026, 09:01 - Sam: sent you 500\n12/11/2026, 09:02 - Riya: paid 300 for chai')).rows
    expect(rows[0]).toMatchObject({ kind: 'payment', payer: 'Sam', to: 'Riya', amount: 50000 })
    expect(rows[1]).toMatchObject({ kind: 'expense', payer: 'Riya', among: ['Riya', 'Sam'] })
  })

  it('a line to someone outside the chat is an expense', () => {
    expect(one('paid 500 to the driver')).toMatchObject({ kind: 'expense', amount: 50000 })
    expect(one('transferred 5000 advance to the villa owner')).toMatchObject({ kind: 'expense', sure: false, title: 'Advance to the villa owner' })
  })

  it('every row has a key that stays the same for the same message, and differs otherwise', () => {
    const a = rowsOf(['paid 1200 for cab', 'paid 1200 for cab'])
    const b = rowsOf(['paid 1200 for cab', 'paid 1200 for cab'])
    expect(a.map((r) => r.key)).toEqual(b.map((r) => r.key))
    expect(new Set(a.map((r) => r.key)).size).toBe(2)
    expect(rowKey(['a', 1])).not.toBe(rowKey(['a', 2]))
  })

  it('leaves WhatsApp’s own notes out of the people', () => {
    const reading = readChat(parseChat('12/11/2026, 21:41 - Riya changed the subject to "Goa: the trip"\n12/11/2026, 21:42 - Riya: paid 500 for chai\n12/11/2026, 21:43 - Sam: ok'))
    expect(reading.members).toEqual(['Riya', 'Sam'])
    expect(reading.rows).toHaveLength(1)
  })

  it('a year of chatter is read quickly and only the money comes back', () => {
    const lines: string[] = []
    for (let i = 0; i < 6000; i++) lines.push(`12/11/2026, 10:${String(i % 60).padStart(2, '0')} - ${i % 2 ? 'Riya' : 'Sam'}: ${i % 100 === 0 ? `paid ${100 + i} for chai` : 'ok see you at 8, bring 2 chargers'}`)
    const started = Date.now()
    const reading = readChat(parseChat(lines.join('\n')))
    expect(reading.rows).toHaveLength(60)
    expect(Date.now() - started).toBeLessThan(4000)
  })
})
