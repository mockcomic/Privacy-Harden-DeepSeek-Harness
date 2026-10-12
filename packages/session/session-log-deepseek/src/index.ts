/**
 * Historical session-log extension types. This plugin does not contribute
 * `dsh_session_log` to model requests, including when `enabled` is true.
 * @module @deepseek-ai/dsh-session-log-deepseek
 */

import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-deepseek-llm-api-extensions'

export type * from './types.ts'

/** Cordis plugin name. */
export const name = 'session-log-deepseek'
/** Services the shipped composition already provides. The plugin does not read them. */
export const inject = ['deepseekLlmApiExtensions', 'sessions']

/** Session-log configuration retained so existing compositions still validate. */
export interface Config {
  /** Ignored. The request field is never contributed. */
  enabled: Volatile<boolean>
  /** Ignored byte ceiling retained so existing compositions validate. */
  maxBytes: number
}

/** Validated configuration. Neither field enables upload. */
export const Config = z.object({
  enabled: z.boolean().default(true).volatile(),
  maxBytes: z.number().step(1).min(1).default(8 * 1024 * 1024),
})

/**
 * Mount the plugin without registering a request field.
 * @param _ctx - unused; the extension registry is not called.
 * @param _config - accepted and ignored, including `enabled: true`.
 */
export function apply(_ctx: Context, _config: Config): void {}
