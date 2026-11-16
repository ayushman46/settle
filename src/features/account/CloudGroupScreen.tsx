import { useState } from 'react'
import { Plus, Share2 } from 'lucide-react'
import { goBack, navigate, Redirect, useLocation } from '../../app/router'
import { Badge, Banner, List, BottomSheet, Button, Card, EmptyState, IconButton, ListRow, Money, PageTitle, Screen, SectionHeader, Spinner, TextField, TopBar, useToast } from '../../components'
import { useT } from '../../i18n'
import { copyText, shareResult } from '../../lib/share'
import { cloud, idempotencyKey, type CloudExpense, type GroupDetail, type Settlement } from './api'
import { ExpenseSheet } from './ExpenseSheet'
import { PaySheet } from './PaySheet'
import { inr, isOpen, lineText, referenceOf, statusText } from './settlementText'
import { refreshAccount, useAccount } from './store'
import { useCloudGet } from './useCloud'
import styles from './Account.module.css'

const GROUP_PATH = /^\/app\/cloud\/([0-9a-f-]{36})$/

/** `/app/cloud/:id` — one account group: what's left to settle, payments in flight, expenses, people. */
export function CloudGroupScreen() {
  const t = useT()
  const account = useAccount()
  const location = useLocation()
  const id = GROUP_PATH.exec(location.path)?.[1] ?? null
  const signedIn = account.status === 'signedIn'
  const { data, error, loading, reload } = useCloudGet<GroupDetail>(signedIn && id ? `/groups/${id}` : null)

  const header = <TopBar onBack={() => goBack('/app/cloud')} />
  if (account.status === 'signedOut') return <Redirect to={`/app/account?next=${encodeURIComponent(location.path)}`} />
  if (account.status === 'unavailable') {
    return (
      <Screen header={header}>
        <EmptyState title={account.message ?? t('account.error.generic')} action={<Button onClick={() => void refreshAccount()}>{t('account.cloud.retry')}</Button>} />
      </Screen>
    )
  }
  if (!data) {
    return (
      <Screen header={header}>
        {error && !loading ? (
          <EmptyState title={error.message} action={<Button onClick={() => reload()}>{t('account.cloud.retry')}</Button>} />
        ) : (
          <div className={styles.stack} role="status" aria-label={t('app.loading.aria')}>
            <Spinner />
          </div>
        )}
      </Screen>
    )
  }
  return <GroupView detail={data} reload={reload} stale={error?.message ?? null} />
}

function GroupView({ detail, reload, stale }: { detail: GroupDetail; reload: () => void; stale: string | null }) {
  const t = useT()
  const toast = useToast()
  const { me, group } = detail
  const nameOf = (userId: string) => detail.members.find((m) => m.userId === userId)?.displayName ?? ''
  const mine = detail.balances.find((b) => b.userId === me) ?? { net: 0, openOut: 0, openIn: 0, userId: me }
  const [adding, setAdding] = useState(false)
  const [inviting, setInviting] = useState<string | null>(null)
  const [paying, setPaying] = useState<{ id: string; name: string; amount: number } | null>(null)
  const [viewing, setViewing] = useState<CloudExpense | null>(null)
  const [reversing, setReversing] = useState<Settlement | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const open = detail.settlements.filter(isOpen)
  const settled = detail.settlements.filter((s) => !isOpen(s))

  const startPay = async (to: string, amount: number) => {
    if (busy) return
    setBusy(`pay:${to}`)
    const res = await cloud<{ id: string }>('POST', `/groups/${group.id}/settlements`, { receiverId: to, amountPaise: amount, idempotencyKey: idempotencyKey() })
    setBusy(null)
    if (!res.ok) {
      toast(res.message, { tone: 'error' })
      reload()
      return
    }
    setPaying({ id: res.data.id, name: nameOf(to), amount })
  }

  const act = async (s: Settlement, action: 'sent' | 'cancel' | 'confirm' | 'dispute', note: string) => {
    if (busy) return
    setBusy(`${action}:${s.id}`)
    const res = await cloud<{ status: string }>('POST', `/settlements/${s.id}/${action}`, {})
    setBusy(null)
    toast(res.ok ? note : res.message, { tone: res.ok ? 'success' : 'error' })
    reload()
  }

  const invite = async () => {
    if (busy) return
    setBusy('invite')
    const res = await cloud<{ token: string }>('POST', `/groups/${group.id}/invites`, {})
    setBusy(null)
    if (!res.ok) {
      toast(res.message, { tone: 'error' })
      return
    }
    setInviting(`${window.location.origin}/app/cloud/join#${res.data.token}`)
  }

  const leave = async () => {
    if (busy) return
    setBusy('leave')
    const res = await cloud('POST', `/groups/${group.id}/leave`, {})
    setBusy(null)
    if (!res.ok) {
      toast(res.message, { tone: 'error' })
      return
    }
    toast(t('account.cloud.group.left'), { tone: 'success' })
    navigate('/app/cloud', { replace: true })
  }

  const canEdit = (e: CloudExpense) => e.createdBy === me || e.payerId === me || detail.myRole === 'owner'

  const settlementRow = (s: Settlement) => {
    const ref = referenceOf(s)
    const iSend = s.senderId === me
    const iReceive = s.receiverId === me
    return (
      <div key={s.id} className={styles.row}>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>
            {lineText(s, me)} · {inr(s.amountPaise)}
          </span>
          <span className={styles.rowSub}>
            {statusText(s, me)}
            {ref ? ` · ${t('account.cloud.settlement.ref', { ref })}` : ''}
          </span>
          <span className={styles.actions}>
            {iSend && ['pending', 'initiated', 'failed', 'disputed'].includes(s.status) && (
              <>
                <Button size="sm" onClick={() => setPaying({ id: s.id, name: s.receiverName, amount: s.amountPaise })}>
                  {t('account.cloud.pay.again')}
                </Button>
                <Button size="sm" variant="secondary" loading={busy === `sent:${s.id}`} onClick={() => void act(s, 'sent', t('account.cloud.pay.sent.done', { name: s.receiverName }))}>
                  {t('account.cloud.pay.outside')}
                </Button>
                <Button size="sm" variant="ghost" loading={busy === `cancel:${s.id}`} onClick={() => void act(s, 'cancel', t('account.cloud.pay.cancelled'))}>
                  {t('account.cloud.pay.cancel')}
                </Button>
              </>
            )}
            {iReceive && isOpen(s) && (
              <Button size="sm" loading={busy === `confirm:${s.id}`} onClick={() => void act(s, 'confirm', t('account.cloud.receive.confirmed'))}>
                {t('account.cloud.receive.confirm')}
              </Button>
            )}
            {iReceive && s.status === 'awaiting_confirmation' && (
              <Button size="sm" variant="secondary" loading={busy === `dispute:${s.id}`} onClick={() => void act(s, 'dispute', t('account.cloud.receive.disputed', { name: s.senderName }))}>
                {t('account.cloud.receive.dispute')}
              </Button>
            )}
            {iReceive && s.status === 'confirmed' && (
              <Button size="sm" variant="ghost" onClick={() => setReversing(s)}>
                {t('account.cloud.receive.reverse')}
              </Button>
            )}
          </span>
        </span>
      </div>
    )
  }

  return (
    <Screen
      header={
        <TopBar
          onBack={() => goBack('/app/cloud')}
          right={
            <IconButton label={t('account.cloud.group.invite')} onClick={() => void invite()}>
              <Share2 />
            </IconButton>
          }
        />
      }
    >
      <div className={styles.stack}>
        <PageTitle
          title={group.name}
          subtitle={mine.net > 0 ? t('account.cloud.net.owed', { amount: inr(mine.net) }) : mine.net < 0 ? t('account.cloud.net.owe', { amount: inr(-mine.net) }) : t('account.cloud.net.square')}
        />
        {stale && <Banner tone="warning">{stale}</Banner>}

        <section>
          <SectionHeader title={t('account.cloud.group.toSettle')} />
          <Card padding="md">
            {detail.transfers.length === 0 ? (
              <p className={styles.footnote}>{t('account.cloud.group.toSettle.none')}</p>
            ) : (
              detail.transfers.map((tr) => {
                const left = tr.from === me ? Math.min(tr.amountPaise, -mine.net - mine.openOut) : 0
                return (
                  <div key={`${tr.from}-${tr.to}`} className={styles.row}>
                    <span className={styles.rowText}>
                      <span className={styles.rowTitle}>{t('account.cloud.group.pays', { from: tr.from === me ? t('account.cloud.group.member.you', { name: nameOf(tr.from) }) : nameOf(tr.from), to: nameOf(tr.to) })}</span>
                      <Money value={tr.amountPaise} currency="INR" strong />
                    </span>
                    {tr.from === me &&
                      (left > 0 ? (
                        <Button size="sm" loading={busy === `pay:${tr.to}`} onClick={() => void startPay(tr.to, left)}>
                          {t('account.cloud.group.pay', { name: nameOf(tr.to) })}
                        </Button>
                      ) : (
                        <Badge tone="neutral" size="sm">{t('account.cloud.group.payInProgress')}</Badge>
                      ))}
                  </div>
                )
              })
            )}
          </Card>
        </section>

        {open.length > 0 && (
          <section>
            <SectionHeader title={t('account.cloud.group.payments')} />
            <Card padding="md">{open.map(settlementRow)}</Card>
          </section>
        )}

        <section>
          <SectionHeader title={t('account.cloud.group.expenses')} action={{ label: t('account.cloud.group.addExpense'), onClick: () => setAdding(true) }} />
          {detail.expenses.length === 0 ? (
            <Card padding="md">
              <div className={styles.stack}>
                <p className={styles.footnote}>{t('account.cloud.group.expenses.empty')}</p>
                <Button iconStart={<Plus />} onClick={() => setAdding(true)}>
                  {t('account.cloud.group.addExpense')}
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              <List aria-label={t('account.cloud.group.expenses')}>
                {detail.expenses.map((e) => {
                  const share = e.splits.find((s) => s.userId === me)?.sharePaise
                  return (
                    <li key={e.id}>
                      <ListRow
                        title={e.description}
                        subtitle={t('account.cloud.group.paidBy', { name: e.payerId === me ? t('account.cloud.group.member.you', { name: nameOf(e.payerId) }) : nameOf(e.payerId), amount: inr(e.amountPaise) })}
                        trailing={share !== undefined ? <span className={styles.rowSub}>{t('account.cloud.group.yourShare', { amount: inr(share) })}</span> : <span className={styles.rowSub}>{t('account.cloud.group.notInSplit')}</span>}
                        onClick={() => setViewing(e)}
                        chevron
                      />
                    </li>
                  )
                })}
              </List>
            </Card>
          )}
        </section>

        {settled.length > 0 && (
          <section>
            <SectionHeader title={t('account.cloud.group.history')} />
            <Card padding="md">{settled.slice(0, 30).map(settlementRow)}</Card>
          </section>
        )}

        <section>
          <SectionHeader title={t('account.cloud.group.members')} />
          <Card padding="md">
            {detail.members
              .filter((m) => m.active)
              .map((m) => (
                <div key={m.userId} className={styles.row}>
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{m.userId === me ? t('account.cloud.group.member.you', { name: m.displayName }) : m.displayName}</span>
                    <span className={styles.rowSub}>
                      {m.hasUpi ? t('account.cloud.group.member.upi') : t('account.cloud.group.member.noUpi')}
                      {m.role === 'owner' ? ` · ${t('account.cloud.group.member.owner')}` : ''}
                    </span>
                  </span>
                </div>
              ))}
          </Card>
        </section>

        <Button variant="ghost" block loading={busy === 'leave'} onClick={() => void leave()}>
          {t('account.cloud.group.leave')}
        </Button>
      </div>

      <ExpenseSheet open={adding} groupId={group.id} me={me} members={detail.members} onClose={() => setAdding(false)} onSaved={() => reload()} />
      <PaySheet settlementId={paying?.id ?? null} payeeName={paying?.name ?? ''} amountPaise={paying?.amount ?? 0} onClose={() => setPaying(null)} onChanged={() => reload()} />

      <BottomSheet open={inviting !== null} onClose={() => setInviting(null)} title={t('account.cloud.group.invite.title', { name: group.name })} description={t('account.cloud.group.invite.body')}>
        {inviting && (
          <div className={styles.stack}>
            <p className={styles.upiBig}>{inviting}</p>
            <Button block iconStart={<Share2 />} onClick={() => void shareResult(t('account.cloud.group.invite.message', { name: group.name, link: inviting }))}>
              {t('account.cloud.group.invite.share')}
            </Button>
            <Button
              block
              variant="secondary"
              onClick={() =>
                void copyText(inviting).then((ok) => {
                  if (ok) toast(t('account.cloud.group.invite.copied'), { tone: 'success' })
                })
              }
            >
              {t('account.cloud.group.invite.copy')}
            </Button>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={viewing !== null} onClose={() => setViewing(null)} title={viewing?.description ?? ''} description={viewing ? t('account.cloud.group.paidBy', { name: nameOf(viewing.payerId), amount: inr(viewing.amountPaise) }) : undefined}>
        {viewing && (
          <div className={styles.stack}>
            <SectionHeader title={t('account.cloud.expense.detail.split')} headingLevel={3} />
            <div className={styles.shareGrid}>
              {viewing.splits.map((s) => (
                <span key={s.userId} className={styles.rowSub}>
                  {t('account.cloud.expense.share', { name: s.userId === me ? t('account.cloud.group.member.you', { name: nameOf(s.userId) }) : nameOf(s.userId), amount: inr(s.sharePaise) })}
                </span>
              ))}
            </div>
            {canEdit(viewing) && (
              <Button
                variant="danger"
                block
                loading={busy === 'delete'}
                onClick={() => {
                  setBusy('delete')
                  void cloud('DELETE', `/expenses/${viewing.id}`).then((res) => {
                    setBusy(null)
                    toast(res.ok ? t('account.cloud.expense.deleted') : res.message, { tone: res.ok ? 'success' : 'error' })
                    if (res.ok) setViewing(null)
                    reload()
                  })
                }}
              >
                {t('account.cloud.expense.delete')}
              </Button>
            )}
          </div>
        )}
      </BottomSheet>

      <ReverseSheet settlement={reversing} onClose={() => setReversing(null)} onDone={() => reload()} />
    </Screen>
  )
}

/** Undoing a confirmation the receiver made by mistake: needs a reason, and the record keeps both steps. */
function ReverseSheet({ settlement, onClose, onDone }: { settlement: Settlement | null; onClose: () => void; onDone: () => void }) {
  const t = useT()
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!settlement || busy || !reason.trim()) return
    setBusy(true)
    const res = await cloud('POST', `/settlements/${settlement.id}/reverse`, { reason: reason.trim() })
    setBusy(false)
    toast(res.ok ? t('account.cloud.receive.reversed') : res.message, { tone: res.ok ? 'success' : 'error' })
    if (res.ok) {
      setReason('')
      onClose()
      onDone()
    }
  }
  return (
    <BottomSheet open={settlement !== null} onClose={onClose} title={t('account.cloud.receive.reverse.title')} description={t('account.cloud.receive.reverse.body')}>
      <div className={styles.form}>
        <TextField
          label={t('account.cloud.receive.reverse.reason')}
          placeholder={t('account.cloud.receive.reverse.reason.placeholder')}
          value={reason}
          maxLength={200}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        <Button block variant="danger" loading={busy} disabled={!reason.trim()} onClick={() => void submit()}>
          {t('account.cloud.receive.reverse.cta')}
        </Button>
      </div>
    </BottomSheet>
  )
}
