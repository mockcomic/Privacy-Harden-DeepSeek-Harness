# Product telemetry

English | [中文](product-telemetry.zh.md)

The [product telemetry plugin](../../packages/host/product-telemetry-otel/README.md) sends explicitly selected analytics events through OTLP/HTTP. Its `productTelemetry` service owns submission only; product consumers own when an event occurs and which fields are approved. The exporter collects no Session data or identifiers automatically. The [Desktop analytics consumer](../../packages/client/product-analytics/README.md) selects interaction and live compaction events, adds available login identity, and follows the Desktop launch-time collection switch. Ordinary Web clients do not collect product events.

`ProductTelemetryRecord` requires an event name, string body, and Unix-millisecond timestamp. Attributes accept scalar strings, numbers, booleans, and one-level objects of those values (`ProductTelemetryScalar`). Optional severity uses OTel severity numbers and defaults to INFO. Observation time is assigned when the record is enqueued.

Enqueue is synchronous and does not acknowledge delivery. The SDK owns batching and retry; local diagnostics report export failures. See the package README for configuration, shutdown, and loss limits.

## Record types

```ts type-equiv
/** Scalar values accepted in product attributes. */
type ProductTelemetryScalar = OTelEventScalar
```

```ts type-equiv
/** Caller-selected ordinary analytics record. */
type ProductTelemetryRecord = OTelEventRecord
```

Source: [`packages/host/product-telemetry-otel/src/index.ts`](../../packages/host/product-telemetry-otel/src/index.ts)

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxproductanalytics--productanalytics"></a>

### `ctx.productAnalytics` — `ProductAnalytics`

Authenticated event intake; disabled instances do not inspect identity or accept new events.

```ts cordis-catalog
/**
 * Read the collection policy.
 * @returns whether this Host currently accepts Desktop analytics.
 */
@Remote enabled(): boolean

/**
 * Stream the effective policy initially and after live configuration edits.
 * @param signal - subscriber lifetime.
 * @returns current policy values until cancellation or service disposal.
 */
@Remote({ mode: 'stream' }) async *watchPolicy(signal: AbortSignal): AsyncIterable<boolean>

/**
 * Drop a Desktop analytics event. Identity is not read and nothing is exported.
 * @param _event - typed product event, discarded locally.
 * @returns immediately, without a delivery acknowledgement.
 */
@Remote async report(_event: ProductEvent): Promise<void>
```

Source: [`packages/client/product-analytics/src/index.ts`](../../packages/client/product-analytics/src/index.ts)

<a id="ctxproducttelemetry--producttelemetry"></a>

### `ctx.productTelemetry` — `ProductTelemetry`

Host analytics receiver. Mounting and `emit` send nothing.

```ts cordis-catalog
/**
 * Drop one selected product event. No exporter is constructed.
 * @param _record - caller-owned event, discarded locally.
 */
emit(_record: ProductTelemetryRecord): void
```

Source: [`packages/host/product-telemetry-otel/src/index.ts`](../../packages/host/product-telemetry-otel/src/index.ts)
<!-- END GENERATED cordis-surface -->
