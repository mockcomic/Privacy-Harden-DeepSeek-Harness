/**
 * Refused ordinary-event export. No HTTP client is constructed.
 * @module @deepseek-ai/dsh-otel/event-transport
 */
import { type LogExporterOptions, refuseOutboundReporting } from './transport.ts'

/**
 * Refuse ordinary-event export before a client, agent, or socket is created.
 * @param _options - ignored destination and transport settings.
 * @param _signal - ignored cancellation signal.
 * @returns never; the function always throws.
 */
export function createEventLogExporter(_options: LogExporterOptions, _signal: AbortSignal): never {
  refuseOutboundReporting()
}
