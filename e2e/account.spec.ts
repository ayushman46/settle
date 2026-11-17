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

  test('passkeys: named after their password manager; add, rename and delete, never the last one', async ({ page, api }) => {
    api.me.passkeys.push({ ...api.me.passkeys[0]!, id: '00000000-0000-4000-8000-000000000003', credentialId: 'mock-credential-0002', provider: 'Windows Hello', current: false, backedUp: false })
    await onboard(page)
    await page.goto('/app/account')
    const list = page.getByRole('region').or(page.locator('section')).filter({ hasText: 'Passkeys' }).first()
    await expect(list.getByRole('button', { name: /Google Password Manager.*Signed in here/ })).toBeVisible()

    // Adding: three places a passkey can go.
    await page.getByRole('button', { name: 'Add a passkey' }).first().click()
    const add = page.getByRole('dialog', { name: 'Add a passkey' })
    for (const where of ['This phone', 'Another phone or tablet', 'Security key']) await expect(add.getByRole('radio', { name: new RegExp(where) })).toBeVisible()
    await expect(add.getByRole('radio', { name: /Another phone or tablet/ })).toBeChecked()
    await page.keyboard.press('Escape')

    // Rename the Windows one.
    await list.getByRole('button', { name: /Windows Hello/ }).click()
    const sheet = page.getByRole('dialog', { name: 'Windows Hello' })
    await sheet.getByRole('textbox', { name: 'Name (optional)' }).fill('Work laptop')
    await sheet.getByRole('button', { name: 'Save name' }).click()
    await expect(page.getByText('Passkey renamed')).toBeVisible()
    await expect(list.getByRole('button', { name: /Work laptop/ })).toBeVisible()

    // Delete it: asks first.
    await list.getByRole('button', { name: /Work laptop/ }).click()
    await page.getByRole('dialog', { name: 'Work laptop' }).getByRole('button', { name: 'Delete passkey' }).click()
    await expect(page.getByText('Delete this passkey?')).toBeVisible()
    await page.getByRole('dialog', { name: 'Work laptop' }).getByRole('button', { name: 'Delete passkey' }).click()
    await expect(page.getByText('Passkey deleted')).toBeVisible()
    expect(api.calls.passkeyDelete).toEqual(['00000000-0000-4000-8000-000000000003'])

    // The last one can't be deleted.
    await list.getByRole('button', { name: /Google Password Manager/ }).click()
    const last = page.getByRole('dialog', { name: 'Google Password Manager' })
    await expect(last.getByText(/your only passkey, so it can’t be deleted/)).toBeVisible()
    await expect(last.getByRole('button', { name: 'Delete passkey' })).toHaveCount(0)
  })

  test('deleting the account: blocked while money is owed, then a typed word, and the phone forgets everything', async ({ page, api }) => {
    api.dashboard = { owe: 50000, owed: 0, net: -50000, groups: [{ id: '00000000-0000-4000-8000-0000000000a1', name: 'Flat', role: 'member', updatedAt: '2026-11-17T00:00:00Z', net: -50000, members: 3 }], open: [] }
    await onboard(page)
    await page.goto('/app/account')

    await page.getByRole('button', { name: 'Delete account' }).click()
    const sheet = page.getByRole('dialog', { name: 'Delete your Settle account?' })
    await expect(sheet.getByText('Settle up first')).toBeVisible()
    await expect(sheet.getByRole('button', { name: /Flat · ₹500.*you owe/ })).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Delete my account' })).toHaveCount(0)
    await sheet.getByRole('button', { name: 'Keep my account' }).click()

    api.dashboard = { owe: 0, owed: 0, net: 0, groups: [], open: [] }
    await page.getByRole('button', { name: 'Delete account' }).click()
    const ready = page.getByRole('dialog', { name: 'Delete your Settle account?' })
    const go = ready.getByRole('button', { name: 'Delete my account' })
    await expect(go).toBeDisabled()
    await ready.getByRole('textbox', { name: 'Type DELETE to confirm' }).fill('delete')
    await go.click()
    await expect(page.getByText('Your account is deleted')).toBeVisible()
    expect(api.calls.cloudDelete).toEqual([{ confirm: 'DELETE' }])
    await expect(page).toHaveURL(/\/app\/(account|welcome)/, { timeout: 15_000 })
    const left = await page.evaluate(() => Object.keys(localStorage).filter((k) => /^settle[.-]/.test(k) && !/install|rates|billing/.test(k)))
    expect(left.filter((k) => !k.startsWith('settle.v3.profile'))).toEqual([])
  })
})
