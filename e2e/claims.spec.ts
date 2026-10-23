/**
 * Claim your items (spec 01 §9): the organiser sends one link from the bill flow, friends pick what
 * they had on their own phones and pay their exact share by UPI, their signed replies come back,
 * a conflict is decided and the bill updates to the paisa. Plus a tampered reply, the ⋮ entry on
 * a saved bill, axe scans and a 320 px run.
 */
import type { Page } from '@playwright/test'
import { claimShare } from '../src/engine/claims'
import type { ClaimPick, Expense } from '../src/domain/types'
import { formatMoney } from '../src/lib/money'
import { onboard, OWNER, readUpiLink } from './support/app'
import { expectAccessible } from './support/a11y'
import { expectNoSideScroll, replyLinkIn, sampleBillToPeople } from './support/claims'
import { expect, test } from './support/fixtures'
import { friend, seed } from './support/seed'

/** "Try a sample bill" (src/api/sample.ts), in paise, as the claim link carries it. */
const SAMPLE_ITEMS = [
  { name: 'Paneer Tikka', amount: 34500, quantity: 1 },
  { name: 'Butter Chicken', amount: 49500, quantity: 1 },
  { name: 'Dal Makhani', amount: 32500, quantity: 1 },
  { name: 'Garlic Naan', amount: 30000, quantity: 4 },
  { name: 'Jeera Rice', amount: 24500, quantity: 1 },
  { name: 'Fresh Lime Soda', amount: 24000, quantity: 2 },
  { name: 'Mango Lassi', amount: 16500, quantity: 1 },
  { name: 'Gulab Jamun', amount: 19000, quantity: 2 },
]
const SAMPLE_TOTAL = 229900

const rupees = (minor: number) => formatMoney(minor, 'INR', { trimZeros: true })
const shareFor = (picks: ClaimPick[], personIndex: number) => claimShare({ items: SAMPLE_ITEMS, total: SAMPLE_TOTAL, picks, personIndex }).share

async function storedExpenses(page: Page): Promise<Expense[]> {
  return page.evaluate(() => (JSON.parse(window.localStorage.getItem('settle.v3.expenses') ?? '{"data":[]}') as { data: Expense[] }).data)
}

test.describe('claim your items', () => {
  test('one link: friends pick, pay and reply; a conflict is decided and the bill adds up', async ({ page, shared, openPhone }) => {
    test.setTimeout(300_000)
    await onboard(page)
    await sampleBillToPeople(page, ['Riya', 'Sam'])

    await page.getByRole('button', { name: 'Let everyone pick their own' }).click()
    await expect(page).toHaveURL(/\/app\/claims\/[A-Za-z0-9_-]{10}$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Who had what?' })).toBeVisible()
    await expect(page.getByText(/^Saffron Table · ₹2,299/)).toBeVisible()
    await page.getByRole('button', { name: 'Copy link' }).click()
    const link = (await shared()).clipboard.at(-1) ?? ''
    expect(link).toContain('/claim#')
    const boardUrl = page.url()

    // Riya's phone.
    const riya = (await openPhone()).page
    await riya.goto(link)
    await expect(riya.getByRole('heading', { level: 1, name: 'Saffron Table' })).toBeVisible()
    await expect(riya.getByText('Ayush is splitting')).toBeVisible()
    await riya.getByRole('button', { name: 'Riya' }).click()
    await expect(riya.getByRole('heading', { name: 'What did you have?' })).toBeFocused()
    await riya.getByRole('button', { name: 'I had this: Paneer Tikka' }).click()
    await riya.getByRole('radio', { name: 'Shared' }).click()
    await riya.getByRole('button', { name: '2', exact: true }).click()
    await riya.getByRole('button', { name: 'Increase garlic Naan: you had' }).or(riya.getByRole('button', { name: 'Increase garlic naan: you had' })).click()
    await expect(riya.getByText('1 of 4 · ₹75')).toBeVisible()

    const riyaShare = shareFor(
      [
        { item: 0, num: 1, den: 2 },
        { item: 3, num: 1, den: 4 },
      ],
      1,
    )
    await expect(riya.getByText(`Your share, ${rupees(riyaShare)}, after the discount`, { exact: true })).toBeAttached()
    await expectAccessible(riya)

    const upi = readUpiLink((await riya.getByRole('link', { name: /with any UPI app/ }).getAttribute('href')) ?? '')
    expect(upi.params.pa).toBe(OWNER.upiId)
    expect(upi.params.am).toBe((riyaShare / 100).toFixed(2))
    await riya.getByRole('checkbox', { name: `Paid ${rupees(riyaShare)}?` }).check()

    const send = riya.getByRole('link', { name: 'Send my picks to Ayush' })
    await expect(send).toHaveAttribute('href', /claims%2Fin%23/)
    const riyaReply = replyLinkIn((await send.getAttribute('href')) ?? '')

    // Back on the organiser's phone: Riya's picks arrive.
    await page.goto(riyaReply)
    await expect(page.getByRole('heading', { name: 'Riya’s picks' })).toBeVisible()
    await expect(page.getByText(`Says they’ve paid ${rupees(riyaShare)}`)).toBeVisible()
    await page.getByRole('button', { name: 'Add to the bill' }).click()
    await expect(page).toHaveURL(boardUrl)
    await expect(page.getByText('Riya’s picks added')).toBeVisible()
    const people = page.getByRole('list', { name: 'People' })
    await expect(people.getByRole('listitem').filter({ hasText: 'Riya' })).toContainText('Paid')
    await expectAccessible(page)

    // Sam takes the whole Paneer Tikka: claimed 1½ times.
    const sam = (await openPhone()).page
    await sam.goto(link)
    await sam.getByRole('button', { name: 'Sam' }).click()
    await sam.getByRole('button', { name: 'I had this: Paneer Tikka' }).click()
    const samReply = replyLinkIn((await sam.getByRole('link', { name: 'Send my picks to Ayush' }).getAttribute('href')) ?? '')
    await page.goto(samReply)
    await page.getByRole('button', { name: 'Add to the bill' }).click()
    await expect(page).toHaveURL(boardUrl)

    const paneer = page.getByRole('button', { name: /Paneer Tikka.*Claimed 1½ of 1.*needs you/ })
    await expect(paneer).toBeVisible()
    await paneer.click()
    await expect(page.getByRole('dialog', { name: 'Paneer Tikka — 1½ of 1 claimed' })).toBeVisible()
    await page.getByRole('button', { name: /Split it as claimed/ }).click()
    await expect(page.getByRole('button', { name: /Paneer Tikka.*Decided.*Split as claimed/ })).toBeVisible()

    await page.getByRole('button', { name: 'Update the bill' }).click()
    const updated = page.getByRole('dialog', { name: 'Bill updated' })
    await expect(updated).toBeVisible()
    await expect(updated.getByText(/^Riya paid/)).toBeVisible()
    await expect(updated.getByText(/^Sam · share now/)).toBeVisible()
    await updated.getByRole('button', { name: 'See the bill' }).click()
    await expect(page).toHaveURL(/\/app\/expense\//)

    const [bill] = await storedExpenses(page)
    expect(bill?.total).toBe(SAMPLE_TOTAL)
    expect(Object.values(bill?.shares ?? {}).reduce((a, b) => a + b, 0)).toBe(SAMPLE_TOTAL)
    // Paneer Tikka is split 1 : 2 between Riya and Sam, as claimed.
    const paneerId = bill?.bill?.items.find((i) => i.name === 'Paneer Tikka')?.id ?? ''
    expect(Object.values(bill?.bill?.assignments[paneerId] ?? {}).sort()).toEqual([1, 2])
    await expect(page.getByText('Claims · 2 of 2 replied')).toBeVisible()

    // A reply changed by one character is refused.
    const at = riyaReply.indexOf('#') + 20
    const tampered = riyaReply.slice(0, at) + (riyaReply[at] === 'A' ? 'B' : 'A') + riyaReply.slice(at + 1)
    await page.goto(tampered)
    await expect(page.getByRole('heading', { name: 'This reply doesn’t look right' })).toBeVisible()
  })

  test('a saved bill: claim from the ⋮ menu, add your UPI ID first, and it fits 320 px', async ({ page, shared, openPhone }) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width: 320, height: 720 })
    const expense: Expense = {
      id: 'e-toit',
      kind: 'bill',
      title: 'Toit Brewpub',
      category: 'food',
      currency: 'INR',
      total: 276600,
      date: '2026-10-18',
      createdAt: 1,
      updatedAt: 1,
      payerId: 'me',
      mode: 'items',
      participants: [
        { friendId: 'me', input: null },
        { friendId: 'riya', input: null },
        { friendId: 'kabir', input: null },
      ],
      shares: { me: 92200, riya: 92200, kabir: 92200 },
      roundedToWhole: false,
      note: null,
      groupId: null,
      bill: {
        meta: { merchant: 'Toit Brewpub', date: '2026-10-18', subtotal: 224000, tax: null, serviceCharge: null, discount: null, tip: null, total: 276600 },
        items: [
          { id: 'i0', name: 'Butter Chicken', quantity: 1, amount: 45000 },
          { id: 'i1', name: 'Paneer Tikka', quantity: 1, amount: 38000 },
          { id: 'i2', name: 'Butter Naan', quantity: 4, amount: 24000 },
          { id: 'i3', name: 'Kingfisher Beer', quantity: 3, amount: 90000 },
          { id: 'i4', name: 'Fresh Lime Soda', quantity: 1, amount: 12000 },
          { id: 'i5', name: 'Gulab Jamun', quantity: 1, amount: 15000 },
        ],
        assignments: {},
        warnings: [],
      },
      paidBack: {},
      recurringId: null,
      source: 'scan',
    }
    await seed(page, { friends: [friend('riya', 'Riya'), friend('kabir', 'Kabir')], expenses: [expense] })
    await page.goto('/app/expense/e-toit')
    await page.getByRole('button', { name: /More/ }).first().click()
    await page.getByRole('button', { name: /Let friends claim items/ }).click()

    await expect(page.getByRole('dialog', { name: 'Add your UPI ID' })).toBeVisible()
    await page.getByRole('textbox', { name: 'Your UPI ID' }).fill('ayush@okicici')
    await page.getByRole('button', { name: 'Save and continue' }).click()
    await expect(page.getByRole('dialog', { name: 'Add your UPI ID' })).toBeHidden()
    await expect(page.getByText(/^Toit Brewpub · ₹2,766 · 18 Oct/)).toBeVisible()
    await expectNoSideScroll(page)
    await expectAccessible(page)

    await page.getByRole('button', { name: 'Copy link' }).click()
    const link = (await shared()).clipboard.at(-1) ?? ''
    const kabir = (await openPhone()).page
    await kabir.setViewportSize({ width: 320, height: 720 })
    await kabir.goto(link)
    await kabir.getByRole('button', { name: 'Kabir' }).click()
    await kabir.getByRole('button', { name: 'Increase kingfisher Beer: you had' }).or(kabir.getByRole('button', { name: 'Increase kingfisher beer: you had' })).click()
    await kabir.getByRole('button', { name: 'Increase kingfisher Beer: you had' }).or(kabir.getByRole('button', { name: 'Increase kingfisher beer: you had' })).click()
    // Spec 01 §4.2: Kabir's Paneer ½ + Naan 1 of 4 + Beer 2 of 3 → ₹1,049.60.
    await kabir.getByRole('button', { name: 'I had this: Paneer Tikka' }).click()
    await kabir.getByRole('radio', { name: 'Shared' }).click()
    await kabir.getByRole('button', { name: 'Increase butter Naan: you had' }).or(kabir.getByRole('button', { name: 'Increase butter naan: you had' })).click()
    await expect(kabir.getByText('Your share, ₹1,049.60, including tax and service', { exact: true })).toBeAttached()
    await expectNoSideScroll(kabir)
    await expectAccessible(kabir)

    // The "had nothing" path needs no picks.
    await kabir.getByRole('button', { name: 'I didn’t have anything' }).click()
    await expect(kabir.getByRole('link', { name: 'Send my picks to Ayush' })).toBeVisible()
  })

  test('an empty or broken claim link says so', async ({ page }) => {
    await page.goto('/claim')
    await expect(page.getByRole('heading', { name: 'No claim link here' })).toBeVisible()
    await page.goto('/claim#AAAAbroken')
    await expect(page.getByRole('heading', { name: 'This claim link doesn’t work' })).toBeVisible()
  })
})
