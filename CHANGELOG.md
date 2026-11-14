# Changelog

## v9.1 — 15 Nov 2026

**What twenty customers found in v9.0, fixed.** Twenty people (an organiser, a Hinglish flat, an office of twelve, a first-timer, a low-tech uncle, a sceptic who tried to cheat the score…) drove v9.0 on phone-sized screens and checked every number by hand. Average "would use": 3.45 of 5. The arithmetic was right throughout; what was wrong was the reading of some messages and a few untrue sentences.

### Chat to split
- Hinglish payments: "Sid ne 400 diye mujhe", "Neha ne mujhe 800 bheje" and "Neha 3k transfer kiya tujhe" are payments between two people, not shared expenses. "udhaar diya Neha ko 700" is money that moved.
- Never ticked by itself any more: a question ("paid? 300", "…de diye the maine?? ya Rohit ne"), a payment that failed, a bank’s "Transaction successful".
- The right number: the amount the verb points at ("paid 600") wins over a pin code, a cricket score or a flight number; "32000 total, 8000 each" is 32,000; "2 chai 40 each" is two chais; "USD 20" is not rupees; "on 12/11" is not a head count.
- Who shares it: "Rohit ke saath", "sirf Neha aur Aman", "3 log baant lena Aman Neha", "split 3 (Aman, Neha, Sid)", and a split said in the very next message.
- The same money said twice the same day is only offered, with the reason. Two people with one first name are never guessed.
- "le aaya", "laaye", "mangaya" are bought. Titles drop the chatter ("Electrician", not "Electrician ko de diye fan theek karne").
- People: one phone number written two ways is one person. Names in the chat are matched to people you already have ("Riya Sharma" is your "Riya") and shown, with a choice; two possible people are asked, not guessed.
- The same chat again under another file name (an iPhone calls every export `_chat.txt`) or pasted is recognised by its messages, so nothing is added twice. Undo puts an existing group back exactly as it was.

### Everything else
- **Kitty** counts from the moment it starts (a bill from that morning is not kitty spending); Put in − Spent = Left reads true; top-ups name each person’s own amount.
- **Came late:** a stay is never taken off a late joiner (it goes to Split by nights), a nights split is never overwritten, the banner names the expenses, percent splits are fixed in one tap.
- **Ask** honours "in Goa", refuses names it doesn’t know and commands, answers "how much did Sam pay" and breakdowns by category, group and month.
- **Settle Score** can’t be farmed with ₹20 chais, shows no number without history, and its sentences only claim what the factors show.
- **Shagun book:** Done never loses a typed envelope; a repeated family is kept, never dropped.
- **Story** percentages match the Totals tab; **one payment instead of two** says who is cleared and what is left; the **expense claim** shows the whole bill for a share, the period as dates, and reads on a phone; the **wheel** names every slice and never draws a name upside down.
- Odd paise on an itemised bill go round the table, so people who had the same things pay the same.
- Names up to 40 characters. Your UPI ID from your number is now in onboarding and your profile. /get is readable in dark mode. Group tools are 44 px.

## v9.0 — 14 Nov 2026

**Chat to split, and nineteen more things the app now does for you.** The group chat already says who paid for what: Settle reads it and makes the group. Around it, twenty features that take typing and chasing off the user.

### New: the headline
- **Chat to split.** In WhatsApp, Export chat → Without media → Settle (or pick the file, or paste messages). Settle reads the chat **on the phone** (it is never uploaded), finds lines like "paid 1200 for the cab", "Dinner ₹2,400", "petrol ke 1500 diye", "Sam paid 800 for lunch", "sent Sam 500", and shows them to be checked. One tap makes the group: the people (matched by name to the ones you have), every expense split between whoever the message said ("for me and Riya", "except Sam"), and payments between two people recorded. Questions, plans, prices being discussed, times, dates, phone numbers and OTPs are left alone; a bare "Chai 60" or a "400 each" is offered un-ticked with the reason. The same chat again later adds only what is new. Android (.txt) and iPhone (.zip) exports and copied messages; English and everyday Hinglish.

### New: in every group (a row of tools under the balance)
- **Trip kitty.** Everyone puts the same amount with one person. Who has put in, what's left, the day it runs out at this pace, and a one-tap "ask ₹500 more each". Worked out from the group's own payments and bills.
- **Who pays?** A wheel that picks who gets this bill: fair (whoever has paid less than their share gets a bigger slice, with the percentages shown) or pure luck. The bill opens with that person already paying.
- **Came late, left early.** Set who was there from when to when; anyone on an expense from a day they weren't there is taken off it in one tap, with Undo.
- **Split by nights.** A stay (hotel, villa, hostel) is split by the nights each person stayed.
- **The story.** A tap-through story of the group: what you spent, the big day, the biggest bill, where the money went, who fronted the most, who paid back fastest. Every slide shares as a picture.
- **"Looks like this trip is done."** A few days after the spending stops, a card (in the group and on Home) says how many payments settle it.
- **A group's usual split.** A couple's 60/40 or a flat's shares, set once: every new expense in the group opens already split that way.

### New: on Home
- **Clear everything.** Owe three people? One screen, one person after another: pay, tick, next.
- **One payment instead of two.** You owe Sam ₹500 and Riya owes you ₹500: Settle writes the message asking Riya to pay Sam directly (with a pay link when Sam's UPI ID is known) and one tap clears both.
- **Ask Settle.** "Who owes me?", "what did I spend on food in Goa?", "kisne sabse zyada pay kiya?": answered at once, on the phone, with what it understood shown.
- **Split this? (Android app).** A payment your phone's alert shows you made is kept for a few days as a one-tap split, with the amount, the name and the day filled in and the group you're spending with offered first.

### New: you and your people
- **Settle Score.** 300 to 900 for how good you are to share money with: how fast you pay back, what you've left for over a week, bills you picked up. A game, not a credit score; paying something off never lowers it.
- **The shagun book.** Who gave what at whose wedding, housewarming or naming. A fast "envelopes in hand" entry screen, per-family history both ways, and "What should I give?" in one tap (never less than they gave you, grown 6% a year, rounded to an amount ending in 1). In backups; exports as CSV.
- **"Doesn't drink" and "Vegetarian", remembered.** Set once on a person (or on the bill): on every itemised bill after that they are taken off the drinks or the non-veg dishes by themselves, with a banner and Undo. A menu lexicon of Indian dishes and brands, with the traps (ginger beer, virgin mojito, hara bhara kebab, eggless) kept out.
- **Expense claim.** A work trip's expenses as an A4 sheet for the office (Print / Save as PDF) and a CSV: what you paid or your share, by category, total in words.
- **Shared ride, split by where each got off.** Tap people in the order they got off; each pays only for the legs they rode.
- **Your UPI ID with no typing.** Your mobile number (the keyboard offers it) and the app you use on it give the ID for PhonePe, BHIM and Amazon Pay; or paste the ID you copied. Google Pay IDs can't be worked out from a number: its QR is read instead, as before.
- **People from your contacts (Android).** The phone's own picker: names and numbers, no typing; only the ones you choose.
- **The Android app as a download.** `/get` now links the APK (built by GitHub Actions, kept as a release). iPhone stays Add to Home Screen: there is no App Store app.

### Honest limits
- Chat to split reads what people wrote. A chat where nobody wrote amounts has nothing to read, and a message can be misread: that is why everything is shown before it is added, and can be undone.
- Reading a group's WhatsApp for "paid …" messages is not new as an idea (a connected-WhatsApp splitter exists). What is different here: nothing is connected and nothing leaves the phone, it works from the export any member can make, and it adds payments between people too.
- A UPI ID made from a number is right only if that app is set up on that number. The app says so.
- "Split this?" and contacts need Android. Nothing in this release has been tried on a physical phone.
- New screens are in English; other languages fall back to it.

## v8.4 — 14 Nov 2026

**What 20 customers found in "Pay at the counter" and the Board.** A panel of 20 personas drove both on phone-sized browsers (all 20 finished; no ticks were lost, even with four people paying in the same half-second).

### Fixed
- **Added twice? no longer cries wolf.** Two different expenses for the same amount on the same day (a ₹500 cab and ₹500 of snacks) were flagged, and "Remove one" removed the other. Now only the same name counts, the banner names both, and the button says which one it removes.
- **Points can't be farmed.** Sending a rupee at a time earned +30 each. Points now go to the payment that pays off what you owe; bills count from ₹50, shared with someone, up to five a day. "Biggest share" is not handed out when shares are level. The rules on the screen say exactly this.
- **"Did you pay?" comes into view.** Back from the UPI app on a small phone, the question sat far below the Pay button; the page now brings it to you.
- **The bill page explains itself.** With a counter open, the card says each person pays the shop and that "paid you back" there means they paid the shop; the card no longer says "nothing to collect" beside a list of people who owe.
- **A budget of "12abc" is refused** instead of being saved as ₹12; the field says it is only on your phone before you save; one day of spending is no longer called a pace.
- **Plainer words.** "Nobody has to pay the whole bill first" for "nobody fronts the bill"; the QR on the organiser's screen says it opens a Settle page, not the payment; the shop's UPI ID is labelled; paying a person says the QR is sent to the app (not that the app "opens"); a shop is not told a person's ₹2,000 limit.
- **Your own share in cash**, and a warning before paying a share already marked paid.

### Known, not changed
- Anyone in a group can record a payment between two others (as before), so the Board trusts the group's own records.
- The expense rows of a bill paid at the counter still read "paid you back"; the card above them explains it.

## v8.3 — 14 Nov 2026

**The Board: a group that runs itself, and rewards settling up.** A fourth tab on every group. Everything on it is worked out from the expenses and payments the group already shares, so every phone shows the same Board and nobody fills anything in.

### New
- **Leaderboard.** Points for paying a bill for the group (+10), for settling up (+20, and +10 more within a day of owing), for owing nobody (+25) and for debts cleared on time in a row (+5 each). Levels: Starter, Regular, Pro, Legend. The rules are on the screen.
- **Titles, awarded by themselves.** The banker (fronted the most), Fastest to pay back, Always gets the bill, Biggest share, Most patient (owed the most), On the clock (has owed the longest).
- **Streaks.** Debts in a row you cleared within two days; days the whole group has been all square.
- **This week: square by Sunday.** How many of you owe nothing, days left, and a trophy for every week the group ends all square.
- **Milestones.** First expense, 10 expenses, ₹10,000 and ₹50,000 together, everyone has paid a bill, three payments within a day, all square, a trophy week: ticked off as the group reaches them.
- **Your move.** What to do next, with the points it earns: "Pay Riya ₹300: +30 points", or who has kept you waiting longest.
- **Add again.** What the group buys again and again (chai, the cab) sits above the expenses: one tap adds today's, same people, same split, with Undo.
- **Added twice?** Two people adding the same dinner is the commonest mess in a shared group. Same day, same amount, same name: Settle asks, and removes one in a tap (or remembers they are different).
- **Budget and pace.** What is spent, the pace per day, and the day the budget runs out at this pace. The budget is kept on your phone.
- **Today.** What the group spent today, your share, and whether you are better or worse off than this morning.
- **The story so far.** The total, the pace, the biggest bill, where the money went, who fronted most and who pays back fastest: shared to the group chat in one tap with the leaderboard.

## v8.2 — 14 Nov 2026

**Pay at the counter: nobody fronts the bill.** Until now one person paid the whole bill and then collected from everyone. Now everyone pays the shop their own exact share, so there is nothing to collect.

### New
- **Everyone pays the shop.** On a bill you saved: "Pay at the counter" → scan the shop's UPI QR once (camera, or a photo of it; the standee on the counter or the QR printed on the bill). Each person's share, to the paisa, now goes straight to the shop.
- **One link, or the QR on your screen.** Friends at the table scan your screen (or open the link from WhatsApp) on their own phone, with no app and no sign-up, pick their name and tap Pay.
- **One tap into the UPI app, any amount.** A payment to a business may start from a link (it is a payment to a person that UPI apps refuse), so "Pay ₹600 with Google Pay" opens the app on the payment itself, with the shop and the amount filled in: only the PIN is left. A stall that uses a personal QR is paid the ways a person can be.
- **The list ticks itself.** Your screen shows "2 of 4 paid · ₹1,200 of ₹2,400" and ticks each friend off as they pay on their phone: the screen to show the cashier. It runs on the same encrypted relay as shared groups (the secret travels only in the link); where the relay is off, friends send the usual "I've paid" message, or you tick them. Cash at the counter is one tap.
- **Nobody owes anybody.** A friend who paid the shop is settled for that bill: marked paid back on a bill of its own, a payment of their share recorded in a group. Undo takes it back.
- **Shops you've paid before need no scan.** The next bill at the same place is one tap.
- **A QR made for one payment is called out.** If the QR carries a fixed amount (the whole bill), Settle says so and asks for the shop's own QR, since a till may expect a single payment.

### Not yet tried on a physical phone
- Whether each UPI app opens on the payment from the link for every kind of shop QR, and the camera scanner on real cameras. The journey is tested end to end in a browser (two phones, a real QR picture).

## v8.0 — 14 Nov 2026

**Live groups, and paying through your UPI app.** A group is now the same on every friend's phone, and "Pay" hands the payment to Google Pay, PhonePe, Paytm or BHIM.

### New
- **Invite friends to a group.** On a group: "Invite friends" → one link (WhatsApp, share, copy, or a QR for the phone next to you). A friend opens it on their own phone — even one that has never opened Settle — sees the group, taps which name is theirs (or "I'm not on the list"), adds a UPI ID if they like, and joins. No sign-up, no phone number.
- **The group stays the same everywhere, by itself.** Expenses, recorded payments, members, names and UPI IDs sync between the phones every few seconds while the app is open, and catch up when it's opened, comes back online or returns to the front. The group's page says "Live: everyone sees this group · 3 of 4 joined", and what the others add shows up with a short note. Two people changing the same thing: the later change wins on every phone; a deletion travels (and so does its Undo). Offline changes wait on the phone and go out later.
- **End-to-end encrypted.** Each phone encrypts its copy with a key that only travels in the invite link's `#fragment` (never sent to a server). The server (`GET`/`PUT /api/sync/:room`) keeps one opaque blob per group and can't read it. It needs somewhere to keep them: Upstash Redis (Vercel → Storage → Upstash, which sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`), or its own memory on a server that stays up. Where there's nowhere, groups still work **by link**: "Send update" carries the whole group, and opening it merges.
- **Pay ₹400 with Google Pay.** Settle up → Pay now leads with one button and the UPI app you use (picked once, remembered). Up to ₹2,000 the payee's QR is handed straight to the app, which opens on the payment with the UPI ID and amount filled in (UPI's "QR share & pay"); above ₹2,000 the UPI ID is copied and the app opened, because UPI apps take nothing else for a person. A direct link to the app is offered as a try and says plainly that apps often refuse it (NPCI OC 76A tells them to). "I've paid" records it for the whole group.
- **Connect Google Pay: no typing.** Wherever your UPI ID is asked for (joining a group, first set-up, a pay sheet), pick a screenshot of your own QR code from Google Pay, PhonePe, Paytm or BHIM: the UPI ID is read from it on the phone, with the name on the bank account shown to check. No typos, nothing uploaded. Uses the browser's own QR reader where there is one (Chrome on Android and the Android app) and Settle's own, built in, where there is none (Safari on iPhone, Firefox), so it works on every phone.
- **Share your QR to Settle.** With Settle installed on Android, open your own QR in Google Pay (or PhonePe, Paytm, BHIM) and share it to Settle: it asks "Is this your own QR?" and one tap connects it. No screenshot, no typing. A bill photo that carries a shop's QR is never taken for yours: Settle asks.
- **Settle finds out you paid (Android app).** With payment alerts on (Auto-settle), after you tap Pay the phone's own alert that the money left your account ("You paid ₹400 to Riya", or the bank's debit SMS) records the payment by itself, for everyone in the group: nothing to tap. The friend who was paid is ticked off the same way on their phone when the money arrives. In a browser no app can see this, so coming back from the UPI app asks one question, one tap.
- **A friend's UPI ID fills itself in.** When a friend pays you and the alert carries the UPI ID they paid from, Settle keeps it on them (never replacing one they have; Undo forgets it), and in a shared group it reaches every phone: nobody types it.
- **Android app:** a `SettlePay` plugin hands the QR to the chosen UPI app itself (no share sheet) and opens it for bigger amounts.
- **Say it / Snap a bill on the group's page.** An expense spoken (or typed as a sentence) or read from a bill photo, started from a group, lands in that group.
- **Get the app** (`/get`, linked from the landing page): install on Android (the browser's Install) and iPhone (Share → Add to Home Screen), a QR on a computer, and a clear note when the page is open inside WhatsApp's or Instagram's browser, where installing can't work.
- **iPhone app build** (Actions → iOS): the Capacitor iOS project built for the simulator, unsigned. A real App Store build needs an Apple Developer account.
- Backups and "Clear all data" include which groups are shared; the privacy policy says exactly what a shared group puts on the server.

### Tested
- The sync engine as three and four phones in one test (join, add, edit, delete and undo, payments, renames, late joiners, same-moment edits); the live loop through a stand-in server (slim invites, unreadable ciphertext, server down, server without storage); the relay's own rules.
- In real browsers (`e2e/trip.spec.ts`): a Goa trip on three phones end to end; paying under and over ₹2,000; "Say it" in a group; `/get`; a late joiner from the first invite; a cut-off link.

### Not yet tried on physical phones
- That Google Pay, PhonePe, Paytm and BHIM each accept a QR picture shared into them (Android's share sheet, and the Android app's direct hand-over), and what each does with the direct link. The fallbacks (save the QR and upload it in the app; copy the UPI ID) are the ones that were already there.

## v7.2 — 3 Nov 2026

**Bank charges** — the new headline feature. Banks took ₹7,087 crore in minimum-balance penalties alone in FY26 (Rajya Sabha, 28 Jul 2026), and the RBI's rules limit when they may — but nobody checks. No Indian app audits a statement against them; abroad, Cushion proved people want it. Settle does it on the phone, for free.

### New
- **Check a statement.** Add your bank statement — CSV, .xlsx, or the HTML ".xls" banks email; PDF is refused with a message — or paste bank SMS. It's read on the phone; only the charges are kept (date, amount and GST, the narration, the balance around it), never the rest. The bank, account and account type are read from the header or IFSC; a Basic Savings (BSBD/PMJDY), scholarship or minor's account is recognised.
- **Every charge checked against the RBI's rules** (as they stand on 3 Nov 2026, each with its paragraph):
  - minimum balance (RBI/DOR/2025-26/170): it turned the balance negative (160(6)); no warning a month before (160(1)–(2), from the bank's SMS on Android or one question); your average for the month wasn't short, or the charge was more than the shortfall (160(4)–(5)) or than the bank's own published schedule (81(7); HDFC, ICICI, Kotak, Axis); a Basic Savings, scholarship, inoperative or minor's account (86–89, 161, 209, 190); a public-sector bank that stopped charging it (SBI, Canara, PNB, Bank of Baroda, Indian Bank, Union Bank);
  - ATMs: charged in a month with no more than 3 withdrawals that went through — failed ones aren't counted (RBI/2021-22/52, RBI/2019-20/41) — after one question about balance checks at other banks' ATMs; a decline that wasn't your fault; a Basic Savings account's 4 free withdrawals (86(8));
  - NEFT sent online from a savings account (RBI/2019-20/116), incoming NEFT/RTGS, UPI (PSS Act s.10A; from 14 Sep 2026 up to ₹2,000, S.O. 5067(E)), passbook and monthly statement (162–163), reactivating a dormant account (210), what a Basic Savings account gets free, a charge taken twice, GST left behind on a reversal, a prepayment charge on a floating-rate loan, a card's late fee paid within 3 days;
  - GST inside the line ("INCL GST", "+GST") or on its own line (CGST + SGST halves) is paired; reversals are matched; real narrations from HDFC, ICICI, SBI, Axis, Bank of Baroda and Bank of India are recognised.
- **One question, not a form.** When one answer settles a charge, it asks just that (the same question for several charges is asked once). Two answers about the account — what kind, and the average balance it must keep — fold to one line once given.
- **Claim it back.** Wrong charges are grouped per bank into one claim: the letter (each charge, why, the paragraph, the part of it to reverse, the total), your details filled in once, copy / share / email / print, "I've sent it" with the day and complaint number; after the bank's 30 days, the RBI Ombudsman with the form's fields and the complaint (90 days from the later of the 30 days and the bank's reply, RB-IOS 2026); "The bank replied", "It's back". The Ombudsman only takes complaints that went to the bank first — the most common reason it turns them away — so Settle keeps that order.
- **Allowed, but avoidable**: totals per kind with what to do (a Basic Savings account has no minimum balance and the bank must switch you within 7 days — the letter is ready; your own bank's ATMs give 5 free; UPI and online NEFT are free).
- **An ATM refund that came back after the RBI's 5 days** goes to Stuck money, where the ₹100 a day is claimed.
- **Android**: the bank's SMS about a charge is checked as it comes (a toast when it breaks a rule or needs one answer), a reversal is noted, and the bank's "balance below the minimum" warning starts the month the rule gives.
- **Where it shows**: a Home tile (From SMS moves to More when the grid is full), a Home card once something can be claimed, You → Money owed to you, a link on Stuck money, the landing page's announcement and first tile (its numbers from the real rules), backups, the privacy policy, all eight languages.

### After 24 customers tried it
The same 24 people as Stuck money's panel (English and all seven Indian languages, 360–390 px, light and dark) each lived a Bank charges story on a real phone-sized browser: overall 6.5, Bank charges 6.2, would recommend 6.2 — held down by a few serious bugs, all fixed:
- **The RBI Ombudsman step** is noted as the Ombudsman's, never over the bank complaint (it used to replace the bank's date and number and restart its 30 days).
- **Part of it back keeps the rest open**: "₹300 of ₹668 back so far. ₹368 still to come.", with the next step still there; a reversal SMS for a claimed charge counts as money back by itself; all of it back says "HDFC Bank put back ₹668", and the top card says what came back — never "none against the RBI's rules" after charges were found wrong.
- **"The bank replied"** can be noted after the 30 days too, so a late reply moves the 90 days; "See the letter" says when it was sent.
- **Payments are never charges**: a UPI or NEFT payment to someone whose remark says "fee" or "charges" (a college fee, a gym) is left alone, and each kind of charge has a ceiling. A charge removed as read wrong stays removed when the statement is read again.
- **The full charge, not just part**: the warning question is asked even when the charge took the balance below zero ("Answer this and ₹69.91 more can be claimed"). "Not sure" asks the bank to show its notice rather than saying none came. The ATM question asks how many balance checks (None, 1, 2, 3 or more), so one check no longer gives up a charge that was still inside the 3 free.
- **Reading**: negative balances in SMS ("AVl Bal -68.20") and in statements with a separate Dr/Cr column; "+ GST Rs.90" in SMS; several SMS pasted one per line; "Withdrawal (Dr)" / "Deposit (Cr)" columns; Bank of India's "MinBalChrgs", BoB's "MMSREGCHARGE", "Annual fee … Debit Card"; a returned cheque's own amount isn't a charge; the statement's own "From … To …" period, and opening-balance rows aren't counted; an account the header calls Basic Savings isn't asked about; a warning SMS is dated the day it came and names its bank and account; a reversal dated after today isn't counted; SBI's SMS charges after its 2020 waiver are claimed.
- **Letters**: the narration quoted in full; the Ombudsman complaint asks the Ombudsman (and its sheet says so); credit-card and loan charges get their own claim and say "credit card" or "loan account"; the Basic Savings switch goes to the account that paid the most for its minimum balance; charges in date order; the sent date can't be before the charges.
- **Clearer**: a claim shows its complaint number; a charge claimed only in part says so ("₹638.09 of the ₹708 charge"); before the questions are answered the top card says to answer them, not "none against the rules"; what was read is said once, in the note with Undo, not in a toast on top of it; the account questions come after the claims and only for an account with a minimum-balance charge; a "Paste from clipboard" button; "Not a bank charge: remove it"; the SMS-alert tip asks the bank which alerts can be turned off; the ATM rule says the first 3 a month are free at any bank's ATM (5 at your own).
- **Re-tested by 8 of the same customers** (English, Hindi, Bengali, Tamil): 6.4 → 7.4 overall, 6.3 → 7.1 for Bank charges, most of what each had found fixed. What they still found, now fixed: a statement's Undo stays only until anything else changes (it used to wipe claims made after it); the same refund SMS read twice is counted once; after part of it is back, the reminder, the RBI Ombudsman complaint and its form say what came back and ask only for the rest; Home and You say "With the RBI Ombudsman" or "Take it to the RBI Ombudsman" with that claim's own amount, and You shows the stage line; the Ombudsman's "I've raised it" speaks of filing at cms.rbi.org.in, not the bank's 30 days; a claim not sent yet still asks its question and takes in what a later answer adds (no second claim to the same bank); "Drop this claim" leaves its charges out; a claim's amount follows its rows; a wrong charge the bank put back by itself counts as found and back; the Basic Savings letter goes to the account whose charges were allowed; an early-month ATM charge for a month the statement doesn't cover isn't claimed on a count it can't know, and the narration's own "4 TXNS" counts; credit-card and loan complaints get their own category on the Ombudsman form; a letter has no "[your mobile number]" line when none was given.
- **Everywhere**: Home and You follow the claim's stage (with the bank till…, the RBI Ombudsman by…) and the card sits at the top while there's something to do; Bank charges is in More beside Stuck money; dates use each language's month names; toasts wrap their buttons under a long message instead of cutting it off; the late ATM refund for Stuck money is kept until claimed (and only once, with the bank and account); backups, restore and Clear all data count bank charges; sheets open on what they say, not on a button that drops a claim.

## v7.1 — 2 Nov 2026

Stuck money, after 24 people tried it on phones — in English and all seven Indian languages — and told us what got in their way.

### Fixes
- **Part of it back.** Marking ₹1,000 of a ₹1,299 refund back no longer closes it as "All back": the other ₹299 stays open, keeps its days late, and is what the list, Home, the letters and the next "It's back" (which starts at what's still owed) talk about. More of it back adds up. An Android reversal alert for part of it does the same.
- **Back, but the bank still owes for the wait.** Once the money is back, the case shows the compensation owed — not the original amount "On its way" — under a new "Owed for the wait" section, and walks the bank → RBI Ombudsman ladder for that amount.
- **The list says where each one stands**: Needs you, Waiting on them, Owed for the wait, Not due yet, Got back, Set aside. Raised cases keep their days late and the ₹ owed. Titles say what it is ("Failed payment to Swiggy", "Flipkart refund") so a shop never looks like a friend who owes you; rows show the order number.
- **The clock is in date order**, says where each due date comes from (the date they gave, their own timeline, or the usual 7 working days — never a promise that wasn't made), and shows what comes next and the last day for the RBI Ombudsman.
- **Ombudsman timing.** The bank's 30th day is still the bank's; the Ombudsman is offered from day 31 — or at once after "My bank replied or said no". The 90-day window counts from that reply. No more made-up deadline after a complaint is with the Ombudsman, and a closed window is said plainly.
- **Airline refunds paid by card** are due within the DGCA's 7 days even when the airline says later, and the app and the letters say it's the DGCA's rule.
- **Wallets and NACH.** A wallet payment's complaint goes to the wallet company (Paytm, PhonePe, Amazon Pay, MobiKwik), not "your bank". A debit after you cancelled a NACH mandate gets a letter that says exactly that, not "the payment failed".
- **Amounts and dates.** "99,99,999" typed with Indian commas is ₹99,99,999, not ₹99.99. Future days and a promise before the cancellation are caught. Dates from another year show the year.
- **Duplicates.** The same reference or order number can't be tracked twice (it opens the one you have); a pasted SMS you've already tracked says so.
- Undo after adding a case no longer lands on "This one's gone"; Delete asks first (and offers Set aside).

### New
- **Your bank, app and account on the form**, with labels for the way you paid (ATM slip number, card's last 4, IMPS reference, mandate UMRN, PNR), so letters no longer say "[your bank's name]". "Failed payment or refund?" says which is which (an IRCTC booking that failed but took the money is a failed payment).
- **Letters ready to send**: your mobile, city and address filled in once (kept on this phone, never in backups), the email address you send to remembered per bank or business, a two-line summary in your language of what the English letter asks, the complaint history carried into every later step (the NCH message includes the AirSewa complaint), a printable copy with an acknowledgement slip for the branch, and NPCI's MyUPI only within its 45 days.
- **Paste several messages at once.** Each is read on its own, so an OTP in the paste no longer hides a failed payment; a debit SMS can become a failed payment with one "Yes, it failed"; anything not recognised keeps what it found for the form. Hindi and Hinglish bank SMS, and 18 more banks (Canara, Union, Bank of India, Indian Bank, IOB, Karur Vysya, City Union and others), are recognised. A pending payment waits for its final SMS instead of being called stuck.
- **Remind me** on the next deadline, as a calendar event made on the phone (or Google Calendar). **A win card** when it's all back, with something to share that carries no references or account digits. **Notes** on a case. **"They don't answer"** goes straight to the next step.
- **Easier to find.** A Stuck money tile on Home from day one; the Home card names the case and opens it; it sits above the first-split card when something needs you; onboarding has a Stuck money slide, and arriving from a Stuck money link lands there. The More sheet is now "More": getting your money back, then starting a split.
- Backup, restore and Clear all data count stuck payments.

### Changed
- Toasts give long messages (and long translations) time to be read, have a close button, stay with the page they were shown on, and sit above an open sheet instead of over its buttons; a plain message makes way for a sheet, an Undo stays.
- **Regional languages.** Hindi and Bengali vowel signs no longer clipped in status pills; words no longer break mid-word; Tamil and Bengali case endings no longer glued on with a hyphen; Undo no longer reads as "take the money back"; "you" no longer flips the meaning of a share line. Rent & HRA is now in all eight languages, and the You tab, backup note, Home's example sentence and screen-reader labels are translated.
- Privacy policy: letter details stay on the phone and out of backups; a backup file is readable by anyone who has it; what the Google Calendar link sends; the app's check-ins with the server.

### After the re-test
The same 24 people tried the fixed build: overall 7.0 → 8.0, Stuck money 7.3 → 8.3, would recommend 7.0 → 8.1; of their 72 earlier top asks, 35 were fixed and 37 partly. What they still found:
- **Money back is a dated history.** Each sum that comes back, and compensation paid later, keeps its own date — in the clock, the win card and every letter ("₹2,000 reversed on 30 October 2026 and the remaining ₹3,000 on 1 November 2026"). "They've paid the ₹300" has its own short sheet; more back than was stuck, or a date before the payment, is caught.
- **The RBI Ombudsman's 90 days** run from the end of the bank's 30 days or its last reply, whichever is later (RB-IOS 2026, the RBI's FAQ Q17): noting an early reply no longer shortens them. The sheet shows the case's own last day, the scheme, and the postal route (CRPC, Chandigarh); a later reply can be noted at the Ombudsman step too.
- **Letters are send-ready.** No "[your UPI ID]" (your profile's, or a field to add it); signed with your name, never "You"; a warning before sending with blanks left; card and ATM letters say "Card ending 7712" and "ATM: …"; wording follows where the case stands (before or after the due date, citing the earlier ticket); NACH after a revoked mandate cites row 7(b); airline letters say "Cancelled on" and the DGCA rule once, with a Nodal Officer step.
- **Paste reads what the message says.** A message's own date is the date (and "in 7 working days" counts from it); no date, and it asks; up to 50 messages, none dropped silently; a Hinglish "credited back" is a promise, not money back; a bank's failure SMS, or a matching debit, confirms the money left; a NACH "returned unpaid" isn't money that left; pending stays pending; compensation credits and part reversals are recognised.
- **Home**: New group keeps its tile; the Stuck money tile shows only when there's no Stuck card; the card names the most urgent case "+ N more", and sits on top (compact) only when something needs you. More is "From friends" and "From banks and shops"; You groups them as "Money owed to you".
- **Toasts** go away when a sheet opens, have a close button, stay two lines at most, and no longer look like the main button; focus returns where it was.
- "Share the win" adds the app's link; the DGCA is credited when its date ties with the airline's; the list sorts by urgency and stops mangling order and PNR numbers; every new string in all eight languages.

## v7 — 2 Nov 2026

From "friends who owe you" to "banks and businesses who owe you": money stuck in a failed payment or a refund that never came, tracked to the day and claimed the way the RBI says.

### New
- **Stuck money.** A UPI, card, ATM or IMPS payment that failed but took your money, or a refund a business promised (Amazon, Flipkart, Swiggy, Zomato, IRCTC, airlines…), tracked until it's back. For a failed payment Settle uses the RBI's deadline for that kind of payment (RBI/2019-20/67, 20 Sep 2019): T+1 for UPI to a person, IMPS, card-to-card, NACH and on-us wallets; T+5 for UPI to a shop, cards online or at a shop, ATM cash not dispensed and AePS — calendar days from the payment, as the circular counts them; the longer one when the way you paid isn't known. A refund goes by the date the business gave, or its published timeline (DGCA's 7 days for an airline's card refund). Past the deadline it counts the ₹100 a day the circular says the bank pays on its own, without being asked.
- **The complaint ladder, with the letter ready.** Each stuck payment says what to do today: a failed payment goes to your bank or UPI app, then — after 30 days without a fix — to the RBI Ombudsman (cms.rbi.org.in, Reserve Bank – Integrated Ombudsman Scheme, 2026); a refund goes to the business, then the National Consumer Helpline (1915 or WhatsApp), then a consumer commission (e-Jagriti); an airline's refund can go to AirSewa. The letters carry the dates, the amount, the circular's row, the compensation so far and your name and UPI ID — copy, share or email them. "I've raised it" keeps the date and complaint number; "It's back" records the money and any compensation paid, and a delayed reversal without compensation turns into a claim for it. Settle drafts, you send: it never contacts anyone for you.
- **Found by itself on Android.** With notification access on, the Settle Android app also reads failed, pending and refund alerts from the UPI apps (and from your bank's SMS, if you allowed it), and refund alerts from a short list of shopping, food and travel apps. A failure becomes a stuck payment — confirmed when the bank's debit for the same amount arrives, or with one tap ("Did ₹500 leave your account?") — and an open one is ticked off when the reversal or refund lands, with a toast and Undo. Read on the phone, never uploaded. On iPhone and the web: paste or share the bank SMS, or add one in three taps.
- Home shows what banks and shops owe you when something is open; Stuck money is also under Home → More and You → Shortcuts. Stuck payments are in backups.

### Changed
- **The landing page and README lead with Stuck money**: a "New" link above the tagline, the first feature tile (with its numbers from the real rules), and three new questions in the FAQ — how it works, whether the ₹100 a day is real, and whether Settle files complaints (it doesn't). Auto-settle's tile says it now catches failed payments and refunds too.
- **Privacy policy**: what Stuck money keeps on the phone and in backups, and what the Android app now reads — failed-payment, pending and refund alerts from UPI apps and a few shopping, food and travel apps, and a bank's debit SMS only to check that a failed payment took the money — and that complaint letters leave the phone only when you send them.

### Known limits
- The wording of failed-payment, reversal and refund alerts comes from published samples and test texts, not yet from notifications collected on real phones; the shopping and travel apps' package names are as Google Play lists them and haven't been tried on a device.
- Deadlines are counted in calendar days, as the circular does; NPCI's own FAQ speaks of working days for UPI reversals, so a bank may answer by that. Refund timelines in working days skip weekends but not bank holidays.
- Settle states the published rules and where to complain. It isn't legal advice, it can't make a bank or a business pay, and it can't see compensation paid to you unless you record it.

## v6 — 27 Oct 2026

Getting paid back, start to finish — and the things nobody checks: the bill, the electricity, who has actually paid.

### New
- **Auto-settle — payments tick themselves off (Android app).** Settle now comes as an Android app (`android/`, Capacitor loading the live site, built by `.github/workflows/android.yml`). With Auto-settle on, when Google Pay, PhonePe, Paytm, BHIM, Amazon Pay, MobiKwik or CRED — or, if you allow it, your bank's SMS — says money arrived, Settle matches it to whoever owed you and ticks them off, with a toast and Undo. A payment it isn't sure of (a part payment, a name it can't place) waits under "Payments to check" for one tap; one that fits nobody is let go. The same payment told twice (the UPI app's alert and the bank's SMS) is counted once. Only alerts from those apps that say money came in are kept, on the phone, until Settle reads them; every other notification is ignored. A clear disclosure comes before Android's notification-access switch, and it can be turned off there any time. The matching is "Who's paid?"'s, which stays the way in on iPhone and the web.
- **Who's paid?** Bring in what you received and Settle ticks off everyone who paid you back, in one go. Three ways in: screenshots of your UPI app's history (up to 6, read by `POST /api/history` and not kept), a bank statement (CSV, Excel, or the HTML ".xls" banks email) or pasted bank SMS — the statement and SMS are read on the phone and never uploaded. Each payment is matched on the bank names you've confirmed, the UPI ID (whole or masked), the name, the amount and the date: clear matches are ticked for you, doubtful ones ask with one tap, and part payments, overpayments and one payment for several splits are offered as such. A statement whose running balance doesn't add up, a row only a green colour marks as money in, and a cut-off row are never ticked for you; references already marked are skipped. One tap marks them, with Undo; the bank name you confirm is remembered; whoever paid in cash is one more tap. Share a statement from the bank's or mail app (Android) and it opens here. From Home → More and any expense people still owe on.
- **Part payments.** Someone who pays ₹200 of their ₹420 now owes ₹220 — everywhere: Home, the friend's page, To collect, the expense ("₹200 paid · ₹220 left"), reminders and their pay link, which asks only for the rest and says what's already paid. "Who's paid?" and Auto-settle record a part payment as just that, instead of marking the whole share paid. Edits keep what was paid; a share it now covers is ticked off.
- **To collect.** Everyone who owes you on one list, the longest wait first, with what it's for and how long it's been. Remind opens the message in the tone that comes next — friendly, then funny, then firm — and every reminder sent anywhere in the app is remembered, so each row says when you last asked (and to give it a day if it was today or yesterday). Late at night it says the reminder can wait. Paid ticks someone off across their splits and groups, with Undo. Home's balance card, when you're only owed, says **Get paid back** and opens it.
- **Bill check.** Before a restaurant bill is split, Settle checks it: a service charge (or "staff contribution") added by default — optional under the CCPA guidelines of 4 Jul 2022, upheld by the Delhi High Court on 28 Mar 2025 (under appeal) — with the GST charged on it; service tax and its cesses (gone since July 2017); GST on a bill of supply; an odd tax rate; CGST ≠ SGST; a total above the bill's own lines; the same line twice. "Possible saving ₹121.01", a polite note for the staff in any of the eight languages, the consumer helplines, and one tap to split without the charges (with Undo).
- **Fair bijli.** Split a flat's electricity bill by the tariff's slabs instead of equally: everyday units by days at home, each higher slab only on whoever used that much, a lost subsidy on whoever crossed the line. Tariffs in force on 27 Oct 2026 for BESCOM, MSEDCL, AEML, Delhi, TNPDCL, TGSPDCL, CESC, Torrent, UGVCL and UPPCL, or a flat rate; extra units from AC nights (BEE star-label energy, calibrated to the bill) or room meters; reconciled to the bill to the paisa. Saved as an ordinary split. From Home → More, or a rented flat's page.
- **What each had.** A fifth way to split a meal with no bill: type what each person had; tax, tip or a discount on what was paid is shared in proportion. The split-mode picker says in one line what each way is for.
- **Ask each person, and "I've paid" replies.** The share sheet lists everyone who still owes, each with their own WhatsApp message and a personal pay link that opens on their share. On the pay page a friend says how they paid (UPI with the 12-digit reference, or cash) and sends a reply; you tap it and they're ticked off after one confirmation.
- **Rent, split right — with HRA receipts.** A flat's rent with each flatmate's share and the landlord's UPI ID and PAN. One rent link a month makes the landlord the payee: each flatmate pays their own share directly (nobody fronts the whole rent), and has their own payment trail. HRA rent receipts for each flatmate's share — a month or a quarter of the financial year, amount in words, landlord PAN (needed above ₹1,00,000 a year), a ₹1 revenue stamp on cash receipts above ₹5,000 — printed or saved as PDF. Home → More and You → Shortcuts.
- **Proprietary licence.** All rights reserved (LICENSE); open-source components listed in THIRD-PARTY-NOTICES.md.

### Changed
- **Paying a person, the ways UPI allows.** NPCI has payer apps refuse a payment to a person that starts from a link or intent (OC 76C, April 2025; UPI Consolidated Circular 7.9), so the "Pay with GPay / PhonePe…" buttons are gone. On a computer: the QR, scanned with any UPI app (amount and note filled in). On a phone, up to ₹2,000: save the QR to the gallery and upload it in the UPI app (a QR picture pays a person up to ₹2,000), or copy the UPI ID; above ₹2,000: copy the UPI ID and the amount. "Show QR for another phone" works for any amount. Back from the UPI app, "Did you pay …?" leads to "I've paid" or to what to do when a payment doesn't go through. The name check reads honestly (UPI apps show the bank's name).

### Fixes
- "Who's paid?" (and Auto-settle) ticked a group expense's share as paid, which a group ignores — its balances still said they owed. Money owed in a group is now matched against the group's simplified payments and settled by recording the payment in the group, with Undo.
- **Offline straight after the first visit.** A screen opened on the first visit (the split screen, say) was missing offline until Settle had been opened online once more: its code loaded before the service worker took over, and loading it again never asked the network. When the worker takes over, Settle now fetches what the page already loaded once more through it (from the browser's cache), so it's kept. The scenario test that was red since v5 passes.
- A bill photo shared into Settle (Android) opened "Paid? Drop the screenshot" and stopped at "That doesn't look like a UPI payment". It now goes on to the bill scan.
- The Hindi firm reminder no longer assumes the sender is male.
- "Who's paid?" and "To collect" fit a 320 px phone; long choices wrap instead of being cut off.

### Known limits
- Auto-settle reads the wording UPI apps and banks use today ("Riya Sharma paid you ₹420", "Received ₹420 from …", "Rs.420 credited … VPA …"); the exact alerts of each app version have not been collected from real phones yet, so some may need adding. The Android app is built as a debug APK by CI; a Play Store release needs a signing key and Play's review of notification access.
- Bank statement layouts were built from published formats and synthetic files for HDFC, SBI, ICICI, Axis and Kotak; real statements may need small fixes.
- The saved-QR route (₹2,000 cap) and opening UPI apps on iPhone have not been tried on physical phones yet.

## v5 — 24 Oct 2026

### New
- **Eight languages.** English (the default), Hindi, Bengali, Marathi, Tamil, Telugu, Kannada and Gujarati. Every app screen reads from a message catalog; each language loads as its own file only when it is chosen, and English ships with the screens that use it. Chosen on the first onboarding screen or in You → Language, and kept on the phone. Public pages (pay links, claim links, collections) use the phone's language with a small switcher. Money and dates keep Indian grouping with Latin digits.
- **Paid? Drop the screenshot.** Drop a GPay, PhonePe, Paytm or BHIM payment screenshot. `POST /api/proof` reads the status, amount, payee, UTR and date, and Settle matches it to who owes you. It marks the person paid after you confirm, and refuses pending or failed payments, payments to someone else, payments whose UTR is already recorded, and screenshots that are not payments. Android can share a screenshot straight to Settle; elsewhere, use the picker.
- **Entry points.** "Got a payment screenshot?" on the friend page and the Settle-up page.
- **Install Settle.** An install card on Home (after the first split or the second visit) and a You row. Android and desktop Chrome use the browser's install prompt; iPhone Safari gets the two Share → Add to Home Screen steps. Hidden once installed; dismissible for 30 days.

### Fixes
- Accessibility: the language tiles keep their contrast, radio chips use `aria-checked`, the currency button and the people pills read their visible text.
- Pay links: the "Which one are you?" area holds its place while the link loads, so the page does not jump on a slow connection.
- Pro checkout messages, scan busy and offline messages, the Just-say-it errors and data errors read through the catalog too.

### Not in this release
- **Shagun book.** Only the "What should I give?" rule is in the code (`src/features/shagun/suggest.ts`, unit-tested). The ledger, the screens and the reminders are not built, and the feature is off.
- **Offline, straight after the first visit.** The split screen can say "You're offline" on the first trip until the app has been opened once more online. The fix in progress waits for the service worker before preloading; the scenario test is still red.
- **Translation review.** The Indian-language catalogs are complete but have not been reviewed by native speakers.
- **English-only copy.** The public landing page and the policy text on the privacy and terms pages stay in English.

## v4 — 23 Oct 2026

### New
- **Claim your items**: one claim link per scanned bill; friends tick what they had on their phones, replies merge into the split.
- **From SMS**: paste or share a bank / UPI alert to split it, settle a friend, or let AI read it. OTPs are refused.
- **Food orders**: delivery-app screenshots keep delivery, platform, packaging, surge and small-order fees apart and share them fairly.
- **Speak to split** in eight Indian languages; number words ("dhai hazaar") become digits.
- **Collections (chanda)**: a `/pool` link for gifts, parties, trips and puja; contributors pay by UPI and reply.
- **Udhaar**: lend or borrow in two taps, part payments, reminders.
- **Next round's on you**: rotation for groups that take turns paying.
- **Trip currency**: ECB rates for the expense's day (cached, offline-safe), your own rate or your bank's total; trips spend in one currency and settle in another.
- Message catalogs and `t()` for every new screen (English now; Indian-language catalogs next).

### Faster (low-end Android profile: 4× CPU slowdown, 1.6 Mbps, 150 ms RTT; see bench/RESULTS.md)
- Opening a group with 300 expenses: 7.69 s → 1.59 s.
- Home with two years of data: 8.47 s → 6.52 s; data layer 2.61 s → 0.81 s.
- Activity, scrolling to the oldest of 1,500 expenses: 165 s → 66 s, then a further −24% (78 → 59 s, re-measured on a busier machine).
- Pay links: brotli assets (−11% JS) and the page's own code preloaded (content −10%).
- Currency names and the small collections no longer cost every start.

### Deploy
- Render Blueprint (`render.yaml`), Cloudflare Pages with an `/api/*` proxy, GitHub Actions CI, step-by-step DEPLOY.md. No new paid services; exchange rates come from the ECB's free feed.
