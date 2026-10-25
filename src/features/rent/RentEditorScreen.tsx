import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { goBack, navigate, Redirect, useRoute } from '../../app/router'
import {
  ActionBar,
  AmountInput,
  BottomSheet,
  Button,
  PageTitle,
  Screen,
  Stepper,
  TextField,
  TopBar,
  useToast,
} from '../../components'
import { useFriendsById } from '../../data'
import { ME_ID } from '../../domain/types'
import { useT, type MessageKey } from '../../i18n'
import { FriendAvatar, friendLabel, PeoplePicker } from '../../kit/index-a'
import { haptic } from '../../lib/haptics'
import { formatMoney, parseMoneyInput, toInputString } from '../../lib/money'
import { ChoiceChips } from './ChoiceChips'
import { RENT_ENABLED, RENT_PATH, rentPath } from './enabled'
import { equalShares, needsLandlordPan, RENT_PAYMENT_MODES, type RentPaymentMode } from './hra'
import { deleteRent, rentIssue, saveRent, useRent, type Rent, type RentInput, type RentIssue } from './store'
import styles from './Rent.module.css'

const ROUTES = ['/app/rent/new', '/app/rent/:id/edit'] as const

const ISSUE_KEYS: Record<RentIssue, MessageKey> = {
  name: 'rent.editor.issue.name',
  landlord: 'rent.editor.issue.landlord',
  amount: 'rent.editor.issue.amount',
  tenants: 'rent.editor.issue.tenants',
  shares: 'rent.editor.issue.shares',
  upi: 'rent.editor.issue.upi',
  pan: 'rent.editor.issue.pan',
}

const MODE_KEYS: Record<RentPaymentMode, MessageKey> = {
  upi: 'rent.mode.upi',
  bank: 'rent.mode.bank',
  cash: 'rent.mode.cash',
  cheque: 'rent.mode.cheque',
}

/** `/app/rent/new` and `/app/rent/:id/edit` — the flat, who pays how much, the landlord. */
export function RentEditorScreen() {
  if (!RENT_ENABLED) return <Redirect to="/app" />
  return <EditorRoute />
}

function EditorRoute() {
  const t = useT()
  const { params } = useRoute(ROUTES)
  const id = params.id ?? null
  const rent = useRent(id)
  if (id !== null && !rent) {
    return (
      <Screen header={<TopBar onBack={() => goBack(RENT_PATH)} />}>
        <PageTitle title={t('rent.editor.gone')} />
        <Button onClick={() => navigate(RENT_PATH, { replace: true })}>{t('rent.editor.gone.action')}</Button>
      </Screen>
    )
  }
  return <Editor key={id ?? 'new'} rent={rent} />
}

interface Form {
  name: string
  address: string
  amount: string
  tenantIds: string[]
  /** Typed shares, by friend id (used once `sharesEdited`). */
  shareTexts: Record<string, string>
  sharesEdited: boolean
  legalNames: Record<string, string>
  landlordName: string
  landlordUpi: string
  landlordPan: string
  dueDay: number
  mode: RentPaymentMode
}

function initialForm(rent: Rent | null): Form {
  if (!rent) {
    return { name: '', address: '', amount: '', tenantIds: [ME_ID], shareTexts: {}, sharesEdited: false, legalNames: {}, landlordName: '', landlordUpi: '', landlordPan: '', dueDay: 5, mode: 'upi' }
  }
  const equal = equalShares(rent.monthly, rent.tenants.length)
  return {
    name: rent.name,
    address: rent.address,
    amount: toInputString(rent.monthly, 'INR', { trimZeros: true }),
    tenantIds: rent.tenants.map((t) => t.friendId),
    shareTexts: Object.fromEntries(rent.tenants.map((t) => [t.friendId, toInputString(t.share, 'INR', { trimZeros: true })])),
    sharesEdited: rent.tenants.some((tenant, i) => tenant.share !== equal[i]),
    legalNames: Object.fromEntries(rent.tenants.flatMap((t) => (t.legalName ? [[t.friendId, t.legalName]] : []))),
    landlordName: rent.landlordName,
    landlordUpi: rent.landlordUpi ?? '',
    landlordPan: rent.landlordPan ?? '',
    dueDay: rent.dueDay,
    mode: rent.mode,
  }
}

function Editor({ rent }: { rent: Rent | null }) {
  const t = useT()
  const toast = useToast()
  const friendsById = useFriendsById()
  const [form, setForm] = useState<Form>(() => initialForm(rent))
  const [tried, setTried] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const update = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }))

  const monthly = parseMoneyInput(form.amount, 'INR') ?? 0
  const equal = equalShares(monthly, form.tenantIds.length)
  const shares = form.sharesEdited ? form.tenantIds.map((id) => parseMoneyInput(form.shareTexts[id] ?? '', 'INR') ?? 0) : equal
  const assigned = shares.reduce((sum, s) => sum + s, 0)
  const nameOf = (id: string) => friendLabel(id, friendsById[id] ?? null)

  const input: RentInput = {
    name: form.name,
    address: form.address,
    landlordName: form.landlordName,
    landlordUpi: form.landlordUpi.trim() || null,
    landlordPan: form.landlordPan.trim() || null,
    monthly,
    dueDay: form.dueDay,
    mode: form.mode,
    tenants: form.tenantIds.map((friendId, i) => {
      const legalName = form.legalNames[friendId]
      return legalName ? { friendId, share: shares[i] ?? 0, legalName } : { friendId, share: shares[i] ?? 0 }
    }),
  }
  const issue = rentIssue(input)
  const shown = tried ? issue : null
  const panFor = form.tenantIds.find((_, i) => needsLandlordPan(shares[i] ?? 0))

  const setShare = (id: string, text: string) => {
    const base = form.sharesEdited ? form.shareTexts : Object.fromEntries(form.tenantIds.map((x, i) => [x, toInputString(equal[i] ?? 0, 'INR', { trimZeros: true })]))
    update({ sharesEdited: true, shareTexts: { ...base, [id]: text } })
  }

  const save = () => {
    setTried(true)
    if (issue) {
      haptic('error')
      // Straight to the field that needs fixing (it may be scrolled away), once it shows its error.
      window.setTimeout(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0)
      return
    }
    const saved = saveRent(input, rent?.id)
    haptic('success')
    toast(t('rent.editor.saved'), { tone: 'success' })
    navigate(rentPath(saved.id), { replace: true })
  }

  return (
    <Screen
      header={<TopBar onBack={() => goBack(rent ? rentPath(rent.id) : RENT_PATH)} />}
      footer={
        <ActionBar>
          {shown === 'shares' && <p className={`${styles.shareStatus} ${styles.shareStatusBad}`}>{t(ISSUE_KEYS.shares)}</p>}
          <Button block onClick={save}>
            {t('rent.editor.save')}
          </Button>
        </ActionBar>
      }
      contentClassName={styles.content}
    >
      <PageTitle title={rent ? t('rent.editor.edit.title') : t('rent.editor.new.title')} subtitle={t('rent.list.subtitle')} />

      <section className={styles.fields}>
        <TextField
          label={t('rent.editor.name.label')}
          placeholder={t('rent.editor.name.placeholder')}
          value={form.name}
          maxLength={120}
          error={shown === 'name' ? t(ISSUE_KEYS.name) : undefined}
          onChange={(e) => update({ name: e.target.value })}
        />
        <TextField
          label={t('rent.editor.address.label')}
          placeholder={t('rent.editor.address.placeholder')}
          hint={t('rent.editor.address.hint')}
          value={form.address}
          maxLength={300}
          onChange={(e) => update({ address: e.target.value })}
        />
        <AmountInput
          size="field"
          currency="INR"
          label={t('rent.editor.amount.label')}
          value={form.amount}
          error={shown === 'amount' ? t(ISSUE_KEYS.amount) : undefined}
          onChange={(text) => update({ amount: text })}
        />
      </section>

      <section className={styles.section} aria-labelledby="rent-people">
        <h2 id="rent-people" className={styles.sectionTitle}>
          {t('rent.editor.people.title')}
        </h2>
        <PeoplePicker selectedIds={form.tenantIds} onChange={(ids) => update({ tenantIds: ids.slice(0, 12) })} label={t('rent.editor.people.label')} max={12} />
        {shown === 'tenants' && <p className={`${styles.shareStatus} ${styles.shareStatusBad}`}>{t(ISSUE_KEYS.tenants)}</p>}
      </section>

      {form.tenantIds.length > 0 && monthly > 0 && (
        <section className={styles.section} aria-labelledby="rent-shares">
          <div className={styles.row}>
            <h2 id="rent-shares" className={styles.sectionTitle}>
              {t('rent.editor.shares.title')}
            </h2>
            {form.sharesEdited && (
              <Button size="sm" variant="ghost" onClick={() => update({ sharesEdited: false })}>
                {t('rent.editor.shares.equal')}
              </Button>
            )}
          </div>
          {form.tenantIds.map((id, i) => (
            <div key={id} className={styles.shareRow}>
              <FriendAvatar friendId={id} size="md" />
              <AmountInput
                size="field"
                currency="INR"
                label={id === ME_ID ? t('rent.editor.share.label.you') : t('rent.editor.share.label', { name: nameOf(id) })}
                value={form.sharesEdited ? (form.shareTexts[id] ?? '') : toInputString(equal[i] ?? 0, 'INR', { trimZeros: true })}
                onChange={(text) => setShare(id, text)}
              />
            </div>
          ))}
          <p className={assigned === monthly ? styles.shareStatus : `${styles.shareStatus} ${styles.shareStatusBad}`} role="status">
            {assigned === monthly
              ? t('rent.editor.shares.done')
              : assigned < monthly
                ? t('rent.editor.shares.left', { amount: formatMoney(monthly - assigned, 'INR', { trimZeros: true }) })
                : t('rent.editor.shares.over', { amount: formatMoney(assigned - monthly, 'INR', { trimZeros: true }) })}
          </p>
        </section>
      )}

      <section className={styles.section} aria-labelledby="rent-landlord">
        <h2 id="rent-landlord" className={styles.sectionTitle}>
          {t('rent.editor.landlord.title')}
        </h2>
        <div className={styles.fields}>
          <TextField
            label={t('rent.editor.landlord.name.label')}
            value={form.landlordName}
            maxLength={120}
            autoComplete="off"
            error={shown === 'landlord' ? t(ISSUE_KEYS.landlord) : undefined}
            onChange={(e) => update({ landlordName: e.target.value })}
          />
          <TextField
            label={t('rent.editor.landlord.upi.label')}
            placeholder="name@bank"
            hint={t('rent.editor.landlord.upi.hint')}
            value={form.landlordUpi}
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            error={shown === 'upi' ? t(ISSUE_KEYS.upi) : undefined}
            onChange={(e) => update({ landlordUpi: e.target.value })}
          />
          <TextField
            label={t('rent.editor.landlord.pan.label')}
            placeholder="ABCDE1234F"
            hint={
              panFor === undefined
                ? t('rent.editor.landlord.pan.hint')
                : panFor === ME_ID
                  ? t('rent.editor.landlord.pan.needed.you')
                  : t('rent.editor.landlord.pan.needed', { name: nameOf(panFor) })
            }
            value={form.landlordPan}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={12}
            error={shown === 'pan' ? t(ISSUE_KEYS.pan) : undefined}
            onChange={(e) => update({ landlordPan: e.target.value.toUpperCase() })}
          />
        </div>
      </section>

      <section className={styles.fields}>
        <div className={styles.row}>
          <span className={styles.lead}>{t('rent.editor.due.label')}</span>
          <Stepper label={t('rent.editor.due.label')} value={form.dueDay} min={1} max={28} onChange={(dueDay) => update({ dueDay })} />
        </div>
        <ChoiceChips
          label={t('rent.editor.mode.label')}
          value={form.mode}
          onChange={(mode) => update({ mode })}
          options={RENT_PAYMENT_MODES.map((mode) => ({ value: mode, label: t(MODE_KEYS[mode]) }))}
        />
      </section>

      {rent && (
        <Button variant="ghost" iconStart={<Trash2 />} onClick={() => setConfirmDelete(true)}>
          {t('rent.editor.delete')}
        </Button>
      )}
      {rent && (
        <BottomSheet
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title={t('rent.editor.delete.title', { name: rent.name })}
          description={t('rent.editor.delete.text')}
          footer={
            <ActionBar>
              <Button
                block
                variant="danger"
                onClick={() => {
                  deleteRent(rent.id)
                  setConfirmDelete(false)
                  navigate(RENT_PATH, { replace: true })
                }}
              >
                {t('rent.editor.delete.confirm')}
              </Button>
              <Button block variant="secondary" onClick={() => setConfirmDelete(false)}>
                {t('rent.editor.delete.cancel')}
              </Button>
            </ActionBar>
          }
        />
      )}
    </Screen>
  )
}
