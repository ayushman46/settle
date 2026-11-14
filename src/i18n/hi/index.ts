/**
 * The Hindi catalog: every namespace merged. Loaded lazily, only when Hindi is chosen (src/i18n
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
import { today } from './today'
import { tools } from './tools'
import { credit } from './credit'
import { twice } from './twice'
import { health } from './health'
import { scanfriend } from './scanfriend'
import { lock } from './lock'
import { estimate } from './estimate'
import { functionCopy } from './function'
import { vendor } from './vendor'
import { tab } from './tab'
import { regulars } from './regulars'
import { seats } from './seats'
import { pot } from './pot'
import { moveout } from './moveout'
import { things } from './things'
import { deposit } from './deposit'
import { fairrent } from './fairrent'
import { committee } from './committee'
import { help } from './help'
import { carpool } from './carpool'
import { tally } from './tally'
import { byaaj } from './byaaj'
import { limit } from './limit'
import { passbook } from './passbook'
import { units } from './units'
import { notes } from './notes'
import { abroad } from './abroad'
import { kind } from './kind'
import { hold } from './hold'
import { refund } from './refund'
import { chhutta } from './chhutta'
import { payday } from './payday'
import { promise } from './promise'
import { kist } from './kist'
import { checkout } from './checkout'
import { settleday } from './settleday'
import { why } from './why'
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

export const HI: Messages = {
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
  ...today,
  ...tools,
  ...credit,
  ...twice,
  ...health,
  ...scanfriend,
  ...lock,
  ...estimate,
  ...functionCopy,
  ...vendor,
  ...tab,
  ...regulars,
  ...seats,
  ...pot,
  ...moveout,
  ...things,
  ...deposit,
  ...fairrent,
  ...committee,
  ...help,
  ...carpool,
  ...tally,
  ...byaaj,
  ...limit,
  ...passbook,
  ...units,
  ...notes,
  ...abroad,
  ...kind,
  ...hold,
  ...refund,
  ...chhutta,
  ...payday,
  ...promise,
  ...kist,
  ...checkout,
  ...settleday,
  ...why,
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

export default HI
