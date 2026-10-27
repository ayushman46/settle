/**
 * Settle inside its Android app (android/, Capacitor loading the live site): the bridge the app
 * injects into the page, and calls to its native plugins (Auto-settle's PaymentAlerts). On the
 * web none of this exists and every check says so — nothing here is bundled from Capacitor.
 */

interface PluginHeader {
  name: string
}

interface Bridge {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
  PluginHeaders?: readonly PluginHeader[]
  nativePromise?: (plugin: string, method: string, options?: Record<string, unknown>) => Promise<unknown>
  addListener?: (plugin: string, event: string, callback: (data: unknown) => void) => { remove: () => Promise<void> }
}

function bridge(): Bridge | null {
  const cap = (globalThis as { Capacitor?: Bridge }).Capacitor
  try {
    return cap?.isNativePlatform?.() === true ? cap : null
  } catch {
    return null
  }
}

/** Running inside the Settle Android app. */
export function inAndroidApp(): boolean {
  return bridge()?.getPlatform?.() === 'android'
}

/** The app has this native plugin (an older install may not). */
export function hasPlugin(name: string): boolean {
  return bridge()?.PluginHeaders?.some((h) => h.name === name) ?? false
}

/** Calls a native plugin method; rejects on the web or when the plugin is missing. */
export async function callPlugin<T>(plugin: string, method: string, options: Record<string, unknown> = {}): Promise<T> {
  const cap = bridge()
  if (!cap?.nativePromise || !hasPlugin(plugin)) throw new Error(`No native ${plugin}`)
  return (await cap.nativePromise(plugin, method, options)) as T
}

/** Listens to a plugin's event; returns the way to stop (a no-op on the web). */
export function listenToPlugin(plugin: string, event: string, onEvent: (data: unknown) => void): () => void {
  const cap = bridge()
  if (!cap?.addListener || !hasPlugin(plugin)) return () => undefined
  const handle = cap.addListener(plugin, event, onEvent)
  return () => {
    void handle.remove().catch(() => undefined)
  }
}

/** The Android app's file plugin (android/…/SettleFilesPlugin.java). */
const FILES = 'SettleFiles'

/** Base64 of a blob, in slices (a long argument list would overflow the stack). */
async function base64Of(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

/**
 * In the Android app, a file goes out through Android's share sheet (save to Files or Drive, or
 * send): a WebView can neither share files nor download a blob. Null when this isn't the app.
 */
export async function shareFileInApp(blob: Blob, name: string, extras: { text?: string; title?: string } = {}): Promise<boolean | null> {
  if (!hasPlugin(FILES)) return null
  try {
    await callPlugin(FILES, 'share', { data: await base64Of(blob), name, mime: blob.type || 'application/octet-stream', ...extras })
    return true
  } catch {
    return false
  }
}

/** Prints the page: Android's print service in the app (a WebView ignores window.print), else the browser's. */
export function printPage(title?: string): void {
  if (hasPlugin(FILES)) {
    void callPlugin(FILES, 'print', title ? { title } : {}).catch(() => undefined)
    return
  }
  window.print()
}
