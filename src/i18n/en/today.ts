/** English copy for Today (src/features/today): what is due today, in one list. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const today = {
  'today.title': 'Today',
  'today.subtitle': '{count, plural, one {One thing needs you today.} other {# things need you today.}}',
  'today.all': 'Show all {count}',
  'today.fewer': 'Show fewer',
} satisfies Messages
