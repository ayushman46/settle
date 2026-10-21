/**
 * Share-card colours. A canvas can't read CSS variables for a theme the page isn't in, so these
 * mirror `src/styles/tokens.css` (v3 palette) — keep them in step. Contrast is checked in tests.
 */
import type { AccentId, CategoryId } from '../../domain/types'

export type CardThemeName = 'light' | 'dark'

export interface CardTheme {
  bg: string
  surface: string
  surface2: string
  ink: string
  /** Secondary text (AA on surface and bg). */
  ink2: string
  line: string
  lineStrong: string
  accent: string
  onAccent: string
  /** Edge that makes a lime fill read on a light track (tokens: --accent-edge); null when not needed. */
  accentEdge: string | null
  positive: string
  onPositive: string
  /** Soft drop shadow under the card (light only — dark relies on its hairline). */
  shadow: { color: string; blur: number; offsetY: number } | null
  /** Strength of the lime glow behind the card. */
  glow: number
  /** Strength of the category-tinted glow. */
  categoryGlow: number
}

export const CARD_THEMES: Readonly<Record<CardThemeName, CardTheme>> = {
  light: {
    bg: '#f5f6f8',
    surface: '#ffffff',
    surface2: '#eef0f3',
    ink: '#0e1013',
    ink2: '#4b515a',
    line: '#e3e6ea',
    lineStrong: '#d3d7dd',
    accent: '#cbf266',
    onAccent: '#0e1013',
    accentEdge: '#3d6b0a',
    positive: '#0b7a43',
    onPositive: '#ffffff',
    shadow: { color: 'rgba(14, 16, 19, 0.10)', blur: 64, offsetY: 24 },
    glow: 0.55,
    categoryGlow: 0.1,
  },
  dark: {
    bg: '#0b0c0e',
    surface: '#16181b',
    surface2: '#1e2125',
    ink: '#f3f5f7',
    ink2: '#a9b0ba',
    line: '#262a2f',
    lineStrong: '#353a41',
    accent: '#cbf266',
    onAccent: '#0e1013',
    accentEdge: null,
    positive: '#4ade80',
    onPositive: '#0e1013',
    shadow: null,
    glow: 0.18,
    categoryGlow: 0.14,
  },
}

/**
 * The accent palettes (Pro) a card can be drawn in, as in tokens.css `:root[data-accent=…]`:
 * the fill, and its light-theme ink (which edges the progress fill on a light track).
 */
export const CARD_ACCENTS: Readonly<Record<AccentId, { accent: string; inkLight: string }>> = {
  lime: { accent: '#cbf266', inkLight: '#3d6b0a' },
  mint: { accent: '#7fe3c0', inkLight: '#0a6a4d' },
  sky: { accent: '#9fcdff', inkLight: '#0b5aab' },
  violet: { accent: '#cbb8ff', inkLight: '#5a33c0' },
  coral: { accent: '#ffb59f', inkLight: '#a5341a' },
}

/** A card theme in one of the accent palettes (unknown accents read as lime). */
export function cardTheme(name: CardThemeName, accent: AccentId = 'lime'): CardTheme {
  const base = CARD_THEMES[name]
  const palette = Object.hasOwn(CARD_ACCENTS, accent) ? CARD_ACCENTS[accent] : CARD_ACCENTS.lime
  return { ...base, accent: palette.accent, accentEdge: base.accentEdge === null ? null : palette.inkLight }
}

/** Soft tint (icon tile) + saturated ink (icon, label) per category. */
export const CATEGORY_COLORS: Readonly<Record<CardThemeName, Readonly<Record<CategoryId, { bg: string; ink: string }>>>> = {
  light: {
    food: { bg: '#ffe8d6', ink: '#b23f0b' },
    groceries: { bg: '#dcf4e2', ink: '#1d7438' },
    rent: { bg: '#e3e6ff', ink: '#3940c0' },
    utilities: { bg: '#fff1bf', ink: '#855600' },
    travel: { bg: '#dbeeff', ink: '#0b5fb3' },
    transport: { bg: '#d4f2ee', ink: '#0a6a62' },
    shopping: { bg: '#ffe0ee', ink: '#ad2367' },
    entertainment: { bg: '#ece2ff', ink: '#6633c4' },
    subscription: { bg: '#eaf6c8', ink: '#476505' },
    gift: { bg: '#fae0ff', ink: '#9228a8' },
    health: { bg: '#ffe2df', ink: '#b3261e' },
    other: { bg: '#e8ebef', ink: '#4b515a' },
  },
  dark: {
    food: { bg: '#3a2416', ink: '#ffb27a' },
    groceries: { bg: '#14301d', ink: '#7edc9a' },
    rent: { bg: '#1f2347', ink: '#aab2ff' },
    utilities: { bg: '#352a0b', ink: '#ffd465' },
    travel: { bg: '#10283f', ink: '#8cc8ff' },
    transport: { bg: '#0f302d', ink: '#6edccf' },
    shopping: { bg: '#3a1428', ink: '#ff9cc8' },
    entertainment: { bg: '#2a1c45', ink: '#c7a8ff' },
    subscription: { bg: '#26300f', ink: '#c8ee6a' },
    gift: { bg: '#36163d', ink: '#eba2ff' },
    health: { bg: '#3b1716', ink: '#ff9a90' },
    other: { bg: '#23272c', ink: '#b4bbc5' },
  },
}

/** The eight people pastels (same in both themes, like the app's avatars). */
export const AVATAR_COLORS: ReadonlyArray<{ bg: string; ink: string }> = [
  { bg: '#ffd8c2', ink: '#7a2e0e' },
  { bg: '#c9f0d8', ink: '#14532d' },
  { bg: '#cfe5ff', ink: '#1e3a8a' },
  { bg: '#e3d7ff', ink: '#4c1d95' },
  { bg: '#fff1a8', ink: '#713f12' },
  { bg: '#ffd3df', ink: '#881337' },
  { bg: '#c2eeea', ink: '#134e4a' },
  { bg: '#eadfcf', ink: '#57412a' },
]

/** Palette entry for any integer (wraps like `Person.color`; NaN → 0). */
export function avatarColor(color: number): { bg: string; ink: string } {
  const n = AVATAR_COLORS.length
  const i = Number.isFinite(color) ? ((Math.trunc(color) % n) + n) % n : 0
  return AVATAR_COLORS[i] ?? { bg: '#e8ebef', ink: '#4b515a' }
}

/** `#rrggbb` + alpha → `rgba(r, g, b, a)`. */
export function withAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) return hex
  const n = parseInt(match[1] ?? '000000', 16)
  const a = Math.min(1, Math.max(0, alpha))
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Number(a.toFixed(3))})`
}
