/**
 * The English catalog: every namespace merged. English is bundled with the app (no fetch); other
 * languages translate these keys. Add copy to your namespace file, never here.
 */
import { claim } from './claim'
import { common } from './common'
import { delivery } from './delivery'
import { home } from './home'
import { lend } from './lend'
import { pools } from './pools'
import { rotation } from './rotation'
import { sharein } from './sharein'
import { trip } from './trip'
import { voice } from './voice'
import { you } from './you'

export const EN = {
  ...common,
  ...home,
  ...you,
  ...claim,
  ...sharein,
  ...voice,
  ...delivery,
  ...rotation,
  ...lend,
  ...pools,
  ...trip,
} as const

/** Every message key the app may ask for. */
export type MessageKey = keyof typeof EN
