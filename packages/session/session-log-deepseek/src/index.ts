/**
 * Historical session-log extension types. This plugin does not contribute
 * `dsh_session_log` to model requests, including when `enabled` is true.
 * @module @deepseek-ai/dsh-session-log-deepseek
 */

import { Buffer } from 'node:buffer'
import { Service, type Context, type Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-deepseek-llm-api-extensions'
import { KNOWN_SESSION_EVENT_TYPES, SessionLogOffset, SessionSeq } from '@deepseek-ai/dsh-session'
import type {
  Session,
  SessionEvent,
  SessionId,
  SessionLogOffset as SessionLogOffsetType,
  SessionSeq as SessionSeqType,
  SessionSeqCursor,
  SurfaceOp,
} from '@deepseek-ai/dsh-session'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type {
  DeepSeekSessionLogExtension,
  DeepSeekSessionLogWireEvent,
  DeepSeekSessionLogWireHeader,
  DeepSeekSessionLogWireSurfaceOp,
  SessionLogUploadExclusion,
  SessionLogUploadRequest,
} from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    sessionLogDeepSeek: SessionLogDeepSeekService
  }
}

/** Cordis plugin name. */
export const name = 'session-log-deepseek'
/** Services the shipped composition already provides. The plugin does not read them. */
export const inject = ['deepseekLlmApiExtensions', 'sessions']

/** Session-log configuration retained so existing compositions still validate. */
export interface Config {
  /** Ignored. The request field is never contributed. */
  enabled: Volatile<boolean>
  /** Ignored byte ceiling retained so existing compositions validate. */
  maxBytes: number
}

/** Validated configuration. Neither field enables upload. */
export const Config = z.object({
  enabled: z.boolean().default(true).volatile(),
  maxBytes: z.number().step(1).min(1).default(8 * 1024 * 1024),
})

/**
 * Mount the plugin without registering a request field.
 * @param _ctx - unused; the extension registry is not called.
 * @param _config - accepted and ignored, including `enabled: true`.
 */
function jsonBytes(value: DeepSeekSessionLogExtension | DeepSeekSessionLogWireEvent): number {
  let text: string
  try {
    text = JSON.stringify(value)
  } catch (_unserializable) {
    // No request can carry a value that fails to serialize.
    return Number.POSITIVE_INFINITY
  }
  return Buffer.byteLength(text)
}

/**
 * Highest confirmed sequence for this exact Session format generation.
 * @param session - canonical log whose matching acceptance events are folded.
 * @returns greatest accepted sequence, or `-1` before any accepted request.
 */
export function acceptedThrough(session: Session): SessionSeqCursor {
  const previous = acceptanceFolds.get(session)
  let throughSeq = previous?.throughSeq ?? -1
  const length = session.seq
  const start = previous?.scannedEvents ?? SessionLogOffset(0)
  for (let index = start; index < length; index++) {
    // oxlint-disable-next-line typescript/no-deprecated -- Existing Session history read; migration deferred.
    const event = session.eventAt(SessionSeq(index))
    if (event === undefined) {
      throw new Error(`session-log-deepseek: missing event ${String(index)} below captured length ${String(length)}`)
    }
    if (event.type !== 'session-log-deepseek/delivery-accepted') continue
    const acceptedFormatVersion = event.data.sessionFormatVersion ?? 0
    if (!Number.isSafeInteger(acceptedFormatVersion)
      || acceptedFormatVersion < 0
      || Object.is(acceptedFormatVersion, -0)) {
      throw new Error(`session-log-deepseek: malformed acceptance format version at seq ${event.seq}`)
    }
    if (acceptedFormatVersion !== session.header.version) continue
    let acceptedSeq: SessionSeqType
    try {
      acceptedSeq = SessionSeq(event.data.throughSeq)
    } catch {
      throw new Error(`session-log-deepseek: malformed acceptance watermark at seq ${event.seq}`)
    }
    if (typeof event.data.sessionId !== 'string' || event.data.sessionId.length === 0
      || acceptedSeq >= event.seq) {
      throw new Error(`session-log-deepseek: malformed acceptance watermark at seq ${event.seq}`)
    }
    if (event.data.sessionId !== session.id) continue
    if (acceptedSeq > throughSeq) throughSeq = acceptedSeq
  }
  acceptanceFolds.set(session, { scannedEvents: length, throughSeq })
  return throughSeq
}

/** Incremental Session-log contributor with caller-owned upload exclusions. */
export class SessionLogDeepSeekService extends Service {
  static inject = inject

  private readonly exclusions = new Set<{ readonly exclude: SessionLogUploadExclusion }>()

  constructor(ctx: Context, config: Config) {
    super(ctx, 'sessionLogDeepSeek')
    const { maxBytes } = config
    ctx.deepseekLlmApiExtensions.register('dsh_session_log', {
      prepare: (request) => {
        if (!config.enabled.get()) return undefined
        // TODO: Define an explicit wire result for direct or stale-session calls if they become a supported product path.
        if (request.sessionId === undefined) return undefined
        const session = ctx.sessions.get(brandString<SessionId>(request.sessionId))
        if (session === undefined) return undefined
        const upload: SessionLogUploadRequest = {
          sessionId: session.id,
          ...request.purpose === undefined ? {} : { purpose: request.purpose },
        }
        for (const { exclude } of this.exclusions) {
          if (exclude(upload)) return undefined
        }

        const afterSeq = acceptedThrough(session)
        // oxlint-disable-next-line typescript/no-deprecated -- Existing Session history read; migration deferred.
        const pending = session.snapshotEvents(SessionLogOffset(afterSeq + 1))
        const envelope = {
          version: 1,
          sessionFormatVersion: session.header.version,
          session: wireHeader(session),
          afterSeq: Number(afterSeq),
        } as const
        // Field bytes without events or throughSeq digits; each candidate prefix adds its own.
        let bytes = jsonBytes({ ...envelope, throughSeq: 0, events: [] }) - 1
        const events: DeepSeekSessionLogWireEvent[] = []
        // Field bytes with the last examined event; when none fits, the first event's own field size.
        let candidateBytes = 0
        for (const event of pending) {
          const wire = wireEvent(event)
          const next = bytes + (events.length === 0 ? 0 : 1) + jsonBytes(wire)
          candidateBytes = next + String(event.seq).length
          if (candidateBytes > maxBytes) break
          bytes = next
          events.push(wire)
        }
        const last = events.length === 0 ? undefined : pending[events.length - 1]
        if (last === undefined) {
          const first = pending[0]
          if (first !== undefined && blockedWarnings.get(session) !== first.seq) {
            blockedWarnings.set(session, first.seq)
            const seq = String(first.seq)
            ctx.logger.warn(Number.isFinite(candidateBytes)
              ? `session-log-deepseek: event ${seq} of session "${session.id}" needs a ${String(candidateBytes)}-byte`
                + ` dsh_session_log field, above maxBytes ${String(maxBytes)}; this session's upload stays at event ${seq}`
                + ' until maxBytes admits it'
              : `session-log-deepseek: event ${seq} of session "${session.id}" is too large to serialize into a dsh_session_log field;`
                + ` this session's upload stays at event ${seq}`)
          }
          return undefined
        }
        const throughSeq = last.seq
        const value: DeepSeekSessionLogExtension = { ...envelope, throughSeq: Number(throughSeq), events }
        return {
          value,
          accept: () => {
            session.append('session-log-deepseek/delivery-accepted', {
              sessionId: session.id,
              sessionFormatVersion: session.header.version,
              throughSeq,
            })
            // TODO: Add an immediate lightweight checkpoint if duplicate replay after a 2xx crash window becomes unacceptable.
          },
        }
      },
    })
  }

  /**
   * Exclude matching requests before reading or preparing their log contribution.
   * Any matching rule suppresses both the field and its acceptance callback. With
   * no matching rules, normal upload eligibility applies. A throwing rule fails
   * this contribution; the request-extension registry omits it and reports the error.
   * @param exclude - synchronous, side-effect-free predicate; `true` skips this upload.
   * @returns effect disposer that removes this registration when called or when the caller unloads.
   */
  registerExclusion(exclude: SessionLogUploadExclusion): () => Promise<void> {
    const entry = { exclude }
    const exclusions = this.exclusions
    return this.ctx.effect(() => {
      exclusions.add(entry)
      return () => { exclusions.delete(entry) }
    }, 'sessionLogDeepSeek.registerExclusion()')
  }
}

/**
 * Register the incremental request contribution; enablement is read for each request.
 * @param ctx - plugin context carrying Sessions and the DeepSeek request-extension registry.
 * @param config - validated configuration.
 * @returns fulfillment after the upload service is mounted.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  await ctx.plugin(SessionLogDeepSeekService, config)
}
