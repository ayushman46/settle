/**
 * A minimal Chrome DevTools Protocol client over Node's built-in WebSocket: launch headless
 * Edge (or Chrome), talk to the browser target, attach to pages with flattened sessions.
 * No dependencies, so the harness runs on a bare checkout.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const BROWSER_CANDIDATES = [
  process.env.BENCH_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

export function findBrowser() {
  const found = BROWSER_CANDIDATES.find((path) => existsSync(path))
  if (!found) throw new Error('No Edge/Chrome found. Set BENCH_BROWSER to its executable.')
  return found
}

/** A CDP connection; `session(sessionId)` scopes `send`/`on` to an attached target. */
export class Cdp {
  #ws
  #nextId = 1
  #pending = new Map()
  #listeners = new Map()

  static async connect(url) {
    const ws = new WebSocket(url)
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true })
      ws.addEventListener('error', () => reject(new Error(`CDP: cannot connect to ${url}`)), { once: true })
    })
    return new Cdp(ws)
  }

  constructor(ws) {
    this.#ws = ws
    ws.addEventListener('message', (event) => this.#onMessage(JSON.parse(String(event.data))))
    ws.addEventListener('close', () => {
      for (const { reject } of this.#pending.values()) reject(new Error('CDP: connection closed'))
      this.#pending.clear()
    })
  }

  #onMessage(msg) {
    if (msg.id !== undefined) {
      const pending = this.#pending.get(msg.id)
      if (!pending) return
      this.#pending.delete(msg.id)
      if (msg.error) pending.reject(new Error(`${pending.method}: ${msg.error.message}${msg.error.data ? ` (${msg.error.data})` : ''}`))
      else pending.resolve(msg.result)
      return
    }
    const key = `${msg.sessionId ?? ''}|${msg.method}`
    for (const listener of [...(this.#listeners.get(key) ?? [])]) listener(msg.params)
  }

  send(method, params = {}, sessionId) {
    const id = this.#nextId++
    const message = { id, method, params }
    if (sessionId) message.sessionId = sessionId
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, method })
      this.#ws.send(JSON.stringify(message))
    })
  }

  on(method, listener, sessionId) {
    const key = `${sessionId ?? ''}|${method}`
    let set = this.#listeners.get(key)
    if (!set) this.#listeners.set(key, (set = new Set()))
    set.add(listener)
    return () => set.delete(listener)
  }

  /** Resolves with the next `method` event's params (optionally one matching `predicate`). */
  waitFor(method, { sessionId, predicate = () => true, timeout = 60_000 } = {}) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off()
        reject(new Error(`CDP: timed out waiting for ${method}`))
      }, timeout)
      const off = this.on(
        method,
        (params) => {
          if (!predicate(params)) return
          clearTimeout(timer)
          off()
          resolve(params)
        },
        sessionId,
      )
    })
  }

  session(sessionId) {
    return {
      id: sessionId,
      send: (method, params) => this.send(method, params, sessionId),
      on: (method, listener) => this.on(method, listener, sessionId),
      waitFor: (method, opts = {}) => this.waitFor(method, { ...opts, sessionId }),
    }
  }

  close() {
    try {
      this.#ws.close()
    } catch {
      // already closed
    }
  }
}

/**
 * Launches a headless browser with remote debugging on `port` and a throwaway profile.
 * Returns `{ cdp, close }`; `close()` kills the browser and removes the profile.
 */
export async function launchBrowser({ port, executable = findBrowser(), headless = true, extraArgs = [] }) {
  const profile = mkdtempSync(join(tmpdir(), 'settle-bench-'))
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-component-update',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-default-apps',
    '--disable-features=Translate,EdgeCollections,msEdgeShopping,msUndersideButton,msImplicitSignin,AutofillServerCommunication,OptimizationHints,MediaRouter',
    '--metrics-recording-only',
    '--mute-audio',
    '--password-store=basic',
    // Timers and rAF keep running at full speed in background targets.
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--window-size=412,915',
    ...(headless ? ['--headless=new'] : []),
    ...extraArgs,
    'about:blank',
  ]
  const child = spawn(executable, args, { stdio: 'ignore', windowsHide: true })
  let exited = false
  child.on('exit', () => {
    exited = true
  })

  let wsUrl = null
  for (let i = 0; i < 150 && !wsUrl; i++) {
    if (exited) throw new Error('Browser exited during launch')
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`)
      wsUrl = (await res.json()).webSocketDebuggerUrl
    } catch {
      await sleep(100)
    }
  }
  if (!wsUrl) throw new Error(`Browser did not open its debugging port ${port}`)
  const cdp = await Cdp.connect(wsUrl)

  const close = async () => {
    try {
      await Promise.race([cdp.send('Browser.close'), sleep(3000)])
    } catch {
      // ignore
    }
    cdp.close()
    if (!exited) {
      try {
        if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/F', '/T'], { stdio: 'ignore' })
        else child.kill('SIGKILL')
      } catch {
        // ignore
      }
    }
    for (let i = 0; i < 30; i++) {
      try {
        rmSync(profile, { recursive: true, force: true })
        break
      } catch {
        await sleep(200)
      }
    }
  }
  return { cdp, close }
}

/**
 * A fresh, isolated browser context (own cache, cookies, storage, service workers) with one
 * page target attached. Returns the page session plus `dispose()`.
 */
export async function newIsolatedPage(cdp) {
  const { browserContextId } = await cdp.send('Target.createBrowserContext', { disposeOnDetach: true })
  const page = await openPage(cdp, browserContextId)
  return {
    ...page,
    browserContextId,
    async dispose() {
      await page.close()
      try {
        await cdp.send('Target.disposeBrowserContext', { browserContextId })
      } catch {
        // already gone
      }
    },
  }
}

/** A new page target (in `browserContextId`, if given), attached with a flattened session. */
export async function openPage(cdp, browserContextId) {
  const { targetId } = await cdp.send('Target.createTarget', {
    url: 'about:blank',
    ...(browserContextId ? { browserContextId } : {}),
  })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  const session = cdp.session(sessionId)
  return {
    targetId,
    session,
    async close() {
      try {
        await cdp.send('Target.closeTarget', { targetId })
      } catch {
        // already closed
      }
    },
  }
}

/** Evaluates `expression` in the page and returns its value (awaiting promises). Throws page errors. */
export async function evaluate(session, expression, { timeout = 120_000 } = {}) {
  const result = await session.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout,
  })
  if (result.exceptionDetails) {
    const details = result.exceptionDetails
    throw new Error(`Page error: ${details.exception?.description ?? details.text}`)
  }
  return result.result.value
}
