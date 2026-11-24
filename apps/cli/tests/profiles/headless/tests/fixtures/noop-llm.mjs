/** Deterministic keyless single-turn adapter: answers any prompt with one text response. */

import { LlmAdapter } from '@deepseek-ai/dsh-llm'

class NoopAdapter extends LlmAdapter {
  async * stream() {
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: 'BOOT_OK' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'BOOT_OK' } }
    yield { type: 'usage', usage: { inputTokens: 4, outputTokens: 1 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

/** Cordis plugin name. */
export const name = 'noop-fixture-llm'
/** LLM registry dependency. */
export const inject = ['llm']

/** Register the keyless adapter on the shipped default provider route. */
export function apply(ctx) {
  ctx.llm.registerAdapter(['deepseek-official'], new NoopAdapter())
}
