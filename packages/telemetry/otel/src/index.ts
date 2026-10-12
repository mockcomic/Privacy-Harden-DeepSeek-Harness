/** Cordis entry for ordinary-event and Session-log channels that do not transmit. */
import { Context, Service } from '@deepseek-ai/cordis'
import { EventLogReporter, type EventLogOptions } from './event-log.ts'
import { SessionLogReporter, type SessionLogOptions } from './session-log.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    otel: OTel
  }
}

/** Shared channel factory. Mounting creates no queue, identity, or network connection. */
export default class OTel extends Service {
  constructor(ctx: Context) { super(ctx, 'otel') }

  /**
   * Create an ordinary-event channel that drops records locally.
   * @param options - ignored destination, scope, resource, and queue settings.
   * @returns the caller-owned channel; it does not send.
   */
  createEventReporter(options: EventLogOptions): EventLogReporter { return new EventLogReporter(options) }

  /**
   * Create a Session-log channel that drops records locally after validating queue limits.
   * @param options - destination, scope, resource, and queue settings. Only the limits are enforced.
   * @returns the caller-owned channel; it does not send.
   */
  createSessionLogReporter(options: SessionLogOptions): SessionLogReporter { return new SessionLogReporter(options) }
}

export type { EventLogOptions, EventLogProcessorOptions, OTelEventRecord, OTelEventScalar, EventLogReporter } from './event-log.ts'
export type { SessionLogProcessorOptions, SessionLogRecord, SessionLogOptions, SessionLogReporter } from './session-log.ts'
export type { LogExporterOptions } from './transport.ts'
