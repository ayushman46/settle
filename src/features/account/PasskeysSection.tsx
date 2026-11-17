import { useState } from 'react'
import { ChevronRight, KeyRound, Plus, QrCode, Smartphone, Usb } from 'lucide-react'
import { Badge, Banner, BottomSheet, Button, Card, SectionHeader, TextField, useToast } from '../../components'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { cloud, type Me, type Passkey } from './api'
import { addPasskey, forgetPasskeys, withFreshAuth, type PasskeyKind } from './passkey'
import { setMe } from './store'
import { passkeyName } from './accountHelpers'
import styles from './Account.module.css'

const MAX_PASSKEYS = 10

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}


/**
 * Every passkey on the account: add one (this phone, another phone by QR code, or a security key),
 * rename one, or delete one. The last one can't be deleted, or nobody could sign in.
 */
export function PasskeysSection({ me }: { me: Me }) {
  const t = useT()
  const [adding, setAdding] = useState(false)
  const [managing, setManaging] = useState<Passkey | null>(null)
  const full = me.passkeys.length >= MAX_PASSKEYS
  // The sheet follows the account: a rename shows straight away, a deleted one closes it.
  const open = managing ? (me.passkeys.find((p) => p.id === managing.id) ?? null) : null

  return (
    <section>
      <SectionHeader
        title={t('account.passkeys.heading')}
        description={t('account.passkeys.description')}
        action={full ? undefined : { label: t('account.passkeys.add'), onClick: () => setAdding(true) }}
      />
      <Card padding="md">
        {me.passkeys.map((pk) => (
          <button key={pk.id} type="button" className={cx(styles.row, styles.rowButton)} onClick={() => setManaging(pk)}>
            <KeyRound aria-hidden="true" />
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>{passkeyName(pk, t)}</span>
              <span className={styles.badges}>
                {pk.current && <Badge tone="accent" size="sm">{t('account.passkeys.current')}</Badge>}
                <span className={styles.rowSub}>
                  {t('account.passkeys.created', { date: shortDate(pk.createdAt) })}
                  {pk.lastUsedAt ? ` · ${t('account.passkeys.lastUsed', { date: shortDate(pk.lastUsedAt) })}` : ''}
                </span>
              </span>
            </span>
            <ChevronRight aria-hidden="true" />
          </button>
        ))}
        <p className={styles.footnote}>
          {full ? t('account.passkeys.full', { max: MAX_PASSKEYS }) : me.passkeys.length > 1 ? t('account.passkeys.recovery') : t('account.passkeys.onlyOne')}
        </p>
        {!full && me.passkeys.length === 1 && (
          <Button variant="secondary" size="sm" iconStart={<Plus />} onClick={() => setAdding(true)}>
            {t('account.passkeys.add')}
          </Button>
        )}
      </Card>
      <AddPasskeySheet open={adding} known={me.passkeys.map((p) => p.id)} onClose={() => setAdding(false)} />
      <ManagePasskeySheet passkey={open} count={me.passkeys.length} onClose={() => setManaging(null)} />
    </section>
  )
}

const KINDS: Array<{ kind: PasskeyKind; icon: typeof Smartphone }> = [
  { kind: 'this', icon: Smartphone },
  { kind: 'other', icon: QrCode },
  { kind: 'key', icon: Usb },
]

function AddPasskeySheet({ open, known, onClose }: { open: boolean; known: readonly string[]; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const [kind, setKind] = useState<PasskeyKind>('other')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setName('')
    setError(null)
    onClose()
  }

  const create = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    const res = await withFreshAuth(() => addPasskey(kind, name.trim() || null))
    setBusy(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    setMe(res.data.me)
    const added = res.data.me.passkeys.find((p) => !known.includes(p.id))
    toast(added ? t('account.passkeys.addedNamed', { name: passkeyName(added, t) }) : t('account.passkeys.added'), { tone: 'success' })
    close()
  }

  return (
    <BottomSheet open={open} onClose={close} title={t('account.passkeys.add.title')} description={t('account.passkeys.add.body')}>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault()
          void create()
        }}
      >
        <fieldset className={styles.fieldset}>
          <legend className="visually-hidden">{t('account.passkeys.add.where')}</legend>
          {KINDS.map(({ kind: k, icon: Icon }) => (
            <label key={k} className={cx(styles.choice, kind === k && styles.choiceOn)}>
              <input type="radio" name="passkey-kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
              <Icon aria-hidden="true" />
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{t(`account.passkeys.kind.${k}`)}</span>
                <span className={styles.rowSub}>{t(`account.passkeys.kind.${k}.body`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <TextField
          label={t('account.passkeys.name.label')}
          placeholder={t('account.passkeys.name.placeholder')}
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        {error && <Banner tone="error">{error}</Banner>}
        <Button type="submit" block loading={busy} iconStart={<KeyRound />}>
          {t('account.passkeys.add.cta')}
        </Button>
        {busy && (
          <p className={styles.footnote} role="status">
            {t(`account.passkeys.add.busy.${kind}`)}
          </p>
        )}
      </form>
    </BottomSheet>
  )
}

function ManagePasskeySheet({ passkey, count, onClose }: { passkey: Passkey | null; count: number; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const [name, setName] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState<'rename' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const value = name ?? passkey?.nickname ?? ''

  const close = () => {
    setName(null)
    setConfirming(false)
    setError(null)
    onClose()
  }

  const rename = async () => {
    if (!passkey || busy) return
    setBusy('rename')
    const res = await cloud<{ me: Me }>('PATCH', `/passkeys/${passkey.id}`, { nickname: value.trim() || null })
    setBusy(null)
    if (!res.ok) {
      setError(res.message)
      return
    }
    setMe(res.data.me)
    toast(t('account.passkeys.renamed'), { tone: 'success' })
    close()
  }

  const remove = async () => {
    if (!passkey || busy) return
    setBusy('delete')
    const res = await withFreshAuth(() => cloud<{ me: Me }>('DELETE', `/passkeys/${passkey.id}`))
    setBusy(null)
    if (!res.ok) {
      setError(res.message)
      setConfirming(false)
      return
    }
    // If it's on this phone, its password manager stops offering it.
    void forgetPasskeys([passkey.credentialId])
    setMe(res.data.me)
    toast(t('account.passkeys.removed'), { tone: 'success' })
    close()
  }

  return (
    <BottomSheet open={passkey !== null} onClose={close} title={passkey ? passkeyName(passkey, t) : ''}>
      {passkey && (
        <div className={styles.stack}>
          <p className={styles.footnote}>
            {[
              passkey.provider,
              passkey.backedUp ? t('account.passkeys.synced') : t('account.passkeys.device'),
              t('account.passkeys.created', { date: shortDate(passkey.createdAt) }),
              passkey.lastUsedAt ? t('account.passkeys.lastUsed', { date: shortDate(passkey.lastUsedAt) }) : t('account.passkeys.neverUsed'),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {passkey.current && <Banner tone="info">{t('account.passkeys.current.body')}</Banner>}
          {confirming ? (
            <>
              <Banner tone="warning" title={t('account.passkeys.delete.confirm.title')}>
                {passkey.current ? t('account.passkeys.delete.confirm.current') : t('account.passkeys.delete.confirm.body')}
              </Banner>
              <Button block variant="danger" loading={busy === 'delete'} onClick={() => void remove()}>
                {t('account.passkeys.delete.confirm.cta')}
              </Button>
              <Button block variant="ghost" onClick={() => setConfirming(false)}>
                {t('account.passkeys.delete.confirm.cancel')}
              </Button>
            </>
          ) : (
            <>
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault()
                  void rename()
                }}
              >
                <TextField
                  label={t('account.passkeys.name.label')}
                  placeholder={passkey.provider ?? t('account.passkeys.name.placeholder')}
                  value={value}
                  maxLength={40}
                  onChange={(e) => setName(e.currentTarget.value)}
                />
                <Button type="submit" block variant="secondary" loading={busy === 'rename'} disabled={value.trim() === (passkey.nickname ?? '')}>
                  {t('account.passkeys.rename.cta')}
                </Button>
              </form>
              {error && <Banner tone="error">{error}</Banner>}
              {count > 1 ? (
                <Button block variant="danger" onClick={() => setConfirming(true)}>
                  {t('account.passkeys.delete.cta')}
                </Button>
              ) : (
                <p className={styles.footnote}>{t('account.passkeys.delete.last')}</p>
              )}
            </>
          )}
        </div>
      )}
    </BottomSheet>
  )
}
