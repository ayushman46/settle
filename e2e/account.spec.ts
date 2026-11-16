/**
 * Settle needs an account: past onboarding, nothing opens until you sign in, and once signed in
 * everything you add goes to your account's database (the mocked `/api/cloud`, see mocks.ts).
 */
import { onboard, OWNER, splitEqually } from './support/app'
import { expect, test } from './support/fixtures'

test.describe('the Settle account', () => {
  test('signed out, every page waits for the account first, with no way around it', async ({ page, api }) => {
    api.cloud = 'signedOut'
    await page.goto('/app')
    await page.getByRole('button', { name: 'Skip' }).click()
    await page.getByRole('textbox', { name: 'Your name' }).fill(OWNER.name)
    await page.getByRole('button', { name: 'Start splitting' }).click()

    await expect(page).toHaveURL(/\/app\/account\?next=/)
    await expect(page.getByRole('heading', { level: 1, name: 'Your Settle account' })).toBeVisible()
    await expect(page.getByText(/saved to your account, so they’re safe/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Create passkey' })).toBeVisible()

    await page.goto('/app/groups')
    await expect(page).toHaveURL(/\/app\/account\?next=%2Fapp%2Fgroups/)
  })

  test('signed in, a split goes to the account with each person’s share', async ({ page, api }) => {
    await onboard(page)
    await splitEqually(page, { amount: '1200', title: 'Dinner at Toit', people: ['Riya', 'Sam'] })
    await expect(page.getByText('You’re owed ₹800')).toBeVisible()

    await expect
      .poll(() => api.calls.cloudPush.flatMap((body) => body.expenses ?? []).length, { timeout: 15_000 })
      .toBeGreaterThan(0)
    const expenses = api.calls.cloudPush.flatMap((body) => (body.expenses ?? []) as Array<Record<string, unknown>>)
    const dinner = expenses.filter((e) => e.title === 'Dinner at Toit').at(-1)!
    expect(dinner.total).toBe(120_000)
    expect(Object.values(dinner.shares as Record<string, number>).sort()).toEqual([40_000, 40_000, 40_000])
    const friends = api.calls.cloudPush.flatMap((body) => (body.friends ?? []) as Array<Record<string, unknown>>).map((f) => f.name)
    expect(friends).toEqual(expect.arrayContaining(['Riya', 'Sam']))
    const stores = api.calls.cloudPush.flatMap((body) => (body.stores ?? []) as Array<Record<string, unknown>>).map((s) => s.key)
    expect(stores).toContain('settle.v3.profile')
  })

  test('the account screen says everything is saved, and signing out leaves nothing on the phone', async ({ page, api }) => {
    await onboard(page)
    await splitEqually(page, { amount: '600', title: 'Cab', people: ['Riya'] })
    await expect.poll(() => api.calls.cloudPush.length, { timeout: 15_000 }).toBeGreaterThan(0)

    await page.goto('/app/account')
    await expect(page.getByRole('heading', { level: 1, name: 'Ayush' })).toBeVisible()
    await expect(page.getByText(/Everything’s saved/)).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    api.cloud = 'signedOut'
    await page.getByRole('dialog').getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page).toHaveURL(/\/app\/welcome/, { timeout: 15_000 })
    const left = await page.evaluate(() => Object.keys(localStorage).filter((k) => /^settle[.-]/.test(k) && !/install|rates|billing/.test(k)))
    expect(left.filter((k) => !k.startsWith('settle.v3.profile'))).toEqual([])
  })
})
