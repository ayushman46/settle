import { useRef, useState } from 'react'
import { ChevronRight, CloudCheck, Fingerprint, KeyRound, LogOut, Plus, QrCode, RefreshCw, UsersRound } from 'lucide-react'
import { goBack, navigate, useLocation } from '../../app/router'
import { Badge, Banner, BottomSheet, Button, Card, ListRow, PageTitle, Screen, SectionHeader, SegmentedControl, Spinner, TextField, TopBar, useToast } from '../../components'
import { useProfile } from '../../data'
import { useT } from '../../i18n'
import { readUpiQr } from '../../lib/upiQr'
import { isUpiShaped, normalizeIndianPhone, normalizeUpi } from '../../../shared/cloud'
import { cloud, type Me, type PaymentMethod } from './api'
import { addPasskey, createAccount, passkeysSupported, signIn, withFreshAuth } from './passkey'
import { accountRequired } from './gate'
import { refreshAccount, setMe, setSignedOut, useAccount } from './store'
import { useSyncStatus } from './sync/status'
import styles from './Account.module.css'

const PHONE_DISPLAY = /^\+91(\d{5})(\d{5})$/

/** `+919876543210` → `+91 98765 43210`. */
function showPhone(e164: string): string {
  const m = PHONE_DISPLAY.exec(e164)
  return m ? `+91 ${m[1]} ${m[2]}` : e164
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Where to go after signing in: only a path inside the app. */
function nextPath(search: string): string | null {
  const next = new URLSearchParams(search).get('next')
  return next && /^\/app(?:[/?#]|$)/.test(next) && !next.startsWith('/app/account') ? next : null
}

/**
 * `/app/account` — the Settle account: create one with a passkey (no OTP, no password), sign in,
 * keep UPI IDs to receive money, manage passkeys, sign out.
 */
export function AccountScreen() {
  const t = useT()
  const account = useAccount()
  const location = useLocation()
  const next = nextPath(location.search)
  const [required] = useState(accountRequired)
  // Before signing in there's nowhere to go back to: the app needs the account.
  const gated = required && account.status !== 'signedIn'

  return (
    <Screen header={<TopBar onBack={gated ? undefined : () => goBack('/app/you')} />}>
      {account.status === 'signedIn' && account.me ? (
        <SignedIn me={account.me} />
      ) : account.status === 'signedOut' || account.status === 'unavailable' ? (
        <SignedOut next={next} gated={gated} message={account.status === 'unavailable' ? account.message : null} />
      ) : (
        <div className={styles.stack} role="status" aria-label={t('app.loading.aria')}>
          <Spinner />
        </div>
      )}
    </Screen>
  )
}

function SignedOut({ next, gated, message }: { next: string | null; gated: boolean; message: string | null }) {
  const t = useT()
  const toast = useToast()
  const profile = useProfile()
  const [mode, setMode] = useState<'create' | 'signIn'>('create')
  const [name, setName] = useState(profile.name === 'Me' ? '' : profile.name)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const supported = passkeysSupported()
  const phoneOk = normalizeIndianPhone(phone) !== null

  const done = (me: Me, note: string) => {
    setMe(me)
    toast(note, { tone: 'success' })
    if (next) navigate(next, { replace: true })
  }

  const create = async () => {
    if (busy || !phoneOk || !name.trim()) return
    setBusy(true)
    setError(null)
    const res = await createAccount(phone, name.trim())
    setBusy(false)
    if (res.ok) done(res.data.me, t('account.create.done'))
    else setError({ code: res.code, message: res.message })
  }

  const login = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    const res = await signIn(phone.trim() ? phone : undefined)
    setBusy(false)
    if (res.ok) done(res.data.me, t('account.signIn.done'))
    else setError({ code: res.code, message: res.message })
  }

  return (
    <div className={styles.stack}>
      <PageTitle
        title={gated ? t('account.gate.title') : t('account.title.signedOut')}
        subtitle={gated ? t('account.gate.subtitle') : next ? t('account.next.hint') : t('account.subtitle.signedOut')}
        leading={<Fingerprint />}
      />
      {message && <Banner tone="warning">{message}</Banner>}
      {!supported && (
        <Banner tone="warning" title={t('account.passkey.unsupported.title')}>
          {t('account.passkey.unsupported.body')}
        </Banner>
      )}
      <SegmentedControl
        ariaLabel={t('account.mode.aria')}
        value={mode}
        onChange={(value) => {
          setMode(value)
          setError(null)
        }}
        options={[
          { value: 'create', label: t('account.mode.create') },
          { value: 'signIn', label: t('account.mode.signIn') },
        ]}
      />
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault()
          void (mode === 'create' ? create() : login())
        }}
      >
        {mode === 'create' && (
          <TextField
            label={t('account.create.name')}
            placeholder={t('account.create.name.placeholder')}
            value={name}
            maxLength={40}
            autoComplete="name"
            onChange={(e) => setName(e.currentTarget.value)}
          />
        )}
        <TextField
          label={t('account.create.phone')}
          placeholder={t('account.create.phone.placeholder')}
          value={phone}
          inputMode="tel"
          autoComplete="tel-national"
          startAdornment="+91"
          hint={mode === 'create' ? t('account.create.phone.hint') : t('account.signIn.phone.hint')}
          onChange={(e) => setPhone(e.currentTarget.value)}
        />
        {error && (
          <Banner
            tone="error"
            action={
              error.code === 'phone_taken'
                ? {
                    // Often the account was made a moment ago (a slow first try): one tap signs in to it.
                    label: t('account.create.signInInstead'),
                    onAction: () => {
                      setMode('signIn')
                      void login()
                    },
                  }
                : undefined
            }
          >
            {error.code === 'phone_taken' ? t('account.create.taken') : error.message}
          </Banner>
        )}
        {mode === 'create' ? (
          <Button type="submit" block loading={busy} disabled={!supported || !phoneOk || !name.trim()} iconStart={<KeyRound />}>
            {t('account.create.cta')}
          </Button>
        ) : (
          <Button type="submit" block loading={busy} disabled={!supported || (phone.trim() !== '' && !phoneOk)} iconStart={<Fingerprint />}>
            {t('account.signIn.cta')}
          </Button>
        )}
        {busy && (
          <p className={styles.footnote} role="status">
            {mode === 'create' ? t('account.create.busy') : t('account.signIn.busy')}
          </p>
        )}
      </form>
      <p className={styles.footnote}>{t('account.footnote')}</p>
    </div>
  )
}

function SignedIn({ me }: { me: Me }) {
  const t = useT()
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [managing, setManaging] = useState<PaymentMethod | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (key: string, step: () => Promise<{ ok: true; data: { me: Me } } | { ok: false; message: string }>, note: string) => {
    if (busy) return
    setBusy(key)
    const res = await step()
    setBusy(null)
    if (res.ok) {
      setMe(res.data.me)
      toast(note, { tone: 'success' })
    } else {
      toast(res.message, { tone: 'error' })
    }
  }

  const sync = useSyncStatus()
  const [confirming, setConfirming] = useState<'out' | 'all' | null>(null)
  const [unsaved, setUnsaved] = useState(false)

  const syncNow = async () => {
    const { syncNow: run } = await import('./sync/runner')
    await run()
  }

  /** Saves what's left first; if that fails, says so and asks again before losing it. */
  const signOut = async (everywhere: boolean, anyway: boolean) => {
    if (busy) return
    setBusy(everywhere ? 'all' : 'out')
    const runner = await import('./sync/runner')
    if (!anyway) {
      await runner.syncNow()
      const { syncStatus } = await import('./sync/status')
      if (syncStatus().state === 'error') {
        setBusy(null)
        setUnsaved(true)
        return
      }
    }
    const res = everywhere ? await withFreshAuth(() => cloud('POST', '/auth/logout-all', {})) : await cloud('POST', '/auth/logout', {})
    setBusy(null)
    if (!res.ok && !anyway) {
      toast(res.message, { tone: 'error' })
      return
    }
    setConfirming(null)
    runner.forgetThisPhone()
    setSignedOut()
    toast(t('account.signedOut'), { tone: 'success' })
  }

  return (
    <div className={styles.stack}>
      <PageTitle
        title={me.displayName}
        subtitle={
          <span className={styles.badges}>
            {showPhone(me.phoneNumber)}
            {!me.phoneVerified && <Badge tone="neutral" size="sm">{t('account.phone.unverified')}</Badge>}
          </span>
        }
      />

      <ListRow
        leading={<UsersRound />}
        title={t('account.groups.link.title')}
        subtitle={t('account.groups.link.body')}
        onClick={() => navigate('/app/cloud')}
        chevron
      />

      <section>
        <SectionHeader
          title={t('account.upi.heading')}
          description={t('account.upi.description')}
          action={me.paymentMethods.length < 5 ? { label: t('account.upi.add'), onClick: () => setAdding(true) } : undefined}
        />
        <Card padding="md">
          {me.paymentMethods.length === 0 ? (
            <div className={styles.stack}>
              <p className={styles.footnote}>{t('account.upi.empty')}</p>
              <Button iconStart={<Plus />} onClick={() => setAdding(true)}>
                {t('account.upi.add')}
              </Button>
            </div>
          ) : (
            me.paymentMethods.map((pm) => (
              <button key={pm.id} type="button" className={`${styles.row} ${styles.rowButton}`} onClick={() => setManaging(pm)}>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{pm.upiId}</span>
                  <span className={styles.badges}>
                    {pm.isDefault && <Badge tone="accent" size="sm">{t('account.upi.default')}</Badge>}
                    <Badge tone="neutral" size="sm">{t(pm.status === 'verified' ? 'account.upi.status.verified' : pm.status === 'validated' ? 'account.upi.status.validated' : 'account.upi.status.unverified')}</Badge>
                    {pm.source === 'qr' && <Badge tone="neutral" size="sm">{t('account.upi.fromQr')}</Badge>}
                    {pm.displayName && <span className={styles.rowSub}>{pm.displayName}</span>}
                  </span>
                </span>
                <ChevronRight aria-hidden="true" />
              </button>
            ))
          )}
        </Card>
      </section>

      <section>
        <SectionHeader title={t('account.passkeys.heading')} description={t('account.passkeys.description')} action={{ label: t('account.passkeys.add'), onClick: () => void run('passkey', () => withFreshAuth(() => addPasskey(null)), t('account.passkeys.added')) }} />
        <Card padding="md">
          {me.passkeys.map((pk) => (
            <div key={pk.id} className={styles.row}>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{pk.nickname ?? (pk.backedUp ? t('account.passkeys.synced') : t('account.passkeys.device'))}</span>
                <span className={styles.rowSub}>
                  {t('account.passkeys.created', { date: shortDate(pk.createdAt) })}
                  {pk.lastUsedAt ? ` · ${t('account.passkeys.lastUsed', { date: shortDate(pk.lastUsedAt) })}` : ''}
                </span>
              </span>
              {me.passkeys.length > 1 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={busy === pk.id}
                  onClick={() => void run(pk.id, () => withFreshAuth(() => cloud<{ me: Me }>('DELETE', `/passkeys/${pk.id}`)), t('account.passkeys.removed'))}
                >
                  {t('account.passkeys.remove')}
                </Button>
              ) : null}
            </div>
          ))}
          <p className={styles.footnote}>{me.passkeys.length > 1 ? t('account.passkeys.recovery') : t('account.passkeys.lastOne')}</p>
        </Card>
      </section>

      <section>
        <SectionHeader title={t('account.sync.heading')} />
        <Card padding="md">
          <div className={styles.row}>
            <span className={styles.rowText}>
              <span className={styles.rowSub} role="status">
                {sync.state === 'error'
                  ? (sync.message ?? t('account.sync.error'))
                  : sync.state === 'syncing'
                    ? t('account.sync.syncing')
                    : sync.lastSyncedAt
                      ? t('account.sync.synced', { time: new Date(sync.lastSyncedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) })
                      : t('account.sync.waiting')}
              </span>
            </span>
            {sync.state === 'synced' ? <CloudCheck aria-hidden="true" /> : null}
          </div>
          <Button variant="secondary" size="sm" iconStart={<RefreshCw />} loading={sync.state === 'syncing'} onClick={() => void syncNow()}>
            {t('account.sync.now')}
          </Button>
        </Card>
      </section>

      <div className={styles.stack}>
        <Button
          variant="secondary"
          block
          iconStart={<LogOut />}
          onClick={() => {
            setUnsaved(false)
            setConfirming('out')
          }}
        >
          {t('account.signOut')}
        </Button>
        <Button
          variant="ghost"
          block
          onClick={() => {
            setUnsaved(false)
            setConfirming('all')
          }}
        >
          {t('account.signOut.all')}
        </Button>
        <p className={styles.footnote}>{t('account.footnote')}</p>
      </div>

      <AddUpiSheet open={adding} onClose={() => setAdding(false)} existing={me.paymentMethods} />
      <BottomSheet open={confirming !== null} onClose={() => setConfirming(null)} title={t('account.signOut.confirm.title')} description={t('account.signOut.confirm.body')}>
        <div className={styles.stack}>
          {unsaved && <Banner tone="warning">{t('account.signOut.confirm.unsaved')}</Banner>}
          <Button block variant="danger" loading={busy === 'out' || busy === 'all'} onClick={() => void signOut(confirming === 'all', unsaved)}>
            {unsaved ? t('account.signOut.confirm.anyway') : t('account.signOut.confirm.cta')}
          </Button>
          <Button block variant="ghost" onClick={() => setConfirming(null)}>
            {t('account.signOut.confirm.cancel')}
          </Button>
        </div>
      </BottomSheet>
      <BottomSheet open={managing !== null} onClose={() => setManaging(null)} title={managing?.upiId ?? ''}>
        {managing && (
          <div className={styles.stack}>
            {!managing.isDefault && (
              <Button
                block
                loading={busy === 'default'}
                onClick={() =>
                  void run('default', () => withFreshAuth(() => cloud<{ me: Me }>('PATCH', `/payment-methods/${managing.id}`, { isDefault: true })), t('account.upi.defaultSet')).then(() => setManaging(null))
                }
              >
                {t('account.upi.makeDefault')}
              </Button>
            )}
            <Button
              block
              variant="danger"
              loading={busy === 'remove'}
              onClick={() => void run('remove', () => withFreshAuth(() => cloud<{ me: Me }>('DELETE', `/payment-methods/${managing.id}`)), t('account.upi.removed')).then(() => setManaging(null))}
            >
              {t('account.upi.remove')}
            </Button>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}

/** Type a UPI ID or read it from the person's own UPI QR picture, then confirm it before saving. */
function AddUpiSheet({ open, onClose, existing }: { open: boolean; onClose: () => void; existing: readonly PaymentMethod[] }) {
  const t = useT()
  const toast = useToast()
  const profile = useProfile()
  const suggested = profile.upiId && !existing.some((p) => p.upiId === normalizeUpi(profile.upiId!)) ? profile.upiId : ''
  const [upi, setUpi] = useState(suggested)
  const [label, setLabel] = useState('')
  const [qrName, setQrName] = useState<string | null>(null)
  const [source, setSource] = useState<'typed' | 'qr'>('typed')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const valid = isUpiShaped(upi)

  const reset = () => {
    setUpi(suggested)
    setLabel('')
    setQrName(null)
    setSource('typed')
    setConfirming(false)
    setError(null)
  }

  const close = () => {
    reset()
    onClose()
  }

  const fromPicture = async (picture: File | undefined) => {
    if (!picture) return
    const result = await readUpiQr(picture)
    if (result.kind !== 'ok') {
      setError(t('account.upi.sheet.qr.none'))
      return
    }
    setUpi(result.qr.vpa)
    setQrName(result.qr.name)
    setSource('qr')
    setError(null)
    setConfirming(true)
  }

  const save = async () => {
    if (busy) return
    setBusy(true)
    const res = await withFreshAuth(() => cloud<{ me: Me }>('POST', '/payment-methods', { upiId: upi, displayName: label.trim() || null, source, confirmed: true }))
    setBusy(false)
    if (!res.ok && res.code === 'upi_exists') {
      // Saved already (a slow first tap went through): show it rather than an error.
      await refreshAccount()
      toast(t('account.upi.saved'), { tone: 'success' })
      close()
      return
    }
    if (!res.ok) {
      setError(res.message)
      setConfirming(false)
      return
    }
    setMe(res.data.me)
    toast(t('account.upi.saved'), { tone: 'success' })
    close()
  }

  return (
    <BottomSheet open={open} onClose={close} title={confirming ? t('account.upi.confirm.title') : t('account.upi.sheet.title')}>
      {confirming ? (
        <div className={styles.stack}>
          <p className={styles.upiBig}>{normalizeUpi(upi)}</p>
          {qrName && <p className={styles.footnote}>{t('account.upi.confirm.qrName', { name: qrName })}</p>}
          <p className={styles.warning}>{t('account.upi.confirm.body')}</p>
          <Button block loading={busy} onClick={() => void save()}>
            {t('account.upi.confirm.cta')}
          </Button>
          <Button block variant="ghost" onClick={() => setConfirming(false)}>
            {t('account.upi.confirm.back')}
          </Button>
        </div>
      ) : (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) {
              setSource('typed')
              setConfirming(true)
            }
          }}
        >
          <TextField
            label={t('account.upi.sheet.label')}
            placeholder={t('account.upi.sheet.placeholder')}
            value={upi}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            error={upi.trim() && !valid ? t('account.upi.sheet.invalid') : undefined}
            onChange={(e) => setUpi(e.currentTarget.value)}
          />
          <TextField label={t('account.upi.sheet.name')} placeholder={t('account.upi.sheet.name.placeholder')} value={label} maxLength={60} onChange={(e) => setLabel(e.currentTarget.value)} />
          <input ref={file} className={styles.hidden} type="file" accept="image/*" tabIndex={-1} aria-hidden="true" onChange={(e) => void fromPicture(e.currentTarget.files?.[0])} />
          <Button type="button" variant="secondary" block iconStart={<QrCode />} onClick={() => file.current?.click()}>
            {t('account.upi.sheet.qr')}
          </Button>
          {error && <Banner tone="error">{error}</Banner>}
          <Button type="submit" block disabled={!valid}>
            {t('account.upi.sheet.next')}
          </Button>
        </form>
      )}
    </BottomSheet>
  )
}

