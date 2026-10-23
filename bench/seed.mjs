/**
 * The "heavy" data set: a long-time Settle user in India — 60 people, 12 groups (one flat with
 * 300 expenses), 1,500 expenses over two years (150 of them itemized restaurant bills),
 * settlements, recurring rent — generated deterministically (seeded PRNG) and run through the
 * app's own split engine and storage schemas, so every record is exactly what the app would
 * have saved. Written as the localStorage entries the app reads at startup.
 *
 *   node bench/seed.mjs            → prints a summary and writes node_modules/.cache/settle-bench/heavy-<date>.json
 *
 * Markers the benchmarks look for (unique titles):
 *   NEWEST_BILL  — the newest expense, an itemized bill (Activity → Expense detail)
 *   OLDEST       — the oldest expense, two years back (Activity scroll target)
 *   GROUP_OLDEST — the oldest expense in the big flat group (Group detail scroll target)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { closeAppModules, loadAppModule } from './lib/appModules.mjs'
import { CACHE_DIR } from './lib/paths.mjs'

export const MARKERS = {
  NEWEST_BILL: 'Dinner at Toit Brewpub',
  OLDEST: 'Housewarming snacks',
  GROUP_OLDEST: 'First month of groceries',
  BIG_GROUP: 'Flat 302, Koramangala',
}

export const HEAVY = { friends: 60, groups: 12, expenses: 1500, bills: 150, bigGroupExpenses: 300, days: 730 }

/* ------------------------------------------------------------------ deterministic randomness */

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Riya', 'Ananya', 'Diya', 'Aadhya', 'Saanvi', 'Pari', 'Anika', 'Navya', 'Myra', 'Kiara',
  'Rohan', 'Karthik', 'Siddharth', 'Pranav', 'Rahul', 'Neha', 'Priya', 'Sneha', 'Pooja', 'Kavya',
  'Arnav', 'Dhruv', 'Kabir', 'Shaurya', 'Atharv', 'Meera', 'Tanvi', 'Ishita', 'Nisha', 'Shreya',
  'Harsh', 'Varun', 'Nikhil', 'Manish', 'Suresh', 'Lakshmi', 'Divya', 'Swati', 'Anjali', 'Bhavna',
  'Sam', 'Imran', 'Farhan', 'Zoya', 'Ayesha', 'Gurpreet', 'Harpreet', 'Joseph', 'Mary', 'Tenzin',
]
const LAST = [
  'Sharma', 'Verma', 'Iyer', 'Reddy', 'Nair', 'Patel', 'Shah', 'Gupta', 'Das', 'Banerjee',
  'Kulkarni', 'Joshi', 'Menon', 'Pillai', 'Rao', 'Singh', 'Khan', 'Fernandes', 'Mehta', 'Chopra',
]
const BANKS = ['okhdfcbank', 'okaxis', 'oksbi', 'okicici', 'ybl', 'paytm', 'ibl', 'axl']

const SPLIT_TITLES = {
  food: ['Swiggy dinner', 'Zomato order', 'Chai & samosa', 'Biryani at Paradise', 'Dosa breakfast', 'Pizza night', 'Momos', 'Thali lunch', 'Office lunch', 'Late-night Maggi'],
  groceries: ['Blinkit groceries', 'Zepto run', 'BigBasket order', 'DMart haul', 'Vegetables & fruits', 'Milk & bread', 'Instamart order'],
  rent: ['Rent', 'Maintenance charges', 'Society maintenance'],
  utilities: ['Electricity bill', 'Wi-Fi bill', 'Gas cylinder', 'Water tanker', 'Airtel postpaid'],
  travel: ['Train tickets', 'Flight to Goa', 'Hotel booking', 'Homestay', 'Bus to Manali', 'Scooter rental'],
  transport: ['Uber to airport', 'Ola ride', 'Rapido', 'Auto', 'Metro card recharge', 'Petrol', 'Parking'],
  shopping: ['Amazon order', 'Myntra sale', 'Decathlon', 'Kitchen stuff', 'Curtains', 'Birthday decor'],
  entertainment: ['Movie tickets', 'Bowling', 'Concert passes', 'IPL tickets', 'Escape room', 'Board game café'],
  subscription: ['Netflix', 'Spotify family', 'Hotstar', 'YouTube Premium', 'Prime'],
  gift: ['Birthday gift for Neha', 'Wedding shagun', 'Farewell gift', 'Diwali sweets'],
  health: ['Pharmacy', 'Doctor visit', 'Gym membership', 'Physio session'],
  other: ['Misc', 'Laundry', 'Maid salary', 'Plumber', 'Cook salary'],
}
const RESTAURANTS = ['Truffles', 'Barbeque Nation', 'Mainland China', 'Haldiram’s', 'Social', 'Paradise Biryani', 'Meghana Foods', 'Empire Restaurant', 'Saravana Bhavan', 'Bombay Brasserie', 'Café Mondegar', 'Karim’s']
const DISHES = [
  ['Paneer Tikka', 32000], ['Butter Chicken', 42000], ['Dal Makhani', 28000], ['Garlic Naan', 7000], ['Butter Roti', 4500],
  ['Veg Biryani', 30000], ['Chicken Biryani', 38000], ['Masala Dosa', 14000], ['Filter Coffee', 6000], ['Gulab Jamun', 9000],
  ['Fresh Lime Soda', 9500], ['Kingfisher Pint', 26000], ['Mocktail', 22000], ['Chilli Paneer', 29000], ['Hakka Noodles', 24000],
  ['Manchow Soup', 16000], ['Tandoori Platter', 65000], ['Jeera Rice', 18000], ['Raita', 9000], ['Brownie Sundae', 25000],
]
const GROUPS = [
  { name: MARKERS.BIG_GROUP, emoji: '🏠', kind: 'home', members: 4 },
  { name: 'Goa trip 2025', emoji: '🏖️', kind: 'trip', members: 6 },
  { name: 'Manali bikers', emoji: '🏍️', kind: 'trip', members: 5 },
  { name: 'Office lunch gang', emoji: '🍱', kind: 'other', members: 8 },
  { name: 'Diwali party', emoji: '🪔', kind: 'event', members: 7 },
  { name: 'Riya & me', emoji: '💛', kind: 'couple', members: 2 },
  { name: 'College reunion', emoji: '🎓', kind: 'event', members: 8 },
  { name: 'Badminton Sundays', emoji: '🏸', kind: 'other', members: 6 },
  { name: 'Pondicherry weekend', emoji: '🌊', kind: 'trip', members: 4 },
  { name: 'PG Indiranagar', emoji: '🛏️', kind: 'home', members: 3 },
  { name: 'Wedding — Kavya', emoji: '💍', kind: 'event', members: 5 },
  { name: 'Ladakh 2024', emoji: '🏔️', kind: 'trip', members: 5, archived: true },
]

/* ------------------------------------------------------------------ generator */

function isoDaysAgo(today, days) {
  const d = new Date(`${today}T12:00:00`)
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function localToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Builds the data set (plain objects, before schema validation). */
export async function buildHeavy({ today = localToday(), seed = 20261023 } = {}) {
  const { expenseShares } = await loadAppModule('/src/engine/split.ts')
  const rand = mulberry32(seed)
  const pick = (list) => list[Math.floor(rand() * list.length)]
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1))
  const chance = (p) => rand() < p
  const nowMs = new Date(`${today}T20:00:00`).getTime()
  const DAY = 86_400_000
  const startMs = nowMs - HEAVY.days * DAY

  const profile = {
    name: 'Ayush Mehta',
    upiId: 'ayush@okhdfcbank',
    currency: 'INR',
    theme: 'system',
    accent: 'lime',
    haptics: true,
    onboarded: true,
    createdAt: startMs - 5 * DAY,
    language: null,
  }

  const friends = [
    { id: 'me', name: profile.name, color: 0, upiId: null, phone: null, createdAt: startMs, lastUsedAt: nowMs },
  ]
  const usedNames = new Set()
  for (let i = 0; i < HEAVY.friends; i++) {
    let name
    do name = `${FIRST[i % FIRST.length]} ${pick(LAST)}`
    while (usedNames.has(name))
    usedNames.add(name)
    const handle = name.split(' ')[0].toLowerCase()
    friends.push({
      id: `f${String(i + 1).padStart(3, '0')}`,
      name,
      color: (i % 7) + 1,
      upiId: chance(0.6) ? `${handle}${int(1, 99)}@${pick(BANKS)}` : null,
      phone: chance(0.5) ? `+9198${String(int(10000000, 99999999))}` : null,
      createdAt: startMs + int(0, 200) * DAY,
      lastUsedAt: nowMs - int(0, 300) * DAY,
    })
  }
  const others = friends.slice(1)

  const groups = GROUPS.map((g, i) => {
    const members = ['me']
    while (members.length < g.members) {
      const f = pick(others).id
      if (!members.includes(f)) members.push(f)
    }
    if (g.name === 'Riya & me') members[1] = others.find((f) => f.name.startsWith('Riya')).id
    const createdAt = startMs + (i === 0 ? 0 : int(10, 600)) * DAY
    return {
      id: `g${String(i + 1).padStart(2, '0')}`,
      name: g.name,
      emoji: g.emoji,
      kind: g.kind,
      currency: 'INR',
      memberIds: members,
      settlements: [],
      createdAt,
      updatedAt: createdAt,
      archived: Boolean(g.archived),
      travelCurrency: null,
      roundSize: null,
    }
  })
  const bigGroup = groups[0]

  // How many expenses each group gets: the flat has 300; the rest share ~420.
  const groupQuota = new Map(groups.map((g, i) => [g.id, i === 0 ? HEAVY.bigGroupExpenses : int(25, 50)]))
  const groupTotal = [...groupQuota.values()].reduce((a, b) => a + b, 0)
  const slots = []
  for (const [groupId, count] of groupQuota) for (let i = 0; i < count; i++) slots.push(groupId)
  while (slots.length < HEAVY.expenses) slots.push(null)
  // Shuffle (Fisher–Yates) so groups and standalone expenses interleave over time.
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[slots[i], slots[j]] = [slots[j], slots[i]]
  }
  // Bills: 150 of the 1,500, spread out; the very newest expense is one (a marker).
  const billIndexes = new Set([0])
  while (billIndexes.size < HEAVY.bills) billIndexes.add(int(1, HEAVY.expenses - 2))

  const expenses = []
  const groupById = new Map(groups.map((g) => [g.id, g]))
  for (let n = 0; n < HEAVY.expenses; n++) {
    // n = 0 is the newest (today), n = last is the oldest (two years ago).
    const daysAgo = n === 0 ? 0 : n === HEAVY.expenses - 1 ? HEAVY.days : Math.min(HEAVY.days - 1, Math.floor((n / HEAVY.expenses) * HEAVY.days) + int(0, 1))
    const date = isoDaysAgo(today, daysAgo)
    let groupId = n === 0 || n === HEAVY.expenses - 1 ? null : slots[n]
    const group = groupId ? groupById.get(groupId) : null
    if (group && new Date(`${date}T12:00:00`).getTime() < group.createdAt) group.createdAt = new Date(`${date}T09:00:00`).getTime()
    const pool = group ? group.memberIds : ['me', ...Array.from({ length: int(1, 4) }, () => pick(others).id)]
    const people = [...new Set(pool)]
    const participants = group ? people.filter((id) => id === 'me' || chance(0.85)) : people
    if (!participants.includes('me') && chance(0.9)) participants.unshift('me')
    if (participants.length < 2) participants.push(people.find((id) => !participants.includes(id)) ?? pick(others).id)
    const payerId = chance(0.5) ? 'me' : pick(participants)
    const createdAt = new Date(`${date}T${String(int(8, 22)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}:00`).getTime()
    const isBill = billIndexes.has(n)

    let expense
    if (isBill) {
      const count = int(4, 12)
      const items = []
      for (let k = 0; k < count; k++) {
        const [dish, price] = pick(DISHES)
        const quantity = chance(0.25) ? 2 : 1
        items.push({ id: `i${n}-${k}`, name: dish, quantity, amount: price * quantity })
      }
      const subtotal = items.reduce((s, it) => s + it.amount, 0)
      const tax = Math.round(subtotal * 0.05)
      const serviceCharge = chance(0.5) ? Math.round(subtotal * 0.1) : null
      const discount = chance(0.2) ? Math.round(subtotal * 0.1) : null
      const total = subtotal + tax + (serviceCharge ?? 0) - (discount ?? 0)
      const assignments = {}
      for (const it of items) {
        const sharers = participants.filter(() => chance(0.5))
        const who = sharers.length > 0 ? sharers : [pick(participants)]
        assignments[it.id] = Object.fromEntries(who.map((id) => [id, chance(0.1) ? 2 : 1]))
      }
      const merchant = n === 0 ? 'Toit Brewpub' : pick(RESTAURANTS)
      expense = {
        kind: 'bill',
        title: n === 0 ? MARKERS.NEWEST_BILL : `Dinner at ${merchant}`,
        category: 'food',
        total,
        mode: 'items',
        participants: participants.map((friendId) => ({ friendId, input: null })),
        bill: {
          meta: { merchant, date, subtotal, tax, serviceCharge, discount, tip: null, total },
          items,
          assignments,
          warnings: [],
        },
        source: 'scan',
      }
    } else {
      const category = group?.kind === 'home' ? pick(['rent', 'groceries', 'utilities', 'food', 'other', 'groceries']) : group?.kind === 'trip' ? pick(['travel', 'food', 'transport', 'entertainment']) : pick(Object.keys(SPLIT_TITLES))
      const title = n === HEAVY.expenses - 1 ? MARKERS.OLDEST : pick(SPLIT_TITLES[category])
      const total = category === 'rent' ? int(18, 45) * 100000 : int(4, 600) * 1000 + (chance(0.3) ? int(1, 99) * 10 : 0)
      const roll = rand()
      const mode = roll < 0.6 ? 'equal' : roll < 0.7 ? 'exact' : roll < 0.8 ? 'percent' : 'shares'
      let inputs
      if (mode === 'exact') {
        const weights = participants.map(() => int(1, 5))
        const sum = weights.reduce((a, b) => a + b, 0)
        let left = total
        inputs = weights.map((w, i) => {
          const v = i === weights.length - 1 ? left : Math.floor((total * w) / sum)
          left -= v
          return v
        })
      } else if (mode === 'percent') {
        let left = 10_000
        inputs = participants.map((_, i) => {
          const v = i === participants.length - 1 ? left : Math.floor(10_000 / participants.length)
          left -= v
          return v
        })
      } else if (mode === 'shares') {
        inputs = participants.map(() => int(1, 3))
      } else {
        inputs = participants.map(() => null)
      }
      expense = {
        kind: 'split',
        title,
        category,
        total,
        mode,
        participants: participants.map((friendId, i) => ({ friendId, input: inputs[i] })),
        bill: null,
        source: chance(0.1) ? 'describe' : 'manual',
      }
    }

    const base = {
      id: `e${String(HEAVY.expenses - n).padStart(5, '0')}`,
      currency: 'INR',
      date,
      createdAt,
      updatedAt: createdAt,
      payerId,
      roundedToWhole: !isBill && chance(0.2),
      note: chance(0.08) ? pick(['Paid via GPay', 'Split as discussed', 'Includes tip', 'Will settle on Friday']) : null,
      groupId,
      paidBack: {},
      recurringId: null,
      ...expense,
    }
    if (groupId === bigGroup.id && n === lastIndexOf(slots, bigGroup.id)) base.title = MARKERS.GROUP_OLDEST
    base.shares = expenseShares(base)
    // Standalone splits I paid: older ones are collected; recent ones partly pending.
    if (!groupId && payerId === 'me') {
      for (const [id, share] of Object.entries(base.shares)) {
        if (id === 'me' || share <= 0) continue
        if (daysAgo > 45 || chance(0.4)) base.paidBack[id] = Math.min(nowMs, createdAt + int(1, 20) * DAY)
      }
    } else if (!groupId && payerId !== 'me' && (base.shares.me ?? 0) > 0 && (daysAgo > 45 || chance(0.5))) {
      base.paidBack.me = Math.min(nowMs, createdAt + int(1, 20) * DAY)
    }
    expenses.push(base)
  }

  // Settlements: a handful per group, plus the flat's monthly squaring-up.
  let sid = 0
  for (const g of groups) {
    const count = g.id === bigGroup.id ? 20 : int(1, 5)
    for (let k = 0; k < count; k++) {
      const fromId = pick(g.memberIds)
      let toId = pick(g.memberIds)
      if (toId === fromId) toId = g.memberIds.find((m) => m !== fromId)
      if (!toId) continue
      const daysAgo = int(1, Math.max(2, Math.floor((nowMs - g.createdAt) / DAY)))
      g.settlements.push({
        id: `s${++sid}`,
        fromId,
        toId,
        amount: int(5, 400) * 1000,
        date: isoDaysAgo(today, daysAgo),
        createdAt: nowMs - daysAgo * DAY,
        method: pick(['upi', 'upi', 'cash', 'other']),
      })
    }
    g.updatedAt = Math.max(g.createdAt, ...expenses.filter((e) => e.groupId === g.id).map((e) => e.createdAt))
  }

  const recurring = [
    { id: 'r1', title: 'Rent', category: 'rent', currency: 'INR', total: 4200000, payerId: 'me', mode: 'equal', participants: bigGroup.memberIds.map((friendId) => ({ friendId, input: null })), dayOfMonth: 5, groupId: bigGroup.id, lastCreatedPeriod: today.slice(0, 7), active: true, createdAt: startMs },
    { id: 'r2', title: 'Netflix', category: 'subscription', currency: 'INR', total: 64900, payerId: 'me', mode: 'equal', participants: [{ friendId: 'me', input: null }, { friendId: others[10].id, input: null }], dayOfMonth: 12, groupId: null, lastCreatedPeriod: null, active: true, createdAt: startMs },
    { id: 'r3', title: 'Wi-Fi bill', category: 'utilities', currency: 'INR', total: 99900, payerId: others[0].id, mode: 'equal', participants: bigGroup.memberIds.map((friendId) => ({ friendId, input: null })), dayOfMonth: 20, groupId: bigGroup.id, lastCreatedPeriod: null, active: true, createdAt: startMs },
  ]

  return { profile, friends, groups, expenses, recurring, groupTotal }
}

function lastIndexOf(list, value) {
  for (let i = list.length - 1; i >= 0; i--) if (list[i] === value) return i
  return -1
}

/** JSON with object keys sorted, so key order never counts as a difference. */
function canonical(value) {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v,
  )
}

/**
 * Runs every collection through the app's schemas, checks nothing was dropped or repaired, and
 * returns the schemas' output (the exact objects — key order included — the app would store).
 */
export async function validateHeavy(data) {
  const schemas = await loadAppModule('/src/data/schemas.ts')
  const z = await loadAppModule('zod/mini')
  const check = (name, schema, value) => {
    const parsed = z.safeParse(schema, value)
    if (!parsed.success) throw new Error(`seed: ${name} failed validation`)
    const before = canonical(value)
    const after = canonical(parsed.data)
    if (before !== after) {
      const list = Array.isArray(value) ? value : [value]
      const out = Array.isArray(parsed.data) ? parsed.data : [parsed.data]
      if (list.length !== out.length) throw new Error(`seed: ${name} dropped ${list.length - out.length} records`)
      for (let i = 0; i < list.length; i++) {
        if (canonical(list[i]) !== canonical(out[i])) {
          throw new Error(`seed: ${name}[${i}] was repaired:\n${JSON.stringify(list[i])}\n→\n${JSON.stringify(out[i])}`)
        }
      }
    }
    return parsed.data
  }
  return {
    profile: check('profile', schemas.profileSchema, data.profile),
    friends: check('friends', schemas.friendsSchema, data.friends),
    groups: check('groups', schemas.groupsSchema, data.groups),
    expenses: check('expenses', schemas.expensesSchema, data.expenses),
    recurring: check('recurring', schemas.recurringListSchema, data.recurring),
  }
}

/** localStorage entries (key → string) for a data set, in the app's storage format. */
export async function storageEntries(data) {
  const { STORAGE_KEYS, STORAGE_VERSION } = await loadAppModule('/src/data/stores.ts')
  const { MIGRATION_KEY } = await loadAppModule('/src/data/legacy.ts')
  const env = (value) => JSON.stringify({ v: STORAGE_VERSION, data: value })
  return {
    [STORAGE_KEYS.profile]: env(data.profile),
    [STORAGE_KEYS.friends]: env(data.friends),
    [STORAGE_KEYS.groups]: env(data.groups),
    [STORAGE_KEYS.expenses]: env(data.expenses),
    [STORAGE_KEYS.recurring]: env(data.recurring),
    [MIGRATION_KEY]: JSON.stringify({ v: 1, at: data.profile.createdAt, friendIds: [] }),
  }
}

/** The heavy data set's localStorage entries, cached per calendar day (CACHE_DIR). */
export async function heavyStorage({ fresh = false } = {}) {
  const dir = CACHE_DIR
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `heavy-${localToday()}.json`)
  if (!fresh && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  const data = await validateHeavy(await buildHeavy())
  const entries = await storageEntries(data)
  writeFileSync(file, JSON.stringify(entries))
  return entries
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('seed.mjs')) {
  const started = performance.now()
  const entries = await heavyStorage({ fresh: true })
  await closeAppModules()
  const expenses = JSON.parse(entries['settle.v3.expenses']).data
  const groups = JSON.parse(entries['settle.v3.groups']).data
  const bytes = Object.values(entries).reduce((s, v) => s + v.length, 0)
  console.log(
    `heavy seed: ${JSON.parse(entries['settle.v3.friends']).data.length - 1} friends, ${groups.length} groups, ` +
      `${expenses.length} expenses (${expenses.filter((e) => e.kind === 'bill').length} bills, ` +
      `${expenses.filter((e) => e.groupId === 'g01').length} in ${MARKERS.BIG_GROUP}), ` +
      `${expenses[expenses.length - 1].date} → ${expenses[0].date}, ${(bytes / 1024).toFixed(0)} KB of localStorage ` +
      `(${Math.round(performance.now() - started)} ms)`,
  )
}

/**
 * A pay link's `#fragment` for the newest bill in the heavy data set (8-ish people, its items),
 * encoded by the app's own encoder — what a friend opens from WhatsApp.
 */
export async function payLinkFragment() {
  const dir = CACHE_DIR
  const file = join(dir, `paylink-${localToday()}.txt`)
  if (existsSync(file)) return readFileSync(file, 'utf8')
  const entries = await heavyStorage()
  const { payLinkFromExpense, encodePayLink } = await loadAppModule('/src/share/payLink.ts')
  const expenses = JSON.parse(entries['settle.v3.expenses']).data
  const friends = JSON.parse(entries['settle.v3.friends']).data
  const profile = JSON.parse(entries['settle.v3.profile']).data
  const bill = expenses.find((e) => e.title === MARKERS.NEWEST_BILL)
  const payload = payLinkFromExpense(bill, Object.fromEntries(friends.map((f) => [f.id, f])), profile)
  const url = await encodePayLink(payload, 'https://settle.example')
  const fragment = url.slice(url.indexOf('#') + 1)
  writeFileSync(file, fragment)
  return fragment
}
