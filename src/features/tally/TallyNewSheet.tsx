import { useState } from 'react'
import { AmountInput, BottomSheet, Button, Chip, SegmentedControl, Stepper, TextField } from '../../components'
import { useGroups, useProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { DateField, PeoplePicker } from '../../kit/index-a'
import { commaIsDecimal, parseMoneyInput, toInputString } from '../../lib/money'
import { Q, stepOf, TALLY_UNITS, type Tally, type TallySplit, type TallyUnit } from './engine'
import { money, PRESETS, qtyLabel, type PresetId } from './labels'
import { addTally, MAX_TALLY_NAME } from './store'
import styles from './Tally.module.css'

export interface TallyNewSheetProps {
  open: boolean
  onClose: () => void
  /** Called with the tally just started. */
  onStarted: (tally: Tally) => void
}

type What = PresetId | 'other'
/** 'me', a group's id, or 'pick' (the people picker). */
type Who = string

const MAX_GROUP_CHIPS = 5

/**
 * Starting a tally: tap what comes (the rate, unit and usual arrive with it and can be changed),
 * who shares it, then Start. Everything else has a default.
 */
export function TallyNewSheet({ open, onClose, onStarted }: TallyNewSheetProps) {
  const t = useT()
  const profile = useProfile()
  const groups = useGroups({ archived: false })
  const homes = [...groups].sort((a, b) => Number(b.kind === 'home') - Number(a.kind === 'home')).slice(0, MAX_GROUP_CHIPS)
  const firstHome = homes.find((g) => g.kind === 'home') ?? null

  const [what, setWhat] = useState<What>('doodh')
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<TallyUnit>('litre')
  const [rate, setRate] = useState(() => toInputString(PRESETS[0].rate, profile.currency))
  const [usual, setUsual] = useState<number>(PRESETS[0].usual)
  const [split, setSplit] = useState<TallySplit>('equal')
  const [who, setWho] = useState<Who>(firstHome ? firstHome.id : 'me')
  const [picked, setPicked] = useState<string[]>([ME_ID])
  const [start, setStart] = useState(() => todayIso())
  const [error, setError] = useState<string | null>(null)

  const group = groups.find((g) => g.id === who) ?? null
  const currency = group?.currency ?? profile.currency
  const memberIds = who === 'me' ? [ME_ID] : group ? group.memberIds : picked
  const shared = memberIds.length > 1

  const choose = (next: What) => {
    setWhat(next)
    setError(null)
    const preset = PRESETS.find((p) => p.id === next)
    if (!preset) return
    setUnit(preset.unit)
    setRate(toInputString(preset.rate, currency))
    setUsual(preset.usual)
    setSplit(preset.split)
  }

  const submit = () => {
    const title = what === 'other' ? name : t(`tally.preset.${what}`)
    const paise = parseMoneyInput(rate, currency)
    if (!title.trim()) return setError(t('tally.new.error.name'))
    if (paise === null || paise <= 0) return setError(t('tally.new.error.rate'))
    if (memberIds.length === 0) return setError(t('tally.new.error.people'))
    const tally = addTally({
      name: title,
      unit,
      rate: paise,
      usual,
      split: shared ? split : 'equal',
      memberIds,
      groupId: group?.id ?? null,
      start,
      currency,
    })
    if (!tally) return setError(t('tally.new.error.full'))
    onStarted(tally)
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('tally.new.title')}
      size="tall"
      footer={
        <Button block onClick={submit}>
          {t('tally.new.start')}
        </Button>
      }
    >
      <div className={styles.sheet}>
        <div className={styles.block}>
          <h3 id="tally-new-what" className={styles.heading}>
            {t('tally.new.what')}
          </h3>
          <div className={styles.chips} role="radiogroup" aria-labelledby="tally-new-what">
            {PRESETS.map((p) => (
              <Chip
                key={p.id}
                size="lg"
                role="radio"
                selected={what === p.id}
                onClick={() => choose(p.id)}
                aria-label={t('tally.preset.aria', {
                  name: t(`tally.preset.${p.id}`),
                  rate: t('tally.rate', { amount: money(p.rate, currency), per: t(`tally.per.${p.unit}`) }),
                })}
              >
                {t(`tally.preset.${p.id}`)}
              </Chip>
            ))}
            <Chip size="lg" role="radio" selected={what === 'other'} onClick={() => choose('other')}>
              {t('tally.preset.other')}
            </Chip>
          </div>
        </div>

        {what === 'other' && (
          <>
            <TextField
              label={t('tally.new.name')}
              placeholder={t('tally.new.name.placeholder')}
              value={name}
              maxLength={MAX_TALLY_NAME}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              autoComplete="off"
            />
            <div className={styles.block}>
              <h3 id="tally-new-unit" className={styles.heading}>
                {t('tally.new.unit')}
              </h3>
              <div className={styles.chips} role="radiogroup" aria-labelledby="tally-new-unit">
                {TALLY_UNITS.map((u) => (
                  <Chip key={u} size="lg" role="radio" selected={unit === u} onClick={() => setUnit(u)}>
                    {t(`tally.unitpick.${u}`)}
                  </Chip>
                ))}
              </div>
            </div>
          </>
        )}

        <AmountInput
          size="field"
          label={t('tally.new.rate', { per: t(`tally.per.${unit}`) })}
          value={rate}
          onChange={(text) => {
            setRate(text)
            setError(null)
          }}
          currency={currency}
          commaGroups={!commaIsDecimal(currency)}
        />

        <div className={styles.fieldRow}>
          <span className={styles.body}>{t(shared && split === 'own' ? 'tally.new.usual.own' : 'tally.new.usual')}</span>
          <Stepper
            label={t('tally.new.usual')}
            size="md"
            value={usual}
            min={0}
            max={20 * Q}
            step={stepOf(unit)}
            onChange={setUsual}
            formatValue={(n) => qtyLabel(unit, n)}
          />
        </div>

        <div className={styles.block}>
          <h3 id="tally-new-who" className={styles.heading}>
            {t('tally.new.who')}
          </h3>
          <div className={styles.chips} role="radiogroup" aria-labelledby="tally-new-who">
            <Chip size="lg" role="radio" selected={who === 'me'} onClick={() => setWho('me')}>
              {t('tally.new.who.me')}
            </Chip>
            {homes.map((g) => (
              <Chip key={g.id} size="lg" role="radio" selected={who === g.id} onClick={() => setWho(g.id)}>
                {`${g.emoji} ${g.name}`}
              </Chip>
            ))}
            <Chip size="lg" role="radio" selected={who === 'pick'} onClick={() => setWho('pick')}>
              {t('tally.new.who.pick')}
            </Chip>
          </div>
          {who === 'pick' && (
            <PeoplePicker
              selectedIds={picked}
              onChange={(ids) => {
                setPicked(ids)
                setError(null)
              }}
              max={30}
              label={t('tally.new.who.search')}
            />
          )}
        </div>

        {shared && (
          <div className={styles.block}>
            <SegmentedControl
              ariaLabel={t('tally.new.split')}
              value={split}
              onChange={setSplit}
              options={[
                { value: 'equal', label: t('tally.new.split.equal') },
                { value: 'own', label: t('tally.new.split.own') },
              ]}
            />
            <p className={styles.fine}>{t(split === 'own' ? 'tally.new.split.own.hint' : 'tally.new.split.equal.hint')}</p>
          </div>
        )}

        <div className={styles.fieldRow}>
          <span className={styles.body}>{t('tally.new.from')}</span>
          <DateField label={t('tally.new.from')} value={start} onChange={setStart} />
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </BottomSheet>
  )
}
