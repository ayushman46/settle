/** What twenty customers typed that the reader got wrong: each line here was a wrong number or a wrong name once. */
import { describe, expect, it } from 'vitest'
import { parseChat } from './parse'
import { readChat, type ChatRow } from './read'

const line = (row: ChatRow): string =>
  `${row.sure ? 'sure' : `check(${row.doubt})`} ${row.kind} ${row.payer}${row.to ? ` > ${row.to}` : ''} | ${row.title} | ${row.amount / 100} | ${row.everyone ? 'all' : row.among.join(', ')}`

/** Reads messages written as "Name: text" (one a minute, same day unless a line starts with "+1d "). */
function read(members: string[], said: string[]): string[] {
  let day = 3
  let minute = 600
  const head = members.map((name, i) => `0${day}/11/2026, 09:${String(i).padStart(2, '0')} - ${name}: hi`)
  const body = said.map((text) => {
    let words = text
    if (words.startsWith('+1d ')) {
      day += 1
      words = words.slice(4)
    }
    minute += 1
    return `${String(day).padStart(2, '0')}/11/2026, ${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')} - ${words}`
  })
  return readChat(parseChat([...head, ...body].join('\n'))).rows.map(line)
}

const FLAT = ['Rohit', 'Neha', 'Aman', 'Sid']

describe('money between two people, the way it is said in Hinglish', () => {
  it('"Sid ne 400 diye mujhe" is Sid paying whoever typed it', () => {
    expect(read(FLAT, ['Neha: Sid ne 400 diye mujhe'])).toEqual(['sure payment Sid > Neha |  | 400 | '])
    expect(read(FLAT, ['Rohit: Neha ne mujhe 800 bheje'])).toEqual(['sure payment Neha > Rohit |  | 800 | '])
  })

  it('"Neha 3k transfer kiya tujhe rent ka" is a payment to Neha, not a shared expense', () => {
    expect(read(FLAT, ['Rohit: Neha 3k transfer kiya tujhe rent ka'])).toEqual(['sure payment Rohit > Neha |  | 3000 | '])
  })

  it('money sent to "you" with nobody named is left alone when there are more than two people', () => {
    expect(read(FLAT, ['Rohit: 500 bhej diye tujhe'])).toEqual([])
  })

  it('a loan given is money that moved', () => {
    expect(read(FLAT, ['Rohit: udhaar diya Neha ko 700'])).toEqual(['sure payment Rohit > Neha |  | 700 | '])
  })
})

describe('what was asked, what failed and what a bank wrote', () => {
  it('a question is only ever offered', () => {
    expect(read(FLAT, ['Sid: Gas wale ko 1500 de diye the maine?? ya Rohit ne'])).toEqual(['check(asked) expense Sid | Gas wale | 1500 | all'])
    expect(read(FLAT, ['Sid: paid? 300'])).toEqual(['check(asked) expense Sid |  | 300 | all'])
    expect(read(FLAT, ['Sid: did you pay 700 yet?'])).toEqual([])
  })

  it('a payment that failed is not money spent', () => {
    expect(read(FLAT, ['Aman: payment of Rs 999 failed, try again', 'Aman: payment failed for 900'])).toEqual([])
  })

  it('a bank’s words are not somebody saying they paid', () => {
    expect(read(FLAT, ['Sid: Transaction ID T2611121234 Rs 450 successful', 'Neha: Transaction successful Rs 450'])).toEqual([])
  })

  it('…unless the person adds that they paid', () => {
    expect(read(FLAT, ['Aman: UPI ref 412398765432 paid 900 for chai'])).toEqual(['sure expense Aman | Chai | 900 | all'])
  })

  it('"order 640 paid by me" is an expense, not an order number', () => {
    expect(read(FLAT, ['Aman: Zomato order 640 paid by me'])).toEqual(['sure expense Aman | Zomato order | 640 | all'])
  })
})

describe('the right number out of several', () => {
  it('takes the amount the verb points at', () => {
    expect(read(FLAT, ['Aman: my pin code is 403001 and i paid 600 for the taxi'])).toEqual(['sure expense Aman | Taxi | 600 | all'])
    expect(read(FLAT, ['Aman: 6E 2341 flight paid 4500'])).toEqual(['check(amounts) expense Aman | 6E flight | 4500 | all'])
  })

  it('"32000 total, 8000 each" is 32,000, not 32,000 each', () => {
    expect(read(FLAT, ['Neha: rent 32000 total, 8000 each, maine owner ko bhej diya'])).toEqual(['sure expense Neha | Rent | 32000 | all'])
  })

  it('"2 chai 40 each" is two chais', () => {
    expect(read(FLAT, ['Neha: 2 chai 40 each'])).toEqual(['check(each) expense Neha | Chai | 80 | all'])
  })

  it('other currencies are not rupees, and a date is not a head count', () => {
    expect(read(FLAT, ['Sid: USD 20 amazon'])).toEqual([])
    expect(read(FLAT, ['Neha: paid 1500 on 12/11 for the boat'])).toEqual(['sure expense Neha | Boat | 1500 | all'])
  })
})

describe('who shares it', () => {
  it('"X ke saath" and "sirf X aur Y"', () => {
    expect(read(FLAT, ['Neha: Rs 75 for parking, Rohit ke saath'])).toEqual(['sure expense Neha | Parking | 75 | Rohit, Neha'])
    expect(read(FLAT, ['Rohit: paid 900 for pizza sirf Neha aur Aman ke saath'])).toEqual(['sure expense Rohit | Pizza | 900 | Rohit, Neha, Aman'])
  })

  it('a count and the names: "3 log baant lena Aman Neha"', () => {
    expect(read(FLAT, ['Rohit: 1,200 ka sofa cover liya, 3 log baant lena Aman Neha'])).toEqual(['sure expense Rohit | Sofa cover | 1200 | Rohit, Neha, Aman'])
    expect(read([...FLAT, 'Kabir'], ['Kabir: paid 1800 for dinner split 3 (Aman, Neha, Sid)'])).toEqual(['sure expense Kabir | Dinner | 1800 | Neha, Aman, Sid'])
  })

  it('the next message says who shares the one before', () => {
    expect(read(FLAT, ['Sid: paid 1,200 for cleaning supplies', 'Sid: sirf Neha aur Aman ke saath split karna'])).toEqual(['sure expense Sid | Cleaning supplies | 1200 | Neha, Aman, Sid'])
  })

  it('…but not when somebody else says it, or it is about something else', () => {
    expect(read(FLAT, ['Sid: paid 1,200 for cleaning supplies', 'Rohit: sirf Neha aur Aman ke saath split karna'])).toEqual(['sure expense Sid | Cleaning supplies | 1200 | all'])
  })
})

describe('who paid, when the message names them', () => {
  it('two people share the first name: offered, never guessed', () => {
    const office = ['Priya', 'Neha', 'Rahul Mehta', 'Rahul S']
    expect(read(office, ['Neha: Rahul paid 4500 for dinner'])).toEqual(['check(who) expense Neha | Dinner | 4500 | all'])
    expect(read(office, ['Neha: Rahul Mehta paid 4500 for dinner'])).toEqual(['sure expense Rahul Mehta | Dinner | 4500 | all'])
  })
})

describe('the same money said twice', () => {
  it('said again the same day in other words: the second is only offered', () => {
    expect(read(FLAT, ['Neha: bijli 2400 bhar diya maine', 'Neha: ₹ 2,400 bijli 👍'])).toEqual(['sure expense Neha | Bijli | 2400 | all', 'check(repeat) expense Neha | Bijli | 2400 | all'])
    expect(read(FLAT, ['Aman: maid 3000 maine diya', 'Neha: I paid 3,000 for Maid'])).toEqual(['sure expense Aman | Maid | 3000 | all', 'check(repeat) expense Neha | Maid | 3000 | all'])
  })

  it('the very same words twice, or the same thing on another day, are two things', () => {
    expect(read(FLAT, ['Neha: paid 50 for auto', 'Neha: paid 50 for auto'])).toEqual(['sure expense Neha | Auto | 50 | all', 'sure expense Neha | Auto | 50 | all'])
    expect(read(FLAT, ['Neha: Chai 20 paid by me', '+1d Neha: paid 20 for chai'])).toEqual(['sure expense Neha | Chai | 20 | all', 'sure expense Neha | Chai | 20 | all'])
  })
})

describe('things that were bought, and titles a person would write', () => {
  it('"le aaya", "laaye", "mangaya" are bought', () => {
    expect(read(FLAT, ['Rohit: groceries 1850 le aaya bigbasket se', 'Sid: diwali sweets 1800 le aaya', 'Aman: Zepto 349 se mangaya'])).toEqual([
      'sure expense Rohit | Groceries | 1850 | all',
      'sure expense Sid | Diwali sweets | 1800 | all',
      'sure expense Aman | Zepto | 349 | all',
    ])
  })

  it('a title on the line above', () => {
    expect(read(FLAT, ['Neha: Groceries\ntotal 1450 paid by me'])).toEqual(['sure expense Neha | Groceries | 1450 | all'])
  })

  it('keeps the name of the thing and drops the talk', () => {
    expect(read(FLAT, ['Rohit: Electrician ko 450 de diye fan theek karne'])).toEqual(['sure expense Rohit | Electrician | 450 | all'])
    expect(read(FLAT, ['Rohit: Zomato 780 maine order kiya sabke liye'])).toEqual(['sure expense Rohit | Zomato | 780 | all'])
    expect(read(FLAT, ['Neha: Dinner 6100 paid at Fisherman'])).toEqual(['sure expense Neha | Dinner at Fisherman | 6100 | all'])
    expect(read(FLAT, ['Neha: paid 900 for lunch day 2'])).toEqual(['sure expense Neha | Lunch day 2 | 900 | all'])
  })

  it('a complaint with a number in it is not ticked, and a year is not money', () => {
    expect(read(FLAT, ['Sid: mera 2000 ka kharcha tha bhai'])).toEqual(['check(short) expense Sid | Kharcha | 2000 | all'])
    expect(read(FLAT, ['Sid: Year of the trip 2026'])).toEqual([])
  })
})
