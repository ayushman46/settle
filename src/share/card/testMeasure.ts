/** A deterministic stand-in for canvas text measurement in tests: every character is half the font size wide. */
import { graphemes } from '../../lib/people'
import type { Measure } from './textFit'

export const fakeMeasure: Measure = (text, style) => graphemes(text).length * (style.size * 0.5 + (style.tracking ?? 0))
