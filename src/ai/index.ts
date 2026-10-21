/**
 * AI on the client — "Just say it": a sentence read by the AI into a draft split
 * (`describeSplit`), then turned into a new-split prefill (`describedToPrefill`).
 * Bill photos go through `scanBill` in `src/api/client.ts`.
 */
export {
  DESCRIBE_ERROR_MESSAGES,
  DESCRIBE_EXAMPLE,
  DESCRIBE_EXAMPLES,
  DESCRIBE_OFFLINE_MESSAGE,
  DESCRIBE_TIMEOUT_MS,
  DESCRIBE_TOO_LONG_MESSAGE,
  DescribeError,
  describeRateLimitedMessage,
  describeSplit,
  type DescribeErrorCode,
  type DescribeHints,
} from './describe'
export { describedToPrefill, missingPeople, resolveDescribedPeople, type DescribeContext, type ResolvedPerson } from './prefill'
