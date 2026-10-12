# Agent Note: Privacy-hardened outbound reporting

Status: implemented

English | [中文](2026-10-12-privacy-hardening.zh.md)

## Problem

Shipped profiles could send session content, plugin inventories, and installation identifiers to DeepSeek-operated endpoints. `DSH_TELEMETRY_DISABLED` stopped only the feedback-gated OpenTelemetry row. A self-hosted coding agent must keep sessions, tools, and local inference without those reporting paths.

## Decision

Exporters throw before an HTTP client exists, and the OpenTelemetry client libraries are not dependencies of the telemetry packages. Session telemetry, product telemetry, and product analytics do not construct reporters or read account device identity. `session-log-deepseek` and `plugin-package-inventory-deepseek` accept `enabled: true` and register no request fields. Official Messages requests omit `x-deepseek-harness-user-id`, `x-deepseek-harness-session-id`, and `x-deepseek-harness-compact`. Shipped profiles do not mint `$DSH_HOME/.anonymous-user-id`. Profile startup rejects `fetch` to `dsh-otel-collector.deepseeksvc.com`. Desktop background update and launch-time mandatory-policy checks run only when `DSH_DESKTOP_UPDATES=1`.

Local JSONL sessions, crash logs, session ids, and the product `User-Agent` remain. DeepSeek remains an optional Anthropic Messages provider. OpenAI-compatible servers, including SGLang, use the existing custom `llm-pi-ai` provider. The fetch guard does not cover subprocesses or `node:http`.

This supersedes outbound upload described in [explicit-feedback OpenTelemetry](2026-09-05-nonofficial-feedback-otel.md). Historical `session-log-deepseek/delivery-accepted` events remain readable.

## Alternatives considered

**Disable rows with `DSH_TELEMETRY_DISABLED` only.** That variable never covered session-log upload, plugin inventory, desktop analytics, or the anonymous header.

**Delete the telemetry packages.** Session readers, compositions, and historical event types still name them. Keeping the packages mounted and refusing the send path preserves load and old logs.

**Default-deny every non-loopback host.** That would block user-authorized web tools, git, package install, and configured LAN or Tailscale model servers. The deny list is the known collector host.

## Consequences

Feedback stays on the machine. Official DeepSeek diagnostics no longer receive session suffixes or package inventories. Automatic desktop update discovery waits for an explicit opt-in. Tests that expected collector traffic or tracking headers now assert absence. A unit test that never observes a socket does not prove a child process was silent.
