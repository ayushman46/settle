import { describe, expect, it } from 'vitest'
import { analyticsHost, cleanAddress } from './analytics'

describe('analytics', () => {
  it('runs on the live site only', () => {
    expect(analyticsHost('settleupi.vercel.app')).toBe(true)
    expect(analyticsHost('localhost')).toBe(false)
    expect(analyticsHost('settle-abc123-team.vercel.app')).toBe(false)
    expect(analyticsHost('evilsettleupi.vercel.app')).toBe(false)
  })

  it.each([
    ['https://settleupi.vercel.app/app', 'https://settleupi.vercel.app/app'],
    ['https://settleupi.vercel.app/app/groups?tab=balances', 'https://settleupi.vercel.app/app/groups'],
    ['https://settleupi.vercel.app/app/cloud/3f2b8c1e-1d2a-4b5c-8d9e-0a1b2c3d4e5f', 'https://settleupi.vercel.app/app/cloud/:id'],
    ['https://settleupi.vercel.app/app/cloud/join?token=AbCdEf123', 'https://settleupi.vercel.app/app/cloud/join'],
    ['https://settleupi.vercel.app/pay/riya@oksbi/450#n=Riya', 'https://settleupi.vercel.app/pay/:id/:id'],
    ['https://settleupi.vercel.app/app/expense/e_9xk2', 'https://settleupi.vercel.app/app/expense/:id'],
    ['https://settleupi.vercel.app/app/split/new', 'https://settleupi.vercel.app/app/split/new'],
  ])('%s → %s', (url, cleaned) => {
    expect(cleanAddress(url)).toBe(cleaned)
  })
})
