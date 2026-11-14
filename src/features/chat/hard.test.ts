import { expect, it } from 'vitest'
import { parseChat } from './parse'
import { readChat } from './read'

const CHAT = `01/11/2026, 08:12 - Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them. Tap to learn more.
01/11/2026, 08:12 - Aditya Rao created group "Coorg 🏞️ boys"
01/11/2026, 08:12 - Aditya Rao added you
01/11/2026, 08:15 - Aditya Rao: Guys homestay is 4500 per night, 2 nights. ok?
01/11/2026, 08:16 - Nikhil: done bro
01/11/2026, 08:20 - +91 98450 12345: 👍
01/11/2026, 08:31 - Aditya Rao: Booked homestay. Paid 9000 advance
01/11/2026, 09:02 - Nikhil: petrol 2500 bhara maine
01/11/2026, 09:05 - Varun S: toll 345 paid
01/11/2026, 09:40 - Nikhil: breakfast at Kamat 780rs. paid by me
01/11/2026, 11:15 - Varun S: bhai mera number 9845098450 pe gpay kar dena
01/11/2026, 13:30 - Aditya Rao: Lunch 1,860/- (I paid)
01/11/2026, 13:31 - Aditya Rao: beer 1200 only for me nikhil and varun
01/11/2026, 16:00 - +91 98450 12345: Jeep safari 600 per head, I paid for all
01/11/2026, 19:45 - Nikhil: dinner 2.2k paid
01/11/2026, 19:50 - Varun S: Rs.150 tip diya
01/11/2026, 21:00 - Aditya Rao: Day 1:
Homestay 9000
Lunch 1860
Beer 1200
Total 12060
02/11/2026, 08:00 - Varun S: aaj 10 baje nikalna hai
02/11/2026, 09:10 - Nikhil: coffee estate tickets 4 x 250 = 1000 paid
02/11/2026, 12:00 - Varun S: I'll pay for lunch today
02/11/2026, 13:10 - Varun S: lunch done 1640
02/11/2026, 15:00 - Nikhil: Aditya paid 500 for honey and spices
02/11/2026, 18:20 - Aditya Rao: Nikhil ko 2000 bhej diye
02/11/2026, 18:22 - Nikhil: got it 👍 received 2000 from Aditya
02/11/2026, 20:10 - +91 98450 12345: sent 1500 to Aditya Rao
02/11/2026, 21:00 - Varun S: total kitna hua?
02/11/2026, 21:05 - Aditya Rao: around 28k I think
02/11/2026, 21:06 - Nikhil: per head 7k approx
02/11/2026, 22:00 - Varun S: <Media omitted>
03/11/2026, 09:00 - Aditya Rao: balance homestay 0, already paid full 9000
03/11/2026, 10:30 - Varun S: Paid ₹420 to Shell Petrol Pump
03/11/2026, 12:45 - Nikhil: snacks n chai 310`

it('reads a real-looking trip chat the way a person would', () => {
  const file = parseChat(CHAT, 'WhatsApp Chat with Coorg 🏞️ boys.txt')
  const r = readChat(file)
  expect(file.name).toBe('Coorg 🏞️ boys')
  expect(r.members).toEqual(['Aditya Rao', 'Nikhil', '+91 98450 12345', 'Varun S'])
  const line = (row: (typeof r.rows)[number]): string => `${row.sure ? 'sure' : 'check'} ${row.kind} ${row.payer}${row.to ? ` > ${row.to}` : ''} | ${row.title} | ${row.amount / 100} | ${row.everyone ? 'all' : row.among.join(', ')}`
  expect(r.rows.map(line)).toEqual([
    'sure expense Aditya Rao | Homestay | 9000 | all',
    'sure expense Nikhil | Petrol | 2500 | all',
    'sure expense Varun S | Toll | 345 | all',
    'sure expense Nikhil | Breakfast at Kamat | 780 | all',
    'sure expense Aditya Rao | Lunch | 1860 | all',
    // Offered at first (a bare line), then confirmed by the day’s recap list; shared by the three it named.
    'sure expense Aditya Rao | Beer | 1200 | Aditya Rao, Nikhil, Varun S',
    'check expense +91 98450 12345 | Jeep safari | 2400 | all',
    'sure expense Nikhil | Dinner | 2200 | all',
    'sure expense Varun S | Tip | 150 | all',
    'sure expense Nikhil | Coffee estate tickets | 1000 | all',
    'check expense Varun S | Lunch | 1640 | all',
    'sure expense Aditya Rao | Honey and spices | 500 | all',
    // Said by Aditya, confirmed by Nikhil: one payment, not two.
    'sure payment Aditya Rao > Nikhil |  | 2000 | ',
    'sure payment +91 98450 12345 > Aditya Rao |  | 1500 | ',
    'sure expense Varun S | Shell Petrol Pump | 420 | all',
    'check expense Nikhil | Snacks n chai | 310 | all',
  ])
})
