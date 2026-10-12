# OTel reporting

English | [中文](otel.zh.md)

The [OTel plugin](../../packages/telemetry/otel/README.md) registers `ctx.otel`, a shared factory for independent ordinary-event and Session-log channels. It owns transport and SDK batching implementations. Business consumers inject the service, supply explicit transport/resource/scope options, and own each returned channel's shutdown.

UI feedback reaches the Session feedback services through their existing Remote APIs. Feedback recording authorizes the Session adapter's canonical-prefix capture and redaction before it reports through an OTel channel. Ordinary product consumers submit selected fields through the product adapter. The shared service has no automatic identity or capture policy, and channels never share queues or requests.

The [product adapter](../../packages/host/product-telemetry-otel/README.md) and [Session adapter](../../packages/session/session-telemetry-otel/README.md) retain their deployment configuration and disposal deadlines. Consumers must not reuse a channel after shutdown. Mounting only the OTel service allocates no provider or transport.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxotel--otel"></a>

### `ctx.otel` — `OTel`

Shared channel factory. Mounting creates no queue, identity, or network connection.

```ts cordis-catalog
/**
 * Create an ordinary-event channel that drops records locally.
 * @param options - ignored destination, scope, resource, and queue settings.
 * @returns the caller-owned channel; it does not send.
 */
createEventReporter(options: EventLogOptions): EventLogReporter

/**
 * Create a Session-log channel that drops records locally after validating queue limits.
 * @param options - destination, scope, resource, and queue settings. Only the limits are enforced.
 * @returns the caller-owned channel; it does not send.
 */
createSessionLogReporter(options: SessionLogOptions): SessionLogReporter
```

Source: [`packages/telemetry/otel/src/index.ts`](../../packages/telemetry/otel/src/index.ts)
<!-- END GENERATED cordis-surface -->
