import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGroup, resetDataForTests, updateProfile } from '../data'
import { ME_ID } from '../domain/types'
import { isInstalledApp, isPhoneLike, isReturningUser, shouldOpenApp } from './launch'
import { stubMedia } from './testKit'

beforeEach(() => {
  resetDataForTests()
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetDataForTests()
})

describe('isInstalledApp', () => {
  it.each(['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'])('is true in %s display mode', (mode) => {
    stubMedia([`(display-mode: ${mode})`])
    expect(isInstalledApp()).toBe(true)
  })

  it('is true for an iOS home-screen web app', () => {
    stubMedia([])
    vi.stubGlobal('navigator', { ...navigator, standalone: true })
    expect(isInstalledApp()).toBe(true)
  })

  it('is false in a browser tab, and where matchMedia is missing or broken', () => {
    stubMedia(['(display-mode: browser)'])
    expect(isInstalledApp()).toBe(false)
    vi.stubGlobal('matchMedia', undefined)
    expect(isInstalledApp()).toBe(false)
    vi.stubGlobal('matchMedia', () => {
      throw new Error('nope')
    })
    expect(isInstalledApp()).toBe(false)
  })
})

describe('isPhoneLike', () => {
  it('means a touch screen that isn’t desktop-wide', () => {
    stubMedia(['(pointer: coarse)'])
    expect(isPhoneLike()).toBe(true)
    stubMedia(['(pointer: coarse)', '(min-width: 1024px)'])
    expect(isPhoneLike()).toBe(false)
    stubMedia([])
    expect(isPhoneLike()).toBe(false)
  })
})

describe('isReturningUser', () => {
  it('is someone who finished onboarding or has anything saved', () => {
    expect(isReturningUser()).toBe(false)
    createGroup({ name: 'Flat', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID] })
    expect(isReturningUser()).toBe(true)
    resetDataForTests()
    updateProfile({ onboarded: true })
    expect(isReturningUser()).toBe(true)
  })
})

describe('shouldOpenApp', () => {
  it('opens the app when installed, whoever it is', () => {
    stubMedia(['(display-mode: standalone)'])
    expect(shouldOpenApp()).toBe(true)
  })

  it('opens the app for a returning user on a phone only', () => {
    stubMedia(['(pointer: coarse)'])
    expect(shouldOpenApp()).toBe(false)
    updateProfile({ onboarded: true })
    expect(shouldOpenApp()).toBe(true)
    stubMedia([])
    expect(shouldOpenApp()).toBe(false)
  })
})
