/**
 * Split from a bank SMS / shared text — off until slice S2 finishes it (its last commit flips this to `true`). While off,
 * the feature is invisible: no entry points, and its routes go home.
 */
export const SMS_ENABLED = false
