/**
 * Scenario (i): WhatsApp-style links. People paste a link with words or punctuation glued on after
 * it (a closing bracket, a full stop, a tracking query, a dash and a sentence). The pay, claim and
 * collection pages must still decode the link and show the right thing.
 */
import { expect, test } from '../support/fixtures'
import { expectNoRawKeys } from '../support/scenarios'
import { buildTour, type Tour } from './tour'

/** The trailing text people send with a link. */
const SUFFIXES = [')', '.', '?utm_source=whatsapp', ' — pay me, thanks!', '\n\nFrom Ayush']

test.describe('links pasted with trailing text', () => {
  test.describe.configure({ timeout: 360_000 })

  test('pay, claim and collection links still open with words after them', async ({ page, shared, openPhone }) => {
    const tour: Tour = await buildTour(page, shared)

    for (const suffix of SUFFIXES) {
      // A friend's phone: nothing stored, the pasted text is all it has.
      const friend = await openPhone()
      await friend.page.goto(tour.payLink + suffix)
      await expect(friend.page.getByRole('heading', { name: 'Riya’s share' }), `pay link + ${JSON.stringify(suffix)}`).toBeVisible({ timeout: 45_000 })
      await expect(friend.page.getByRole('heading', { level: 1, name: /Dinner at Toit/ }), `pay title + ${JSON.stringify(suffix)}`).toBeVisible()
      await expectNoRawKeys(friend.page)
      await friend.context.close()
    }

    for (const suffix of SUFFIXES.slice(0, 3)) {
      const friend = await openPhone()
      await friend.page.goto(tour.claimLink + suffix)
      await expect(friend.page.getByRole('heading', { level: 1, name: 'Saffron Table' }), `claim link + ${JSON.stringify(suffix)}`).toBeVisible({ timeout: 45_000 })
      await friend.context.close()
    }

    for (const suffix of SUFFIXES.slice(0, 3)) {
      const friend = await openPhone()
      await friend.page.goto(tour.poolLink + suffix)
      await expect(friend.page.getByRole('heading', { level: 1, name: "Riya's farewell" }), `collection link + ${JSON.stringify(suffix)}`).toBeVisible({ timeout: 45_000 })
      await friend.context.close()
    }
  })
})
