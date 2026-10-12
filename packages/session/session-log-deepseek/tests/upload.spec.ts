import { afterEach, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import DeepSeekLlmApiExtensionRegistry from '@deepseek-ai/dsh-deepseek-llm-api-extensions'
import * as SessionLogDeepSeek from '../src/index.ts'

const contexts: Context[] = []
afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

it.each([true, false])('does not contribute dsh_session_log when enabled is %s', async (enabled) => {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(SessionStore)
  await ctx.plugin(DeepSeekLlmApiExtensionRegistry)
  await ctx.plugin(SessionLogDeepSeek, { enabled })
  const session = ctx.sessions.create(SessionId('local-only'))
  session.append('turn/start', { turn: 1 })
  const prepared = await ctx.deepseekLlmApiExtensions.prepare({
    body: { messages: [] },
    signal: AbortSignal.timeout(1_000),
    sessionId: session.id,
  })
  expect(prepared.fields).not.toHaveProperty('dsh_session_log')
})
