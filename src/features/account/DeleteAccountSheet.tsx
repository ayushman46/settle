import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { navigate } from '../../app/router'
import { Banner, BottomSheet, Button, Money, Spinner, TextField, useToast } from '../../components'
import { useT } from '../../i18n'
import { cloud, type Dashboard, type Me } from './api'
import { ACCOUNT_PATH, cloudGroupPath } from './paths'
import { forgetPasskeys, withFreshAuth } from './passkey'
import { setSignedOut } from './store'
import { useCloudGet } from './useCloud'
import { blockers } from './accountHelpers'
import styles from './Account.module.css'

/** What has to be typed to delete: one word, so it can't happen by a stray tap. */
const CONFIRM_WORD = 'DELETE'

/**
 * Deleting the account, for good: refused while money is owed in an account group (the sheet shows
 * where), then a typed word and a passkey check. Afterwards this phone forgets everything.
 */
export function DeleteAccountSheet({ me, open, onClose }: { me: Me; open: boolean; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const { data, error: loadError } = useCloudGet<Dashboard>(open ? '/dashboard' : null)
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = data ? blockers(data) : null
  const ready = word.trim().toUpperCase() === CONFIRM_WORD && pending !== null && pending.length === 0

  const close = () => {
    setWord('')
    setError(null)
    onClose()
  }

  const remove = async () => {
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    const res = await withFreshAuth(() => cloud<{ ok: true; credentialIds: string[] }>('POST', '/me/delete', { confirm: CONFIRM_WORD }))
    if (!res.ok) {
      setBusy(false)
      setError(res.code === 'balance_not_zero' ? t('account.delete.blocked.body') : res.message)
      return
    }
    // This phone's password manager stops offering the account's passkeys; the phone forgets its data.
    await forgetPasskeys(res.data.credentialIds.length > 0 ? res.data.credentialIds : me.passkeys.map((p) => p.credentialId))
    const runner = await import('./sync/runner')
    runner.forgetThisPhone()
    setSignedOut()
    setBusy(false)
    close()
    toast(t('account.delete.done'), { tone: 'success' })
    navigate(ACCOUNT_PATH, { replace: true })
  }

  return (
    <BottomSheet open={open} onClose={close} title={t('account.delete.title')} description={t('account.delete.body')}>
      <div className={styles.stack}>
        <ul className={styles.list}>
          <li>{t('account.delete.what.personal')}</li>
          <li>{t('account.delete.what.groups')}</li>
          <li>{t('account.delete.what.shared')}</li>
          <li>{t('account.delete.what.number')}</li>
        </ul>

        {pending === null ? (
          loadError ? (
            <Banner tone="error">{loadError.message}</Banner>
          ) : (
            <div role="status" aria-label={t('app.loading.aria')}>
              <Spinner />
            </div>
          )
        ) : pending.length > 0 ? (
          <Banner tone="warning" title={t('account.delete.blocked.title')}>
            <span className={styles.stack}>
              {t('account.delete.blocked.body')}
              {pending.map((b) => (
                <Button key={b.groupId} size="sm" variant="secondary" onClick={() => { close(); navigate(cloudGroupPath(b.groupId)) }}>
                  {b.name}
                  {b.net !== 0 ? ' · ' : ''}
                  {b.net !== 0 ? <Money value={Math.abs(b.net)} currency="INR" /> : null}
                  {b.net > 0 ? ` ${t('account.delete.blocked.owed')}` : b.net < 0 ? ` ${t('account.delete.blocked.owe')}` : ` ${t('account.delete.blocked.inFlight')}`}
                </Button>
              ))}
            </span>
          </Banner>
        ) : (
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault()
              void remove()
            }}
          >
            <TextField
              label={t('account.delete.type', { word: CONFIRM_WORD })}
              value={word}
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setWord(e.currentTarget.value)}
            />
            {error && <Banner tone="error">{error}</Banner>}
            <Button type="submit" block variant="danger" loading={busy} disabled={!ready} iconStart={<Trash2 />}>
              {t('account.delete.cta')}
            </Button>
          </form>
        )}
        <Button block variant="ghost" onClick={close}>
          {t('account.delete.cancel')}
        </Button>
      </div>
    </BottomSheet>
  )
}
