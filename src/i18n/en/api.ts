/** English copy for client API errors (src/api). Keys: `api.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const api = {
  // What we tell people when a bill scan fails, by error code. Never the server's own words.
  'api.scan.error.bad_request': "Something about that photo didn't work. Please try another one.",
  'api.scan.error.unsupported_image': 'Please use a JPG or PNG photo.',
  'api.scan.error.image_too_large': 'That photo is too large. Try a smaller one — or take a screenshot of it.',
  'api.scan.error.not_a_bill': "That doesn't look like a bill. Try a clear photo of the full receipt.",
  'api.scan.error.unreadable': "We couldn't read any items. Try a clearer, well-lit photo — or enter them manually.",
  'api.scan.error.not_configured': "Photo scanning isn't available right now — you can type the items in.",
  'api.scan.error.upstream_auth': "Photo scanning isn't working right now — you can type the items in.",
  'api.scan.error.rate_limited': 'Too many scans right now. Try again in a few minutes — or type the items in.',
  'api.scan.error.timeout': 'Reading the bill took too long. Try again with a sharper, closer photo.',
  'api.scan.error.upstream_error': "Couldn't reach the AI service. Please try again.",
  'api.scan.error.network': 'You seem to be offline. Check your connection and try again.',
  'api.scan.error.aborted': 'Scan cancelled.',
  // A short wait: the server is busy, nobody did anything wrong.
  'api.scan.busy': 'Lots of bills are being read right now — try again in a moment.',
  // A long wait; `{wait}` is "about 10 minutes" (api.wait.*).
  'api.scan.proLimit': "You've reached today's fair-use AI limit. It resets in {wait} — you can still type the items in.",
  'api.scan.limit': 'Too many scans. Try again in {wait} — or type the items in.',
  'api.scan.offline': "You're offline — you can still type the items in.",
  // A picked photo we can't use.
  'api.image.error.not_image': "That file isn't a photo. Please choose a JPG or PNG image.",
  'api.image.error.decode_failed': "We couldn't open that image. Try a JPG or PNG — or take a screenshot of it.",
  'api.image.error.too_large': 'That photo is too large (over 25 MB). Try a smaller one — or take a screenshot of it.',
  // How long a wait is, rounded up.
  'api.wait.minute': 'about a minute',
  'api.wait.minutes': 'about {count} minutes',
  'api.wait.hours': 'about {count} hours',
} as const satisfies Messages
