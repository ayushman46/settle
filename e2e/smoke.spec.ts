/**
 * Smoke: the three journeys that must never break — a first visit becomes a set-up app, a split
 * is saved and shows up everywhere, and a friend opening the pay link sees exactly their share
 * with a UPI link that pays the right person the right amount.
 */
import { copyPayLink, onboard, OWNER, readUpiLink, splitEqually, UPI_PAYMENT_LINKS, upiQrLink } from './support/app'
import { expect, test } from './support/fixtures'

test.describe('smoke', () => {
  test('landing → open the app → onboarding → Home', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: /Split anything\.\s*Settle in a tap\./ })).toBeVisible()

    await page.getByRole('link', { name: /Open Settle/ }).first().click()
    await expect(page).toHaveURL(/\/app\/welcome/)
    // The language step comes first (its own Continue), then the intro slides.
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('heading', { name: 'Snap the bill' })).toBeVisible()

    // Through every intro slide with Next, then "Get started".
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('button', { name: /Slide 2:/ })).toHaveAttribute('aria-current', 'step')
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('button', { name: /Slide 3:/ })).toHaveAttribute('aria-current', 'step')
    await page.getByRole('button', { name: 'Get started' }).click()

    // A name is required; a bad UPI ID is caught before anything is saved.
    await expect(page.getByRole('heading', { name: 'Let’s set you up' })).toBeVisible()
    await page.getByRole('button', { name: 'Start splitting' }).click()
    await expect(page.getByText('Add your name — friends see it on the requests you send.')).toBeVisible()
    await page.getByRole('textbox', { name: 'Your name' }).fill(OWNER.name)
    await page.getByRole('textbox', { name: 'Your UPI ID (optional)' }).fill('not a upi id')
    await page.getByRole('button', { name: 'Start splitting' }).click()
    await expect(page.getByText('That doesn’t look like a UPI ID. It looks like name@bank.')).toBeVisible()
    await expect(page).toHaveURL(/\/app\/welcome/)

    // An Indian phone gets rupees by default.
    await expect(page.getByRole('button', { name: /Currency.*INR/ })).toBeVisible()
    await page.getByRole('textbox', { name: 'Your UPI ID (optional)' }).fill(OWNER.upiId)
    await page.getByRole('button', { name: 'Start splitting' }).click()

    await expect(page).toHaveURL(/\/app$/)
    await expect(page.getByRole('heading', { level: 1, name: `Hi, ${OWNER.name}` })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Split your first expense' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()

    // Set up once: a reload opens Home, not the welcome screens.
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: `Hi, ${OWNER.name}` })).toBeVisible()
    await expect(page).toHaveURL(/\/app$/)
  })

  test('a manual split is saved and shown on the expense, Home and Activity', async ({ page }) => {
    await onboard(page)
    await splitEqually(page, { amount: '1200', title: 'Dinner at Toit', people: ['Riya', 'Sam'] })

    // The expense itself.
    await expect(page.getByText('₹1,200').first()).toBeVisible()
    await expect(page.getByText('You’re owed ₹800')).toBeVisible()
    const shares = page.getByRole('list', { name: 'Shares' })
    await expect(shares.getByRole('listitem')).toHaveCount(3)
    await expect(shares.getByRole('listitem').filter({ hasText: 'Riya' })).toContainText(/Owes you\s*₹400/)
    await expect(shares.getByRole('listitem').filter({ hasText: 'Sam' })).toContainText(/Owes you\s*₹400/)

    // Home now shows where you stand and the latest activity.
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page).toHaveURL(/\/app$/)
    await expect(page.getByRole('heading', { name: 'Split your first expense' })).toHaveCount(0)
    await expect(page.getByText('Dinner at Toit').first()).toBeVisible()
    await expect(page.getByText('₹800').first()).toBeVisible()

    // Activity lists it, and it survives a reload (it lives on the phone).
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Activity' }).click()
    await expect(page).toHaveURL(/\/app\/activity/)
    await expect(page.getByText('Dinner at Toit').first()).toBeVisible()
    await page.reload()
    await expect(page.getByText('Dinner at Toit').first()).toBeVisible()
  })

  test('a pay link opened as a friend shows their share, the ways UPI allows, and a QR for exactly that', async ({ page, shared, openPhone }) => {
    await onboard(page)
    // ₹1,000 three ways doesn't divide evenly: friends pay ₹333.33, the payer absorbs the paisa.
    await splitEqually(page, { amount: '1000', title: 'Goa cab', people: ['Riya', 'Sam'] })
    const link = await copyPayLink(page, async () => (await shared()).clipboard)

    const url = new URL(link)
    expect(url.pathname).toBe('/pay')
    expect(url.hash.length).toBeGreaterThan(20)
    expect(url.origin).toBe(new URL(page.url()).origin)

    // A friend with nothing on their phone.
    const friend = await openPhone()
    await friend.page.goto(link)
    await expect(friend.page.getByRole('heading', { level: 1, name: `${OWNER.name} requested money for Goa cab` })).toBeVisible()
    await expect(friend.page.getByRole('heading', { name: 'Which one are you?' })).toBeVisible()
    await expect(friend.page.getByRole('button', { name: /Sam/ })).toContainText('₹333.33')

    await friend.page.getByRole('button', { name: /Riya/ }).click()
    await expect(friend.page.getByRole('heading', { name: 'Riya’s share' })).toBeVisible()
    // Up to ₹2,000: save the QR and upload it in the UPI app — never a payment link (UPI apps refuse those).
    await expect(friend.page.getByRole('radio', { name: 'QR from photos' })).toHaveAttribute('aria-checked', 'true')
    await expect(friend.page.locator(UPI_PAYMENT_LINKS)).toHaveCount(0)
    const download = friend.page.waitForEvent('download')
    await friend.page.getByRole('button', { name: 'Save QR to gallery' }).click()
    expect((await download).suggestedFilename()).toMatch(/^Settle QR Ayush 333\.33\.png$/)
    await expect(friend.page.getByRole('button', { name: 'QR saved' })).toBeVisible()

    const upi = readUpiLink(await upiQrLink(friend.page))
    expect(upi.scheme).toBe('upi:')
    expect(upi.target).toBe('pay')
    expect(upi.params).toEqual({ pa: OWNER.upiId, pn: OWNER.name, am: '333.33', cu: 'INR', tn: 'Goa cab' })

    // The friend's phone shows who they're paying, and kept nothing of the organiser's data.
    await expect(friend.page.getByText(OWNER.upiId)).toBeVisible()
    const stored = await friend.page.evaluate(() => Object.keys(localStorage).filter((key) => /expense/i.test(key)))
    expect(stored).toEqual([])
  })
})

test.describe('on an iPhone', () => {
  test.use({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  })

  test('a friend saves the QR to Photos, and can open their UPI app — never with a payment in the link', async ({ page, shared, openPhone }) => {
    await onboard(page)
    await splitEqually(page, { amount: '1000', title: 'Goa cab', people: ['Riya', 'Sam'] })
    const link = await copyPayLink(page, async () => (await shared()).clipboard)

    const friend = await openPhone()
    await friend.page.goto(link)
    await friend.page.getByRole('button', { name: /Riya/ }).click()
    await expect(friend.page.getByRole('button', { name: 'Save QR to Photos' })).toBeVisible()
    // The app's home screen only: the bare scheme, no payee or amount.
    for (const [name, scheme] of [['Google Pay', 'gpay'], ['PhonePe', 'phonepe'], ['Paytm', 'paytmmp'], ['BHIM', 'bhim']] as const) {
      await expect(friend.page.getByRole('link', { name: `Open ${name}` })).toHaveAttribute('href', `${scheme}://`)
    }
    await expect(friend.page.locator(UPI_PAYMENT_LINKS)).toHaveCount(0)
    expect(readUpiLink(await upiQrLink(friend.page)).params).toMatchObject({ pa: OWNER.upiId, am: '333.33', cu: 'INR' })
  })
})
