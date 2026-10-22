import { usePageMeta } from '../landing/pageMeta'
import { PublicProblem, PublicShell } from '../pay/PublicShell'
import { BRAND } from '../../domain/types'

/** `/pool#…` — chip in to a collection — placeholder until slice S5 builds it: the "no link" problem state. */
export function PoolPage() {
  usePageMeta({ title: `No collection link here · ${BRAND.name}`, description: 'Open the link your friend shared.', robots: 'noindex' })
  return (
    <PublicShell>
      <PublicProblem title="No collection link here" text="Open the link your friend shared — it says what it’s for and how to chip in." />
    </PublicShell>
  )
}
