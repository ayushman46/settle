/**
 * A traffic-shaping TCP proxy: the browser talks to it instead of the server, and it plays a
 * slow mobile link between them — one shared link per direction (parallel downloads queue for
 * the same bandwidth, as on a phone), half a round trip of delay each way, and the TCP + TLS 1.3
 * handshake (2 round trips) before a new connection's first request goes out. DevTools' own
 * network emulation isn't used: it doesn't delay the document request, and a page's settings
 * don't reach its service worker.
 */
import { createServer, connect } from 'node:net'

/** Bytes per slice on the wire: big writes are cut up so connections interleave. */
const SLICE = 16 * 1024

class Link {
  #bytesPerMs
  #oneWayMs
  #freeAt = 0

  constructor(bitsPerSecond, oneWayMs) {
    this.#bytesPerMs = bitsPerSecond / 8 / 1000
    this.#oneWayMs = oneWayMs
  }

  /** When `bytes` put on the link now arrive at the far end (performance.now() ms). */
  schedule(bytes) {
    const start = Math.max(performance.now(), this.#freeAt)
    this.#freeAt = start + bytes / this.#bytesPerMs
    return this.#freeAt + this.#oneWayMs
  }
}

/** Forwards `from` → `to` through `link`, strictly in order, holding everything until `readyAt`. */
function shape(from, to, link, readyAt = 0) {
  /** Slices on the link, oldest first: { at: delivery time, piece }. */
  const queue = []
  let timer = null
  let lastDelivery = 0

  const finish = () => {
    if (queue.length === 0 && from.readableEnded && !to.destroyed) to.end()
  }
  const drain = () => {
    timer = null
    const now = performance.now()
    while (queue.length > 0 && queue[0].at <= now + 0.5) {
      const { piece } = queue.shift()
      if (!to.destroyed) to.write(piece)
    }
    if (queue.length > 0) timer = setTimeout(drain, Math.max(0, queue[0].at - performance.now()))
    else finish()
  }
  const enqueue = (chunk) => {
    for (let offset = 0; offset < chunk.length; offset += SLICE) {
      const piece = chunk.subarray(offset, Math.min(chunk.length, offset + SLICE))
      lastDelivery = Math.max(link.schedule(piece.length), lastDelivery)
      queue.push({ at: lastDelivery, piece })
    }
    if (timer === null) timer = setTimeout(drain, Math.max(0, queue[0].at - performance.now()))
  }

  let held = []
  let holding = false
  from.on('data', (chunk) => {
    const wait = readyAt - performance.now()
    if (wait <= 0 && !holding) return enqueue(chunk)
    held.push(chunk)
    if (holding) return
    holding = true
    setTimeout(() => {
      holding = false
      const chunks = held
      held = []
      for (const c of chunks) enqueue(c)
    }, Math.max(0, wait))
  })
  from.on('end', () => {
    if (!holding && timer === null) finish()
  })
}

/**
 * Starts the proxy on `port`, forwarding to `targetPort` on 127.0.0.1 through a link of
 * `downKbps` / `upKbps` and `rttMs`. Returns `{ port, close, stats }`.
 */
export async function startThrottle({ port, targetPort, downKbps, upKbps, rttMs, handshakeRtts = 2 }) {
  const down = new Link(downKbps * 1000, rttMs / 2)
  const up = new Link(upKbps * 1000, rttMs / 2)
  const sockets = new Set()
  const stats = { connections: 0 }

  const server = createServer((client) => {
    stats.connections += 1
    const upstream = connect(targetPort, '127.0.0.1')
    sockets.add(client)
    sockets.add(upstream)
    client.setNoDelay(true)
    upstream.setNoDelay(true)
    shape(client, upstream, up, performance.now() + handshakeRtts * rttMs)
    shape(upstream, client, down)
    const destroy = () => {
      client.destroy()
      upstream.destroy()
      sockets.delete(client)
      sockets.delete(upstream)
    }
    client.on('error', destroy)
    upstream.on('error', destroy)
    // The browser hanging up ends both; the server hanging up ends the client once the bytes
    // still on the link have been delivered (see `shape`).
    client.on('close', destroy)
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  return {
    port,
    stats,
    /** Hangs up every open connection, so the next request pays for a fresh handshake. */
    reset() {
      for (const socket of sockets) socket.destroy()
      sockets.clear()
    },
    async close() {
      for (const socket of sockets) socket.destroy()
      await new Promise((resolve) => server.close(resolve))
    },
  }
}
