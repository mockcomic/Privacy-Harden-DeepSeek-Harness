# Agent Note: 隐私加固后的对外上报

Status: implemented

[English](2026-10-12-privacy-hardening.md) | 中文

## 问题

随发行版交付的 profile 可能把会话内容、插件清单和安装标识发到 DeepSeek 运营的端点。`DSH_TELEMETRY_DISABLED` 只停掉反馈门控的 OpenTelemetry 配置行。自托管编程代理必须保留会话、工具和本地推理，同时去掉这些上报路径。

## 决策

导出器在创建 HTTP 客户端之前抛出，遥测包不再依赖 OpenTelemetry 客户端库。会话遥测、产品遥测和产品分析不构造 reporter，也不读取账户设备身份。`session-log-deepseek` 与 `plugin-package-inventory-deepseek` 接受 `enabled: true`，但不注册请求字段。官方 Messages 请求不再发送 `x-deepseek-harness-user-id`、`x-deepseek-harness-session-id` 和 `x-deepseek-harness-compact`。随发行版交付的 profile 不生成 `$DSH_HOME/.anonymous-user-id`。profile 启动会拒绝发往 `dsh-otel-collector.deepseeksvc.com` 的 `fetch`。桌面后台更新和启动时的强制更新策略检查仅在 `DSH_DESKTOP_UPDATES=1` 时运行。

本地 JSONL 会话、崩溃日志、会话 id 和产品 `User-Agent` 保留。DeepSeek 仍是可选的 Anthropic Messages 提供方。包括 SGLang 在内的 OpenAI 兼容服务器使用现有的自定义 `llm-pi-ai` 提供方。fetch 守卫不覆盖子进程或 `node:http`。

本决定取代 [仅在显式反馈后通过 OpenTelemetry 上传](2026-09-05-nonofficial-feedback-otel.zh.md) 中的对外上传。历史 `session-log-deepseek/delivery-accepted` 事件仍可读取。

## 考虑过的替代方案

**只用 `DSH_TELEMETRY_DISABLED` 禁用配置行。** 该变量从不覆盖会话日志上传、插件清单、桌面分析或匿名请求头。

**删除遥测包。** 会话读取器、组合和历史事件类型仍然点名这些包。保持挂载并拒绝发送路径，才能同时保住加载和旧日志。

**默认拒绝所有非回环主机。** 这会阻断用户授权的网页工具、git、软件包安装，以及配置在局域网或 Tailscale 上的模型服务器。拒绝列表只有已知的采集主机。

## 后果

反馈留在本机。官方 DeepSeek 诊断不再收到会话后缀或包清单。自动桌面更新发现等待显式启用。原先期望采集流量或跟踪请求头的测试现在断言它们不存在。从未观察套接字的单元测试不能证明子进程保持静默。
