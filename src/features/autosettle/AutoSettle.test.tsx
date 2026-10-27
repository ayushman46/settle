import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, expensesStore, saveExpense, updateProfile } from '../../data'
import { autoSettleStore } from '../../data/stores'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { WhosPaidScreen } from '../whospaid/WhosPaidScreen'
import { AutoSettleCard } from './AutoSettleCard'
import { AutoSettleWatcher } from './AutoSettleWatcher'

vi.setConfig({ testTimeout: 30_000 })

type Handler = (options: Record<string, unknown>) => unknown

/** The Android app's bridge, as Capacitor injects it, with the PaymentAlerts plugin. */
function fakeAndroid(handlers: Record<string, Handler>) {
  const calls: Array<[string, Record<string, unknown>]> = []
  const listeners: Array<(data: unknown) => void> = []
  vi.stubGlobal('Capacitor', {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    PluginHeaders: [{ name: 'PaymentAlerts' }],
    nativePromise: async (plugin: string, method: string, options: Record<string, unknown> = {}) => {
      if (plugin !== 'PaymentAlerts') throw new Error(plugin)
      calls.push([method, options])
      return handlers[method]?.(options) ?? {}
    },
    addListener: (_plugin: string, _event: string, callback: (data: unknown) => void) => {
      listeners.push(callback)
      return { remove: async () => undefined }
    },
  })
  return { calls, fire: () => listeners.forEach((l) => l({})) }
}

const AT = new Date(2026, 9, 28, 19, 42).getTime()
let riya: string
let asha: string
let dinner: string

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AT + 60_000)
  resetProScreens()
  updateProfile({ name: 'Ayush' })
  riya = addFriend({ name: 'Riya Sharma' }).id
  const sam = addFriend({ name: 'Sam' }).id
  asha = addFriend({ name: 'Asha' }).id
  dinner = saveExpense(draft({ title: 'Goa dinner', total: 168_000, date: '2026-10-26', participants: everyone(ME_ID, riya, sam, asha) })).id
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const paid = (friendId: string) => expensesStore.get().find((e) => e.id === dinner)?.paidBack[friendId] !== undefined

describe('AutoSettleCard', () => {
  it('shows nothing on the web', () => {
    const { container } = renderAt('/app/collect', <AutoSettleCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('offers it, says exactly what it reads, then opens Android’s switch with bank SMS as chosen', async () => {
    const android = fakeAndroid({ status: () => ({ granted: false, sms: false }) })
    const { user } = renderAt('/app/collect', <AutoSettleCard />)
    expect(await screen.findByRole('heading', { name: 'Tick people off automatically' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Turn on Auto-settle' }))
    const sheet = await screen.findByRole('dialog', { name: 'Auto-settle' })
    expect(within(sheet).getByText(/reads only the alerts Google Pay, PhonePe, Paytm, BHIM/)).toBeInTheDocument()
    expect(within(sheet).getByText(/Nothing is uploaded/)).toBeInTheDocument()
    const sms = within(sheet).getByRole('switch', { name: 'Bank SMS too' })
    expect(sms).toHaveAttribute('aria-checked', 'false')
    await user.click(sms)
    await user.click(within(sheet).getByRole('button', { name: 'Allow in Android settings' }))
    await waitFor(() => expect(android.calls.map(([m]) => m)).toEqual(['status', 'setOptions', 'openSettings']))
    expect(android.calls[1]).toEqual(['setOptions', { sms: true }])
  })

  it('says it’s on, and lists payments waiting for a tap', async () => {
    fakeAndroid({ status: () => ({ granted: true, sms: true }) })
    autoSettleStore.set({ pending: [{ id: 'p1', amount: 40_000, date: '2026-10-28', at: AT, name: 'Asha Iyer', vpa: null, utr: null }], recent: [] })
    const { user } = renderAt('/app/collect', <AutoSettleCard />)
    expect(await screen.findByRole('heading', { name: 'Auto-settle is on' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '1 payment to check' }))
    expect(currentUrl()).toBe('/app/whos-paid?from=alerts')
  })
})

describe('AutoSettleWatcher', () => {
  it('ticks off whoever the phone saw pay as Settle opens, with Undo', async () => {
    const alerts = [{ id: 'g1', app: 'com.google.android.apps.nbu.paisa.user', title: 'Riya Sharma paid you ₹420', text: '', postedAt: AT }]
    fakeAndroid({ drain: () => ({ alerts: alerts.splice(0) }) })
    const { user } = renderAt('/app', <AutoSettleWatcher />)
    expect(await screen.findByText('Riya Sharma paid ₹420 · Goa dinner — ticked off')).toBeInTheDocument()
    expect(paid(riya)).toBe(true)
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(paid(riya)).toBe(false)
  })

  it('a payment arriving while Settle is open is settled then', async () => {
    const queue: unknown[] = []
    const android = fakeAndroid({ drain: () => ({ alerts: queue.splice(0) }) })
    renderAt('/app', <AutoSettleWatcher />)
    await waitFor(() => expect(android.calls).toHaveLength(1))
    queue.push({ id: 'p1', app: 'com.phonepe.app', title: 'Received ₹420 from Asha', text: '', postedAt: AT })
    android.fire()
    expect(await screen.findByText('Asha paid ₹420 · Goa dinner — ticked off')).toBeInTheDocument()
    expect(paid(asha)).toBe(true)
  })
})

describe('Who’s paid? — payments Auto-settle wasn’t sure of', () => {
  it('reviews them; once looked at, they stop waiting', async () => {
    autoSettleStore.set({ pending: [{ id: 'p1', amount: 40_000, date: '2026-10-28', at: AT, name: 'Asha Iyer', vpa: null, utr: null }], recent: [] })
    const { user } = renderAt('/app/whos-paid?from=alerts', <WhosPaidScreen />)
    const check = await screen.findByRole('region', { name: 'Check these (1)' })
    await user.click(within(check).getByRole('radio', { name: 'Asha · Goa dinner — part of ₹420; marks it paid' }))
    await user.click(screen.getByRole('button', { name: 'Mark 1 as paid' }))
    expect(paid(asha)).toBe(true)
    expect(autoSettleStore.get().pending).toEqual([])
  })

  it('none of them for a split: Done lets them go', async () => {
    autoSettleStore.set({ pending: [{ id: 'p1', amount: 40_000, date: '2026-10-28', at: AT, name: 'Asha Iyer', vpa: null, utr: null }], recent: [] })
    const { user } = renderAt('/app/whos-paid?from=alerts', <WhosPaidScreen />)
    await screen.findByRole('region', { name: 'Check these (1)' })
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(autoSettleStore.get().pending).toEqual([])
    expect(paid(asha)).toBe(false)
  })
})
