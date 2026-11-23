import OTel from '@deepseek-ai/dsh-otel'
import { createServer, type Server } from 'node:http'
import { once } from 'node:events'
import { afterEach, expect, it } from 'vitest'
import { recordFeedback } from '@deepseek-ai/dsh-command-feedback'
import { Context } from '@deepseek-ai/cordis'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import OpenTelemetrySessionBackend, { SessionTelemetryMode } from '../src/index.ts'

const servers: Server[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.close((error) => { if (error === undefined) resolve(); else reject(error) })
    server.closeAllConnections()
  })))
})

it.each(['mock', 'deepseek-official', 'unknown-provider', undefined])(
  'does not export feedback for provider %s',
  async (provider) => {
    const captures: string[] = []
    const server = createServer((request, response) => {
      const chunks: Buffer[] = []
      request.on('data', chunk => chunks.push(chunk as Buffer))
      request.on('end', () => {
        captures.push(Buffer.concat(chunks).toString())
        response.writeHead(200).end('{}')
      })
    })
    servers.push(server)
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('collector has no port')

    const ctx = new Context()
    ctx.plugin(OTel)
    try {
      await ctx.plugin(SessionStore)
      const fiber = await ctx.plugin(OpenTelemetrySessionBackend, {
        mode: SessionTelemetryMode.FEEDBACK_ONLY,
        exporter: { url: `http://127.0.0.1:${address.port}/v1/logs` },
      })
      const session = ctx.sessions.create(SessionId('egress'), { meta: { cwd: process.cwd() } })
      if (provider !== undefined) {
        session.append('request/header', { header: { config: { provider, model: 'm' } }, reason: 'initial' })
      }
      session.append('turn/start', { turn: 1 })
      recordFeedback(session, { text: 'explicit egress feedback' })
      await fiber.dispose()
      expect(captures).toEqual([])
    } finally {
      await ctx.fiber.dispose()
    }
  },
)
