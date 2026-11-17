import { describe, expect, it } from 'vitest'
import { t } from '../../i18n'
import type { Dashboard, Passkey } from './api'
import { blockers, passkeyName } from './accountHelpers'
import { describeUserAgent } from './passkey'

const pk = (over: Partial<Passkey>): Passkey => ({
  id: 'p1', credentialId: 'c1', nickname: null, provider: null, current: false, deviceType: 'multiDevice', backedUp: true,
  createdAt: '2026-11-17T00:00:00Z', lastUsedAt: null, ...over,
})

describe('passkeyName', () => {
  it('prefers the name given, then the password manager, then how it is kept', () => {
    expect(passkeyName(pk({ nickname: 'Work laptop', provider: 'Windows Hello' }), t)).toBe('Work laptop')
    expect(passkeyName(pk({ provider: 'Google Password Manager' }), t)).toBe('Google Password Manager')
    expect(passkeyName(pk({}), t)).toBe('Synced passkey')
    expect(passkeyName(pk({ backedUp: false }), t)).toBe('On one device')
  })
})

describe('blockers (what stops an account being deleted)', () => {
  const dash = (over: Partial<Dashboard>): Dashboard => ({ owe: 0, owed: 0, net: 0, groups: [], open: [], ...over })
  const group = (id: string, net: number) => ({ id, name: id, role: 'member' as const, updatedAt: '', net, members: 2 })

  it('nothing when every group is square and nothing is under way', () => {
    expect(blockers(dash({ groups: [group('Flat', 0)] }))).toEqual([])
  })

  it('a group owed either way, and one with only a payment in flight', () => {
    const open = [{ id: 's', groupId: 'Goa', groupName: 'Goa', senderId: 'a', senderName: '', receiverId: 'b', receiverName: '', amountPaise: 100, status: 'awaiting_confirmation', createdAt: null, updatedAt: '', events: [] }]
    const out = blockers(dash({ groups: [group('Flat', -500), group('Goa', 0), group('Office', 300)], open: open as Dashboard['open'] }))
    expect(out.map((b) => [b.name, b.net])).toEqual([['Flat', -500], ['Office', 300], ['Goa', 0]])
  })
})

describe('describeUserAgent', () => {
  it.each([
    ['Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36', 'Chrome on Android'],
    ['Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0 Mobile Safari/537.36', 'Samsung Internet on Android'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', 'Safari on iPhone'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1', 'Chrome on iPhone'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0', 'Edge on Windows'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', 'Safari on Mac'],
  ])('%#', (ua, name) => {
    expect(describeUserAgent(ua)).toBe(name)
  })
})
