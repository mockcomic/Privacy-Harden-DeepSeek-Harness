# DeepSeek Harness

English | [中文](README.zh.md)

DeepSeek Harness (`dsh`) is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com).

It is built on an **everything-is-a-plugin** architecture and powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512).

Documentation: [https://deepseek-harness.github.io/deepseek-harness/](https://deepseek-harness.github.io/deepseek-harness/)

## Privacy hardening

This checkout refuses outbound telemetry, analytics, and DeepSeek reporting in source. The coding agent, tools, plugins, sessions, and desktop shell remain. The original product can send session content, plugin inventories, and an installation id to DeepSeek-operated endpoints. Setting `DSH_TELEMETRY_DISABLED` there disables only the feedback-gated OpenTelemetry row.

| Original product | This checkout |
| --- | --- |
| After explicit feedback, OpenTelemetry posts session events and an anonymous user id to `dsh-otel-collector.deepseeksvc.com`. | Log exporters throw `Outbound reporting is disabled` before an HTTP client exists. The base profile defaults to `DISABLED` and configures no collector URL. |
| Desktop analytics can post interaction events to that collector and can attach `device_id` and `user_id` from a signed-in account. | Product analytics keeps each event on this machine, without reading account identity or exporting it. |
| Official DeepSeek model requests can carry `dsh_session_log` and `dsh_plugin_packages`, including prompts and tool output. | Those packages stay loaded so existing compositions and old session events still open, and they add no request fields. Settings has no session-log upload switch. |
| Official requests send `x-deepseek-harness-user-id`, `x-deepseek-harness-session-id`, and `x-deepseek-harness-compact`. | Those headers stay unset. Shipped profiles do not create `$DSH_HOME/.anonymous-user-id`. |
| The `/feedback` acknowledgement can include the anonymous user id. | The acknowledgement names the session id only. |
| Desktop polls an update feed in the background and can check a mandatory-update policy at launch. | Those automatic checks run only when `DSH_DESKTOP_UPDATES=1`. A check you start yourself can still contact the update feed. |
| Application `fetch` can reach the collector host. | Profile startup rejects `fetch` to `dsh-otel-collector.deepseeksvc.com` before a socket opens. The error names that host only. |

Local JSONL sessions, crash logs, tools, plugins, streaming, and tool calling stay. A self-hosted OpenAI-compatible server, including SGLang, is a custom provider with API protocol `openai-completions`, as described in the [providers guide](docs/user/guide/providers.md). The Windows installer from this checkout is unsigned, and Windows SmartScreen warns because it has no code-signing certificate. The reporting guard covers `globalThis.fetch` in the harness process; shell, git, package managers, MCP children, `node:http`, and Electron's updater are outside it. Send sites and merge points are in [PRIVACY_HARDENING.md](PRIVACY_HARDENING.md).

## Developer preview

DeepSeek Harness is in _developer preview_ and iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

Review the [safety notice](SAFETY.md) before running the project.

## Run

### Run from `npm`

Install `Node.js`, then run:

```sh
npx @deepseek-ai/dsh web
```

The command starts the Web UI at `http://127.0.0.1:3080` by default and opens it in the default browser for a local launch. An SSH launch only prints the host URL because the SSH client or editor owns the local forwarded address. Pass `--no-open` to run the server without opening a browser. See [Web UI guide](docs/user/guide/index.md).

### Run from source

To run from a repository checkout:

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
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
