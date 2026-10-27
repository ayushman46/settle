import { afterEach, describe, expect, it, vi } from 'vitest'
import { shareFile } from '../share/shareFile'
import { callPlugin, hasPlugin, inAndroidApp, listenToPlugin, printPage, shareFileInApp } from './nativeApp'

/** The Android app's bridge, as Capacitor injects it. */
function android(plugins: string[], handler: (plugin: string, method: string, options: Record<string, unknown>) => unknown = () => ({})) {
  const calls: Array<[string, string, Record<string, unknown>]> = []
  vi.stubGlobal('Capacitor', {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    PluginHeaders: plugins.map((name) => ({ name })),
    nativePromise: async (plugin: string, method: string, options: Record<string, unknown> = {}) => {
      calls.push([plugin, method, options])
      return handler(plugin, method, options)
    },
    addListener: (_plugin: string, _event: string, callback: (data: unknown) => void) => {
      callback({ hello: 1 })
      return { remove: async () => undefined }
    },
  })
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('nativeApp', () => {
  it('on the web: no app, no plugins, and calls refuse', async () => {
    expect(inAndroidApp()).toBe(false)
    expect(hasPlugin('PaymentAlerts')).toBe(false)
    await expect(callPlugin('PaymentAlerts', 'drain')).rejects.toThrow()
    expect(listenToPlugin('PaymentAlerts', 'alert', () => undefined)).toBeTypeOf('function')
    expect(await shareFileInApp(new Blob(['x']), 'x.txt')).toBeNull()
  })

  it('in the app: knows its plugins, calls them and listens', async () => {
    const calls = android(['PaymentAlerts'], () => ({ granted: true }))
    expect(inAndroidApp()).toBe(true)
    expect(hasPlugin('PaymentAlerts')).toBe(true)
    expect(hasPlugin('SettleFiles')).toBe(false)
    expect(await callPlugin('PaymentAlerts', 'status')).toEqual({ granted: true })
    expect(calls).toEqual([['PaymentAlerts', 'status', {}]])
    const heard: unknown[] = []
    listenToPlugin('PaymentAlerts', 'alert', (data) => heard.push(data))
    expect(heard).toEqual([{ hello: 1 }])
  })

  it('a file leaves the app through its share sheet, as base64', async () => {
    const calls = android(['SettleFiles'])
    const outcome = await shareFile(new Blob(['{"app":"settle"}'], { type: 'application/json' }), 'Settle backup.json', undefined, { title: 'Settle backup' })
    expect(outcome).toBe('shared')
    expect(calls).toEqual([['SettleFiles', 'share', { data: btoa('{"app":"settle"}'), name: 'Settle backup.json', mime: 'application/json', title: 'Settle backup' }]])
  })

  it('a share the app refuses says so', async () => {
    android(['SettleFiles'], () => {
      throw new Error('Too big')
    })
    expect(await shareFile(new Blob(['x'], { type: 'text/plain' }), 'x.txt')).toBe('failed')
  })

  it('prints through the app, or the browser', () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)
    printPage('Flat 302')
    expect(print).toHaveBeenCalledTimes(1)
    const calls = android(['SettleFiles'])
    printPage('Flat 302')
    expect(calls).toEqual([['SettleFiles', 'print', { title: 'Flat 302' }]])
    expect(print).toHaveBeenCalledTimes(1)
  })
})
