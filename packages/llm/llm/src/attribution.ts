/**
 * Centralize the non-secret product identity every provider request sends as `User-Agent`, keeping
 * adapters from drifting. See
 * `docs/subsystems/llm-streaming.md#appidentity--app-attribution`.
 *
 * App-attribution vocabulary for provider requests.
 * @module @deepseek-ai/dsh-llm/attribution
 */

import { createRequire } from 'node:module'

// The package's own manifest is the single source of the version so the
// User-Agent cannot drift from what is published (`./package.json` is an
// export of this package; the relative path resolves from both `src/` and
// the bundled `lib/`).
const { version } = createRequire(import.meta.url)('../package.json') as { version: string }

/**
 * Static public application identity sent to LLM providers.
 *
 * Every field is a public product fact, safe on every request: no secrets,
 * local paths, session ids, prompt text, or per-user identifiers belong here,
 * and nothing per-request may influence the values.
 */
export interface AppIdentity {
  /** `User-Agent` product token (lowercase, hyphenated). */
  product: string
  /** Product version; sourced from package metadata, never hand-copied. */
  version: string
  /** Repository home URL of the app, used as the `User-Agent` comment; omit to send no comment. */
  url?: string | undefined
  /** RFC 9110 product token appended after the comment, such as `dsh-profile/web`. */
  suffix?: string | undefined
}

// RFC 9110 §10.1.5 `product = token ["/" product-version]`.
const PRODUCT = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+(?:\/[!#$%&'*+.^_`|~0-9A-Za-z-]+)?$/

/**
 * Read the launching application's `User-Agent` suffix on each use, so a launcher may set it after this module loads.
 * It is a process environment value rather than plugin `Config` because {@link attributionHeaders} runs without a
 * plugin context.
 * @returns the validated `DSH_USER_AGENT_SUFFIX`, or undefined when unset or empty.
 * @throws Error when the value is not an RFC 9110 product token.
 */
function launchSuffix(): string | undefined {
  const value = process.env.DSH_USER_AGENT_SUFFIX
  if (value === undefined || value === '') return undefined
  if (!PRODUCT.test(value)) throw new Error(`DSH_USER_AGENT_SUFFIX must be an RFC 9110 product token; got ${JSON.stringify(value)}`)
  return value
}

// The repository comment is a deployment choice like the suffix: an env value
// so a launcher can set it without a plugin context.
const DEFAULT_ATTRIBUTION_URL = 'https://github.com/deepseek-ai/deepseek-harness'

/**
 * Read the launching application's `User-Agent` comment URL on each use.
 * `DSH_USER_AGENT_URL=none` suppresses the comment entirely; any other value
 * replaces the repository URL. It is a process environment value for the same
 * reason {@link launchSuffix} is: {@link attributionHeaders} runs without a
 * plugin context.
 * @returns the comment URL, or undefined when suppressed.
 * @throws Error when the value is neither `none` nor an absolute http(s) URL.
 */
function attributionUrl(): string | undefined {
  const value = process.env.DSH_USER_AGENT_URL
  if (value === undefined || value === '') return DEFAULT_ATTRIBUTION_URL
  if (value === 'none') return undefined
  let url: URL
  try {
    url = new URL(value)
  } catch (error) {
    throw new Error(`DSH_USER_AGENT_URL must be "none" or an absolute http(s) URL; got ${JSON.stringify(value)} (${String(error)})`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`DSH_USER_AGENT_URL must be "none" or an absolute http(s) URL; got ${JSON.stringify(value)}`)
  }
  return value
}

/**
 * The harness's own identity: the default every adapter sends. Its `suffix`
 * reads `DSH_USER_AGENT_SUFFIX` and its `url` reads `DSH_USER_AGENT_URL`.
 * Deployments that need a white-label identity pass their own
 * {@link AppIdentity} to {@link attributionHeaders} — omission falls back to
 * this default; the product token itself cannot be suppressed.
 */
export const APP_IDENTITY: AppIdentity = {
  product: 'deepseek-harness',
  version,
  get url() { return attributionUrl() },
  get suffix() { return launchSuffix() },
}

/**
 * The standard `User-Agent` value: `product/version (+url)`, then ` suffix` when present. The
 * parenthesized `+url` comment is the conventional self-identification form
 * (RFC 9110 §10.1.5 product + comment syntax).
 * @param identity - the identity to render; defaults to {@link APP_IDENTITY}.
 * @returns the ready-to-send header value.
 */
export function userAgent(identity: AppIdentity = APP_IDENTITY): string {
  const base = `${identity.product}/${identity.version}`
  const commented = identity.url === undefined ? base : `${base} (+${identity.url})`
  return identity.suffix === undefined ? commented : `${commented} ${identity.suffix}`
}

/**
 * Build the attribution headers an adapter must send on every provider
 * request. Header names are lowercase (HTTP field names are case-insensitive
 * on the wire).
 * @param identity - the identity to send; defaults to {@link APP_IDENTITY} — omission cannot suppress attribution.
 * @returns headers to merge into the provider request (currently just `user-agent`).
 */
export function attributionHeaders(
  identity: AppIdentity = APP_IDENTITY,
): Record<string, string> {
  return { 'user-agent': userAgent(identity) }
}
