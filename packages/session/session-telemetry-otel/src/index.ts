/**
 * Session telemetry backend that keeps feedback in the local session log.
 *
 * No mode constructs an exporter, reads a collector URL, or mints an anonymous user id.
 *
 * @module @deepseek-ai/dsh-session-telemetry-otel
 */

import z from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-command-feedback'
import type {} from '@deepseek-ai/dsh-message-feedback'
import { type Session, type SessionEvent } from '@deepseek-ai/dsh-session'
import {
  SessionTelemetryBackend,
  type SessionTelemetryRecord,
  type SessionTelemetrySharingStatus,
} from '@deepseek-ai/dsh-session-telemetry'

/** Session-sharing policy names still accepted from existing compositions. */
export enum SessionTelemetryMode {
  FEEDBACK_ONLY = 'FEEDBACK_ONLY',
  DISABLED = 'DISABLED',
}

/** Default policy. Every accepted mode stays local. */
export const DEFAULT_TELEMETRY_MODE = SessionTelemetryMode.DISABLED

const DISABLED_FEEDBACK_WARNING = 'OpenTelemetry session upload is DISABLED; this feedback is not uploaded through OpenTelemetry'

/** Only this Session's explicit feedback is warned about; fork seeds are not. */
function isFeedback(session: Session, event: SessionEvent): boolean {
  if (event.seq < session.inheritedEventCount) return false
  switch (event.type) {
    case 'feedback/record': return true
    case 'feedback/message-put':
    case 'feedback/message-delete': return event.data.sessionId === session.id
    default: return false
  }
}

/** Reject unknown runtime values. Accepted modes do not enable export. */
function resolveMode(mode: SessionTelemetryMode | undefined): void {
  const resolved = mode ?? DEFAULT_TELEMETRY_MODE
  switch (resolved) {
    case SessionTelemetryMode.FEEDBACK_ONLY:
    case SessionTelemetryMode.DISABLED:
      return
    default:
      return assertNever(resolved)
  }
}

/** Fail closed when direct construction bypasses the runtime config schema. */
function assertNever(value: never): never {
  throw new Error(`session-telemetry-otel: unsupported mode ${JSON.stringify(value)}`)
}

/**
 * Plugin configuration retained so existing compositions still load.
 * `exporter` and `processor` are ignored. `FULL` is rejected by the schema.
 */
export interface Config {
  /** Defaults to `DISABLED`. `FEEDBACK_ONLY` is accepted and still does not upload. */
  mode?: SessionTelemetryMode
  /** Ignored destination and transport settings. */
  exporter?: {
    /** Ignored logs URL. Export does not contact it. */
    url?: string
  }
  /** Ignored queue settings. */
  processor?: {
    /** Ignored maximum records per batch. */
    maxExportBatchSize?: number
    /** Ignored delay before a partial batch. */
    scheduledDelayMillis?: number
  }
  /** Ignored shutdown bound. */
  shutdownTimeoutMillis?: number
  /** Ignored request ceiling. */
  maxRequestBytes?: number
}

/**
 * Schemastery validator for {@link Config}. Uploading modes are not accepted
 * beyond the two local policies, and neither policy reads a collector URL.
 */
export const Config: z<Config> = z.object({
  mode: z.union(Object.values(SessionTelemetryMode)).default(DEFAULT_TELEMETRY_MODE),
  exporter: z.any(),
  processor: z.any(),
  shutdownTimeoutMillis: z.number(),
  maxRequestBytes: z.number(),
})

/**
 * Local session-telemetry service. It registers `sessionTelemetry` and warns
 * when new feedback stays on this machine.
 */
export class OpenTelemetrySessionBackend extends SessionTelemetryBackend {
  static inject = ['sessions', 'otel']
  static Config = Config

  override readonly sharing: SessionTelemetrySharingStatus = 'disabled'

  constructor(ctx: Context, config: Config) {
    resolveMode(config.mode)
    super(ctx)
    ctx.on('session/event', (session, event) => {
      if (isFeedback(session, event)) ctx.logger.warn(DISABLED_FEEDBACK_WARNING)
    })
  }

  /**
   * Drop a direct record. Nothing is queued or uploaded.
   * @param _record - the direct record, never uploaded.
   */
  emit(_record: SessionTelemetryRecord): void {}

  /**
   * Finish a backend that has no transport to drain.
   * @returns completion immediately.
   */
  shutdown(): Promise<void> {
    return Promise.resolve()
  }
}

export default OpenTelemetrySessionBackend
