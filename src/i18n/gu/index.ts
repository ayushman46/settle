/**
 * The Gujarati catalog: every namespace merged. Loaded lazily, only when Gujarati is chosen (src/i18n
 * runtime). Keys missing here fall back to English. Add copy to your namespace file, never here.
 */
import type { Messages } from '../types'
import { common } from './common'
import { home } from './home'
import { you } from './you'
import { claim } from './claim'
import { sharein } from './sharein'
import { voice } from './voice'
import { delivery } from './delivery'
import { rotation } from './rotation'
import { lend } from './lend'
import { pools } from './pools'
import { trip } from './trip'
import { ui } from './ui'
import { kit } from './kit'
import { app } from './app'
import { share } from './share'
import { api } from './api'
import { bill } from './bill'
import { split } from './split'
import { expense } from './expense'
import { recurring } from './recurring'
import { state } from './state'
import { groups } from './groups'
import { friends } from './friends'
import { insights } from './insights'
import { pay } from './pay'
import { pro } from './pro'
import { onboarding } from './onboarding'
import { landing } from './landing'
import { legal } from './legal'
import { activity } from './activity'
import { proof } from './proof'
import { shagun } from './shagun'
import { install } from './install'
import { bijli } from './bijli'
import { whospaid } from './whospaid'
import { collect } from './collect'

export const GU: Messages = {
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
  ...ui,
  ...kit,
  ...app,
  ...share,
  ...api,
  ...bill,
  ...split,
  ...expense,
  ...recurring,
  ...state,
  ...groups,
  ...friends,
  ...insights,
  ...pay,
  ...pro,
  ...onboarding,
  ...landing,
  ...legal,
  ...activity,
  ...proof,
  ...shagun,
  ...install,
  ...bijli,
  ...whospaid,
  ...collect,
}

export default GU
