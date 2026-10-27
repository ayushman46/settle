/**
 * Hindi render smoke: the first screens a Hindi person meets render in Hindi (onboarding's
 * language step, You → Language, the public language switcher), and the choice is saved.
 * English is checked by the screens' own tests, which must not change.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { profileStore, updateProfile } from '../data'
import type { LanguageCode } from '../domain/types'
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen'
import { PrivacyPage } from '../features/legal/PrivacyPage'
import { chooseAppLanguage } from '../features/you/appLanguage'
import { YouScreen } from '../features/you/YouScreen'
import { renderAt, resetProScreens } from '../features/pro/testing'
import { getLanguage, resetI18nForTests, setLanguage } from './runtime'
import { PUBLIC_LANG_KEY, resolveLanguage } from './language'
import { LanguageSwitcher } from './ui/LanguageSwitcher'

beforeEach(async () => {
  resetProScreens()
  updateProfile({ name: 'Ayush Kumar', currency: 'INR', onboarded: true })
  await setLanguage('hi')
})

afterEach(() => {
  resetProScreens()
  resetI18nForTests()
  try {
    window.localStorage.removeItem(PUBLIC_LANG_KEY)
  } catch {
    // storage unavailable: nothing to clean
  }
})

describe('Hindi: onboarding', () => {
  it('opens on the language step in Hindi, with the eight languages', async () => {
    renderAt('/app/welcome', <OnboardingScreen />)
    expect(await screen.findByRole('heading', { level: 1, name: 'अपनी भाषा चुनें' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'भाषा' })).toBeInTheDocument()
    for (const native of ['English', 'हिन्दी', 'বাংলা', 'मराठी', 'தமிழ்', 'తెలుగు', 'ಕನ್ನಡ', 'ગુજરાતી']) {
      expect(screen.getByText(native)).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'आगे बढ़ें' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('hi')
  })
})

describe('Hindi: You → Language', () => {
  it('shows You in Hindi and saves a language pick', async () => {
    const { user } = renderAt('/app/you', <YouScreen />)
    expect(await screen.findByRole('heading', { name: 'पसंद' })).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /भाषा/ })[0] as HTMLElement)
    const sheet = await screen.findByRole('radiogroup', { name: 'भाषा' })
    expect(sheet).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /^English/ }))
    await waitFor(() => expect(profileStore.get().language).toBe('en'))
    expect(getLanguage()).toBe('en')
  })
})

describe('language resolution and picker persistence', () => {
  it('a saved app choice wins over the phone language', () => {
    expect(resolveLanguage({ context: 'app', saved: 'ta', search: '', languages: ['hi-IN'] })).toBe('ta')
    expect(resolveLanguage({ context: 'app', saved: null, search: '', languages: ['hi-IN', 'en-US'] })).toBe('hi')
    expect(resolveLanguage({ context: 'app', saved: null, search: '', languages: ['fr-FR'] })).toBe('en')
  })

  it('?lang= wins for this tab (QA)', () => {
    expect(resolveLanguage({ context: 'app', saved: 'hi', search: '?lang=gu', languages: [] })).toBe('gu')
  })

  it('choosing a language saves it in the profile, and Automatic saves null', async () => {
    expect(await chooseAppLanguage('hi')).toBe('ok')
    expect(profileStore.get().language).toBe('hi')
    expect(await chooseAppLanguage(null)).toBe('ok')
    expect(profileStore.get().language).toBeNull()
  })

  it('a language without a catalog is not switched to, and nothing is saved', async () => {
    // All eight app languages have catalogs now; a code with none stands in for a chunk that won't load.
    expect(await chooseAppLanguage('fr' as LanguageCode)).toBe('failed')
    expect(profileStore.get().language).toBeNull()
  })
})

describe('Hindi: public language switcher', () => {
  it('switches a public page to Hindi and remembers it on this phone only', async () => {
    await setLanguage('en')
    renderAt('/claim/x', <LanguageSwitcher placement="page" />)
    const select = screen.getByRole('combobox', { name: 'Language' })
    fireEvent.change(select, { target: { value: 'hi' } })
    await waitFor(() => expect(getLanguage()).toBe('hi'))
    expect(window.localStorage.getItem(PUBLIC_LANG_KEY)).toBe('hi')
    expect(profileStore.get().language).toBeNull()
  })
})

describe('Hindi: privacy policy', () => {
  it('has a Hindi heading and summary, with the full text noted as English', async () => {
    renderAt('/privacy', <PrivacyPage />)
    expect(await screen.findByRole('heading', { level: 1, name: 'प्राइवेसी नीति' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'एक नज़र में' })).toBeInTheDocument()
    expect(screen.getByText('इस नीति का पूरा पाठ अभी अंग्रेज़ी में है।')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'आपके फ़ोन में क्या रहता है' })).toBeInTheDocument()
  })
})
