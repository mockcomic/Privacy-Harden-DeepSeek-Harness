import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, expectTypeOf, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { MessageId } from '@deepseek-ai/dsh-llm/brand'
import { recordFeedback } from '@deepseek-ai/dsh-command-feedback'
import OTel from '@deepseek-ai/dsh-otel'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import { ANONYMOUS_USER_ID_FILE_NAME } from '@deepseek-ai/dsh-anonymous-user-id'
import OpenTelemetrySessionBackend, { Config, DEFAULT_TELEMETRY_MODE, SessionTelemetryMode } from '../src/index.ts'

const cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
  vi.restoreAllMocks()
})

async function boot(home: string) {
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = home
  cleanup.push(async () => {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  })
  const ctx = new Context()
  cleanup.push(() => ctx.fiber.dispose())
  ctx.plugin(OTel)
  await ctx.plugin(SessionStore)
  const fiber = await ctx.plugin(OpenTelemetrySessionBackend, { mode: SessionTelemetryMode.FEEDBACK_ONLY, exporter: { url: 'https://collector.example/v1/logs' } })
  return { ctx, fiber }
}

it('keeps every accepted mode local and does not mint an anonymous user id', async () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-telemetry-local-'))
  cleanup.push(async () => { rmSync(home, { recursive: true, force: true }) })
  const { ctx } = await boot(home)
  const warn = vi.spyOn(ctx.logger, 'warn')
  const session = ctx.sessions.create(SessionId('local-feedback'))
  session.append('turn/start', { turn: 1 })
  recordFeedback(session, { text: 'stays on this machine' })
  session.append('feedback/message-put', {
    sessionId: session.id,
    item: { messageId: MessageId('m'), rating: 'positive', version: 'v' as never, createdAt: 1, updatedAt: 1 },
  })
  session.append('feedback/message-delete', { sessionId: session.id, messageId: MessageId('m') })
  session.append('feedback/message-delete', { sessionId: SessionId('other'), messageId: MessageId('m') })
  session.append('feedback/message-put', {
    sessionId: SessionId('other'),
    item: { messageId: MessageId('m'), rating: 'negative', version: 'v' as never, createdAt: 1, updatedAt: 1 },
  })
  expect(warn).toHaveBeenCalledTimes(3)
  const child = ctx.sessions.fork(session, undefined, SessionId('child'))
  const inherited = child.snapshotEvents().find(event => event.type === 'feedback/record')
  if (inherited === undefined) throw new Error('fork dropped parent feedback')
  warn.mockClear()
  ctx.emit('session/event', child, inherited)
  expect(warn).not.toHaveBeenCalled()
  recordFeedback(session, { text: 'second local note' })
  expect(warn).toHaveBeenCalledWith('OpenTelemetry session upload is DISABLED; this feedback is not uploaded through OpenTelemetry')
  expect(ctx.sessionTelemetry.sharing).toBe('disabled')
  ctx.sessionTelemetry.emit({ channel: 'ops', time: 1, severity: 'info', body: {}, attributes: {} })
  await ctx.sessionTelemetry.shutdown()
  expect(existsSync(join(home, ANONYMOUS_USER_ID_FILE_NAME))).toBe(false)
})

it('uses the same local policy when mode is omitted or explicitly disabled', async () => {
  const ctx = new Context()
  cleanup.push(() => ctx.fiber.dispose())
  ctx.plugin(OTel)
  await ctx.plugin(SessionStore)
  const omitted = await ctx.plugin(OpenTelemetrySessionBackend, {})
  expect(ctx.sessionTelemetry.sharing).toBe('disabled')
  await omitted.dispose()
  await ctx.plugin(OpenTelemetrySessionBackend, { mode: SessionTelemetryMode.DISABLED, exporter: { url: 'not a url' } })
  expect(ctx.sessionTelemetry.sharing).toBe('disabled')
})

it('rejects unknown modes before reading transport settings', async () => {
  expect(DEFAULT_TELEMETRY_MODE).toBe(SessionTelemetryMode.DISABLED)
  expect(Object.values(SessionTelemetryMode)).toEqual(['FEEDBACK_ONLY', 'DISABLED'])
  expectTypeOf<Config['mode']>().toEqualTypeOf<SessionTelemetryMode | undefined>()
  expectTypeOf<'FULL'>().not.toExtend<SessionTelemetryMode>()
  expect(Config({}).mode).toBe(SessionTelemetryMode.DISABLED)
  expect(() => Config({ mode: 'FULL' } as unknown as Config)).toThrow()

  const ctx = new Context()
  cleanup.push(() => ctx.fiber.dispose())
  ctx.plugin(OTel)
  await ctx.plugin(SessionStore)
  let exporterRead = false
  const config = {
    mode: 'FULL',
    get exporter() {
      exporterRead = true
      return undefined
    },
  } as unknown as Config
  expect(() => new OpenTelemetrySessionBackend(ctx, config)).toThrow('unsupported mode "FULL"')
  expect(exporterRead).toBe(false)
})

it('loads the service class through the loader unwrap path', async () => {
  const module = await import('../src/index.ts')
  const loader = Object.create(Loader.prototype) as Loader
  const unwrapped = loader.unwrapExports(module) as typeof OpenTelemetrySessionBackend
  expect(unwrapped).toBe(OpenTelemetrySessionBackend)
  expect(unwrapped.inject).toEqual(['sessions', 'otel'])
  const ctx = new Context()
  cleanup.push(() => ctx.fiber.dispose())
  ctx.plugin(OTel)
  await ctx.plugin(SessionStore)
  await ctx.plugin(unwrapped, {})
  expect(ctx.sessionTelemetry).toBeInstanceOf(OpenTelemetrySessionBackend)
})
