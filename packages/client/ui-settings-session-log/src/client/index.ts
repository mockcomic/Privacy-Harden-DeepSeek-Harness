/** General settings companion for the Host Session-log upload configuration. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { en } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** API Session-log preference copy. */
    'settings.sessionLog': keyof typeof en
  }
}

/** Services used by the browser companion. */
export const inject = ['slots', 'locale', 'configForms']

/**
 * Keep the package loadable without offering a session-log upload control.
 * @param _ctx - browser plugin context. No settings row is registered.
 */
export function apply(_ctx: Context): void {}
