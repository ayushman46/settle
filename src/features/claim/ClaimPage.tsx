import { usePageMeta } from '../landing/pageMeta'
import { PublicProblem, PublicShell } from '../pay/PublicShell'
import { BRAND } from '../../domain/types'

/** `/claim#…` — a friend picks what they had — placeholder until slice S1 builds it: the "no link" problem state. */
export function ClaimPage() {
  usePageMeta({ title: `No claim link here · ${BRAND.name}`, description: 'Open the link your friend shared.', robots: 'noindex' })
  return (
    <PublicShell>
      <PublicProblem title="No claim link here" text="Open the link your friend shared — it has the bill and everyone on it." />
    </PublicShell>
  )
}
