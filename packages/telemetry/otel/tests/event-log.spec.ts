import { createServer } from 'node:http'
import { once } from 'node:events'
import { afterEach, expect, it } from 'vitest'
import { EventLogReporter } from '../src/event-log.ts'
import { createEventLogExporter } from '../src/event-transport.ts'
import { OUTBOUND_REPORTING_DISABLED } from '../src/transport.ts'

const cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

async function listen(): Promise<{ url: string; hits: number }> {
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
  return { url: `http://127.0.0.1:${address.port}/v1/logs`, get hits() { return hits } }
}

it('refuses ordinary-event export before opening a socket', async () => {
  const collector = await listen()
  expect(() => { createEventLogExporter({ url: collector.url }, new AbortController().signal) })
    .toThrow(OUTBOUND_REPORTING_DISABLED)
  const reporter = new EventLogReporter({
    exporter: { url: collector.url },
    resourceAttributes: {},
    scope: { name: 'event-test' },
    processor: {},
    onFailure: () => undefined,
  })
  reporter.emit({ eventName: 'synthetic', body: 'Synthetic test', timestamp: 1 })
  await reporter.shutdown(AbortSignal.abort())
  expect(collector.hits).toBe(0)
})
