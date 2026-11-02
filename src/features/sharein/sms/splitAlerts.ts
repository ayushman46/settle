/**
 * One paste of bank SMS and UPI alerts cut into its messages: on blank lines, and before a line
 * that starts a new alert. Shared by Share-in's "From SMS" (src/features/sharein/sms/smsView.ts),
 * Who's paid? (src/features/whospaid/sms.ts) and Stuck money's paste. Pure; no copy.
 * No regex lookbehind (Safari < 16.4).
 */

/**
 * Lines that open a new alert — how banks and UPI apps start their messages. A strong opener
 * (`Dear Customer`, `Your A/C …`, `ICICI Bank Acct …`, an OTP) starts a new message whenever
 * the text before it already has an amount; a weak one (`Sent Rs…`, `₹480 paid …`) only when it
 * brings an amount of its own — so the lines inside one multi-line alert ("HDFC Bank Card x9034",
 * "To SWIGGY") never cut it.
 */
const STRONG_START =
  /^(?:dear\b|update!|\d{4,8} is your otp\b|(?:your )?otp\b|(?:your|ur) (?:a\/c|ac\b|acct|account|kyc|otp|upi (?:payment|transaction)|[a-z]+ bill)|[a-z]+ bank (?:acct|a\/c|account|credit card|debit card)\b|congratulations\b|reminder:|[a-z][a-z ]{1,30} has requested\b|collect request\b|upi autopay\b|hi,|(?:your|ur)\s|never share\b|get\b|enjoy\b|upgrade\b|earn\b|[a-z]+ (?:bank|\d{3}):\s|प्रिय\s)/i
const WEAK_START =
  /^(?:sent\b|spent\b|paid\b|received\b|money received\b|refund of\b|(?:rs\.?|inr|₹|रु\.?|रू\.?)\s?\d|a\/c\b|acct\b|txn\b|transaction of\b|you (?:have )?(?:paid|received|sent)\b|get flat\b|flat \d|pre-approved\b|[a-z]+ bank card\b)/i
/** An amount: ₹500, Rs.500, INR 500, रु.500, "500 रुपये", "debited by 500". */
const MONEY_CUE = /(?:rs\.?|inr|₹|रु\.?|रू\.?)\s?\d|(?:debited|credited) by\s?\d|\d\s?(?:रुपये|रुपए)/gi
/** Words that make the amount after them a balance or a limit (as the parser's 14-character look-back). */
const NOT_A_PAYMENT = /(?:bal(?:ance)?|avl|avail(?:able)?|limit|lmt|due|outstanding|o\/s|amt)\W{0,4}$/i

/** True when `text` names any amount (a balance or a due amount too). */
function hasMoney(text: string): boolean {
  return text.search(MONEY_CUE) >= 0
}

/** True when `text` has an amount that isn't a balance or a limit. */
function hasAmount(text: string): boolean {
  for (const m of text.matchAll(MONEY_CUE)) {
    if (!NOT_A_PAYMENT.test(text.slice(Math.max(0, m.index - 14), m.index))) return true
  }
  return false
}

/**
 * One block's lines (no blank lines inside) cut into messages. A line can start a new message once
 * the text before it has an amount: a strong opener always does; a weak opener when it, or the
 * lines up to the next opener, bring an amount; any other line when it has an amount itself.
 */
function cutBlock(lines: readonly string[]): string[] {
  const out: string[] = []
  let from = 0
  for (let at = 1; at < lines.length; at++) {
    const line = lines[at] ?? ''
    const strong = STRONG_START.test(line)
    const weak = !strong && WEAK_START.test(line)
    let starts = strong || hasAmount(line)
    if (weak && !starts) {
      let end = at + 1
      while (end < lines.length && !STRONG_START.test(lines[end] ?? '') && !WEAK_START.test(lines[end] ?? '')) end++
      starts = hasAmount(lines.slice(at, end).join('\n'))
    }
    if (starts && hasMoney(lines.slice(from, at).join('\n'))) {
      out.push(lines.slice(from, at).join('\n'))
      from = at
    }
  }
  out.push(lines.slice(from).join('\n'))
  return out
}

/** Every message in `clean` (text through cleanSms): split on blank lines, or before a line that starts a new alert. */
export function splitAlerts(clean: string): string[] {
  const out: string[] = []
  for (const block of clean.split(/\n\s*\n+/)) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
    if (lines.length > 0) out.push(...cutBlock(lines))
  }
  return out.filter((m) => /[\p{L}\p{N}]/u.test(m))
}
