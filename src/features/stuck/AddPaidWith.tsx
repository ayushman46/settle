/* eslint-disable react-refresh/only-export-components -- the block and what its values mean (wallets, banks) are one unit; an edit here just reloads the page in dev. */
import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { Chip, SectionHeader, TextField } from '../../components'
import type { StuckRail } from '../../data/stores'
import { useT } from '../../i18n'
import { BANK_LABELS } from '../sharein/sms/smsView'
import { UPI_APP_IDS, UPI_APP_NAMES, upiAppOf } from './help'
import styles from './Stuck.module.css'

/** Wallets a failed wallet payment can be owed by; the one picked is kept as the payment's `app`. */
export const WALLET_IDS = ['paytm', 'phonepe', 'amazonpay', 'mobikwik'] as const
export type WalletId = (typeof WALLET_IDS)[number]

const WALLET_NAMES: Readonly<Record<WalletId, string>> = {
  paytm: 'Paytm',
  phonepe: 'PhonePe',
  amazonpay: 'Amazon Pay',
  mobikwik: 'MobiKwik',
}

/** The select's value for "Another bank" (its name is typed). */
export const OTHER_BANK = '_other'

/** The wallet a saved `app` means — an id, a package or a name — or null. */
export function walletOf(app: string | null | undefined): WalletId | null {
  const raw = app?.trim() ?? ''
  if (/^(?:mobikwik|com\.mobikwik_new)$/i.test(raw)) return 'mobikwik'
  const upi = upiAppOf(raw)
  return upi !== null && (WALLET_IDS as readonly string[]).includes(upi) ? (upi as WalletId) : null
}

/** A bank Settle knows by id. */
export function isKnownBank(bank: string): boolean {
  return Object.hasOwn(BANK_LABELS, bank)
}

/** What Add asks about the money's way out: the bank (or the wallet), the UPI app, the account's last digits. */
export interface PaidWith {
  /** A bank id, OTHER_BANK (its name in `bankName`), or ''. */
  bank: string
  bankName: string
  /** The account's or card's last digits. */
  account: string
  /** The UPI app or wallet: an id ("gpay", "paytm"), what was saved (a package name), a wallet's name, or ''. */
  app: string
  /** "Another wallet" picked: its name is typed into `app`. */
  otherWallet: boolean
}

const UPI_RAILS: ReadonlySet<StuckRail> = new Set(['upi_person', 'upi_merchant'])
const CARD_RAILS: ReadonlySet<StuckRail> = new Set(['card_online', 'card_pos', 'card_transfer', 'atm'])

/**
 * The bank and app block on Add: which wallet (a wallet payment is owed by the wallet company),
 * else the UPI app it was paid with and the bank with the account's (or card's) last 4 digits —
 * what the complaint letter is addressed to. Filled in from a message, it's there to check.
 */
export function AddPaidWith({ rail, value, onChange }: { rail: StuckRail | null; value: PaidWith; onChange: (patch: Partial<PaidWith>) => void }) {
  const t = useT()
  const ids = { head: useId(), apps: useId(), bank: useId() }

  if (rail === 'wallet') {
    const picked = walletOf(value.app)
    return (
      <section className={styles.formSection} aria-labelledby={ids.head}>
        <SectionHeader id={ids.head} title={t('stuck.add.paidWith.wallet')} description={t('stuck.add.paidWith.text')} />
        <div role="radiogroup" aria-labelledby={ids.head} className={styles.chips}>
          {WALLET_IDS.map((id) => (
            <Chip key={id} role="radio" selected={picked === id && !value.otherWallet} onClick={() => onChange({ app: id, otherWallet: false })}>
              {WALLET_NAMES[id]}
            </Chip>
          ))}
          <Chip role="radio" selected={value.otherWallet} onClick={() => onChange({ app: value.otherWallet ? value.app : '', otherWallet: true })}>
            {t('stuck.add.wallet.other')}
          </Chip>
        </div>
        {value.otherWallet && (
          <TextField label={t('stuck.add.wallet.name')} value={value.app} maxLength={40} autoCapitalize="words" onChange={(event) => onChange({ app: event.target.value })} />
        )}
      </section>
    )
  }

  const card = rail !== null && CARD_RAILS.has(rail)
  const upi = rail === null || UPI_RAILS.has(rail)
  const app = upiAppOf(value.app)
  return (
    <section className={styles.formSection} aria-labelledby={ids.head}>
      <SectionHeader id={ids.head} title={t('stuck.add.paidWith')} description={t('stuck.add.paidWith.text')} />
      {upi && (
        <div role="group" aria-labelledby={ids.apps} className={styles.formSection}>
          <p id={ids.apps} className={styles.dateLabel}>
            {t('stuck.add.app')}
          </p>
          <div className={styles.chips}>
            {UPI_APP_IDS.map((id) => (
              <Chip key={id} selected={app === id} onClick={() => onChange({ app: app === id ? '' : id })}>
                {UPI_APP_NAMES[id]}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <div className={styles.selectField}>
        <label htmlFor={ids.bank} className={styles.selectLabel}>
          {card ? t('stuck.add.bank.card') : t('stuck.add.bank')}
        </label>
        <span className={styles.selectControl}>
          <select id={ids.bank} className={styles.select} value={value.bank} onChange={(event) => onChange({ bank: event.target.value })}>
            <option value="">{t('stuck.add.bank.none')}</option>
            {Object.entries(BANK_LABELS).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
            <option value={OTHER_BANK}>{t('stuck.add.bank.other')}</option>
          </select>
          <ChevronDown aria-hidden="true" className={styles.selectChevron} />
        </span>
      </div>
      {value.bank === OTHER_BANK && (
        <TextField label={t('stuck.add.bank.name')} value={value.bankName} maxLength={40} autoCapitalize="words" onChange={(event) => onChange({ bankName: event.target.value })} />
      )}
      <TextField
        label={card ? t('stuck.add.account.card') : t('stuck.add.account')}
        hint={t('stuck.add.account.hint')}
        value={value.account}
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        onChange={(event) => onChange({ account: event.target.value.replace(/\D/g, '').slice(0, 4) })}
      />
    </section>
  )
}
