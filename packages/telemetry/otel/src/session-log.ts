/**
 * Session-log channel that validates queue limits and does not transmit events.
 * @module @deepseek-ai/dsh-otel/session-log
 */
import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import { type LogExporterOptions } from './transport.ts'

/** Former collector request ceiling, retained as the validation upper bound. */
export const SESSION_LOG_MAX_REQUEST_BYTES = 4_000_000

/** One canonical event. Reporting drops it locally. */
export interface SessionLogRecord {
  /** Session that owns the event. */
  sessionId: SessionId
  /** Complete event envelope. */
  event: Omit<SessionEvent, 'data'> & { data: unknown }
  /** Additional capture metadata. Not transmitted. */
  attributes?: Record<string, unknown>
  /** Omitted values stay unset. */
  severityNumber?: number
}

/** Queue fields accepted from existing compositions. They do not schedule exports. */
export interface SessionLogProcessorOptions {
  /** Unused maximum queued records. */
  maxQueueSize?: number
  /** Unused maximum records per batch. */
  maxExportBatchSize?: number
  /** Unused delay before a partial batch. */
  scheduledDelayMillis?: number
  /** Unused per-request deadline. */
  exportTimeoutMillis?: number
}

/** Session-log options. The exporter URL is not contacted. */
export interface SessionLogOptions {
  /** Ignored destination. */
  exporter: LogExporterOptions
  /** Optional queue settings, validated and then unused. */
  processor?: SessionLogProcessorOptions
  /** May lower, but never exceed, {@link SESSION_LOG_MAX_REQUEST_BYTES}. */
  maxRequestBytes?: number
  /** Ignored instrumentation scope. */
  scope: { name: string; version?: string }
  /** Ignored resource attributes. */
  resourceAttributes: Record<string, string | number | boolean>
  /** Unused diagnostic callback. Export has no transport failure to report. */
  onFailure: (message: string, error?: Error) => void
}

/**
 * Validate byte and queue settings.
 * @param options - Session-specific limits supplied by the owning composition.
 * @returns the resolved request limit.
 */
export function resolveSessionLogLimits(options: Pick<SessionLogOptions, 'maxRequestBytes' | 'processor'>): number {
  const limit = options.maxRequestBytes ?? SESSION_LOG_MAX_REQUEST_BYTES
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > SESSION_LOG_MAX_REQUEST_BYTES) {
    throw new Error(`session log maxRequestBytes must be an integer between 1 and ${SESSION_LOG_MAX_REQUEST_BYTES}`)
  }
  for (const key of ['maxQueueSize', 'maxExportBatchSize', 'scheduledDelayMillis', 'exportTimeoutMillis'] as const) {
    const value = options.processor?.[key]
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647)) {
      throw new Error(`session log processor.${key} must be a positive integer no greater than 2147483647`)
    }
  }
  const queue = options.processor?.maxQueueSize ?? 2048
  const batch = options.processor?.maxExportBatchSize ?? 512
  if (batch > queue) throw new Error('session log maxExportBatchSize must not exceed maxQueueSize')
  return limit
}

/** Owns a Session-log channel that does not send. */
export class SessionLogReporter {
  /**
   * Validate limits without creating a transport.
   * @param options - destination, identity, and queue settings. Only the limits are read.
   */
  constructor(options: SessionLogOptions) {
    resolveSessionLogLimits(options)
  }

  /**
   * Drop one event. No queue admission and no network delivery.
   * @param _record - event discarded locally.
   */
  reportSessionLog(_record: SessionLogRecord): void {}

  /** No queued request exists to stop. */
  stopPending(): void {}

  /**
   * Finish a channel that has nothing to drain.
   * @returns completion immediately.
   */
  shutdown(): Promise<void> {
    return Promise.resolve()
  }
}
