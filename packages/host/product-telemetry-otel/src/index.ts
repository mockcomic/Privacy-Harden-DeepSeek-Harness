/** Product analytics service that accepts events and does not export them. */
import { validateHeaderValue } from 'node:http'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { OTelEventRecord, OTelEventScalar } from '@deepseek-ai/dsh-otel'

declare module '@deepseek-ai/cordis' {
  interface Context { productTelemetry: ProductTelemetry }
}

/** Caller-selected ordinary analytics record. `emit` drops it locally. */
export type ProductTelemetryRecord = OTelEventRecord
/** Scalar values accepted in product attributes. */
export type ProductTelemetryScalar = OTelEventScalar

/** Collector routing, application identity, and batch settings retained for existing compositions. */
export interface Config {
  /** Optional HTTP(S) logs URL. When set, it is validated and then not contacted. */
  endpoint?: string
  /** Collector routing header retained for composition compatibility. It is not sent. */
  channel: string
  /** Resource service.name supplied by the application composition. Not transmitted. */
  serviceName: string
  /** Resource service.version supplied by the application composition. Not transmitted. */
  serviceVersion: string
  /** Ignored compression selection. */
  compression?: 'none' | 'gzip'
  /** Ignored maximum records per export. Must not exceed maxQueueSize when both are set. */
  maxExportBatchSize: number
  /** Ignored maximum queued records. */
  maxQueueSize: number
  /** Ignored partial-batch delay. */
  scheduledDelayMillis: number
  /** Ignored HTTP deadline. */
  timeoutMillis: number
  /** Ignored per-batch deadline. */
  exportTimeoutMillis: number
  /** Ignored drain deadline. */
  shutdownTimeoutMillis: number
}

const positiveInteger = () => z.number().step(1).min(1).max(2_147_483_647)

/** Loader validation. There is no default collector URL. */
export const Config: z<Partial<Config>, Config> = z.object({
  endpoint: z.string(),
  channel: z.string().min(1).default('dsh_otel_report'),
  serviceName: z.string().required(),
  serviceVersion: z.string().required(),
  compression: z.union(['none', 'gzip']),
  maxExportBatchSize: positiveInteger().default(512),
  maxQueueSize: positiveInteger().default(2048),
  scheduledDelayMillis: positiveInteger().default(30000),
  timeoutMillis: positiveInteger().default(15000),
  exportTimeoutMillis: positiveInteger().default(20000),
  shutdownTimeoutMillis: positiveInteger().default(21000),
})

/** Host analytics receiver. Mounting and `emit` send nothing. */
export default class ProductTelemetry extends Service {
  static inject = ['otel']
  static Config = Config

  constructor(ctx: Context, config: Config) {
    if (config.endpoint !== undefined) {
      let endpoint: URL
      try {
        endpoint = new URL(config.endpoint)
      } catch (cause) {
        throw new Error('product-telemetry-otel: endpoint must be a valid HTTP(S) URL', { cause })
      }
      if (!['http:', 'https:'].includes(endpoint.protocol)) {
        throw new Error('product-telemetry-otel: endpoint must use HTTP or HTTPS')
      }
    }
    try {
      validateHeaderValue('x-channel', config.channel)
    } catch (cause) {
      throw new Error('product-telemetry-otel: channel must be a valid HTTP header value', { cause })
    }
    if (config.maxExportBatchSize > config.maxQueueSize) {
      throw new Error('product-telemetry-otel: maxExportBatchSize must not exceed maxQueueSize')
    }
    super(ctx, 'productTelemetry')
  }

  /**
   * Drop one selected product event. No exporter is constructed.
   * @param _record - caller-owned event, discarded locally.
   */
  emit(_record: ProductTelemetryRecord): void {}
}
