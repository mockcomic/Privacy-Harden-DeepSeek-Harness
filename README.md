# Privacy-Harden DeepSeek Harness

This repository is a privacy fork of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`), the open-source agent harness from [DeepSeek AI](https://deepseek.com). The fork keeps the local coding agent and removes the tracking upstream can send off the machine: session content, plugin inventories, an installation id, and desktop analytics.

Upstream can deliver that data to DeepSeek-operated endpoints. `DSH_TELEMETRY_DISABLED` there stops only the feedback-gated OpenTelemetry row. This fork refuses the send paths in source, so those reports do not leave the process. Model calls, tools, plugins, sessions, and the desktop shell stay.

It is built on an **everything-is-a-plugin** architecture and powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512).

Upstream documentation: [https://deepseek-harness.github.io/deepseek-harness/](https://deepseek-harness.github.io/deepseek-harness/)

## What this fork removed

The tracking removal is the commit `chore(egress): remove outbound data paths and GitHub Actions infrastructure`, applied on the tree that contains release `0.2.1-alpha.2`. From this checkout:

```sh
git log --grep='^chore(egress): remove outbound data paths' -1
git show --stat "$(git log --grep='^chore(egress): remove outbound data paths' -1 --format=%H)"
```

That commit is the source of the behavior below. [PRIVACY_HARDENING.md](PRIVACY_HARDENING.md) lists each send site and the files to re-check when merging upstream. The decision record is [the privacy-hardening Agent Note](.agents/notes/implemented/architecture/2026-10-12-privacy-hardening.md).

| Upstream | This fork |
| --- | --- |
| After explicit feedback, OpenTelemetry posts session events and an anonymous user id to `dsh-otel-collector.deepseeksvc.com`. | Log and event exporters throw `Outbound reporting is disabled` before an HTTP client exists. The `@opentelemetry/*` and `got` dependencies are gone from the telemetry packages. The base profile defaults to `DISABLED` and configures no collector URL. |
| Desktop analytics can post interaction events to that collector and can attach `device_id` and `user_id` from a signed-in account. | Product analytics keeps each event on this machine, without reading account identity or calling an exporter. |
| Official DeepSeek model requests can carry `dsh_session_log` and `dsh_plugin_packages`, including prompts and tool output. | `session-log-deepseek` and `plugin-package-inventory-deepseek` stay mounted so existing compositions and old session events still open, and they add no request fields. Settings has no session-log upload switch. |
| Official requests send `x-deepseek-harness-user-id`, `x-deepseek-harness-session-id`, and `x-deepseek-harness-compact`. | Those headers stay unset. Shipped profiles do not create `$DSH_HOME/.anonymous-user-id`. |
| The `/feedback` acknowledgement can include the anonymous user id. | The acknowledgement names the session id only. Feedback stays in the local session log. |
| Desktop polls an update feed in the background and can check a mandatory-update policy at launch. | Automatic checks run only when `DSH_DESKTOP_UPDATES=1`, and even a check you start yourself runs only when `DSH_DESKTOP_UPDATE_FEED=enabled`; otherwise the menu reports updates are disabled without a connection. `DSH_DESKTOP_UPDATE_FEED_URL` and `DSH_DESKTOP_UPDATE_POLICY_ORIGIN` point both at a mirror. |
| Application `fetch` can reach the collector host. | Profile startup rejects every outbound connection to a denied reporting host — `fetch`, `node:http`/`node:https`, and the undici dispatcher — before a socket opens. The error names that host only. The refused list is `DSH_DENIED_REPORTING_HOSTS`, defaulting to `dsh-otel-collector.deepseeksvc.com`. |
| Connector plugins (wecom, tencent-meeting) download their upstream guide archives from `https://codeload.github.com` at plugin load. | The download is opt-in (`skillsDownloadEnabled`, default off). When on, `skillsUrls` is a Config array: point it at a mirror to redirect it. |
| The plugin manager pings `registry.npmjs.org` and `registry.npmmirror.com` to pick the fastest registry. | The ping is opt-in (`registryProbeEnabled`, default off); the registry for an install stays a user choice. |
| The opt-in plugin market fetches indexes and detail files from `raw.githubusercontent.com` or configured GitLab origins, falling back to anonymous git smart-HTTP clones. | Unchanged. The bundle is opt-in and ships with no index source configured, so a default boot contacts neither. |

Every GitHub Actions workflow and the Dependabot config are deleted from this tree — release tags trigger no CI here. Build installers locally with `pnpm run package:desktop:<platform>` (see PRIVACY_HARDENING.md).

Local JSONL sessions, crash logs, tools, plugins, streaming, and tool calling stay. A self-hosted OpenAI-compatible server, including SGLang, is a custom provider with API protocol `openai-completions`, as described in the [providers guide](docs/user/guide/providers.md). The Windows installer from this checkout is unsigned, and Windows SmartScreen warns because it has no code-signing certificate. The reporting guard covers every in-process HTTP entry point (`fetch`, `node:http`/`node:https`, undici); shell, git, package managers, and MCP children are outside it. Official requests carry `User-Agent` `deepseek-harness/<version>`; `DSH_USER_AGENT_URL=none` drops the repository comment. See [PRIVACY_HARDENING.md](PRIVACY_HARDENING.md).

## Developer preview

DeepSeek Harness is in _developer preview_ and iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

Review the [safety notice](SAFETY.md) before running the project.

## Run

### Run from `npm`

`npx @deepseek-ai/dsh` installs the published upstream package. That package still includes the tracking this fork removes. Use the source checkout below for the privacy behavior.

Install `Node.js`, then run:

```sh
npx @deepseek-ai/dsh web
```

The command starts the Web UI at `http://127.0.0.1:3080` by default and opens it in the default browser for a local launch. An SSH launch only prints the host URL because the SSH client or editor owns the local forwarded address. Pass `--no-open` to run the server without opening a browser. See [Web UI guide](docs/user/guide/index.md).

### Run from source

To run from a repository checkout:

```sh
git clone https://github.com/mockcomic/Privacy-Harden-DeepSeek-Harness.git
cd Privacy-Harden-DeepSeek-Harness
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` prepares the repository artifacts. `pnpm dsh web` uses those built artifacts without rebuilding.

## Community and support

- Submit feedback or bug reports through [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join <a href="https://discord.gg/4MrtZUhpxg">DeepSeek Harness Discord community</a>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

`pnpm run dev:web` builds, serves, and rebuilds client bundles on source edits in one terminal, and `make help` lists the matching Make targets for Web and Desktop; the guide's application commands section owns the full table.

For agents, follow [AGENTS.md](AGENTS.md).

## Citation

```bibtex
@misc{deepseek-harness2026,
  title={DeepSeek Harness: Everything is a Plugin},
  author={DeepSeek-AI},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/deepseek-ai/deepseek-harness}},
}
```

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
