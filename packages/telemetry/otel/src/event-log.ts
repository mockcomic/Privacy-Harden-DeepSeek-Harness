/**
 * Ordinary-event channel that accepts records and does not transmit them.
 * @module @deepseek-ai/dsh-otel/event-log
 */
import type { SessionLogOptions } from './session-log.ts'
import type { LogExporterOptions } from './transport.ts'

/** Scalar values a caller may place in an event attribute. */
export type OTelEventScalar = string | number | boolean

/** Explicitly selected analytics fields. This channel does not send them. */
export interface OTelEventRecord {
  /** Product event name. */
  eventName: string
  /** Human-readable summary. */
  body: string
  /** Event occurrence time in Unix milliseconds. */
  timestamp: number
  /** Numeric severity; omitted values stay on the record and are not transmitted. */
  severityNumber?: number
  /** Business fields selected by the caller. */
  attributes?: Record<string, OTelEventScalar | Record<string, OTelEventScalar>>
}

/** Count-batching fields retained for existing compositions. They do not open a queue. */
export interface EventLogProcessorOptions {
  /** Unused maximum records per batch. */
  maxExportBatchSize?: number
  /** Unused maximum queued records. */
  maxQueueSize?: number
  /** Unused delay before a partial batch. */
  scheduledDelayMillis?: number
  /** Unused per-batch deadline. */
  exportTimeoutMillis?: number
}

/** Ordinary-event options. The exporter URL is not contacted. */
export interface EventLogOptions {
  /** Ignored destination. */
  exporter: LogExporterOptions
  /** Ignored resource attributes. */
  resourceAttributes: Record<string, string | number | boolean>
  /** Ignored instrumentation scope. */
  scope: { name: string; version?: string }
  /** Ignored queue settings. */
  processor: EventLogProcessorOptions
  /** Ignored diagnostic callback. */
  onFailure: SessionLogOptions['onFailure']
}

/** One caller-owned ordinary-event channel. `emit` drops the record locally. */
export class EventLogReporter {
  /**
   * Accept channel options without creating a transport.
   * @param _options - ignored destination, identity, and queue settings.
   */
  // Callers must pass the channel options; this channel does not retain them.
  // oxlint-disable-next-line no-useless-constructor -- required options stay unused
  constructor(_options: EventLogOptions) {}

  /**
   * Drop one event. No queue admission and no network delivery.
   * @param _record - the ordinary event, discarded.
   */
  emit(_record: OTelEventRecord): void {}

  /**
   * Finish a channel that has nothing to drain.
   * @param _signal - ignored cancellation signal.
   * @returns completion immediately.
   */
  shutdown(_signal?: AbortSignal): Promise<void> {
    return Promise.resolve()
  }
}
