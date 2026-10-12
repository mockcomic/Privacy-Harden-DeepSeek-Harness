/**
 * Plugin package inventory types. This plugin does not contribute
 * `dsh_plugin_packages` to model requests, including when `enabled` is true.
 * @module @deepseek-ai/dsh-plugin-package-inventory-deepseek
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-deepseek-llm-api-extensions'

export type * from './types.ts'

/** Cordis plugin name. */
export const name = 'plugin-package-inventory-deepseek'
/** Services the shipped composition already provides. The plugin does not read them. */
export const inject = ['agents', 'deepseekLlmApiExtensions', 'loader']

/** Inventory configuration retained so existing compositions still validate. */
export interface Config {
  /** Ignored. The request field is never contributed. */
  enabled?: boolean
}

/** Validated configuration. `enabled: true` does not contribute the field. */
export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
})

/**
 * Mount the plugin without registering a request field.
 * @param _ctx - unused; the extension registry is not called.
 * @param _config - accepted and ignored, including `enabled: true`.
 */
export function apply(_ctx: Context, _config: Config): void {}
