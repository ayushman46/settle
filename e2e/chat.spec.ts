/**
 * Chat to split. The group already wrote down who paid for what, in WhatsApp. Ayush picks the
 * chat WhatsApp exported: Settle reads it on the phone, shows what it found to be checked, and one
 * tap makes the group with its people, every expense split and the payment between two of them
 * recorded. A week later the same chat, longer now, adds only what is new.
 */
import { expect, test } from './support/fixtures'
import { seed } from './support/seed'

const GOA = `12/11/2026, 21:40 - Riya created group "Goa trip"
12/11/2026, 21:41 - Riya: paid 1200 for the cab
12/11/2026, 21:45 - Sam: Dinner at Brittos ₹2,400
13/11/2026, 09:05 - Ayush: I paid 3k for the hotel booking
13/11/2026, 10:15 - Sam: Chai 60
13/11/2026, 11:00 - Riya: sent Sam 500
13/11/2026, 11:05 - Sam: see you at 8, bring 2 chargers
13/11/2026, 11:06 - Riya: how much was the scooty? 500?`

const chatFile = (text: string) => ({ name: 'WhatsApp Chat with Goa trip.txt', mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') })

test.describe('Chat to split', () => {
  test('a WhatsApp chat becomes a group: people, expenses, a payment, and who owes whom', async ({ page }) => {
    await seed(page)
    await page.goto('/app')
    await page.getByRole('button', { name: 'From a chat' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Turn a chat into a split' })).toBeVisible()
    await expect(page.getByText('Read on this phone. The chat is never uploaded.')).toBeVisible()

    await page.locator('input[type="file"]').setInputFiles(chatFile(GOA))
    await expect(page.getByRole('heading', { level: 1, name: 'Goa trip' })).toBeVisible()
    await expect(page.getByText('7 messages read on this phone · 5 about money')).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Ayush' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByLabel('Group name')).toHaveValue('Goa trip')
    await expect(page.getByRole('heading', { name: 'Found 4 payments' })).toBeVisible()
    const cab = page.getByRole('checkbox').filter({ hasText: 'Cab' })
    await expect(cab).toHaveAttribute('aria-checked', 'true')
    await expect(cab).toContainText('₹1,200')
    await expect(cab).toContainText('Riya paid')
    await expect(cab).toContainText('split by all 3')
    // The question and the plan are left alone; the bare "Chai 60" is offered, not assumed.
    await expect(page.getByText('scooty')).toHaveCount(0)
    await expect(page.getByText('chargers')).toHaveCount(0)
    const chai = page.getByRole('checkbox').filter({ hasText: 'Chai' })
    await expect(chai).toHaveAttribute('aria-checked', 'false')
    await chai.click()
    await expect(page.getByText('₹6,660 of spending')).toBeVisible()

    await page.getByRole('button', { name: 'Make the group with 5 entries' }).click()
    await expect(page).toHaveURL(/\/app\/groups\/[^/]+$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Goa trip' })).toBeVisible()
    await expect(page.getByText('Added 5 entries to Goa trip')).toBeVisible()
    for (const title of ['Cab', 'Dinner at Brittos', 'Hotel booking', 'Chai']) await expect(page.getByText(title, { exact: true }).first()).toBeVisible()
    // ₹6,660 between three is ₹2,220 each: Ayush paid ₹3,000, so he is owed ₹780.
    await expect(page.getByText('₹780').first()).toBeVisible()

    // A week later: the same chat with one more line adds only that line, to the same group.
    await page.goto('/app/chat')
    await page.locator('input[type="file"]').setInputFiles(chatFile(`${GOA}\n14/11/2026, 08:00 - Sam: paid 450 for breakfast`))
    await expect(page.getByText('Adding to ✈️ Goa trip')).toBeVisible()
    await expect(page.getByText('5 already added from this chat · 1 new')).toBeVisible()
    await expect(page.getByRole('checkbox')).toHaveCount(1)
    await page.getByRole('button', { name: 'Add 1 to Goa trip' }).click()
    await expect(page).toHaveURL(/\/app\/groups\/[^/]+$/)
    await expect(page.getByText('Breakfast', { exact: true }).first()).toBeVisible()
  })

  test('a file that isn’t a chat is turned away kindly; pasted messages work too', async ({ page }) => {
    await seed(page)
    await page.goto('/app/chat')
    await page.locator('input[type="file"]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('milk, eggs, bread') })
    await expect(page.getByRole('alert')).toContainText('That doesn’t look like a WhatsApp chat.')
    await page.getByRole('button', { name: 'Or paste the messages' }).click()
    await page.getByLabel('Messages copied from the chat').fill('[9:41 pm, 12/11/2026] Riya: paid 1200 for the cab\n[9:45 pm, 12/11/2026] Ayush: maine petrol ke 1500 diye')
    await page.getByRole('button', { name: 'Read these' }).click()
    await expect(page.getByRole('heading', { name: 'Found 2 payments' })).toBeVisible()
    await expect(page.getByRole('checkbox').filter({ hasText: 'Petrol' })).toContainText('You paid')
    await expect(page.getByText('Give the group a name')).toBeVisible()
    await page.getByLabel('Group name').fill('Road trip')
    await page.getByRole('button', { name: 'Make the group with 2 entries' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Road trip' })).toBeVisible()
  })
})
