import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScanResponse } from '../../../shared/api'
import { ImageError, prepareImage, type PreparedImage } from '../../lib/image'
import type * as ImageModule from '../../lib/image'
import { navigate } from '../../app/router'
import { peekSplitPrefill, resetDataForTests } from '../../data'
import { aiUsedToday, AI_USAGE_KEY, localDay, resetQuotaForTests } from '../../pro/quota'
import { resetProModulesForTests } from '../../pro/testKit'
import { paywallState, resetPaywallForTests } from '../pro/paywall'
import { readEntry, resetFlowHistory } from '../../state/backStack'
import { resetHealthForTests } from '../../state/health'
import { getPhoto, setPhoto } from '../../state/photo'
import { useFlow } from '../../state/store'
import { createSession } from '../../state/reducer'
import { ReviewScreen } from './ReviewScreen'
import { ScanScreen } from './ScanScreen'
import { AISHA, assignAll, BEN, historyIdle, renderScreen, sampleSession } from './screenTestKit'

vi.mock('../../lib/image', async (importOriginal) => {
  const actual: typeof ImageModule = await importOriginal()
  return { ...actual, prepareImage: vi.fn() }
})

const prepareMock = vi.mocked(prepareImage)

/** Home + review, so tests can follow a scan through to the next step. */
function Flow() {
  const { step } = useFlow()
  if (step === 'scan') return <ScanScreen />
  if (step === 'review') return <ReviewScreen />
  return <h1>{step} step</h1>
}

const SCANNED: ScanResponse = {
  merchant: 'Cafe Mocha',
  date: '2026-10-19',
  currency: 'INR',
  items: [
    { name: 'Cappuccino', quantity: 2, amount: 360 },
    { name: 'Club Sandwich', quantity: 1, amount: 295 },
  ],
  subtotal: 655,
  tax: 32.75,
  serviceCharge: null,
  discount: null,
  tip: null,
  total: 688,
  category: 'food',
  warnings: [],
  model: 'test-model',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

interface PendingScan {
  body: unknown
  signal: AbortSignal | null
  respond: (response: Response) => void
}

/** Mocks the API: `/api/health` answers at once; each `/api/scan` waits until the test responds. */
function mockApi({ configured = true }: { configured?: boolean } = {}) {
  const scans: PendingScan[] = []
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.endsWith('/api/health')) return Promise.resolve(json({ ok: true, configured, models: ['test-model'] }))
    if (url.endsWith('/api/scan')) {
      return new Promise<Response>((resolve, reject) => {
        const signal = init?.signal ?? null
        const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        scans.push({ body, signal, respond: resolve })
      })
    }
    return Promise.resolve(new Response('Not found', { status: 404 }))
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, scans }
}

function preparedImage(n = 1): PreparedImage {
  return {
    dataUrl: 'data:image/jpeg;base64,/9j/AAAA',
    previewUrl: `blob:test-photo-${n}`,
    width: 800,
    height: 1200,
    bytes: 1234,
  }
}

const photoFile = () => new File(['fake-jpeg'], 'bill.jpg', { type: 'image/jpeg' })

function galleryInput(): HTMLInputElement {
  return screen.getByLabelText('Choose a photo of the bill', { selector: 'input' })
}

/** Picks a photo the way the browser does after the file dialog closes. */
function choosePhoto(file: File = photoFile()): void {
  fireEvent.change(galleryInput(), { target: { files: [file] } })
}

async function healthLoaded(): Promise<void> {
  await waitFor(() => expect(screen.queryByRole('button', { name: /Scan a bill|Type the items in/ })).toBeInTheDocument())
}

const revoked: string[] = []
const originalRevoke = URL.revokeObjectURL

beforeEach(() => {
  resetDataForTests()
  resetQuotaForTests()
  resetProModulesForTests()
  resetPaywallForTests()
  resetFlowHistory()
  window.history.replaceState(null, '')
  resetHealthForTests()
  setPhoto(null)
  prepareMock.mockReset()
  revoked.length = 0
  URL.revokeObjectURL = (url: string) => {
    revoked.push(url)
  }
})

afterEach(async () => {
  await historyIdle()
  setPhoto(null)
  URL.revokeObjectURL = originalRevoke
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ScanScreen — home', () => {
  it('leads with scanning, plus typing it in and a sample', async () => {
    mockApi()
    renderScreen(<ScanScreen />, createSession('INR'))
    await healthLoaded()

    expect(screen.getByRole('heading', { level: 1, name: 'Scan a bill' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Scan a bill' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Upload a photo' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Type it in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try a sample' })).toBeInTheDocument()
    // Camera input opens the rear camera on phones; the upload one is a plain picker.
    expect(screen.getByLabelText('Take a photo of the bill', { selector: 'input' })).toHaveAttribute('capture', 'environment')
    expect(galleryInput()).not.toHaveAttribute('capture')
    expect(galleryInput()).toHaveAttribute('accept', 'image/*')
    // Nothing in progress → no resume card.
    expect(screen.queryByText('Pick up where you left off')).not.toBeInTheDocument()
  })

  it('"Try a sample" opens the review step with the sample items', async () => {
    mockApi()
    const { user, probe } = renderScreen(<Flow />, createSession('INR'))
    await user.click(await screen.findByRole('button', { name: 'Try a sample' }))

    expect(probe.current.step).toBe('review')
    expect(probe.current.source).toBe('sample')
    expect(screen.getByRole('heading', { level: 1, name: 'Check the items' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Edit Paneer Tikka/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rename bill, Saffron Table' })).toBeInTheDocument()
    expect(getPhoto()).toBeNull()
  })

  it('"Type it in" starts an empty bill with the item editor already open', async () => {
    mockApi()
    const { user, probe } = renderScreen(<Flow />, createSession('INR'))
    await user.click(await screen.findByRole('button', { name: 'Type it in' }))

    expect(probe.current.step).toBe('review')
    expect(probe.current.source).toBe('manual')
    expect(probe.current.items).toEqual([])
    const dialog = screen.getByRole('dialog', { name: 'Add an item' })
    expect(within(dialog).getByRole('textbox', { name: 'Item' })).toHaveFocus()
  })

  it('without scanning on the server, promotes typing the items in', async () => {
    mockApi({ configured: false })
    renderScreen(<ScanScreen />, createSession('INR'))

    expect(
      await screen.findByText('Photo scanning is off right now — typing a bill in takes about a minute.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/server/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Type the items in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try a sample bill' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Scan a bill' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Upload a photo' })).not.toBeInTheDocument()
    // The pitch matches what's on offer: no "snap it" without a camera button.
    expect(screen.getByText('Type the items in, tap who had what — tax, tips and discounts are shared fairly.')).toBeInTheDocument()
    expect(screen.queryByText(/Snap it/)).not.toBeInTheDocument()
  })

  it('a returning visitor whose server can’t scan gets the typing-first layout on the first paint', async () => {
    // First visit: the server says scanning is off (remembered on this device).
    mockApi({ configured: false })
    const first = renderScreen(<ScanScreen />, createSession('INR'))
    await screen.findByRole('button', { name: 'Type the items in' })
    first.unmount()

    // Next visit: the health check is still on its way.
    resetHealthForTests()
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    renderScreen(<ScanScreen />, createSession('INR'))
    expect(screen.getByRole('button', { name: 'Type the items in' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Scan a bill' })).not.toBeInTheDocument()
  })

  it('moves keyboard focus to "Type the items in" when the photo buttons it was on disappear', async () => {
    let answer: (response: Response) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            answer = resolve
          }),
      ),
    )
    const { user } = renderScreen(<ScanScreen />, createSession('INR'))
    // Nothing known yet: optimistic photo buttons. A keyboard user is sitting on "Scan a bill".
    const scan = screen.getByRole('button', { name: 'Scan a bill' })
    scan.focus()
    await user.keyboard('{Shift}')
    expect(scan).toHaveFocus()

    await act(async () => {
      answer(json({ ok: true, configured: false, models: [] }))
    })
    expect(await screen.findByRole('button', { name: 'Type the items in' })).toHaveFocus()
  })

  it('offline: says so, offers the offline paths, and brings scanning back when online', async () => {
    mockApi()
    const onLine = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    renderScreen(<ScanScreen />, createSession('INR'))

    expect(screen.getByText("You're offline")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Type the items in' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Scan a bill' })).not.toBeInTheDocument()

    onLine.mockReturnValue(true)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await healthLoaded()
    expect(screen.getByRole('button', { name: 'Scan a bill' })).toBeInTheDocument()
    expect(screen.queryByText("You're offline")).not.toBeInTheDocument()
  })
})

describe('ScanScreen — scanning', () => {
  it('shows the photo with a live status while reading, then opens review with the photo kept', async () => {
    const { scans } = mockApi()
    prepareMock.mockResolvedValue(preparedImage())
    const vibrate = vi.fn()
    Object.defineProperty(window.navigator, 'vibrate', { value: vibrate, configurable: true })
    const { probe } = renderScreen(<Flow />, createSession('INR'))
    await healthLoaded()

    choosePhoto()
    expect(await screen.findByRole('heading', { level: 1, name: 'Reading your bill' })).toBeInTheDocument()
    await waitFor(() => expect(scans).toHaveLength(1))
    expect(screen.getByRole('img', { name: 'The bill being read' })).toHaveAttribute('src', 'blob:test-photo-1')
    expect(screen.getByText('Reading the bill…')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(scans[0]?.body).toEqual({ image: 'data:image/jpeg;base64,/9j/AAAA' })

    await act(async () => {
      scans[0]?.respond(json(SCANNED))
    })

    await screen.findByRole('heading', { level: 1, name: 'Check the items' })
    expect(probe.current.source).toBe('scan')
    expect(probe.current.meta.merchant).toBe('Cafe Mocha')
    expect(probe.current.items.map((i) => [i.name, i.quantity, i.amount])).toEqual([
      ['Cappuccino', 2, 36000],
      ['Club Sandwich', 1, 29500],
    ])
    expect(getPhoto()).toEqual({ previewUrl: 'blob:test-photo-1' })
    expect(screen.getByRole('button', { name: 'View photo' })).toBeInTheDocument()
    expect(revoked).not.toContain('blob:test-photo-1')
    expect(vibrate).toHaveBeenCalledWith([12, 60, 24])
    delete (window.navigator as { vibrate?: unknown }).vibrate
  })

  it('a busy server is "busy right now", and only the per-device limit is "too many scans"', async () => {
    const { scans } = mockApi()
    prepareMock.mockResolvedValue(preparedImage())
    const { user } = renderScreen(<Flow />, createSession('INR'))
    await healthLoaded()
    const limited = (retryAfter: string) =>
      new Response(JSON.stringify({ error: { code: 'rate_limited', message: 'x' } }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': retryAfter },
      })

    choosePhoto()
    await waitFor(() => expect(scans).toHaveLength(1))
    await act(async () => scans[0]?.respond(limited('10')))
    let alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Busy right now')
    expect(alert).toHaveTextContent('Lots of bills are being read right now — try again in a moment.')
    expect(alert).not.toHaveTextContent('Too many scans')

    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(scans).toHaveLength(2))
    await act(async () => scans[1]?.respond(limited('480')))
    alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Too many scans')
    expect(alert).toHaveTextContent('Try again in about 8 minutes — or type the items in.')
  })

  it('a timeout explains itself and "Try again" re-sends the same photo', async () => {
    const { scans } = mockApi()
    prepareMock.mockResolvedValue(preparedImage())
    const { user } = renderScreen(<Flow />, createSession('INR'))
    await healthLoaded()

    choosePhoto()
    await waitFor(() => expect(scans).toHaveLength(1))
    await act(async () => {
      scans[0]?.respond(
        json({ error: { code: 'timeout', message: 'Reading the bill took too long. Try again.' } }, 504),
      )
    })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('That took too long')
    // Our own copy, whatever the server says.
    expect(alert).toHaveTextContent('Reading the bill took too long. Try again with a sharper, closer photo.')
    expect(within(alert).getByRole('button', { name: 'Type it in' })).toBeInTheDocument()

    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Reading your bill' })).toBeInTheDocument()
    await waitFor(() => expect(scans).toHaveLength(2))
    expect(prepareMock).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('img', { name: 'The bill being read' })).toHaveAttribute('src', 'blob:test-photo-1')
  })

  it('"not a bill" offers another photo, and frees the rejected one', async () => {
    const { scans } = mockApi()
    prepareMock.mockResolvedValue(preparedImage())
    renderScreen(<Flow />, createSession('INR'))
    await healthLoaded()

    choosePhoto()
    await waitFor(() => expect(scans).toHaveLength(1))
    await act(async () => {
      scans[0]?.respond(
        json({ error: { code: 'not_a_bill', message: "That doesn't look like a bill." } }, 422),
      )
    })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("That doesn't look like a bill.")
    expect(within(alert).getByRole('button', { name: 'Try another photo' })).toBeInTheDocument()
    expect(within(alert).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    expect(revoked).toContain('blob:test-photo-1')
  })

  it('a rejected scanning key switches the rest of the visit to typing the bill in', async () => {
    const { scans } = mockApi()
    prepareMock.mockResolvedValue(preparedImage())
    renderScreen(<ScanScreen />, createSession('INR'))
    await healthLoaded()
    expect(screen.getByRole('button', { name: 'Scan a bill' })).toBeInTheDocument()

    choosePhoto()
    await waitFor(() => expect(scans).toHaveLength(1))
    await act(async () => {
      scans[0]?.respond(json({ error: { code: 'upstream_auth', message: 'Scanning is unavailable.' } }, 502))
    })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Photo scanning is off right now — typing a bill in takes about a minute.')
    expect(within(alert).getByRole('button', { name: 'Type it in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Type the items in' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Scan a bill' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Upload a photo' })).not.toBeInTheDocument()
  })

  it("shows the image's own friendly message when a photo can't be used", async () => {
    mockApi()
    prepareMock.mockRejectedValue(new ImageError('decode_failed'))
    renderScreen(<ScanScreen />, createSession('INR'))
    await healthLoaded()

    choosePhoto()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("That photo didn't work")
    expect(alert).toHaveTextContent("We couldn't open that image.")
  })

  it('a result with no usable items and no total counts as unreadable', async () => {
    const { scans } = mockApi()
    prepareMock.mockResolvedValue(preparedImage())
    const { probe } = renderScreen(<ScanScreen />, createSession('INR'))
    await healthLoaded()

    choosePhoto()
    await waitFor(() => expect(scans).toHaveLength(1))
    await act(async () => {
      scans[0]?.respond(json({ ...SCANNED, items: [{ name: '   ', quantity: 1, amount: 10 }], total: null }))
    })
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't read that bill")
    expect(probe.current.step).toBe('scan')
  })

  it('Cancel stops the request and returns home quietly', async () => {
    const { scans } = mockApi()
    prepareMock.mockResolvedValue(preparedImage())
    const { user, probe } = renderScreen(<ScanScreen />, createSession('INR'))
    await healthLoaded()

    choosePhoto()
    await waitFor(() => expect(scans).toHaveLength(1))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Scan a bill' })).toBeInTheDocument()
    expect(scans[0]?.signal?.aborted).toBe(true)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(probe.current.step).toBe('scan')
    expect(revoked).toContain('blob:test-photo-1')
  })

  it('the system Back button cancels a scan instead of leaving the app', async () => {
    const { scans } = mockApi()
    prepareMock.mockResolvedValue(preparedImage())
    renderScreen(<ScanScreen />, createSession('INR'))
    await healthLoaded()

    choosePhoto()
    await waitFor(() => expect(scans).toHaveLength(1))
    await historyIdle()
    expect(readEntry(window.history.state)).toMatchObject({ step: 'scan', sheet: true })

    await act(async () => {
      window.history.back()
      await historyIdle()
    })
    await screen.findByRole('heading', { level: 1, name: 'Scan a bill' })
    expect(scans[0]?.signal?.aborted).toBe(true)
    expect(readEntry(window.history.state)).toEqual({ step: 'scan', depth: 0, sheet: false })
  })

  it('offline when a photo is picked: no upload, a clear message', async () => {
    const { scans } = mockApi()
    prepareMock.mockResolvedValue(preparedImage())
    renderScreen(<ScanScreen />, createSession('INR'))
    await healthLoaded()

    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    choosePhoto()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("You're offline — you can still type the items in.")
    expect(scans).toHaveLength(0)
    expect(prepareMock).not.toHaveBeenCalled()
  })
})

describe('ScanScreen — desktop', () => {
  it('a pasted screenshot is scanned', async () => {
    const { scans } = mockApi()
    prepareMock.mockResolvedValue(preparedImage())
    renderScreen(<ScanScreen />, createSession('INR'))
    await healthLoaded()

    const paste = new Event('paste', { cancelable: true })
    Object.defineProperty(paste, 'clipboardData', { value: { files: [photoFile()] } })
    act(() => {
      window.dispatchEvent(paste)
    })
    expect(paste.defaultPrevented).toBe(true)
    expect(await screen.findByRole('heading', { level: 1, name: 'Reading your bill' })).toBeInTheDocument()
    await waitFor(() => expect(scans).toHaveLength(1))
  })

  it('a photo dragged onto the page shows a drop hint and is scanned when dropped', async () => {
    const { scans } = mockApi()
    prepareMock.mockResolvedValue(preparedImage())
    renderScreen(<ScanScreen />, createSession('INR'))
    await healthLoaded()

    const dragEvent = (type: string) => {
      const event = new Event(type, { cancelable: true })
      Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'], files: [photoFile()], dropEffect: 'none' } })
      return event
    }
    act(() => {
      window.dispatchEvent(dragEvent('dragenter'))
    })
    expect(screen.getByText('Drop the photo to scan it')).toBeInTheDocument()

    const drop = dragEvent('drop')
    act(() => {
      window.dispatchEvent(drop)
    })
    expect(drop.defaultPrevented).toBe(true)
    expect(screen.queryByText('Drop the photo to scan it')).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: 'Reading your bill' })).toBeInTheDocument()
    await waitFor(() => expect(scans).toHaveLength(1))
  })

  it('Escape cancels a scan', async () => {
    const { scans } = mockApi()
    prepareMock.mockResolvedValue(preparedImage())
    const { user } = renderScreen(<ScanScreen />, createSession('INR'))
    await healthLoaded()

    choosePhoto()
    await waitFor(() => expect(scans).toHaveLength(1))
    await user.keyboard('{Escape}')
    expect(screen.getByRole('heading', { level: 1, name: 'Scan a bill' })).toBeInTheDocument()
    expect(scans[0]?.signal?.aborted).toBe(true)
  })
})

describe('ScanScreen — starting over a bill in progress', () => {
  /** The sample bill with people, shares and a payer: real work that a new bill would replace. */
  function busySession() {
    const base = sampleSession('scan', { people: [AISHA, BEN], payerId: 'a' })
    return { ...base, assignments: assignAll(base, { a: 1, b: 1 }) }
  }

  it('asks before "Try a sample" or "Type it in" replace it; "Keep it" changes nothing', async () => {
    mockApi()
    const before = busySession()
    const { user, probe } = renderScreen(<Flow />, before)
    await healthLoaded()

    for (const name of ['Try a sample', 'Type it in']) {
      await user.click(screen.getByRole('button', { name }))
      const dialog = screen.getByRole('dialog', { name: 'Start a new bill?' })
      expect(dialog).toHaveAccessibleDescription('Saffron Table (8 items) will be replaced. The people you added stay.')
      await user.click(within(dialog).getByRole('button', { name: 'Keep it' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(probe.current).toEqual(before)
    }

    await user.click(screen.getByRole('button', { name: 'Try a sample' }))
    await user.click(screen.getByRole('button', { name: 'Start new bill' }))
    expect(probe.current.step).toBe('review')
    expect(probe.current.id).not.toBe(before.id)
    expect(probe.current.assignments).toEqual({})
    expect(probe.current.payerId).toBeNull()
  })

  it('"Scan a bill" asks first, then opens the camera from the confirming tap', async () => {
    mockApi()
    const { user } = renderScreen(<ScanScreen />, busySession())
    await healthLoaded()
    const camera = screen.getByLabelText('Take a photo of the bill', { selector: 'input' })
    const click = vi.spyOn(camera, 'click')

    await user.click(screen.getByRole('button', { name: 'Scan a bill' }))
    expect(click).not.toHaveBeenCalled()
    await user.click(within(screen.getByRole('dialog', { name: 'Start a new bill?' })).getByRole('button', { name: 'Start new bill' }))
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('a pasted photo waits for the go-ahead, then is scanned', async () => {
    const { scans } = mockApi()
    prepareMock.mockResolvedValue(preparedImage())
    const { user } = renderScreen(<ScanScreen />, busySession())
    await healthLoaded()

    const paste = new Event('paste', { cancelable: true })
    Object.defineProperty(paste, 'clipboardData', { value: { files: [photoFile()] } })
    act(() => {
      window.dispatchEvent(paste)
    })
    const dialog = screen.getByRole('dialog', { name: 'Start a new bill?' })
    expect(prepareMock).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Start new bill' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Reading your bill' })).toBeInTheDocument()
    await waitFor(() => expect(scans).toHaveLength(1))
  })

  it('with nothing in progress, starts straight away', async () => {
    mockApi()
    const { user, probe } = renderScreen(<Flow />, createSession('INR'))
    await user.click(await screen.findByRole('button', { name: 'Try a sample' }))
    expect(screen.queryByRole('dialog', { name: 'Start a new bill?' })).not.toBeInTheDocument()
    expect(probe.current.step).toBe('review')
  })

  it('puts the bill in progress first, instead of the illustration', async () => {
    mockApi()
    renderScreen(<ScanScreen />, busySession())
    // Straight to the bill in progress, then the title.
    const [first, second] = Array.from(screen.getByRole('main').children)
    expect(first).toHaveTextContent('Pick up where you left off')
    expect(second).toContainElement(screen.getByRole('heading', { level: 1 }))
  })
})

describe('ScanScreen — resume card', () => {
  it('continues the bill in progress where it was left', async () => {
    mockApi()
    const { user, probe } = renderScreen(<ScanScreen />, sampleSession('scan', { people: [AISHA, BEN] }))

    expect(screen.getByText('Pick up where you left off')).toBeInTheDocument()
    expect(screen.getByText('Saffron Table')).toBeInTheDocument()
    expect(screen.getByText(/8 items · ₹2,299\.00/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Aisha and Ben' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(probe.current.step).toBe('review')
  })

  it('discarding asks first, then clears the bill', async () => {
    mockApi()
    const { user, probe } = renderScreen(<ScanScreen />, sampleSession('scan', { people: [AISHA, BEN] }))

    await user.click(screen.getByRole('button', { name: 'Discard this bill' }))
    const dialog = screen.getByRole('dialog', { name: 'Discard this bill?' })
    await user.click(within(dialog).getByRole('button', { name: 'Keep it' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(probe.current.items).toHaveLength(8)

    await user.click(screen.getByRole('button', { name: 'Discard this bill' }))
    await user.click(screen.getByRole('button', { name: 'Discard bill' }))
    expect(probe.current.items).toEqual([])
    expect(probe.current.people).toEqual([])
    expect(screen.queryByText('Pick up where you left off')).not.toBeInTheDocument()
    expect(screen.getByText('Bill discarded')).toBeInTheDocument()
  })
})

describe('ScanScreen — v3', () => {
  /** The flow opened from Home: `/app`, then `/app/bill` pushed over it. */
  function openFromHome(): void {
    window.history.replaceState(null, '', '/app')
    navigate('/app/bill')
  }

  it('the back arrow leaves the flow for the screen it was opened from', async () => {
    mockApi()
    openFromHome()
    const { user, probe } = renderScreen(<ScanScreen />, sampleSession('scan'))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await historyIdle()
    expect(window.location.pathname).toBe('/app')
    // The bill in progress is kept for later.
    expect(probe.current.items).toHaveLength(8)
  })

  it('keeps the category the scan read on the bill', async () => {
    const { scans } = mockApi()
    prepareMock.mockResolvedValue(preparedImage())
    const { probe } = renderScreen(<Flow />, createSession('INR'))
    await healthLoaded()
    choosePhoto()
    await waitFor(() => expect(scans).toHaveLength(1))
    await act(async () => {
      scans[0]?.respond(json({ ...SCANNED, category: 'groceries' }))
    })
    await screen.findByRole('heading', { level: 1, name: 'Check the items' })
    expect(probe.current.category).toBe('groceries')
  })

  it('a bill with just a total becomes a prefilled quick split, leaving the bill in progress alone', async () => {
    const { scans } = mockApi()
    prepareMock.mockResolvedValue(preparedImage())
    openFromHome()
    const before = createSession('INR')
    const { probe } = renderScreen(<ScanScreen />, before)
    await healthLoaded()

    choosePhoto()
    await waitFor(() => expect(scans).toHaveLength(1))
    await act(async () => {
      scans[0]?.respond(
        json({
          ...SCANNED,
          merchant: 'BESCOM',
          date: '2026-10-05',
          items: [],
          subtotal: null,
          tax: null,
          total: 1847,
          category: 'utilities',
        }),
      )
    })
    await historyIdle()

    expect(window.location.pathname + window.location.search).toBe('/app/split/new?from=scan')
    expect(peekSplitPrefill()).toEqual({
      title: 'BESCOM',
      total: 184700,
      currency: 'INR',
      category: 'utilities',
      date: '2026-10-05',
      source: 'scan',
    })
    expect(probe.current).toBe(before)
    expect(revoked).toContain('blob:test-photo-1')
    expect(getPhoto()).toBeNull()
    expect(aiUsedToday()).toBe(1)
    // Back from the quick split returns to Home: the scan step was replaced.
    window.history.back()
    await waitFor(() => expect(window.location.pathname).toBe('/app'))
  })

  it('counts each successful scan against the free daily AI allowance, and says how many are left', async () => {
    const { scans } = mockApi()
    prepareMock.mockResolvedValue(preparedImage())
    renderScreen(<Flow />, createSession('INR'))
    await healthLoaded()
    expect(await screen.findByText('3 of 3 free AI splits left today')).toBeInTheDocument()

    choosePhoto()
    await waitFor(() => expect(scans).toHaveLength(1))
    await act(async () => {
      scans[0]?.respond(json(SCANNED))
    })
    await screen.findByRole('heading', { level: 1, name: 'Check the items' })
    expect(aiUsedToday()).toBe(1)
  })

  it('a scan that fails costs nothing', async () => {
    const { scans } = mockApi()
    prepareMock.mockResolvedValue(preparedImage())
    renderScreen(<ScanScreen />, createSession('INR'))
    await healthLoaded()
    choosePhoto()
    await waitFor(() => expect(scans).toHaveLength(1))
    await act(async () => {
      scans[0]?.respond(json({ error: { code: 'not_a_bill', message: 'x' } }, 422))
    })
    await screen.findByRole('alert')
    expect(aiUsedToday()).toBe(0)
    expect(screen.getByText('3 of 3 free AI splits left today')).toBeInTheDocument()
  })

  it('out of free AI splits for today: offers Pro, and typing the bill in', async () => {
    mockApi()
    window.localStorage.setItem(AI_USAGE_KEY, JSON.stringify({ day: localDay(), used: 3 }))
    resetQuotaForTests()
    const { user } = renderScreen(<ScanScreen />, createSession('INR'))
    await healthLoaded()

    expect(screen.getByText("That's today's free AI splits")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Scan a bill' })).not.toBeInTheDocument()
    expect(screen.queryByText(/free AI splits left today/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Type the items in' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Get unlimited with Pro' }))
    expect(paywallState()).toMatchObject({ open: true, request: { feature: 'unlimited_ai' } })
  })
})

