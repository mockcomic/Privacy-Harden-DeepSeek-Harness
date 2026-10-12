import { createServer } from 'node:http'
import { once } from 'node:events'
import { afterEach, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SessionId, SessionSeq } from '@deepseek-ai/dsh-session'
import OTel from '../src/index.ts'
import { createLogExporter, OUTBOUND_REPORTING_DISABLED } from '../src/transport.ts'
import {
  resolveSessionLogLimits,
  SESSION_LOG_MAX_REQUEST_BYTES,
  type SessionLogRecord,
} from '../src/session-log.ts'

const cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

it.each([0, -1, 1.5, SESSION_LOG_MAX_REQUEST_BYTES + 1, Infinity])('rejects byte limit %s', (maxRequestBytes) => {
  expect(() => { resolveSessionLogLimits({ maxRequestBytes }) }).toThrow(/maxRequestBytes/)
})

it.each(['maxQueueSize', 'maxExportBatchSize', 'scheduledDelayMillis', 'exportTimeoutMillis'] as const)('rejects invalid %s', (key) => {
  expect(() => { resolveSessionLogLimits({ processor: { [key]: 0 } }) }).toThrow(key)
})

it('rejects a batch larger than the queue and accepts the default ceiling', () => {
  expect(() => { resolveSessionLogLimits({ processor: { maxQueueSize: 1, maxExportBatchSize: 2 } }) }).toThrow(/maxExportBatchSize/)
  expect(resolveSessionLogLimits({})).toBe(SESSION_LOG_MAX_REQUEST_BYTES)
})

it('drops session logs locally and refuses the low-level exporter', async () => {
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
  const url = `http://127.0.0.1:${address.port}/v1/logs`
  expect(() => { createLogExporter({ url }) }).toThrow(OUTBOUND_REPORTING_DISABLED)

  const ctx = new Context()
  cleanup.push(() => ctx.fiber.dispose())
  await ctx.plugin(OTel)
  const record: SessionLogRecord = {
    sessionId: SessionId('synthetic-session'),
    event: { type: 'user/message', seq: SessionSeq(0), time: 1, data: { text: 'local only' } },
  }
  const sessionLogs = ctx.otel.createSessionLogReporter({
    exporter: { url },
    scope: { name: 'session-test' },
    resourceAttributes: { 'service.name': 'test' },
    onFailure: () => undefined,
  })
  sessionLogs.reportSessionLog(record)
  sessionLogs.stopPending()
  await sessionLogs.shutdown()
  const events = ctx.otel.createEventReporter({
    exporter: { url },
    resourceAttributes: {},
    scope: { name: 'event-test' },
    processor: {},
    onFailure: () => undefined,
  })
  events.emit({ eventName: 'synthetic', body: 'local', timestamp: 1 })
  await events.shutdown()
  expect(hits).toBe(0)
})
