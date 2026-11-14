/**
 * The Marathi catalog: every namespace merged. Loaded lazily, only when Marathi is chosen (src/i18n
 * runtime). Keys missing here fall back to English. Add copy to your namespace file, never here.
 *
 * A new language mirrors this folder: `src/i18n/<code>/<ns>.ts` per namespace and this index with
 * the merged catalog as its default export — `load.ts` finds it by itself.
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
import { rent } from './rent'
import { bijli } from './bijli'
import { whospaid } from './whospaid'
import { collect } from './collect'
import { autosettle } from './autosettle'
import { stuck } from './stuck'
import { stuckhelp } from './stuckhelp'
import { stuckalerts } from './stuckalerts'
import { fees } from './fees'
import { counter } from './counter'
import { groupsync } from './groupsync'
import { play } from './play'
import { spent } from './spent'
import { usual } from './usual'
import { diet } from './diet'
import { fare } from './fare'
import { report } from './report'
import { ask } from './ask'
import { score } from './score'
import { queue } from './queue'
import { swap } from './swap'
import { wrapped } from './wrapped'
import { spin } from './spin'
import { kitty } from './kitty'
import { presence } from './presence'
import { chat } from './chat'

export const MR: Messages = {
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
  ...rent,
  ...bijli,
  ...whospaid,
  ...collect,
  ...autosettle,
  ...stuck,
  ...stuckhelp,
  ...stuckalerts,
  ...fees,
  ...counter,
  ...groupsync,
  ...play,
  ...spent,
  ...usual,
  ...diet,
  ...fare,
  ...report,
  ...ask,
  ...score,
  ...queue,
  ...swap,
  ...wrapped,
  ...spin,
  ...kitty,
  ...presence,
  ...chat,
}

export default MR
