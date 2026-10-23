import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown, Image as ImageIcon, ListPlus, Pencil, Plus, ReceiptText } from 'lucide-react'
import { useT } from '../../i18n'
import {
  ActionBar,
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  List,
  ListRow,
  Money,
  PageTitle,
  Screen,
  TopBar,
  useToast,
} from '../../components'
import { currencyName } from '../../lib/currencies'
import { formatBillDate, formatQuantity } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { newId } from '../../lib/ids'
import { currencySymbol, formatMoney } from '../../lib/money'
import { usePhoto } from '../../state/photo'
import { MAX_FEES, MAX_ITEMS } from '../../state/reducer'
import { canContinue, itemsTotal, stepProgress } from '../../state/selectors'
import { useFlow, useSession } from '../../state/store'
import type { BillFee, BillItem } from '../../types'
import { CurrencySheet } from './CurrencySheet'
import { DELIVERY_ENABLED } from './delivery.enabled'
import { FeeEditorSheet, type FeeDraft } from './FeeEditorSheet'
import { FEE_EMOJI, feeAsItem, feeRowLabel, restoreFee } from './feeView'
import { ItemEditorSheet, type ItemDraft } from './ItemEditorSheet'
import { MerchantSheet } from './MerchantSheet'
import { PhotoSheet } from './PhotoSheet'
import { focusScreenHeading, plural } from './screenUtils'
import { CURRENCY_KEYS, ITEM_KEYS, restoreCurrency, restoreItem } from './undoMerge'
import styles from './ReviewScreen.module.css'

interface EditorState {
  /** Bumped on every opening so the form starts fresh. */
  key: number
  /** null = adding a new item. A snapshot, so the sheet can finish closing after a delete. */
  item: BillItem | null
  open: boolean
}

interface FeeEditorState {
  key: number
  /** null = adding a fee. A snapshot, so the sheet can finish closing after a removal. */
  fee: BillFee | null
  open: boolean
}

/** "Qty 4 · ₹75.00 each" (unit price only when it is exact), or nothing for single items. */
function quantityLine(item: BillItem, currency: string): string | undefined {
  if (item.quantity === 1) return undefined
  const qty = `Qty ${formatQuantity(item.quantity)}`
  if (!Number.isInteger(item.quantity) || item.quantity <= 1 || item.amount % item.quantity !== 0) return qty
  return `${qty} · ${formatMoney(item.amount / item.quantity, currency)} each`
}

/** Step 1: check (and fix) what the AI read, or type the bill in. */
export function ReviewScreen() {
  const { session, dispatch } = useSession()
  const flow = useFlow()
  const toast = useToast()
  const photo = usePhoto()
  const { items, currency, meta, warnings } = session

  // "Type it in" lands here with an empty bill: open the editor straight away.
  const [editor, setEditor] = useState<EditorState>(() => ({
    key: 0,
    item: null,
    open: session.source === 'manual' && session.items.length === 0,
  }))
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const [nameSheet, setNameSheet] = useState({ key: 0, open: false })
  const latest = useRef(session)
  useLayoutEffect(() => {
    latest.current = session
  })
  const [photoOpen, setPhotoOpen] = useState(false)
  const [feeEditor, setFeeEditor] = useState<FeeEditorState>({ key: 0, fee: null, open: false })
  const t = useT()
  const baseId = useId()
  const rowId = (itemId: string) => `${baseId}-item-${itemId}`
  const addRowId = `${baseId}-add`
  const feeRowId = (feeId: string) => `${baseId}-fee-${feeId}`
  const addFeeId = `${baseId}-add-fee`
  const fees = DELIVERY_ENABLED ? (meta.fees ?? []) : []
  /** Where focus goes once a deleted item's row (the editor's return target) is gone. */
  const focusAfter = useRef<string | null>(null)
  useEffect(() => {
    const id = focusAfter.current
    if (id === null) return
    focusAfter.current = null
    const target = document.getElementById(id) ?? document.getElementById(addRowId)
    if (target instanceof HTMLButtonElement && !target.disabled) target.focus()
    else focusScreenHeading()
  })

  const total = itemsTotal(session)
  const ready = canContinue(session, 'review')
  const subtotalOff = meta.subtotal !== null && items.length > 0 && Math.abs(meta.subtotal - total) > 1
  // The bill's name is its own control (below); the eyebrow is just the date.
  const eyebrow = formatBillDate(meta.date) ?? undefined
  const symbol = currencySymbol(currency)

  const openEditor = (item: BillItem | null): void => {
    setEditor((e) => ({ key: e.key + 1, item, open: true }))
  }
  const closeEditor = (): void => setEditor((e) => (e.open ? { ...e, open: false } : e))

  const saveItem = (draft: ItemDraft, addAnother: boolean): void => {
    const editing = editor.item
    if (editing) {
      dispatch({ type: 'updateItem', item: { ...editing, ...draft } })
    } else if (items.length >= MAX_ITEMS) {
      toast(`A bill can hold up to ${MAX_ITEMS} items.`, { tone: 'warning' })
      closeEditor()
      return
    } else {
      dispatch({ type: 'addItem', item: { id: newId(), ...draft } })
    }
    if (addAnother) toast(`Added ${draft.name}`, { tone: 'success' })
    else closeEditor()
  }

  const deleteItem = (): void => {
    const item = editor.item
    if (!item) return
    const before = session
    // Its row goes too: focus moves to the next row, else the previous one, else "Add item".
    const index = items.findIndex((i) => i.id === item.id)
    const neighbour = items[index + 1] ?? items[index - 1]
    focusAfter.current = neighbour ? rowId(neighbour.id) : addRowId
    closeEditor()
    dispatch({ type: 'removeItem', itemId: item.id })
    haptic('warning')
    toast(`Removed ${item.name || 'item'}`, {
      action: {
        label: 'Undo',
        onAction: () => {
          // Merge into the latest state, so edits made since the delete survive the undo.
          const restored = restoreItem(latest.current, before, item.id)
          if (restored) dispatch({ type: 'restore', session: restored, keys: ITEM_KEYS })
          else if (latest.current.items.length >= MAX_ITEMS) toast("Couldn't undo — the bill is full", { tone: 'info' })
        },
      },
    })
  }

  const changeCurrency = (code: string): void => {
    setCurrencyOpen(false)
    if (code === currency) return
    const before = latest.current
    dispatch({ type: 'setCurrency', currency: code })
    toast(`Switched to ${code}`, {
      action: {
        label: 'Undo',
        onAction: () => {
          // Exact amounts back (switching to a currency without decimals rounded them), unless
          // something changed since — then just switch back.
          const restored = restoreCurrency(latest.current, before, code)
          if (restored) dispatch({ type: 'restore', session: restored, keys: CURRENCY_KEYS })
          else dispatch({ type: 'setCurrency', currency: before.currency })
        },
      },
    })
  }

  const dismissWarnings = (): void => {
    dispatch({ type: 'dismissWarnings' })
    // The banner (and its ✕) is gone: keep focus on the page instead of the body.
    focusScreenHeading()
  }

  const openFee = (fee: BillFee | null): void => {
    setFeeEditor((e) => ({ key: e.key + 1, fee, open: true }))
  }
  const closeFee = (): void => setFeeEditor((e) => (e.open ? { ...e, open: false } : e))

  const saveFee = (draft: FeeDraft): void => {
    const editing = feeEditor.fee
    if (editing) {
      dispatch({ type: 'updateFee', fee: { ...editing, ...draft } })
    } else if (fees.length >= MAX_FEES) {
      toast(t('delivery.review.fees.full.toast', { max: MAX_FEES }), { tone: 'warning' })
    } else {
      dispatch({ type: 'addFee', fee: { id: newId(), ...draft } })
    }
    closeFee()
  }

  /** Focus after a fee's row is gone: the next fee, else the previous one, else "Add fee". */
  const focusAfterFee = (feeId: string): void => {
    const index = fees.findIndex((f) => f.id === feeId)
    const neighbour = fees[index + 1] ?? fees[index - 1]
    focusAfter.current = neighbour ? feeRowId(neighbour.id) : addFeeId
  }

  const removeFee = (): void => {
    const fee = feeEditor.fee
    if (!fee) return
    const before = session
    focusAfterFee(fee.id)
    closeFee()
    dispatch({ type: 'removeFee', feeId: fee.id })
    haptic('warning')
    toast(t('delivery.review.fees.removed.toast', { label: fee.label }), {
      action: {
        label: t('common.action.undo'),
        onAction: () => {
          const restored = restoreFee(latest.current, before, fee.id, MAX_FEES)
          if (restored) dispatch({ type: 'restore', session: restored, keys: ['meta'] })
          else toast(t('delivery.review.fees.undoFailed.toast'), { tone: 'info' })
        },
      },
    })
  }

  /** "Only one person tipping?": the fee becomes an item that can be given to whoever tips. */
  const feeToItem = (draft: FeeDraft): void => {
    const fee = feeEditor.fee
    if (!fee) return
    const item = feeAsItem(session, { ...fee, ...draft })
    if (!item) {
      toast(`A bill can hold up to ${MAX_ITEMS} items.`, { tone: 'warning' })
      return
    }
    const before = session
    focusAfterFee(fee.id)
    closeFee()
    dispatch({ type: 'removeFee', feeId: fee.id })
    dispatch({ type: 'addItem', item })
    haptic('success')
    toast(t('delivery.review.fees.converted.toast', { label: item.name }), {
      tone: 'success',
      action: {
        label: t('common.action.undo'),
        onAction: () => {
          const restored = restoreFee(latest.current, before, fee.id, MAX_FEES)
          if (!restored) {
            toast(t('delivery.review.fees.undoFailed.toast'), { tone: 'info' })
            return
          }
          const { [item.id]: _gone, ...assignments } = restored.assignments
          const back = { ...restored, items: restored.items.filter((i) => i.id !== item.id), assignments }
          dispatch({ type: 'restore', session: back, keys: ['meta', 'items', 'assignments'] })
        },
      },
    })
  }

  let hint: string | undefined
  if (items.length === 0) hint = 'Add at least one item'
  else if (!ready) hint = 'Every item needs a name'

  return (
    <Screen
      header={
        <TopBar
          onBack={flow.back}
          progress={stepProgress('review') ?? undefined}
          right={
            <button
              type="button"
              className={styles.currency}
              aria-haspopup="dialog"
              aria-label={`Currency ${currency}, ${currencyName(currency)}. Change`}
              onClick={() => setCurrencyOpen(true)}
            >
              {symbol !== currency && <span className={styles.currencySymbol}>{symbol}</span>}
              <span>{currency}</span>
              <ChevronDown aria-hidden="true" className={styles.currencyChevron} strokeWidth={2.5} />
            </button>
          }
        />
      }
      footer={
        <ActionBar hint={hint}>
          <Button block disabled={!ready} onClick={flow.next}>
            Looks good
          </Button>
        </ActionBar>
      }
    >
      <PageTitle
        eyebrow={eyebrow}
        title="Check the items"
        subtitle={
          items.length === 0
            ? "Add what's on the bill, one line at a time."
            : session.source === 'manual'
              ? 'Tap an item to change it, or add more.'
              : 'Tap anything that looks off.'
        }
      />

      <div className={styles.tools}>
        {/* The bill's name is the control: "🧾 Saffron Table ✎" (or "Name this bill"). */}
        <Chip
          leading={<ReceiptText />}
          trailing={<Pencil />}
          aria-haspopup="dialog"
          aria-label={meta.merchant ? `Rename bill, ${meta.merchant}` : 'Name this bill'}
          className={styles.billName}
          onClick={() => setNameSheet((n) => ({ key: n.key + 1, open: true }))}
        >
          {meta.merchant ?? 'Name this bill'}
        </Chip>
        {photo && (
          <Chip leading={<ImageIcon />} onClick={() => setPhotoOpen(true)} aria-haspopup="dialog">
            View photo
          </Chip>
        )}
      </div>

      {warnings.length > 0 && (
        <Banner tone="warning" title="Worth a quick check" onDismiss={dismissWarnings}>
          {warnings.length === 1 ? (
            warnings[0]
          ) : (
            <ul className={styles.warnings}>
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </Banner>
      )}

      {items.length === 0 ? (
        <Card tone="sunken" padding="none">
          <EmptyState
            icon={<ListPlus />}
            title="Add the first item"
            text="Type each item and its price — tax and discounts come next."
            action={
              <Button id={addRowId} size="md" iconStart={<Plus />} onClick={() => openEditor(null)}>
                Add item
              </Button>
            }
          />
        </Card>
      ) : (
        <section className={styles.section} aria-labelledby="review-items-heading">
          <h2 id="review-items-heading" className={styles.sectionTitle}>
            {plural(items.length, 'item')}
          </h2>
          <Card padding="none">
            <List>
              {items.map((item) => {
                const free = item.amount === 0
                const name = item.name || 'Unnamed item'
                const qty = item.quantity === 1 ? '' : `, quantity ${formatQuantity(item.quantity)}`
                return (
                  <ListRow
                    key={item.id}
                    id={rowId(item.id)}
                    title={name}
                    subtitle={quantityLine(item, currency)}
                    trailing={
                      free ? (
                        <span className={styles.free}>Free</span>
                      ) : (
                        <Money value={item.amount} currency={currency} />
                      )
                    }
                    pending={item.name.trim() === ''}
                    aria-label={`Edit ${name}${qty}, ${free ? 'free' : formatMoney(item.amount, currency)}`}
                    onClick={() => openEditor(item)}
                  />
                )
              })}
              <ListRow
                id={addRowId}
                leading={
                  <span className={styles.addIcon} aria-hidden="true">
                    <Plus strokeWidth={2.5} />
                  </span>
                }
                title="Add item"
                onClick={() => openEditor(null)}
                disabled={items.length >= MAX_ITEMS}
              />
            </List>
          </Card>

          <div className={styles.summary}>
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Items total</span>
              <Money value={total} currency={currency} size="lg" strong />
            </div>
            {subtotalOff && meta.subtotal !== null && (
              <p className={styles.subtotalNote}>
                Bill subtotal says <Money value={meta.subtotal} currency={currency} size="inherit" />
              </p>
            )}
          </div>
        </section>
      )}

      {DELIVERY_ENABLED && items.length > 0 && (
        <FeesSection fees={fees} currency={currency} rowId={feeRowId} addId={addFeeId} onOpen={openFee} full={fees.length >= MAX_FEES} />
      )}

      <ItemEditorSheet
        key={`editor-${editor.key}`}
        open={editor.open}
        item={editor.item}
        currency={currency}
        onClose={closeEditor}
        onSave={saveItem}
        onDelete={editor.item ? deleteItem : undefined}
      />

      <CurrencySheet
        open={currencyOpen}
        currency={currency}
        onClose={() => setCurrencyOpen(false)}
        onSelect={changeCurrency}
      />

      <MerchantSheet
        key={`name-${nameSheet.key}`}
        open={nameSheet.open}
        merchant={meta.merchant}
        onClose={() => setNameSheet((n) => ({ ...n, open: false }))}
        onSave={(name) => {
          dispatch({ type: 'setMerchant', merchant: name })
          setNameSheet((n) => ({ ...n, open: false }))
        }}
      />

      <PhotoSheet open={photoOpen && photo !== null} url={photo?.previewUrl ?? null} onClose={() => setPhotoOpen(false)} />

      {DELIVERY_ENABLED && (
        <FeeEditorSheet
          key={`fee-${feeEditor.key}`}
          open={feeEditor.open}
          fee={feeEditor.fee}
          currency={currency}
          onClose={closeFee}
          onSave={saveFee}
          onRemove={feeEditor.fee ? removeFee : undefined}
          onMakeItem={feeEditor.fee ? feeToItem : undefined}
        />
      )}
    </Screen>
  )
}

interface FeesSectionProps {
  fees: readonly BillFee[]
  currency: string
  rowId: (feeId: string) => string
  addId: string
  onOpen: (fee: BillFee | null) => void
  full: boolean
}

/**
 * "Fees & charges": a delivery order's fees, each its own row (tap to edit), and "Add fee". With no
 * fees yet it's just the "Add fee" button, for an order whose fees weren't read.
 */
function FeesSection({ fees, currency, rowId, addId, onOpen, full }: FeesSectionProps) {
  const t = useT()
  const headingId = useId()
  const hintId = useId()
  if (fees.length === 0) {
    return (
      <div className={styles.feeAddOnly}>
        <Button id={addId} size="sm" variant="ghost" iconStart={<Plus />} onClick={() => onOpen(null)}>
          {t('delivery.review.fees.add.cta')}
        </Button>
      </div>
    )
  }
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.feeHead}>
        <h2 id={headingId} className={styles.sectionTitle}>
          {t('delivery.review.fees.title')}
        </h2>
        <button id={addId} type="button" className={styles.feeAdd} disabled={full} onClick={() => onOpen(null)}>
          <Plus aria-hidden="true" strokeWidth={2.5} />
          {t('delivery.review.fees.add.cta')}
        </button>
      </div>
      <Card padding="none">
        <List aria-describedby={hintId}>
          {fees.map((fee) => (
            <ListRow
              key={fee.id}
              id={rowId(fee.id)}
              leading={
                <span className={styles.feeEmoji} aria-hidden="true">
                  {FEE_EMOJI[fee.kind]}
                </span>
              }
              title={fee.label}
              trailing={<Money value={fee.amount} currency={currency} />}
              chevron
              aria-label={feeRowLabel(fee, currency)}
              onClick={() => onOpen(fee)}
            />
          ))}
        </List>
      </Card>
      <p id={hintId} className={styles.feeHint}>
        {t('delivery.review.fees.hint')}
      </p>
    </section>
  )
}
