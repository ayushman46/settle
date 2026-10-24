/** English copy for the app shell (src/app). Keys: `app.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const app = {
  // The bottom tabs.
  'app.tab.home': 'Home',
  'app.tab.groups': 'Groups',
  'app.tab.activity': 'Activity',
  'app.tab.you': 'You',

  // The browser tab's title: "{page} · Settle".
  'app.title.format': '{page} · {brand}',
  // Page names for the browser tab (one per screen).
  'app.title.home': 'Home',
  'app.title.welcome': 'Welcome',
  'app.title.groups': 'Groups',
  'app.title.group': 'Group',
  'app.title.settleUp': 'Settle up',
  'app.title.activity': 'Activity',
  'app.title.you': 'You',
  'app.title.newSplit': 'New split',
  'app.title.editSplit': 'Edit split',
  'app.title.fromSms': 'From SMS',
  'app.title.lend': 'Lend or borrow',
  'app.title.editLend': 'Edit udhaar',
  'app.title.expense': 'Expense',
  'app.title.claims': 'Claims',
  'app.title.people': 'People',
  'app.title.person': 'Person',
  'app.title.insights': 'Insights',
  'app.title.recurring': 'Recurring splits',
  'app.title.newRecurring': 'New recurring split',
  'app.title.recurringOne': 'Recurring split',
  'app.title.collections': 'Collections',
  'app.title.newCollection': 'New collection',
  'app.title.collection': 'Collection',
  'app.title.editCollection': 'Edit collection',
  'app.title.pro': 'Pro',

  // When the phone won't save (storage full or blocked).
  'app.storage.title': 'This phone isn’t saving your changes',
  'app.storage.body': 'Its storage may be full or blocked. Free up some space — everything stays here while {brand} is open.',

  // While a screen's code loads.
  'app.loading.aria': 'Loading',

  // A screen that crashed or couldn't load.
  'app.crash.title': 'Something went wrong',
  'app.crash.body': 'Sorry about that. Try again, or head back Home — your splits are safe.',
  'app.crash.retry.cta': 'Try again',
  'app.crash.home.cta': 'Go to Home',
  'app.crash.offline.title': 'You’re offline',
  'app.crash.offline.body': 'This screen needs a connection the first time it opens. Reconnect and try again.',
  'app.crash.updated.title': '{brand} has been updated',
  'app.crash.updated.body': 'Reload to get the latest version — your splits are safe on this phone.',
  'app.crash.reload.cta': 'Reload',
} as const satisfies Messages
