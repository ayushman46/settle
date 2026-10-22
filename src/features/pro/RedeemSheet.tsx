import { useId, useRef, useState, type FormEvent } from 'react'
import { ClipboardPaste, KeyRound } from 'lucide-react'
import { Banner, BottomSheet, Button, IconButton, TextField, useToast } from '../../components'
import { BRAND, type License } from '../../domain/types'
import { isOffline } from '../../api/http'
import { LICENSE_PREFIX } from '../../../shared/api'
import { extractLicenseToken, licenseToken, redeemLicense, usePro } from '../../pro'
import { passDate } from './plans'
import styles from './RedeemSheet.module.css'

export interface RedeemSheetProps {
  open: boolean
  onClose: () => void
  /** A code switched Pro on — close the sheet and celebrate. */
  onRedeemed: (license: License) => void
  /** Pre-fills the field (e.g. a code that arrived in a link). */
  initialCode?: string
}

type Notice =
  /** Pro already runs on a pass that lasts longer; the code wasn't needed. */
  | { kind: 'kept'; until: number | null }
  /** That exact code is already this phone's pass. */
  | { kind: 'same' }

const ERRORS = {
  notACode: `That doesn't look like a ${BRAND.name} Pro code. Codes start with ${LICENSE_PREFIX}.`,
  invalid: "That code isn't valid. Check you copied all of it, then try again.",
  expired: 'That code has expired.',
  offline: "You're offline. Connect to the internet to check the code.",
  network: "Couldn't check the code right now. Try again in a moment.",
} as const

function canReadClipboard(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function'
}

/**
 * "Redeem a code": paste a Pro code (promo codes, or a pass moved from another phone) and it's
 * checked on the spot. Says plainly what went wrong — not a code, not genuine, expired, offline —
 * and never swaps a longer pass for a shorter one.
 */
export function RedeemSheet({ open, onClose, onRedeemed, initialCode = '' }: RedeemSheetProps) {
  const toast = useToast()
  const pro = usePro()
  const formId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState(initialCode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const close = (): void => {
    if (busy) return
    onClose()
  }

  const submit = async (event?: FormEvent): Promise<void> => {
    event?.preventDefault()
    if (busy) return
    setNotice(null)
    const token = extractLicenseToken(code)
    if (!token) {
      setError(ERRORS.notACode)
      inputRef.current?.focus()
      return
    }
    if (token === licenseToken() && pro.isPro) {
      setError(null)
      setNotice({ kind: 'same' })
      return
    }
    setBusy(true)
    setError(null)
    const result = await redeemLicense(token)
    setBusy(false)
    if (!result.ok) {
      setError(result.reason === 'network' ? (isOffline() ? ERRORS.offline : ERRORS.network) : ERRORS[result.reason])
      inputRef.current?.focus()
      return
    }
    if (licenseToken() !== token) {
      // A pass that outlasts this code is already on — nothing was swapped.
      setNotice({ kind: 'kept', until: result.license.exp === null ? null : result.license.exp * 1000 })
      return
    }
    setCode('')
    onRedeemed(result.license)
  }

  const paste = async (): Promise<void> => {
    try {
      const text = await navigator.clipboard.readText()
      setCode(text.trim())
      setError(null)
      setNotice(null)
      inputRef.current?.focus()
    } catch {
      toast("Couldn't read the clipboard. Long-press the field to paste instead.", { tone: 'warning' })
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={close}
      title="Redeem a code"
      description={`Paste the Pro code you were given or copied from your old phone. Codes start with ${LICENSE_PREFIX}.`}
      initialFocus={inputRef}
      footer={
        notice ? (
          <Button block onClick={onClose}>
            Done
          </Button>
        ) : (
          <Button block type="submit" form={formId} loading={busy} disabled={!code.trim()}>
            Redeem
          </Button>
        )
      }
    >
      <form id={formId} className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        <TextField
          ref={inputRef}
          label="Pro code"
          value={code}
          placeholder={`${LICENSE_PREFIX}.…`}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          className={styles.code}
          error={error}
          startAdornment={<KeyRound aria-hidden="true" className={styles.key} />}
          endAdornment={
            canReadClipboard() ? (
              <IconButton label="Paste from clipboard" size="sm" onClick={() => void paste()}>
                <ClipboardPaste />
              </IconButton>
            ) : undefined
          }
          onChange={(event) => {
            setCode(event.target.value)
            if (error) setError(null)
            if (notice) setNotice(null)
          }}
        />
      </form>
      {notice?.kind === 'kept' && (
        <Banner tone="info" title="You already have a longer pass">
          {notice.until === null
            ? 'Your Lifetime pass is already on, so nothing changed here.'
            : `Your pass runs until ${passDate(notice.until)} — longer than this code — so nothing changed.`}{' '}
          The code still works on another phone.
        </Banner>
      )}
      {notice?.kind === 'same' && (
        <Banner tone="success" title="That code is already on this phone">
          Pro is on — there's nothing else to do.
        </Banner>
      )}
      <p className={styles.note}>
        Your pass lives on this phone — no account needed. Keep your code private: anyone with it gets your Pro.
      </p>
    </BottomSheet>
  )
}
