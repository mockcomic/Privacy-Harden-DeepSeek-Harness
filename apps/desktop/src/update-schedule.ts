/** Ordinary feed polling; policy queries and user-authorized transfers keep their own lifetimes. */

import { resolveDurationMs } from './duration-env.ts'
import type { DesktopUpdateCoordinator } from './update-coordinator.ts'
import type { DesktopUpdateState } from './ipc.ts'

/** Background update and mandatory-policy checks run only when this variable is exactly `1`. */
export function desktopBackgroundUpdatesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DSH_DESKTOP_UPDATES === '1'
}

/** Where a manual update check goes when the packaged feed is replaced or refused. */
export interface DesktopUpdateFeedConfig {
  /** Mirror base URL for the updater feed, or undefined for the packaged `app-update.yml`. */
  readonly feedUrl: string | undefined
  /** Mandatory-policy origin override, or undefined for the packaged manifest's policy. */
  readonly policyOrigin: string | undefined
  /** Whether a user-started check may contact the feed at all. */
  readonly manualChecksEnabled: boolean
}

/**
 * Validate a Desktop update endpoint override: an HTTPS origin with no credentials, path, query,
 * or fragment — the same rule `resolveDesktopPolicyConfig` applies to policy origins.
 * @param value - raw environment value.
 * @param name - variable name to blame in the rejection.
 * @returns the normalized origin.
 */
function httpsOverrideOrigin(value: string, name: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch (error) {
    throw new Error(`desktop update: ${name} must be an HTTPS origin without credentials, path, query, or fragment (${String(error)})`)
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== ''
    || (url.pathname !== '' && url.pathname !== '/') || url.search !== '' || url.hash !== '') {
    throw new Error(`desktop update: ${name} must be an HTTPS origin without credentials, path, query, or fragment`)
  }
  return url.origin
}

/**
 * Resolve feed-override environment without changing automatic behavior.
 * The privacy fork does not contact upstream's update feed unless the person opts in: manual
 * checks are OFF unless `DSH_DESKTOP_UPDATE_FEED=enabled`, and a disabled check reports that feed
 * checks are disabled instead of contacting the feed. Automatic behavior stays behind
 * `DSH_DESKTOP_UPDATES=1`, unchanged. `DSH_DESKTOP_UPDATE_FEED_URL` replaces the packaged updater
 * feed and `DSH_DESKTOP_UPDATE_POLICY_ORIGIN` replaces the packaged policy origin, so a self-hosted
 * build can update from its own mirror.
 * @param env - Desktop process environment.
 * @returns Validated feed overrides.
 */
export function resolveDesktopUpdateFeedConfig(env: NodeJS.ProcessEnv): DesktopUpdateFeedConfig {
  const feedValue = env.DSH_DESKTOP_UPDATE_FEED_URL?.trim()
  const policyValue = env.DSH_DESKTOP_UPDATE_POLICY_ORIGIN?.trim()
  const mode = env.DSH_DESKTOP_UPDATE_FEED?.trim()
  if (mode !== undefined && mode !== '' && mode !== 'disabled' && mode !== 'enabled') {
    throw new Error('desktop update: DSH_DESKTOP_UPDATE_FEED must be unset, "disabled", or "enabled"')
  }
  return {
    feedUrl: feedValue === undefined || feedValue === '' ? undefined : httpsOverrideOrigin(feedValue, 'DSH_DESKTOP_UPDATE_FEED_URL'),
    policyOrigin: policyValue === undefined || policyValue === '' ? undefined : httpsOverrideOrigin(policyValue, 'DSH_DESKTOP_UPDATE_POLICY_ORIGIN'),
    manualChecksEnabled: mode === 'enabled',
  }
}

/** Validated polling delays; maxBackoffMs caps the final randomized delay. */
export interface DesktopUpdateScheduleConfig {
  readonly intervalMs: number
  readonly maxBackoffMs: number
  readonly jitter: number
}

/**
 * Resolve ordinary-update polling settings without changing mandatory-policy scheduling.
 * @param env - Desktop process environment.
 * @returns Validated durations and fractional jitter.
 */
export function resolveDesktopUpdateScheduleConfig(env: NodeJS.ProcessEnv): DesktopUpdateScheduleConfig {
  const intervalMs = resolveDurationMs(env, 'DSH_DESKTOP_UPDATE_CHECK_INTERVAL_MS', 600_000)
  const maxBackoffMs = resolveDurationMs(env, 'DSH_DESKTOP_UPDATE_CHECK_MAX_BACKOFF_MS', Math.max(intervalMs, 3_600_000))
  const jitter = Number(env.DSH_DESKTOP_UPDATE_CHECK_JITTER ?? 0.2)
  if (!Number.isFinite(jitter) || jitter < 0 || jitter > 1 || maxBackoffMs < intervalMs) {
    throw new Error('desktop update: check jitter must be in [0, 1] and max backoff must cover the check interval')
  }
  return { intervalMs, maxBackoffMs, jitter }
}

/** One completion-based deadline shared by periodic, foreground, resume, and explicit checks. */
export class DesktopUpdateSchedule {
  private timer: ReturnType<typeof setTimeout> | undefined
  private pending: Promise<DesktopUpdateState> | undefined
  private activeChecks = 0
  private disposed = false
  private nextCheck = -Infinity
  private delay: number

  /**
   * @param updates - Coordinator that joins network checks and retains prepared packages.
   * @param config - Validated polling options.
   * @param random - Instance-local uniform sample in [0, 1).
   * @param now - Monotonic milliseconds, independent of wall-clock corrections.
   */
  constructor(
    private readonly updates: Pick<DesktopUpdateCoordinator, 'check' | 'state'>,
    private readonly config: DesktopUpdateScheduleConfig,
    private readonly random: () => number = Math.random,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.delay = config.intervalMs
  }

  /**
   * Start immediately when due; explicit requests bypass the deadline and share in-flight work.
   * @param manual - Whether a check failure must be visible, including when joining an automatic request.
   * @param force - Whether policy arrival or explicit intent bypasses the automatic deadline.
   * @returns Current state when not due, otherwise the coordinator result. Disposal rejects new work.
   */
  async check(manual = false, force = manual): Promise<DesktopUpdateState> {
    if (this.disposed) throw new Error('desktop update: polling is disposed')
    if (this.pending !== undefined && !manual) return this.pending
    if (!force && this.now() < this.nextCheck) return this.updates.state
    clearTimeout(this.timer)
    this.timer = undefined
    this.activeChecks++
    this.pending = Promise.resolve().then(() => {
      if (this.disposed) throw new Error('desktop update: polling is disposed')
      return this.updates.check(manual)
    }).then(
      (state) => {
        this.complete(state.phase === 'error' && state.failedOperation === 'check')
        return state
      },
      (error: unknown) => { this.complete(true); throw error },
    )
    return this.pending
  }

  /** Stop timers and prevent late completion from rearming; the coordinator owns pending network teardown. */
  dispose(): void {
    this.disposed = true
    clearTimeout(this.timer)
    this.timer = undefined
  }

  private complete(failed: boolean): void {
    // Joined manual callers publish through the coordinator but advance the retry delay only once.
    if (--this.activeChecks !== 0) return
    this.pending = undefined
    this.schedule(failed)
  }

  private schedule(failed: boolean): void {
    if (this.disposed) return
    const { intervalMs, maxBackoffMs, jitter } = this.config
    this.delay = failed ? Math.min(maxBackoffMs, this.delay * 2) : intervalMs
    const lower = Math.max(1_000, this.delay * (1 - jitter))
    const upper = Math.min(maxBackoffMs, this.delay * (1 + jitter))
    const delay = Math.round(lower + (upper - lower) * this.random())
    this.nextCheck = this.now() + delay
    this.timer = setTimeout(() => {
      void this.check(false, true).catch((error: unknown) => { console.error(error) })
    }, delay)
  }
}
