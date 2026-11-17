import type { MessageKey, Vars } from '../../i18n'

type TFunction = (key: MessageKey, vars?: Vars) => string
import type { Dashboard, Passkey } from './api'

/** What a passkey is called: its name, else where it's kept. */
export function passkeyName(pk: Passkey, t: TFunction): string {
  return pk.nickname ?? pk.provider ?? (pk.backedUp ? t('account.passkeys.synced') : t('account.passkeys.device'))
}

export interface Blocker {
  groupId: string
  name: string
  /** Positive: owed to you. Negative: you owe. Zero: only a payment in flight. */
  net: number
}

/** Account groups where money is still owed either way, or a payment is under way. */
export function blockers(data: Dashboard): Blocker[] {
  const out = new Map<string, Blocker>()
  for (const g of data.groups) if (g.net !== 0) out.set(g.id, { groupId: g.id, name: g.name, net: g.net })
  for (const s of data.open) {
    if (!out.has(s.groupId)) out.set(s.groupId, { groupId: s.groupId, name: s.groupName ?? '', net: 0 })
  }
  return [...out.values()]
}
