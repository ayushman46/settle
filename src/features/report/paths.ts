/** Where the expense report lives. */
export const REPORT_PATH = '/app/report'

/** The expense report, optionally starting on one group. */
export function reportPath(groupId?: string | null): string {
  return groupId ? `${REPORT_PATH}?group=${encodeURIComponent(groupId)}` : REPORT_PATH
}
