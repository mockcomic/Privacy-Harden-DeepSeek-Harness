/** Feed-override validation and the disabled manual-check switch for self-hosted Desktop builds. */
import { describe, expect, it } from 'vitest'
import { resolveDesktopUpdateFeedConfig } from '../../src/update-schedule.ts'

describe('resolveDesktopUpdateFeedConfig', () => {
  it('refuses manual feed checks when no override is set', () => {
    expect(resolveDesktopUpdateFeedConfig({})).toEqual({ feedUrl: undefined, policyOrigin: undefined, manualChecksEnabled: false })
    expect(resolveDesktopUpdateFeedConfig({ DSH_DESKTOP_UPDATE_FEED_URL: '  ' })).toEqual({
      feedUrl: undefined, policyOrigin: undefined, manualChecksEnabled: false,
    })
  })

  it('accepts a bare HTTPS mirror origin', () => {
    expect(resolveDesktopUpdateFeedConfig({
      DSH_DESKTOP_UPDATE_FEED_URL: 'https://mirror.example/',
      DSH_DESKTOP_UPDATE_POLICY_ORIGIN: 'https://policy.example',
      DSH_DESKTOP_UPDATE_FEED: 'enabled',
    })).toEqual({ feedUrl: 'https://mirror.example', policyOrigin: 'https://policy.example', manualChecksEnabled: true })
  })

  it.each([
    'http://mirror.example',
    'https://user:pw@mirror.example',
    'https://mirror.example/path',
    'https://mirror.example?query=1',
    'https://mirror.example#frag',
    'mirror.example',
  ])('rejects the malformed origin %j', (value) => {
    expect(() => resolveDesktopUpdateFeedConfig({ DSH_DESKTOP_UPDATE_FEED_URL: value }))
      .toThrow(/DSH_DESKTOP_UPDATE_FEED_URL must be an HTTPS origin without credentials, path, query, or fragment/)
  })

  it('enables manual checks only for the exact mode value', () => {
    expect(resolveDesktopUpdateFeedConfig({ DSH_DESKTOP_UPDATE_FEED: 'disabled' }).manualChecksEnabled).toBe(false)
    expect(resolveDesktopUpdateFeedConfig({ DSH_DESKTOP_UPDATE_FEED: '' }).manualChecksEnabled).toBe(false)
    expect(resolveDesktopUpdateFeedConfig({ DSH_DESKTOP_UPDATE_FEED: 'enabled' }).manualChecksEnabled).toBe(true)
    expect(() => resolveDesktopUpdateFeedConfig({ DSH_DESKTOP_UPDATE_FEED: 'off' }))
      .toThrow(/DSH_DESKTOP_UPDATE_FEED must be unset, "disabled", or "enabled"/)
  })
})
