/**
 * What "the screen is there" means for each screen (a predicate run in the page every frame)
 * and how to tap things — kept in one place so every metric agrees.
 */
import { MARKERS } from '../seed.mjs'

const q = (selector) => `document.querySelector(${JSON.stringify(selector)})`

/** In-page predicates (source text): true once the screen's real content is in the DOM. */
export const READY = {
  /** Home with data: the balance card and the recent activity list. */
  home: `() => ${q('section[data-mood]')} && ${q('section[aria-labelledby="home-recent"] li')}`,
  /** Home's balance has finished counting up (the real number is on screen). */
  homeFinal: `() => ${q('section[data-mood]')} && ${q('section[aria-labelledby="home-recent"] li')} && !${q('section[data-mood] [class*="amountBox"] > [aria-hidden="true"]')}`,
  /** First visit: the welcome slides. */
  welcome: `() => ${q('[aria-roledescription="carousel"] h2')}`,
  /** A friend's pay page: who's asking, and "Which one are you?" with the names. */
  pay: `() => ${q('#pay-request-title')} && ${q('[data-person]')}`,
  activity: `() => ${q('section[aria-labelledby^="activity-2"] li')}`,
  expenseBill: `() => ${q('#expense-shares')} && ${q('ul[aria-label="Items"] li')}`,
  groups: `() => ${q('section[aria-labelledby="groups-active"] li')}`,
  groupDetail: `() => ${q('[role="region"][aria-label="Expenses"] li')}`,
  newSplit: `() => ${q('#split-people')} || ${q('#split-how')}`,
  billFlow: `() => ${q('[aria-label="Take a photo of the bill"]')}`,
  you: `() => ${q('#you-name')}`,
}

/** In-page expressions (source text) that find the element to tap. */
export const TAP = {
  tab: (href) => `document.querySelector('nav[data-tabbar] a[href="${href}"]')`,
  button: (text) => `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`,
  ariaPrefix: (prefix) => `[...document.querySelectorAll('button[aria-label]')].find((b) => b.getAttribute('aria-label').startsWith(${JSON.stringify(prefix)}))`,
}

/** In-page expressions that find the scroll targets (the oldest rows). */
export const OLDEST = {
  activity: TAP.ariaPrefix(`${MARKERS.OLDEST},`),
  group: TAP.ariaPrefix(`${MARKERS.GROUP_OLDEST},`),
}
