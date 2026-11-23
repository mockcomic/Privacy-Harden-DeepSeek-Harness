/** Session feedback stays in the local log and is not copied onto a model request. */
import { afterEach, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { recordFeedback } from '@deepseek-ai/dsh-command-feedback'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import DeepSeekLlmApiExtensionRegistry from '@deepseek-ai/dsh-deepseek-llm-api-extensions'
import * as SessionLogDeepSeek from '../src/index.ts'

const contexts: Context[] = []
afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

it('keeps recorded feedback off the model request', async () => {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(SessionStore)
  await ctx.plugin(DeepSeekLlmApiExtensionRegistry)
  await ctx.plugin(SessionLogDeepSeek, { enabled: true })
  const session = ctx.sessions.create(SessionId('feedback-local'))
  recordFeedback(session, { text: 'stays local' })
  const prepared = await ctx.deepseekLlmApiExtensions.prepare({
    body: { messages: [] },
    signal: AbortSignal.timeout(1_000),
    sessionId: session.id,
  })
  expect(prepared.fields).not.toHaveProperty('dsh_session_log')
  expect(session.snapshotEvents().some(event => event.type === 'feedback/record')).toBe(true)
})
