/**
 * Asks NVIDIA's OpenAI-compatible chat-completions API for JSON: reading a bill photo
 * (`extractBill`) or a sentence (`completeJson`, used by describe.ts).
 *
 * Models are tried in order. We fall back to the next one on failures another model
 * might not have (unknown model, 4xx/5xx, capacity, network, timeout, unusable output) and
 * fail fast on ones no model can fix (rejected key, rate limit, the caller going away).
 * All attempts share one time budget that ends before the client gives up, so the user
 * always gets our answer rather than a generic timeout.
 */
import { SCAN_BUDGET_MS } from '../shared/api'
import { redactSecrets, type ServerConfig } from './config'
import { extractJson } from './parse'
import { BILL_SCHEMA, SYSTEM_PROMPT, USER_PROMPT } from './prompt'

export type UpstreamErrorKind =
  /** No API key configured. */
  | 'not_configured'
  /** 401/403: the key was rejected — no model will work. */
  | 'auth'
  /** 429 from NVIDIA. */
  | 'rate_limited'
  /** A model took longer than `timeoutMs`, or the scan ran out of its time budget. */
  | 'timeout'
  /** The caller's signal fired (the client disconnected). */
  | 'aborted'
  /** The model answered, but not with a usable bill. */
  | 'bad_output'
  /** 404, other 4xx, 5xx (capacity included) or a network failure. */
  | 'unavailable'

interface UpstreamErrorDetails {
  model?: string | null
  status?: number | null
  /** Start of the upstream error body (redacted), for server logs only. */
  detail?: string
  /** Seconds, from NVIDIA's Retry-After header. */
  retryAfter?: number | null
  cause?: unknown
}

export class UpstreamError extends Error {
  override readonly name = 'UpstreamError'
  readonly kind: UpstreamErrorKind
  readonly model: string | null
  readonly status: number | null
  readonly detail: string
  readonly retryAfter: number | null

  constructor(kind: UpstreamErrorKind, message: string, details: UpstreamErrorDetails = {}) {
    super(message, details.cause === undefined ? undefined : { cause: details.cause })
    this.kind = kind
    this.model = details.model ?? null
    this.status = details.status ?? null
    this.detail = details.detail ?? ''
    this.retryAfter = details.retryAfter ?? null
  }
}

export interface CompletionOptions {
  /** Aborts every attempt (wire it to the client's request so a disconnect stops the work). */
  signal?: AbortSignal
  /**
   * Whether a parsed reply is good enough. When it returns false the next model is tried;
   * the reply is still returned if no other model does better.
   */
  accept?: (raw: unknown) => boolean
  /** Called for every failed attempt that we recover from or fall back after. */
  onAttemptFailed?: (error: UpstreamError) => void
}

export interface ExtractOptions extends CompletionOptions {
  /** Time for all attempts together, in ms. Defaults to `SCAN_BUDGET_MS` (the client waits a little longer). */
  budgetMs?: number
}

/** One kind of JSON request: which models, how long, what to send and how to read the answer. */
export interface CompletionTask {
  /** What the JSON describes, for log messages: "bill", "split". */
  noun: string
  models: readonly string[]
  /** Time limit for one attempt, in ms. */
  timeoutMs: number
  /** Time for all attempts together, in ms. */
  budgetMs: number
  /** With less time than this left, no new attempt starts: we report what we have. */
  minAttemptMs: number
  /** The chat-completions request body for one attempt; `structured` asks for `response_format`. */
  body: (model: string, structured: boolean) => Record<string, unknown>
  /** Finds the JSON answer in a reply. Throws when there is none. */
  parse: (content: string) => unknown
}

export interface ExtractResult {
  /** The JSON object the model produced (not yet validated — see `parse.ts`). */
  raw: unknown
  model: string
}

const MAX_TOKENS = 4096
/** How much of an upstream error body we keep for logs. */
const MAX_DETAIL_CHARS = 600
const SCHEMA_REJECTION = /response_format|json_schema|guided|schema/i
/** A model that is out of capacity right now: another model may well have room. */
const CAPACITY = /resource[\s_-]?exhausted|out of capacity|overloaded/i
/** With less time than this left, another model can't read a bill: report what we have. */
const MIN_SCAN_ATTEMPT_MS = 5_000
/** How long we remember that a model refused `response_format`. */
const PROMPT_ONLY_MEMORY_MS = 60 * 60_000
const FAIL_FAST: ReadonlySet<UpstreamErrorKind> = new Set(['not_configured', 'auth', 'rate_limited', 'aborted'])
/** When every model fails, the most informative failure wins. */
const SEVERITY: Record<UpstreamErrorKind, number> = {
  unavailable: 0,
  bad_output: 1,
  timeout: 2,
  rate_limited: 3,
  auth: 4,
  aborted: 5,
  not_configured: 6,
}

/** The chat-completions request body for one attempt. */
export function buildRequestBody(model: string, dataUrl: string, structured: boolean): Record<string, unknown> {
  return {
    model,
    temperature: 0.1,
    top_p: 0.95,
    max_tokens: MAX_TOKENS,
    stream: false,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: USER_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    ...(structured
      ? { response_format: { type: 'json_schema', json_schema: { name: 'bill', strict: true, schema: BILL_SCHEMA } } }
      : {}),
    // Nemotron reasons before answering by default; we want the JSON straight away.
    ...(/nemotron/i.test(model) ? { chat_template_kwargs: { enable_thinking: false } } : {}),
  }
}

/**
 * Models (per API base URL) that refused `response_format`, and until when we skip it for
 * them, so later scans don't pay for the refusal again. Not forever: a refusal can come
 * from a passing backend problem ("guided decoding backend failed").
 */
const promptOnlyUntil = new Map<string, number>()
const promptOnlyKey = (config: ServerConfig, model: string) => `${config.baseUrl} ${model}`

function prefersPromptOnly(config: ServerConfig, model: string): boolean {
  const until = promptOnlyUntil.get(promptOnlyKey(config, model))
  return until !== undefined && until > Date.now()
}

/** Forgets which models refused `response_format` (tests). */
export function forgetPromptOnlyModels(): void {
  promptOnlyUntil.clear()
}

/**
 * Asks each configured vision model in turn to read the bill, within `budgetMs` overall.
 * @throws UpstreamError when no model produced a parseable bill.
 */
export async function extractBill(config: ServerConfig, dataUrl: string, options: ExtractOptions = {}): Promise<ExtractResult> {
  const { budgetMs = SCAN_BUDGET_MS, ...rest } = options
  return completeJson(
    config,
    {
      noun: 'bill',
      models: config.models,
      timeoutMs: config.timeoutMs,
      budgetMs,
      minAttemptMs: MIN_SCAN_ATTEMPT_MS,
      body: (model, structured) => buildRequestBody(model, dataUrl, structured),
      parse: extractJson,
    },
    rest,
  )
}

/**
 * Runs one JSON task: each model in turn (and the same model again without `response_format`
 * if it refuses that), within the task's time budget.
 * @throws UpstreamError when no model produced a parseable answer.
 */
export async function completeJson(config: ServerConfig, task: CompletionTask, options: CompletionOptions = {}): Promise<ExtractResult> {
  const { signal, accept, onAttemptFailed } = options
  if (config.apiKey === null) throw new UpstreamError('not_configured', 'NVIDIA_API_KEY is not set.')

  const deadline = Date.now() + task.budgetMs
  let worst: UpstreamError | null = null
  let lastResort: ExtractResult | null = null
  let attempts = 0
  let outOfTime = false

  models: for (const model of task.models) {
    let structured = !prefersPromptOnly(config, model)
    for (;;) {
      if (signal?.aborted) throw new UpstreamError('aborted', 'The request was cancelled.', { model })
      const remaining = deadline - Date.now()
      if (attempts > 0 && remaining < task.minAttemptMs) {
        outOfTime = true
        break models
      }
      attempts++
      try {
        const timeoutMs = Math.max(1, Math.min(task.timeoutMs, remaining))
        const content = await complete(config, model, task.body(model, structured), timeoutMs, signal)
        const raw = parseReply(content, model, task)
        if (accept && !accept(raw)) {
          lastResort ??= { raw, model }
          throw new UpstreamError('bad_output', `${model} returned a ${task.noun} without anything usable.`, { model })
        }
        return { raw, model }
      } catch (caught) {
        const error = caught instanceof UpstreamError ? caught : unexpected(caught, model)
        if (FAIL_FAST.has(error.kind)) {
          // A readable-but-weak answer from an earlier model beats a key/quota error now.
          if (lastResort === null || error.kind === 'aborted') throw error
          onAttemptFailed?.(error)
          return lastResort
        }
        onAttemptFailed?.(error)
        if (structured && isSchemaRejection(error)) {
          promptOnlyUntil.set(promptOnlyKey(config, model), Date.now() + PROMPT_ONLY_MEMORY_MS)
          structured = false // same model again, JSON by prompt only
          continue
        }
        if (worst === null || SEVERITY[error.kind] > SEVERITY[worst.kind]) worst = error
        break
      }
    }
  }

  if (lastResort) return lastResort
  if (worst) throw worst
  if (outOfTime) throw new UpstreamError('timeout', `No model finished the ${task.noun} within ${task.budgetMs} ms.`)
  throw new UpstreamError('unavailable', 'No NVIDIA models are configured.')
}

function isSchemaRejection(error: UpstreamError): boolean {
  return (error.status === 400 || error.status === 422) && SCHEMA_REJECTION.test(error.detail)
}

function parseReply(content: string, model: string, task: CompletionTask): unknown {
  try {
    return task.parse(content)
  } catch (error) {
    throw new UpstreamError('bad_output', `${model} replied without ${task.noun} JSON.`, {
      model,
      detail: content.slice(0, MAX_DETAIL_CHARS),
      cause: error,
    })
  }
}

function unexpected(error: unknown, model: string): UpstreamError {
  return new UpstreamError('unavailable', `Unexpected failure calling ${model}: ${describe(error)}`, { model, cause: error })
}

/** One chat-completions call with its own timeout, linked to the caller's signal. */
async function complete(
  config: ServerConfig,
  model: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  signal: AbortSignal | undefined,
): Promise<string> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort(new Error(`Timed out after ${timeoutMs} ms`))
  }, timeoutMs)
  const onAbort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', onAbort, { once: true })
  if (signal?.aborted) onAbort()

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey ?? ''}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) throw await httpError(response, model, config.apiKey)

    let payload: unknown
    try {
      payload = await response.json()
    } catch (error) {
      if (controller.signal.aborted) throw error
      throw new UpstreamError('bad_output', `${model} sent a response that isn't JSON.`, { model, status: response.status, cause: error })
    }
    return readContent(payload, model)
  } catch (error) {
    if (error instanceof UpstreamError) throw error
    if (timedOut) throw new UpstreamError('timeout', `${model} took longer than ${timeoutMs} ms.`, { model, cause: error })
    if (signal?.aborted) throw new UpstreamError('aborted', 'The request was cancelled.', { model, cause: error })
    throw new UpstreamError('unavailable', `Couldn't reach NVIDIA for ${model}: ${describe(error)}`, { model, cause: error })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

async function httpError(response: Response, model: string, apiKey: string | null): Promise<UpstreamError> {
  const { status } = response
  let detail = ''
  try {
    detail = redactSecrets((await response.text()).slice(0, MAX_DETAIL_CHARS), apiKey)
  } catch {
    // The body is only for logs; a timeout while reading it is reported by the caller.
  }
  // "ResourceExhausted" is one model being full (NVIDIA sends it as a 503, sometimes a 429 or
  // 403): another model may have room, so it's never a key problem or a reason to stop.
  const kind: UpstreamErrorKind = CAPACITY.test(detail)
    ? 'unavailable'
    : status === 401 || status === 403
      ? 'auth'
      : status === 429
        ? 'rate_limited'
        : 'unavailable'
  return new UpstreamError(kind, `${model} answered HTTP ${status}.`, {
    model,
    status,
    detail,
    retryAfter: parseRetryAfter(response.headers.get('retry-after')),
  })
}

function parseRetryAfter(value: string | null): number | null {
  if (value === null) return null
  const seconds = Number(value.trim())
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds)
  const date = Date.parse(value)
  return Number.isNaN(date) ? null : Math.max(0, Math.ceil((date - Date.now()) / 1000))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `choices[0].message.content` as text (string or an array of text parts). Ignores reasoning. */
export function readContent(payload: unknown, model: string): string {
  const choices = isRecord(payload) ? payload.choices : undefined
  const choice: unknown = Array.isArray(choices) ? choices[0] : undefined
  const message = isRecord(choice) ? choice.message : undefined
  const content = isRecord(message) ? message.content : undefined

  let text = ''
  if (typeof content === 'string') text = content
  else if (Array.isArray(content)) {
    text = content
      .map((part) => (isRecord(part) && typeof part.text === 'string' && (part.type === undefined || /text/.test(String(part.type))) ? part.text : ''))
      .join('')
  } else if (isRecord(content)) text = JSON.stringify(content)

  if (text.trim() === '') throw new UpstreamError('bad_output', `${model} returned an empty reply.`, { model })
  return text
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? ` (${error.cause.message})` : ''
    return `${error.name}: ${error.message}${cause}`
  }
  return String(error)
}
