# Privacy hardening

The repository [README](README.md) is the short comparison with the original product. This page records the send sites.

This fork keeps DeepSeek Harness usable as a local coding-agent harness and removes outbound telemetry, analytics, and DeepSeek reporting at the send sites. Local session history, diagnostic logs, and tool execution stay in place.

Self-hosted OpenAI-compatible inference does not require a DeepSeek account. Configure a custom provider as described in [docs/user/guide/providers.md](docs/user/guide/providers.md). Do not put credentials, LAN addresses, or model ids in source.

## Mechanisms found

OpenTelemetry session upload lived in `packages/session/session-telemetry-otel` and `packages/telemetry/otel`. The base profile defaulted to `FEEDBACK_ONLY` and posted session prefixes to `https://dsh-otel-collector.deepseeksvc.com/v1/logs` after explicit feedback. The payload included canonical session events and the anonymous user id as resource `user.id`.

Desktop product analytics lived in `packages/client/product-analytics` and `packages/host/product-telemetry-otel`. It was mounted only when the profile name was `desktop`, posted to the same collector with `x-channel: dsh_otel_report`, and could add `device_id` and `user_id` from a signed-in DeepSeek account.

`packages/session/session-log-deepseek` added `dsh_session_log` to official DeepSeek model requests. That field carried canonical session events, including prompts and tool output, to whatever base URL the official route used.

`packages/llm/plugin-package-inventory-deepseek` added `dsh_plugin_packages` to those same requests. The field listed active Loader package names and versions.

`packages/identity/anonymous-user-id` persisted `$DSH_HOME/.anonymous-user-id`. Official model requests sent it as `x-deepseek-harness-user-id`. Session export also sent `x-deepseek-harness-session-id` and, for compaction, `x-deepseek-harness-compact`. The `/feedback` acknowledgement printed the anonymous id.

Desktop packaged builds polled `https://download.deepseek.com` for updates and could call a mandatory-update policy origin. Crash logs under the desktop log directory were already local. No Sentry, PostHog, Mixpanel, Segment, or Amplitude SDK is present.

`DSH_TELEMETRY_DISABLED` only disabled the `session-telemetry-otel` row. It did not stop session-log upload, plugin inventory, desktop analytics, or the anonymous header.

## Removed or refused

`createLogExporter` and `createEventLogExporter` throw `Outbound reporting is disabled` before creating an HTTP client. The OpenTelemetry SDK packages and `got` are no longer dependencies of `@deepseek-ai/dsh-otel`, `@deepseek-ai/dsh-session-telemetry-otel`, or `@deepseek-ai/dsh-host-product-telemetry-otel`.

`OpenTelemetrySessionBackend` does not construct a reporter. `FEEDBACK_ONLY` and `DISABLED` both keep feedback in the local session log and warn that it was not uploaded. `FULL` is still rejected. The base profile no longer sets a collector URL. Its default mode expression is `DISABLED`.

`ProductTelemetry.emit` drops the record. Product analytics `report` does not read account identity and does not call `emit`.

`session-log-deepseek` and `plugin-package-inventory-deepseek` stay mounted so existing compositions still load, and `enabled: true` does not register a request field. The Settings control that offered “Upload Session Log when using the official model API” is not registered.

Official Messages requests no longer send `x-deepseek-harness-user-id`, `x-deepseek-harness-session-id`, or `x-deepseek-harness-compact`. Shipped profiles do not call `getOrCreateAnonymousUserId`. The `/feedback` acknowledgement names the session id only.

Background desktop update polling and the launch-time mandatory-policy check run only when `DSH_DESKTOP_UPDATES=1`.

`installProxyFromEnvironment` rejects `fetch` to `dsh-otel-collector.deepseeksvc.com` before a socket is opened. The error is `Blocked outbound reporting connection to dsh-otel-collector.deepseeksvc.com` and does not include a path, query, header, or body.

## Retained on purpose

Local JSONL session logs, projection caches, crash logs, and in-process logger output stay. They are required for restore, debugging, and the agent loop.

Session ids, message ids, and RPC ids stay. They are not attached to model requests as tracking headers.

The `User-Agent` product string stays on official Messages requests. It identifies the client build, not an installation.

DeepSeek account sign-in still sends the platform `device_id` created for that OAuth exchange. Local inference does not use that route. Do not sign in if that exchange is unwanted.

`web_search` still uses the configured search provider when the model calls the tool. The default provider contacts DeepSeek’s search API. It does not run at startup.

Historical `session-log-deepseek/delivery-accepted` events remain readable. New requests do not append them.

Explicit desktop update checks that a person starts, and `updateSchedule.check(true)`, can still contact the update feed. Automatic startup checks do not.

## Legitimate network

Configured model endpoints, including localhost, LAN, and Tailscale addresses, are not on the reporting deny list. Official `deepseek-official` speaks Anthropic Messages. Set `DEEPSEEK_BASE_URL` and `DEEPSEEK_API_KEY` for an Anthropic-compatible gateway.

SGLang’s OpenAI-compatible API uses a custom `llm-pi-ai` provider with `api: openai-completions`, a base URL, a credential environment variable, and a model id. That route does not attach `dsh_*` fields. See [docs/user/guide/providers.md](docs/user/guide/providers.md).

User-invoked `web_fetch`, web search, MCP, plugin install, git, and shell commands are not blocked by the reporting guard. `web_fetch` still refuses non-public destinations under its own rules.

## Network controls and limits

The fetch guard runs for every profile because `runProfile` installs the proxy policy before plugins mount. It covers `globalThis.fetch` only.

It does not cover `node:http`, `node:https`, undici calls that bypass `fetch`, Electron’s updater, or subprocesses. Shell, git, package managers, and MCP child processes keep the existing scrubbed environment. Blocking those requires an OS firewall, a container egress policy, or a similar control outside the process.

The guard does not log API keys, authorization headers, or request bodies. A blocked error names only the collector host.

Loopback, private LAN, and Tailscale addresses are allowed unless a future change adds them to the deny list. Do not add them.

## Dependencies that can still communicate

`electron-updater` can contact the feed in `app-update.yml` when a person starts an update check or when `DSH_DESKTOP_UPDATES=1` enables background checks.

The DeepSeek account and official model clients contact the configured origins when those features are used. Defaults remain `https://api.deepseek.com` and `https://platform.deepseek.com`.

Plugin installation uses the npm registry the person selects. The official registry probe is `https://registry.npmjs.org/`.

No OpenTelemetry exporter dependency remains on the telemetry packages. Transitive copies can still appear if another workspace package depends on them. This fork’s telemetry packages do not import them.

## How to verify

Boot a profile against a mock or local OpenAI-compatible server and inspect the captured model request. It must not contain `dsh_session_log`, `dsh_plugin_packages`, `x-deepseek-harness-user-id`, `x-deepseek-harness-session-id`, or `x-deepseek-harness-compact`.

Confirm `$DSH_HOME/.anonymous-user-id` is not created by that run. An older file may already exist and is not read.

`fetch('https://dsh-otel-collector.deepseeksvc.com/v1/logs')` after profile startup must reject with the blocked-host error and must not open a connection.

Unit coverage for these refusals lives next to the changed packages, including `packages/util/http-proxy/tests/install.spec.ts`, `packages/session/session-log-deepseek/tests/upload.spec.ts`, and `packages/llm/plugin-package-inventory-deepseek/tests/inventory.spec.ts`.

Passing those tests does not prove that a subprocess made no connection. Watch the process with an OS-level capture if that proof is required.

## Tradeoffs

Feedback and ratings remain in the local session log and are not delivered to DeepSeek. The product can no longer receive those reports from this build.

Official DeepSeek diagnostics that depended on `dsh_session_log` or `dsh_plugin_packages` no longer receive them. Model inference does not require those fields.

Desktop builds do not learn about mandatory updates until `DSH_DESKTOP_UPDATES=1` or a person starts a check.

The fetch guard can be bypassed by code that uses `node:http` or a child process. That is an application-level limit, not a host firewall.

## Updating from upstream

Re-apply this fork when merging upstream. The send sites that must stay refused are:

`packages/telemetry/otel/src/transport.ts` and `event-transport.ts` must throw before creating a client.

`packages/session/session-telemetry-otel/src/index.ts` must not construct a reporter or call `getOrCreateAnonymousUserId`.

`packages/host/product-telemetry-otel/src/index.ts` must not construct an event reporter, and its schema must not default to the collector URL.

`packages/session/session-log-deepseek/src/index.ts` and `packages/llm/plugin-package-inventory-deepseek/src/index.ts` must not register request fields.

`packages/llm/llm-deepseek/src/adapter.ts` must not set the three `x-deepseek-harness-*` headers.

`packages/client/product-analytics/src/index.ts` `report` must not read device identity or emit.

`packages/bundle/base/cordis.patch.yml` must not set `https://dsh-otel-collector.deepseeksvc.com/v1/logs`.

`packages/util/http-proxy/src/install.ts` must keep the fetch guard.

`apps/desktop/src/main.ts` must keep background update checks behind `DSH_DESKTOP_UPDATES=1`.

Upstream tests that expect upload, the anonymous header, or a collector capture need to stay inverted. A green unit suite that never inspects a request body is not sufficient.
