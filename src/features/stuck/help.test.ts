import { describe, expect, it } from 'vitest'
import { STUCK_RAILS, STUCK_STEP_KINDS, type StuckPayment } from '../../data/stores'
import { EN } from '../../i18n/en'
import { formatMessage } from '../../i18n'
import { formatMoney } from '../../lib/money'
import {
  AIRSEWA_URL,
  EJAGRITI_URL,
  letterSummary,
  MERCHANT_HELP,
  MYUPI_URL,
  NCH_URL,
  nchWhatsAppUrl,
  raiseHelp,
  RBI_CMS_URL,
  upiAppOf,
  walletName,
  walletOf,
  type HelpText,
  type RaiseHelp,
} from './help'

const TODAY = '2026-11-02'

function failed(over: Partial<StuckPayment> = {}): StuckPayment {
  return {
    id: 's1',
    kind: 'failed',
    rail: 'upi_merchant',
    party: 'Swiggy',
    merchant: 'swiggy',
    amount: 50_000,
    date: '2026-10-20',
    promisedBy: null,
    ref: '629420113457',
    orderId: null,
    bank: 'hdfc',
    account: 'XX4821',
    app: null,
    source: 'sms',
    confirmed: true,
    steps: [],
    repliedAt: null,
    back: null,
    dismissedAt: null,
    note: null,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }
}

function refund(over: Partial<StuckPayment> = {}): StuckPayment {
  return failed({ kind: 'refund', rail: null, party: null, merchant: 'amazon', amount: 129_900, ref: null, orderId: '404-1234567-7654321', bank: null, account: null, ...over })
}

const keys = (lines: readonly HelpText[]) => lines.map((l) => l.key)
const say = (line: HelpText) => formatMessage(EN[line.key], line.vars)

/** Every page and number help.ts may send someone to (each checked against its source, Nov 2026). */
const VERIFIED = new Set([
  'https://cms.rbi.org.in',
  'tel:14448',
  'https://www.upihelp.npci.org.in/',
  'https://grievance.phonepe.com/',
  'tel:1915',
  'tel:1800114000',
  'https://consumerhelpline.gov.in',
  'https://airsewa.gov.in',
  'https://e-jagriti.gov.in',
  ...Object.values(MERCHANT_HELP).map((m) => m.url),
])

describe('upiAppOf', () => {
  it('knows the apps by id, Android package and name', () => {
    expect(upiAppOf('gpay')).toBe('gpay')
    expect(upiAppOf('Google Pay')).toBe('gpay')
    expect(upiAppOf('com.google.android.apps.nbu.paisa.user')).toBe('gpay')
    expect(upiAppOf('PhonePe')).toBe('phonepe')
    expect(upiAppOf('com.phonepe.app')).toBe('phonepe')
    expect(upiAppOf('net.one97.paytm')).toBe('paytm')
    expect(upiAppOf('BHIM UPI')).toBe('bhim')
    expect(upiAppOf('in.org.npci.upiapp')).toBe('bhim')
    expect(upiAppOf('CRED')).toBe('cred')
    expect(upiAppOf('amazonpay')).toBe('amazonpay')
    expect(upiAppOf('Amazon Pay')).toBe('amazonpay')
  })

  it('is null for anything else', () => {
    expect(upiAppOf(null)).toBeNull()
    expect(upiAppOf('')).toBeNull()
    expect(upiAppOf('whatsapp')).toBeNull()
    expect(upiAppOf('com.example.bank')).toBeNull()
  })
})

describe('raiseHelp — your bank', () => {
  it('walks Google Pay users through its own dispute path, then the bank, then MyUPI', () => {
    const help = raiseHelp('bank', failed({ app: 'gpay' }))
    expect(say(help.title)).toBe('Raise it with your bank')
    expect(keys(help.steps)).toEqual(['stuckhelp.bank.app.gpay', 'stuckhelp.bank.letter', 'stuckhelp.bank.myupi', 'stuckhelp.bank.note'])
    expect(say(help.steps[0] as HelpText)).toContain('Having issues')
    expect(help.links.map((l) => l.href)).toEqual([MYUPI_URL])
    expect(help.channel).toBeNull()
  })

  it('has PhonePe’s and Paytm’s own paths, and PhonePe’s grievance desk', () => {
    const phonepe = raiseHelp('bank', failed({ app: 'com.phonepe.app' }))
    expect(keys(phonepe.steps)[0]).toBe('stuckhelp.bank.app.phonepe')
    expect(phonepe.links.map((l) => l.href)).toEqual(['https://grievance.phonepe.com/', MYUPI_URL])
    expect(keys(raiseHelp('bank', failed({ app: 'Paytm' })).steps)[0]).toBe('stuckhelp.bank.app.paytm')
  })

  it('names the other UPI apps in the general step', () => {
    for (const [app, name] of [
      ['bhim', 'BHIM'],
      ['cred', 'CRED'],
      ['amazonpay', 'Amazon Pay'],
    ] as const) {
      const first = raiseHelp('bank', failed({ app })).steps[0] as HelpText
      expect(first.key).toBe('stuckhelp.bank.app.other')
      expect(say(first)).toContain(`In ${name}, open this payment`)
    }
    expect(keys(raiseHelp('bank', failed({ app: null })).steps)[0]).toBe('stuckhelp.bank.app.unknown')
  })

  it('goes to the bank or card route for other ways of paying, without MyUPI', () => {
    expect(keys(raiseHelp('bank', failed({ rail: 'card_online' })).steps)[0]).toBe('stuckhelp.bank.card')
    expect(keys(raiseHelp('bank', failed({ rail: 'card_pos' })).steps)[0]).toBe('stuckhelp.bank.card')
    expect(keys(raiseHelp('bank', failed({ rail: 'atm' })).steps)[0]).toBe('stuckhelp.bank.atm')
    expect(keys(raiseHelp('bank', failed({ rail: 'wallet' })).steps)[0]).toBe('stuckhelp.bank.wallet')
    const imps = raiseHelp('bank', failed({ rail: 'imps' }))
    expect(keys(imps.steps)).toEqual(['stuckhelp.bank.direct', 'stuckhelp.bank.letter', 'stuckhelp.bank.note'])
    expect(imps.links).toEqual([])
  })

  it('treats an unknown way of paying from a UPI app as UPI', () => {
    expect(keys(raiseHelp('bank', failed({ rail: null, app: 'phonepe' })).steps)).toContain('stuckhelp.bank.myupi')
    expect(keys(raiseHelp('bank', failed({ rail: null, app: null })).steps)[0]).toBe('stuckhelp.bank.direct')
  })

  it('asks for the compensation, by amount, when the money came back late', () => {
    const back = failed({ back: { date: '2026-10-30', amount: 50_000, compensation: 0 } })
    const help = raiseHelp('bank', back, { today: TODAY })
    expect(say(help.title)).toBe(`Ask for the ${formatMoney(50_000, 'INR', { trimZeros: true })} compensation`)
    expect(keys(help.steps)).toEqual(['stuckhelp.compensation.send', 'stuckhelp.compensation.why', 'stuckhelp.bank.note'])
    expect(help.links).toEqual([])
    expect(say(raiseHelp('bank', back).title)).toBe('Ask for the compensation')
  })
})

describe('raiseHelp — NPCI’s UPI help site, within its 45 days', () => {
  const at = (date: string) => raiseHelp('bank', failed({ app: 'gpay', date }), { today: TODAY })

  it('offers it up to 45 days after the payment', () => {
    const help = at('2026-09-18')
    expect(keys(help.steps)).toContain('stuckhelp.bank.myupi')
    expect(help.links.map((l) => l.href)).toContain(MYUPI_URL)
    expect(help.links.map((l) => say(l.label))).toEqual(['UPI help website'])
  })

  it('says the time has passed after that, and sends you to the letter instead', () => {
    for (const date of ['2026-09-17', '2026-09-13', '2024-03-01']) {
      const help = at(date)
      expect(keys(help.steps), date).not.toContain('stuckhelp.bank.myupi')
      expect(keys(help.steps), date).toContain('stuckhelp.bank.myupiPassed')
      expect(help.links.map((l) => l.href), date).not.toContain(MYUPI_URL)
    }
  })

  it('never mentions it for a card or IMPS payment', () => {
    for (const rail of ['card_online', 'imps'] as const) {
      const steps = keys(raiseHelp('bank', failed({ rail, date: '2026-09-01' }), { today: TODAY }).steps)
      expect(steps).not.toContain('stuckhelp.bank.myupi')
      expect(steps).not.toContain('stuckhelp.bank.myupiPassed')
    }
  })
})

describe('raiseHelp — a wallet', () => {
  const paytm = failed({ rail: 'wallet', party: 'Airtel prepaid recharge', merchant: null, app: 'paytm', bank: null, account: null })

  it('knows the wallet from what was saved', () => {
    expect(walletOf(paytm)).toBe('paytm')
    expect(walletOf({ ...paytm, app: 'com.mobikwik_new' })).toBe('mobikwik')
    expect(walletOf({ ...paytm, app: null, bank: 'paytm' })).toBe('paytm')
    expect(walletOf({ ...paytm, rail: 'upi_merchant' })).toBeNull()
    expect(walletName({ ...paytm, app: 'Freecharge' })).toBe('Freecharge')
    expect(walletName({ ...paytm, app: null })).toBeNull()
  })

  it('raises it with the wallet, not your bank', () => {
    const help = raiseHelp('bank', paytm, { today: TODAY })
    expect(say(help.title)).toBe('Raise it with Paytm')
    expect(say(help.lead)).toContain('the wallet company must put it back')
    expect(keys(help.steps)).toEqual(['stuckhelp.wallet.app', 'stuckhelp.wallet.letter', 'stuckhelp.bank.note'])
    expect(say(help.steps[0] as HelpText)).toBe('In Paytm, open this payment and raise a complaint from its help section.')
    expect(say(raiseHelp('bank', { ...paytm, app: null }).title)).toBe('Raise it with the wallet company')
  })

  it('takes the wallet company to the RBI Ombudsman, by name, with the registered mobile ready', () => {
    const help = raiseHelp('ombudsman', paytm)
    expect(keys(help.steps)).toContain('stuckhelp.ombudsman.fileWallet')
    expect(help.steps.map(say).join(' ')).toContain('against Paytm Payments Bank Ltd, the company behind the wallet')
    expect(keys(help.keepReady)).toContain('stuckhelp.ready.wallet')
    expect(keys(help.keepReady)).not.toContain('stuckhelp.ready.account')
  })

  it('claims the compensation from the wallet company once the money is back', () => {
    const help = raiseHelp('bank', { ...paytm, back: { date: '2026-10-30', amount: 50_000, compensation: 0 } }, { today: TODAY })
    expect(say(help.lead)).toContain('the wallet company owes')
    expect(keys(help.steps)[0]).toBe('stuckhelp.compensation.sendWallet')
  })
})

describe('raiseHelp — once it is raised, or partly back', () => {
  it('says when it was raised instead of asking for the number again', () => {
    const help = raiseHelp('bank', failed({ steps: [{ kind: 'bank', date: '2026-10-27', ref: 'HDFC-88213' }] }), { today: TODAY })
    expect(keys(help.steps).at(-1)).toBe('stuckhelp.bank.raised')
    expect(say(help.steps.at(-1) as HelpText)).toMatch(/^You raised it on 27 Oct\S* \(number HDFC-88213\)\. If it isn’t fixed within 30 days/)
    const noRef = raiseHelp('bank', failed({ steps: [{ kind: 'bank', date: '2026-10-27', ref: null }] }), { today: TODAY })
    expect(say(noRef.steps.at(-1) as HelpText)).toMatch(/^You raised it on 27 Oct\S*\. If/)
  })

  it('still asks for the money, not just the compensation, when only part came back', () => {
    const help = raiseHelp('bank', failed({ back: { date: '2026-10-30', amount: 20_000, compensation: 0 } }), { today: TODAY })
    expect(say(help.title)).toBe('Raise it with your bank')
  })
})

describe('letterSummary', () => {
  const inr = (paise: number) => formatMoney(paise, 'INR', { trimZeros: true })
  const sum = (...args: Parameters<typeof letterSummary>) => say(letterSummary(...args))

  it('says what each letter asks for, with the amounts', () => {
    expect(sum('bank', failed(), { today: TODAY })).toBe(`It asks for ${inr(50_000)} back, and the ${inr(80_000)} owed so far for the delay (₹100 a day).`)
    expect(sum('bank', failed(), { today: '2026-10-22' })).toBe(`It asks for ${inr(50_000)} back, and ₹100 for each day it’s late.`)
    const back = failed({ back: { date: '2026-10-30', amount: 50_000, compensation: 0 } })
    expect(sum('bank', back, { today: TODAY })).toBe(`It asks for the ${inr(50_000)} owed for the days the money was late (₹100 a day).`)
    expect(sum('ombudsman', failed(), { today: TODAY })).toContain(`asks for the ${inr(1_30_000)} you’re owed so far`)
    expect(sum('merchant', refund(), { today: TODAY })).toContain(`your ${inr(1_29_900)} refund`)
    expect(sum('nch', refund(), { today: TODAY })).toContain(inr(1_29_900))
    expect(sum('airsewa', refund({ merchant: 'indigo' }), { today: TODAY })).toContain('AirSewa')
    expect(sum('commission', refund(), { today: TODAY })).toContain(inr(1_29_900))
  })

  it('asks only for what is still to come', () => {
    const part = refund({ back: { date: '2026-10-30', amount: 1_00_000, compensation: 0 } })
    expect(sum('merchant', part, { today: TODAY })).toContain(`your ${inr(29_900)} refund`)
  })

  it('says why the letter itself is in English', () => {
    expect(formatMessage(EN['stuckhelp.summary.english'], { kind: 'letter' })).toMatch(/^The letter is in English/)
    expect(formatMessage(EN['stuckhelp.summary.english'], { kind: 'message' })).toMatch(/^The message is in English/)
  })
})

describe('raiseHelp — the rest of the ladder', () => {
  it('sends the RBI Ombudsman to cms.rbi.org.in, with 14448 and what to have ready', () => {
    const help = raiseHelp('ombudsman', failed())
    expect(say(help.title)).toBe('Take it to the RBI Ombudsman')
    expect(help.channel).toEqual({ kind: 'web', href: RBI_CMS_URL, label: { key: 'stuckhelp.link.cms' } })
    expect(help.links).toEqual([{ kind: 'call', href: 'tel:14448', label: { key: 'stuckhelp.link.call', vars: { phone: '14448' } } }])
    expect(say(help.steps[0] as HelpText)).toContain('30 days')
    expect(say(help.steps[0] as HelpText)).toContain('90 days')
    expect(help.keepReady).toHaveLength(5)
  })

  it('opens a business’s own help when it was checked, else says where to look', () => {
    const amazon = raiseHelp('merchant', refund())
    expect(say(amazon.title)).toBe('Raise it with Amazon')
    expect(amazon.channel?.href).toBe(MERCHANT_HELP.amazon?.url)
    expect(say(amazon.channel?.label as HelpText)).toBe('Open Amazon’s refund help')
    expect(keys(amazon.steps)).toEqual(['stuckhelp.merchant.page', 'stuckhelp.merchant.paste', 'stuckhelp.rule.ecommerce', 'stuckhelp.merchant.nextNch'])

    const flipkart = raiseHelp('merchant', refund({ merchant: 'flipkart' }))
    expect(say(flipkart.channel?.label as HelpText)).toBe('Open Flipkart help')

    const zomato = raiseHelp('merchant', refund({ merchant: 'zomato' }))
    expect(zomato.channel).toBeNull()
    expect(say(zomato.steps[0] as HelpText)).toBe('In the Zomato app or website, open this order and contact support from it.')

    const shop = raiseHelp('merchant', refund({ merchant: null, party: 'Sharma Electronics' }))
    expect(say(shop.title)).toBe('Raise it with Sharma Electronics')
    expect(keys(shop.steps)).toEqual(['stuckhelp.merchant.app', 'stuckhelp.merchant.paste', 'stuckhelp.merchant.nextNch'])

    expect(say(raiseHelp('merchant', refund({ merchant: null })).title)).toBe('Raise it with the business')
  })

  it('points an airline at the DGCA rule and AirSewa next', () => {
    const help = raiseHelp('merchant', refund({ merchant: 'indigo' }))
    expect(keys(help.steps)).toEqual(['stuckhelp.merchant.page', 'stuckhelp.merchant.paste', 'stuckhelp.rule.dgca', 'stuckhelp.merchant.nextAirsewa'])
    expect(raiseHelp('airsewa', refund({ merchant: 'indigo' })).channel?.href).toBe(AIRSEWA_URL)
  })

  it('sends the helpline message on WhatsApp, with 1915, 1800-11-4000 and the website besides', () => {
    const help = raiseHelp('nch', refund(), { message: 'Refund of ₹1,299 not received & more' })
    expect(help.channel).toEqual({
      kind: 'whatsapp',
      href: 'https://wa.me/918800001915?text=Refund%20of%20%E2%82%B91%2C299%20not%20received%20%26%20more',
      label: { key: 'stuckhelp.link.whatsapp' },
    })
    expect(help.links.map((l) => l.href)).toEqual(['tel:1915', 'tel:1800114000', NCH_URL])
    expect(say(help.links[1]?.label as HelpText)).toBe('Call 1800-11-4000')
    expect(say(help.title)).toBe('Take it to the National Consumer Helpline')
    expect(say(help.steps[0] as HelpText)).toBe(
      'Send the message below on WhatsApp to +91 88000 01915, call 1915 or 1800-11-4000 (8 AM to 8 PM), or register it on consumerhelpline.gov.in.',
    )
    expect(say(help.steps[1] as HelpText)).toContain('takes it up with Amazon')
    expect(nchWhatsAppUrl('hi there')).toBe('https://wa.me/918800001915?text=hi%20there')
  })

  it('files with a commission on e-Jagriti', () => {
    const help = raiseHelp('commission', refund())
    expect(help.channel?.href).toBe(EJAGRITI_URL)
    expect(say(help.title)).toBe('Take it to a consumer commission')
  })
})

describe('raiseHelp — every rung, every way', () => {
  const cases: StuckPayment[] = [
    ...STUCK_RAILS.map((rail) => failed({ rail })),
    failed({ rail: null, app: 'gpay', party: null, merchant: null }),
    failed({ back: { date: '2026-10-30', amount: 50_000, compensation: 0 } }),
    failed({ back: { date: '2026-10-30', amount: 20_000, compensation: 0 } }),
    failed({ steps: [{ kind: 'bank', date: '2026-10-27', ref: null }] }),
    failed({ rail: 'wallet', app: null, bank: null }),
    failed({ rail: 'wallet', app: 'mobikwik', date: '2024-01-01' }),
    refund(),
    refund({ merchant: 'akasa' }),
    refund({ merchant: null, party: null }),
  ]
  const all = (help: RaiseHelp): HelpText[] => [help.title, help.lead, ...help.steps, ...help.keepReady, ...[help.channel, ...help.links].flatMap((l) => (l ? [l.label] : []))]

  it('only uses copy that exists, with every value it needs', () => {
    for (const s of cases)
      for (const step of STUCK_STEP_KINDS) {
        const help = raiseHelp(step, s, { today: TODAY, message: 'x' })
        for (const line of [...all(help), letterSummary(step, s, { today: TODAY }), letterSummary(step, s, { today: TODAY, compensationOnly: true })]) {
          expect(EN[line.key], line.key).toBeTypeOf('string')
          expect(say(line), line.key).not.toMatch(/[{}]/)
        }
      }
  })

  it('only links to pages and numbers that were checked', () => {
    for (const s of cases)
      for (const step of STUCK_STEP_KINDS) {
        const help = raiseHelp(step, s, { today: TODAY })
        for (const link of [help.channel, ...help.links]) {
          if (!link) continue
          if (link.kind === 'whatsapp') expect(link.href.startsWith('https://wa.me/918800001915?text=')).toBe(true)
          else expect(VERIFIED.has(link.href), link.href).toBe(true)
        }
      }
  })
})
