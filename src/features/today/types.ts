/** One thing a feature needs from the person today: shown on Home’s Today list, one tap to deal with it. */
export interface TodayItem {
  /** Stable, unique across features: start it with the feature’s namespace ("kist:abc"). */
  id: string
  /** Already translated: what it is ("Kist to Riya is due"). */
  title: string
  /** Already translated: one line of detail ("₹2,000, the second of three"). */
  body: string
  /** Where a tap goes. */
  path: string
  /** Paise, when there is an amount to show at the end of the row. */
  amount?: number
  currency?: string
}
