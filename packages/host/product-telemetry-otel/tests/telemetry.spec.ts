import { createServer } from 'node:http'
import { once } from 'node:events'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import OTel from '@deepseek-ai/dsh-otel'
import ProductTelemetry, { Config } from '../src/index.ts'

const cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

function context() {
  const ctx = new Context()
  const ready = ctx.plugin(OTel)
  cleanup.push(async () => { await ready; await ctx.fiber.dispose() })
  return ctx
}

function config(overrides: Partial<Config> = {}): Config {
  return Config({ serviceName: 'synthetic-test', serviceVersion: '1', ...overrides })
}

describe('product telemetry stays local', () => {
  it('drops events without contacting a collector', async () => {
    let hits = 0
    const server = createServer((request, response) => {
      hits += 1
      request.resume()
      response.end('{}')
    })
    cleanup.push(async () => {
      const closed = once(server, 'close')
      server.close()
      server.closeAllConnections()
      await closed
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('collector has no port')
    const ctx = context()
    const fiber = await ctx.plugin(ProductTelemetry, config({
      endpoint: `http://127.0.0.1:${address.port}/v1/logs`,
      compression: 'gzip',
    }))
    ctx.productTelemetry.emit({ eventName: 'telemetry.synthetic', body: 'Synthetic test', timestamp: 1, severityNumber: 17 })
    await fiber.dispose()
    expect(ctx.get('productTelemetry')).toBeUndefined()
    expect(hits).toBe(0)
    expect(config().endpoint).toBeUndefined()
  })

  it('accepts https endpoints and omits the endpoint entirely', () => {
    expect(() => new ProductTelemetry(context(), config({ endpoint: 'https://collector.example/v1/logs' }))).not.toThrow()
    expect(() => new ProductTelemetry(context(), config())).not.toThrow()
  })

  it.each([
    { endpoint: 'broken' },
    { endpoint: 'ftp://collector.test/logs' },
    { channel: 'bad\nchannel' },
    { channel: '中文' },
    { maxExportBatchSize: 2, maxQueueSize: 1 },
  ])('rejects invalid configuration %j before exposing the service', (invalid) => {
    const ctx = context()
    expect(() => new ProductTelemetry(ctx, config(invalid))).toThrow()
    expect(ctx.get('productTelemetry')).toBeUndefined()
  })

  it.each([
    [{ endpoint: 'broken' }, 'endpoint must be a valid HTTP(S) URL'],
    [{ endpoint: 'ftp://collector.test/logs' }, 'endpoint must use HTTP or HTTPS'],
    [{ channel: 'bad\nchannel' }, 'channel must be a valid HTTP header value'],
    [{ maxExportBatchSize: 2, maxQueueSize: 1 }, 'maxExportBatchSize must not exceed maxQueueSize'],
  ] as const)('names invalid transport fields before registering the service', (invalid, message) => {
    const ctx = context()
    expect(() => new ProductTelemetry(ctx, config(invalid))).toThrow(`product-telemetry-otel: ${message}`)
  })
})
