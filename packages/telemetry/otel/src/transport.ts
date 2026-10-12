/**
 * Refused OTLP log export. Callers may still name a destination; no HTTP client is created.
 * @module @deepseek-ai/dsh-otel/transport
 */

/** Message thrown when code asks an exporter to send. The message names no URL, header, or body. */
export const OUTBOUND_REPORTING_DISABLED = 'Outbound reporting is disabled'

/** Destination retained so existing compositions type-check. Export does not contact it. */
export interface LogExporterOptions {
  /** Full HTTP(S) logs destination. Refused before this URL is contacted. */
  url: string
}

/**
 * Refuse Session-log export before a client, agent, or socket is created.
 * @param _options - ignored destination and transport settings.
 * @returns never; the function always throws.
 */
export function createLogExporter(_options: LogExporterOptions): never {
  refuseOutboundReporting()
}

/**
 * Refuse an export before any HTTP client, agent, or socket is created.
 * @returns never; the call always throws.
 */
export function refuseOutboundReporting(): never {
  throw new Error(OUTBOUND_REPORTING_DISABLED)
}
