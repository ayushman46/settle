import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultVoiceLang, isVoiceLang, saveVoiceLang, toVoiceLang, VOICE_LANG_KEY, voiceLanguage, voiceLanguages } from './voiceLanguages'

beforeEach(() => window.localStorage.clear())
afterEach(() => window.localStorage.clear())

describe('voiceLanguages', () => {
  it('lists the eight languages with native names, English names and examples (spec 03 §2.4)', () => {
    expect(voiceLanguages().map((l) => [l.code, l.native, l.english, l.name])).toEqual([
      ['en-IN', 'English', 'English (India)', 'English'],
      ['hi-IN', 'हिन्दी', 'Hindi · also for Hinglish', 'Hindi'],
      ['bn-IN', 'বাংলা', 'Bengali', 'Bengali'],
      ['mr-IN', 'मराठी', 'Marathi', 'Marathi'],
      ['ta-IN', 'தமிழ்', 'Tamil', 'Tamil'],
      ['te-IN', 'తెలుగు', 'Telugu', 'Telugu'],
      ['kn-IN', 'ಕನ್ನಡ', 'Kannada', 'Kannada'],
      ['gu-IN', 'ગુજરાતી', 'Gujarati', 'Gujarati'],
    ])
    expect(voiceLanguage('en-IN').example).toBe('Dinner 2400 with Riya and Sam, I paid')
    expect(voiceLanguage('hi-IN').example).toBe('ढाई हज़ार का डिनर रिया और सैम के साथ, मैंने दिया')
    expect(voiceLanguage('bn-IN').example).toBe('রিয়া আর স্যামের সাথে ডিনার ২৪০০ টাকা, আমি দিয়েছি')
    expect(voiceLanguage('mr-IN').example).toBe('रिया आणि सॅमसोबत जेवण २४०० रुपये, मी दिले')
    expect(voiceLanguage('ta-IN').example).toBe('ரியா, சாம் உடன் இரவு உணவு 2400 ரூபாய், நான் கொடுத்தேன்')
    expect(voiceLanguage('te-IN').example).toBe('రియా, సామ్‌తో డిన్నర్ 2400 రూపాయలు, నేను కట్టాను')
    expect(voiceLanguage('kn-IN').example).toBe('ರಿಯಾ ಮತ್ತು ಸ್ಯಾಮ್ ಜೊತೆ ಊಟ 2400 ರೂಪಾಯಿ, ನಾನು ಕೊಟ್ಟೆ')
    expect(voiceLanguage('gu-IN').example).toBe('રિયા અને સેમ સાથે ડિનર 2400 રૂપિયા, મેં આપ્યા')
  })

  it('maps language tags to one of the eight', () => {
    expect(toVoiceLang('hi')).toBe('hi-IN')
    expect(toVoiceLang('ta-IN')).toBe('ta-IN')
    expect(toVoiceLang('en-GB')).toBe('en-IN')
    expect(toVoiceLang('EN_us')).toBe('en-IN')
    expect(toVoiceLang('fr-FR')).toBeNull()
    expect(toVoiceLang('')).toBeNull()
    expect(toVoiceLang(null)).toBeNull()
    expect(isVoiceLang('gu-IN')).toBe(true)
    expect(isVoiceLang('gu')).toBe(false)
  })
})

describe('defaultVoiceLang', () => {
  it('prefers the last one used on this device', () => {
    saveVoiceLang('kn-IN')
    expect(window.localStorage.getItem(VOICE_LANG_KEY)).toBe('kn-IN')
    expect(defaultVoiceLang('hi', ['ta-IN'])).toBe('kn-IN')
  })

  it('ignores a saved value that isn’t one of the eight', () => {
    window.localStorage.setItem(VOICE_LANG_KEY, 'xx-IN')
    expect(defaultVoiceLang('mr', [])).toBe('mr-IN')
  })

  it('then the app language, then the browser’s languages, then English (India)', () => {
    expect(defaultVoiceLang('bn', ['ta-IN'])).toBe('bn-IN')
    expect(defaultVoiceLang('en', ['ta-IN'])).toBe('en-IN')
    expect(defaultVoiceLang(null, ['fr-FR', 'te-IN', 'hi-IN'])).toBe('te-IN')
    expect(defaultVoiceLang(undefined, ['fr-FR', 'de'])).toBe('en-IN')
    expect(defaultVoiceLang(null, [])).toBe('en-IN')
  })
})
