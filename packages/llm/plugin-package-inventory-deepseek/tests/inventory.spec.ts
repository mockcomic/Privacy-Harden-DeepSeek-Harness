import { afterEach, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import DeepSeekLlmApiExtensionRegistry from '@deepseek-ai/dsh-deepseek-llm-api-extensions'
import * as PluginInventory from '../src/index.ts'

const contexts: Context[] = []
afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

it.each([undefined, true, false])('does not contribute dsh_plugin_packages when enabled is %s', async (enabled) => {
  const ctx = new Context()
  contexts.push(ctx)
  ctx.provide('agents', {})
  ctx.provide('loader', {})
  await ctx.plugin(DeepSeekLlmApiExtensionRegistry)
  await ctx.plugin(PluginInventory, enabled === undefined ? {} : { enabled })
  const prepared = await ctx.deepseekLlmApiExtensions.prepare({
    body: { messages: [] },
    signal: AbortSignal.timeout(1_000),
  })
  expect(prepared.fields).not.toHaveProperty('dsh_plugin_packages')
})
