import { useState } from 'react'
import { Check, ChevronRight, Zap } from 'lucide-react'
import { goBack, navigate, useLocation } from '../../app/router'
import { ActionBar, AmountInput, BottomSheet, Button, Card, Money, PageTitle, Screen, Stepper, Switch, TextField, TopBar, useToast } from '../../components'
import { saveExpense, useFriendsById } from '../../data'
import { ME_ID } from '../../domain/types'
import { periodOf, today } from '../../engine/dates'
import { useT, type MessageKey } from '../../i18n'
import { FriendAvatar, friendLabel, PeoplePicker } from '../../kit/index-a'
import { formatPercent } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { formatMoney, parseMoneyInput } from '../../lib/money'
import { expensePath } from '../home/homeLinks'
import { monthName } from '../recurring/recurringLabels'
import { ChoiceChips } from '../rent/ChoiceChips'
import { useRent } from '../rent/store'
import { fairSplit, type AcKind, type AcSize, type FairPersonInput, type LostRule, type SplitBasis } from './fairSplit'
import { PERIOD_DAYS, TARIFFS, tariffById, type LostKind, type TariffId } from './tariffs'
import styles from './Bijli.module.css'

/** Tariffs whose fixed charge depends on the sanctioned load. */
const USES_LOAD: ReadonlySet<TariffId> = new Set(['bescom', 'delhi', 'tgspdcl', 'cesc', 'ugvcl', 'uppcl'])
const AC_SIZES: readonly AcSize[] = ['none', '1', '1.5', '2']
const AC_SIZE_KEYS: Record<AcSize, MessageKey> = { none: 'bijli.ac.none', '1': 'bijli.ac.1', '1.5': 'bijli.ac.1.5', '2': 'bijli.ac.2' }
const AC_KINDS: readonly AcKind[] = ['inverter', 'efficient', 'old']
const LOST_KEYS: Record<LostKind, { part: MessageKey; rule: MessageKey }> = {
  subsidy: { part: 'bijli.result.lost.subsidy', rule: 'bijli.lostRule.label.subsidy' },
  freeUnits: { part: 'bijli.result.lost.freeUnits', rule: 'bijli.lostRule.label.freeUnits' },
  cheaperRate: { part: 'bijli.result.lost.cheaperRate', rule: 'bijli.lostRule.label.cheaperRate' },
}

interface PersonForm {
  days: number
  acNights: number
  acSize: AcSize
  roomUnits: string
}

/** A whole number of units from what was typed (Indian digits and commas tolerated); 0 when empty. */
function parseUnits(text: string): number {
  const n = Number(text.replace(/[,\s]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 99_999) : 0
}

/**
 * `/app/bijli` — "Fair bijli": a flat's electricity bill split by what each person used. Slabs,
 * subsidy cliffs and AC nights are priced at what they actually added to the bill (serial cost
 * sharing, see `fairSplit`), everyday use is shared by days home, and the shares are matched to
 * the amount on the bill — then saved as an ordinary split with pay links.
 */
export function BijliScreen() {
  const t = useT()
  const toast = useToast()
  const friendsById = useFriendsById()
  // From a rented flat's page: its flatmates are already in.
  const { search } = useLocation()
  const rent = useRent(new URLSearchParams(search).get('rent'))
  const [tariffId, setTariffId] = useState<TariffId>('delhi')
  const [companyOpen, setCompanyOpen] = useState(false)
  const tariff = tariffById(tariffId)
  const periodDays = PERIOD_DAYS[tariff.period]
  const [unitsText, setUnitsText] = useState('')
  const [amountText, setAmountText] = useState('')
  const [days, setDays] = useState<number>(periodDays)
  const [kw, setKw] = useState(3)
  const [delhiSubsidy, setDelhiSubsidy] = useState(true)
  const [gruhaText, setGruhaText] = useState('')
  const [peopleIds, setPeopleIds] = useState<string[]>(() => (rent && rent.tenants.length > 0 ? rent.tenants.map((tenant) => tenant.friendId) : [ME_ID]))
  const [perPerson, setPerPerson] = useState<Record<string, PersonForm>>({})
  const [basis, setBasis] = useState<SplitBasis>('ac')
  const [acKind, setAcKind] = useState<AcKind>('inverter')
  const [baselineText, setBaselineText] = useState('')
  const [lostRule, setLostRule] = useState<LostRule>('crosser')
  const [payerId, setPayerId] = useState<string>(ME_ID)
  const [tried, setTried] = useState(false)

  const units = parseUnits(unitsText)
  const amount = parseMoneyInput(amountText, 'INR') ?? 0
  const nameOf = (id: string) => friendLabel(id, friendsById[id] ?? null)
  const formFor = (id: string): PersonForm => perPerson[id] ?? { days, acNights: 0, acSize: '1.5', roomUnits: '' }
  const setPerson = (id: string, patch: Partial<PersonForm>) => setPerPerson((all) => ({ ...all, [id]: { ...formFor(id), ...patch } }))

  const people: FairPersonInput[] = peopleIds.map((id) => {
    const form = formFor(id)
    return { id, days: Math.min(form.days, days), acNights: form.acNights, acSize: form.acSize, roomUnits: parseUnits(form.roomUnits) }
  })
  const ready = units > 0 && amount > 0 && peopleIds.length >= 2
  // Cheap (a dozen tariff look-ups a person): worked out on every render.
  const result = ready
    ? fairSplit({
        tariff,
        ctx: { days, kw, delhiSubsidy, gruhaJyothi: parseUnits(gruhaText) },
        units,
        amount,
        basis,
        baseline: baselineText.trim() === '' ? null : parseUnits(baselineText),
        acKind,
        lostRule,
        people,
      })
    : null
  const payer = peopleIds.includes(payerId) ? payerId : (peopleIds[0] ?? ME_ID)
  const money = (minor: number) => formatMoney(minor, 'INR', { trimZeros: true })
  const companyName = tariff.id === 'flat' ? t('bijli.company.other') : tariff.company

  const pickTariff = (id: TariffId) => {
    const next = tariffById(id)
    setTariffId(id)
    setCompanyOpen(false)
    // A two-monthly bill covers twice the days; keep the flatmates' days in step.
    if (next.period !== tariff.period) {
      const nextDays = PERIOD_DAYS[next.period]
      setDays(nextDays)
      setPerPerson((all) => Object.fromEntries(Object.entries(all).map(([key, form]) => [key, { ...form, days: Math.min(nextDays, Math.round((form.days / days) * nextDays)) }])))
    }
  }

  const save = () => {
    setTried(true)
    if (!result) {
      haptic('error')
      return
    }
    const parts = result.people.map((p) => `${nameOf(p.id)}: ${money(p.share)}`).join(' · ')
    const basisLabel = t(basis === 'ac' ? 'bijli.basis.ac' : basis === 'meter' ? 'bijli.basis.meter' : 'bijli.basis.equal')
    const saved = saveExpense({
      kind: 'split',
      title: t('bijli.expense.title', { month: monthName(periodOf(today()), today()) }),
      category: 'utilities',
      currency: 'INR',
      total: amount,
      date: today(),
      payerId: payer,
      mode: 'exact',
      participants: result.people.map((p) => ({ friendId: p.id, input: p.share })),
      roundedToWhole: false,
      note: `${t('bijli.expense.note', { company: companyName, units, basis: basisLabel })}\n${parts}`,
      groupId: null,
      bill: null,
      recurringId: null,
      source: 'manual',
    })
    haptic('success')
    toast(t('bijli.saved'), { tone: 'success' })
    navigate(expensePath(saved.id), { replace: true })
  }

  const lost = tariff.lost ? LOST_KEYS[tariff.lost] : null
  const ac = result?.acExplains ?? null
  return (
    <Screen
      header={<TopBar onBack={() => goBack('/app')} />}
      footer={
        <ActionBar hint={tried && !ready ? t(peopleIds.length < 2 ? 'bijli.need.people' : 'bijli.need.bill') : undefined}>
          <Button block onClick={save} disabled={tried && !ready}>
            {t('bijli.save')}
          </Button>
        </ActionBar>
      }
      contentClassName={styles.content}
    >
      <PageTitle title={t('bijli.title')} subtitle={t('bijli.subtitle')} />

      <section className={styles.section} aria-labelledby="bijli-bill">
        <h2 id="bijli-bill" className={styles.sectionTitle}>
          {t('bijli.bill.title')}
        </h2>
        <button type="button" className={styles.company} onClick={() => setCompanyOpen(true)} aria-haspopup="dialog">
          <span className={styles.companyIcon} aria-hidden="true">
            <Zap />
          </span>
          <span className={styles.companyText}>
            <span className={styles.companyLabel}>{t('bijli.company.label')}</span>
            <span className={styles.companyName}>{companyName}</span>
            <span className={styles.companyCity}>{tariff.id === 'flat' ? t('bijli.company.other.city') : tariff.city}</span>
          </span>
          <ChevronRight aria-hidden="true" className={styles.chevron} />
        </button>
        <div className={styles.fields}>
          <TextField
            label={t('bijli.units.label')}
            hint={t('bijli.units.hint')}
            inputMode="numeric"
            value={unitsText}
            onChange={(e) => setUnitsText(e.target.value.replace(/[^\d,]/g, ''))}
            error={tried && units === 0 ? t('bijli.need.bill') : undefined}
          />
          <AmountInput size="field" currency="INR" label={t('bijli.amount.label')} value={amountText} onChange={setAmountText} />
          <div className={styles.row}>
            <span className={styles.lead}>{t('bijli.days.label')}</span>
            <Stepper label={t('bijli.days.label')} value={days} min={1} max={92} onChange={setDays} />
          </div>
          {USES_LOAD.has(tariff.id) && (
            <div className={styles.row}>
              <span className={styles.lead}>{t('bijli.kw.label')}</span>
              <Stepper label={t('bijli.kw.label')} value={kw} min={1} max={25} onChange={setKw} />
            </div>
          )}
          {tariff.id === 'delhi' && (
            <Switch checked={delhiSubsidy} onChange={setDelhiSubsidy} label={t('bijli.delhiSubsidy.label')} description={t('bijli.delhiSubsidy.description')} />
          )}
          {tariff.id === 'bescom' && (
            <TextField label={t('bijli.gruha.label')} hint={t('bijli.gruha.hint')} inputMode="numeric" placeholder="0" value={gruhaText} onChange={(e) => setGruhaText(e.target.value.replace(/\D/g, ''))} />
          )}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="bijli-people">
        <h2 id="bijli-people" className={styles.sectionTitle}>
          {t('bijli.people.title')}
        </h2>
        <PeoplePicker selectedIds={peopleIds} onChange={(ids) => setPeopleIds(ids.slice(0, 12))} label={t('bijli.people.label')} max={12} />
      </section>

      {peopleIds.length > 0 && (
        <section className={styles.section} aria-labelledby="bijli-how">
          <h2 id="bijli-how" className={styles.sectionTitle}>
            {t('bijli.basis.label')}
          </h2>
          <ChoiceChips
            label={t('bijli.basis.label')}
            hideLabel
            value={basis}
            onChange={setBasis}
            options={[
              { value: 'ac', label: t('bijli.basis.ac') },
              { value: 'meter', label: t('bijli.basis.meter') },
              { value: 'equal', label: t('bijli.basis.equal') },
            ]}
          />
          {peopleIds.map((id) => {
            const form = formFor(id)
            const name = nameOf(id)
            const me = id === ME_ID
            return (
              <div key={id} className={styles.person}>
                <div className={styles.personHead}>
                  <FriendAvatar friendId={id} size="md" />
                  <span className={styles.personName}>{name}</span>
                </div>
                <div className={styles.row}>
                  <span className={styles.lead}>{t('bijli.person.days')}</span>
                  <Stepper label={me ? t('bijli.person.days.label.you') : t('bijli.person.days.label', { name })} value={Math.min(form.days, days)} min={0} max={days} onChange={(value) => setPerson(id, { days: value })} />
                </div>
                {basis === 'ac' && (
                  <>
                    <div className={styles.row}>
                      <span className={styles.lead}>{t('bijli.person.nights')}</span>
                      <Stepper label={me ? t('bijli.person.nights.label.you') : t('bijli.person.nights.label', { name })} value={form.acNights} min={0} max={days} onChange={(value) => setPerson(id, { acNights: value })} />
                    </div>
                    {form.acNights > 0 && (
                      <ChoiceChips
                        label={me ? t('bijli.person.ac.label.you') : t('bijli.person.ac.label', { name })}
                        value={form.acSize}
                        onChange={(acSize) => setPerson(id, { acSize })}
                        options={AC_SIZES.filter((size) => size !== 'none').map((size) => ({ value: size, label: t(AC_SIZE_KEYS[size]) }))}
                      />
                    )}
                  </>
                )}
                {basis === 'meter' && (
                  <TextField label={me ? t('bijli.person.room.label.you') : t('bijli.person.room.label', { name })} inputMode="numeric" value={form.roomUnits} onChange={(e) => setPerson(id, { roomUnits: e.target.value.replace(/\D/g, '') })} />
                )}
              </div>
            )
          })}
          {basis === 'ac' && (
            <>
              <ChoiceChips label={t('bijli.acKind.label')} value={acKind} onChange={setAcKind} options={AC_KINDS.map((kind) => ({ value: kind, label: t(`bijli.acKind.${kind}`) }))} />
              <TextField
                label={t('bijli.baseline.label')}
                hint={t('bijli.baseline.hint', { units: result?.baseline ?? 0 })}
                inputMode="numeric"
                placeholder={result ? String(result.baseline) : undefined}
                value={baselineText}
                onChange={(e) => setBaselineText(e.target.value.replace(/\D/g, ''))}
              />
            </>
          )}
        </section>
      )}

      {result && (
        <section className={styles.section} aria-labelledby="bijli-result">
          <h2 id="bijli-result" className={styles.sectionTitle}>
            {t('bijli.result.title')}
          </h2>
          <Card padding="none">
            <ul className={styles.results}>
              {result.people.map((p) => {
                const parts = [t('bijli.result.everyday', { amount: money(p.everyday) })]
                if (p.extra > 0) parts.push(t(basis === 'meter' ? 'bijli.result.extra.meter' : 'bijli.result.extra.ac', { amount: money(p.extra) }))
                if (p.lost > 0 && lost) parts.push(t(lost.part, { amount: money(p.lost) }))
                const diff = p.share - p.equal
                const home = Math.min(formFor(p.id).days, days)
                return (
                  <li key={p.id} className={styles.result}>
                    <FriendAvatar friendId={p.id} size="md" />
                    <div className={styles.resultText}>
                      <span className={styles.resultName}>{nameOf(p.id)}</span>
                      <span className={styles.resultParts}>{parts.join(' · ')}</span>
                      {home < days && <span className={styles.resultParts}>{t('bijli.result.away', { days: home, total: days })}</span>}
                      <span className={diff < 0 ? styles.less : diff > 0 ? styles.more : styles.same}>
                        {diff < 0 ? t('bijli.result.less', { amount: money(-diff) }) : diff > 0 ? t('bijli.result.more', { amount: money(diff) }) : t('bijli.result.same')}
                      </span>
                    </div>
                    <Money value={p.share} currency="INR" strong trimZeros />
                  </li>
                )
              })}
            </ul>
            <p className={styles.matched}>
              <Check aria-hidden="true" />
              <span>{t('bijli.matched', { amount: money(amount) })}</span>
            </p>
          </Card>

          <div className={styles.notes}>
            {result.flat && <p>{tariff.id === 'flat' ? t('bijli.note.flatOther') : t('bijli.note.flat', { company: tariff.company })}</p>}
            {result.withoutExtra !== null && !result.flat && <p>{t('bijli.note.without', { amount: money(result.withoutExtra) })}</p>}
            {basis === 'ac' && ac === 0 && <p>{t('bijli.note.noAc')}</p>}
            {basis === 'ac' && ac !== null && ac > 0 && ac < 0.5 && <p>{t('bijli.note.acLow', { percent: formatPercent(ac, { maxFractionDigits: 0 }), units: Math.round(result.extraUnits) })}</p>}
            {basis === 'ac' && ac !== null && ac > 2 && <p>{t('bijli.note.acHigh', { units: Math.round(result.extraUnits) })}</p>}
            {Math.abs(result.residual) > amount * 0.05 && result.model > 0 && (
              <p>{result.residual > 0 ? t('bijli.note.residual.more', { amount: money(result.residual) }) : t('bijli.note.residual.less', { amount: money(-result.residual) })}</p>
            )}
          </div>

          {lost && (result.lost > 0 || lostRule === 'shared') && (
            <ChoiceChips
              label={t(lost.rule)}
              value={lostRule}
              onChange={setLostRule}
              options={[
                { value: 'crosser', label: t('bijli.lostRule.crosser') },
                { value: 'shared', label: t('bijli.lostRule.shared') },
              ]}
            />
          )}

          <ChoiceChips label={t('bijli.payer.label')} value={payer} onChange={setPayerId} options={peopleIds.map((id) => ({ value: id, label: nameOf(id) }))} />
          <p className={styles.fine}>{tariff.id === 'flat' ? t('bijli.rates.other') : t('bijli.rates', { company: tariff.company })}</p>
        </section>
      )}

      <BottomSheet open={companyOpen} onClose={() => setCompanyOpen(false)} title={t('bijli.company.sheet.title')} description={t('bijli.company.sheet.description')}>
        <ul className={styles.companies} role="radiogroup" aria-label={t('bijli.company.label')}>
          {TARIFFS.map((option) => (
            <li key={option.id}>
              <button type="button" role="radio" aria-checked={option.id === tariffId} className={styles.companyOption} onClick={() => pickTariff(option.id)}>
                <span className={styles.companyText}>
                  <span className={styles.companyName}>{option.id === 'flat' ? t('bijli.company.other') : option.company}</span>
                  <span className={styles.companyCity}>
                    {option.id === 'flat' ? t('bijli.company.other.city') : option.period === 'bimonthly' ? `${option.city} · ${t('bijli.company.bimonthly')}` : option.city}
                  </span>
                </span>
                {option.id === tariffId && <Check aria-hidden="true" className={styles.check} />}
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </Screen>
  )
}
