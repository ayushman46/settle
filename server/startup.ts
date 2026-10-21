/**
 * What the server says when it starts: what's on, what's off and how to turn it on.
 * Pure (index.ts prints it), so the wording is tested. Never includes secrets.
 */
import { checkoutReady, type ServerConfig } from './config'

export const LOG_TAG = '[settle]'

export interface StartupFacts {
  /** Where the built client should be. */
  clientDir: string
  /** Whether `clientDir/index.html` exists. */
  clientBuilt: boolean
}

/** Notes for the operator, most important first. Empty when everything is set up. */
export function startupWarnings(config: ServerConfig, facts: StartupFacts): string[] {
  const notes: string[] = []
  if (!facts.clientBuilt) notes.push(`No client build at ${facts.clientDir} — run "npm run build". The API still works.`)
  notes.push(...config.warnings)
  if (config.apiKey === null) notes.push('NVIDIA_API_KEY is not set: AI (bill scanning, "Just say it") is off. Everything else works.')

  // loadConfig already explains a half-set or malformed Razorpay key; don't say it twice.
  const razorpayExplained = config.warnings.some((warning) => warning.startsWith('Razorpay checkout is off'))
  if (config.license.publicKey === null) {
    notes.push('LICENSE_PRIVATE_KEY is not set: Pro checkout and redeem codes are off. Run "npm run license keygen" and add its lines to .env.')
  } else if (config.license.privateKey === null) {
    notes.push('Only LICENSE_PUBLIC_KEY is set: codes can be redeemed, but checkout is off until LICENSE_PRIVATE_KEY is set to sign licenses.')
  } else if (config.billing.razorpay === null && !razorpayExplained) {
    notes.push('Checkout is off (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set): the Pro page shows plans and "Redeem a code" still works.')
  }
  return notes
}

/** How to reach a server listening on `hostname` from this machine. */
export function displayHost(hostname: string | undefined): string {
  if (!hostname || hostname === '0.0.0.0' || hostname === '::') return 'localhost'
  return hostname.includes(':') ? `[${hostname}]` : hostname
}

/** The line printed once the server is listening. */
export function readyLine(config: ServerConfig, listening: { hostname?: string; port: number }): string {
  const ai = config.apiKey === null ? 'AI: off' : `vision: ${config.models.join(', ')} · text: ${config.textModels.join(', ')}`
  const checkout = checkoutReady(config)
    ? `checkout: Razorpay ${config.billing.razorpay.keyId.startsWith('rzp_live_') ? 'live' : 'test'} mode`
    : config.license.publicKey === null
      ? 'Pro: off'
      : 'checkout: off (codes only)'
  return `Ready on http://${displayHost(listening.hostname)}:${listening.port} · ${ai} · ${checkout}`
}
