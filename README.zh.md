# DeepSeek Harness

[English](README.md) | 中文

DeepSeek Harness（`dsh`）是由 [DeepSeek AI](https://deepseek.com) 开发的开源 agent harness（智能体框架）。

它构建于**一切皆插件**的架构之上，由 [Cordis](https://github.com/cordiverse/cordis) 驱动，其设计参见论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512)。

文档：[https://deepseek-harness.github.io/deepseek-harness/](https://deepseek-harness.github.io/deepseek-harness/)

<a id="privacy-hardening"></a>

## 隐私加固

本仓库在源码里拒绝出站遥测、埋点和 DeepSeek 上报。coding agent（编程智能体）、工具、插件、会话和桌面壳保持原样。原版可以把会话内容、插件清单和安装标识发到 DeepSeek 运营的端点。在原版里设置 `DSH_TELEMETRY_DISABLED` 只会关掉反馈触发的 OpenTelemetry 那一行。

| 原版 | 本仓库 |
| --- | --- |
| 显式反馈之后，OpenTelemetry 把会话事件和匿名用户 id 发到 `dsh-otel-collector.deepseeksvc.com`。 | 日志导出器在创建 HTTP 客户端之前抛出 `Outbound reporting is disabled`。base profile 默认 `DISABLED`，并且不配置收集端 URL。 |
| 桌面埋点可以把交互事件发到该收集端，并附上已登录账号的 `device_id` 和 `user_id`。 | 产品埋点把每条事件留在本机，不读取账号身份，也不导出。 |
| 官方 DeepSeek 模型请求可以携带 `dsh_session_log` 和 `dsh_plugin_packages`，其中包括提示词和工具输出。 | 这两个包仍然加载，因此既有组合和旧会话事件仍能打开，并且它们不添加请求字段。设置里没有会话日志上传开关。 |
| 官方请求发送 `x-deepseek-harness-user-id`、`x-deepseek-harness-session-id` 和 `x-deepseek-harness-compact`。 | 这三个请求头保持未设置。随产品发布的 profile 不创建 `$DSH_HOME/.anonymous-user-id`。 |
| `/feedback` 的确认文字可以包含匿名用户 id。 | 确认文字只写出会话 id。 |
| Desktop 在后台轮询更新源，并可以在启动时检查强制更新策略。 | 这些自动检查仅在 `DSH_DESKTOP_UPDATES=1` 时运行。你自己发起的更新检查仍可能联系更新源。 |
| 应用内 `fetch` 可以连到收集端主机。 | profile 启动时，在打开套接字之前拒绝发往 `dsh-otel-collector.deepseeksvc.com` 的 `fetch`。错误只写出该主机名。 |

本机仍保留 JSONL 会话日志、崩溃日志、工具、插件、流式回复和工具调用。自建的 OpenAI 兼容服务（含 SGLang）使用自定义提供方，API 协议为 `openai-completions`，配置见[提供商指南](docs/user/guide/providers.zh.md)。本仓库打出的 Windows 安装包未签名，文件没有代码签名证书，因此 Windows SmartScreen 会在启动时警告。上报防护覆盖 harness 进程内的 `globalThis.fetch`；shell、git、包管理器、MCP 子进程、`node:http` 和 Electron 更新器不在该防护之内。发送点与合并上游后需要重新套用的位置见 [PRIVACY_HARDENING.md](PRIVACY_HARDENING.md)。

## 开发者预览

DeepSeek Harness 处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

运行本项目前，请阅读[安全说明](SAFETY.zh.md)。

<a id="run"></a>

## 运行

### 通过 `npm` 运行

安装 `Node.js`，然后运行：

```sh
npx @deepseek-ai/dsh web
```

该命令默认会在 `http://127.0.0.1:3080` 启动 Web UI，本机启动时还会用默认浏览器打开页面。通过 SSH 启动时只打印宿主机 URL，因为本地转发地址由 SSH 客户端或编辑器持有。传入 `--no-open` 可仅运行服务器而不打开浏览器。详见 [Web UI 指南](docs/user/guide/index.zh.md)。

<a id="run-from-source"></a>

### 从源码运行

如需从仓库源码运行：

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` 会准备仓库产物。`pnpm dsh web` 会直接使用这些已构建产物，不会重新构建。

## 社区与支持

- 通过 [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions) 提交反馈或 bug 报告。
- 为你的插件仓库添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) 话题，便于被发现。
- 欢迎加入 DeepSeek Harness 企微群！扫描下方二维码填写入群问卷，小助手会定期发送入群邀请。

<table>
  <thead>
    <tr>
      <th align="center">入群问卷</th>
      <th align="center">微信公众号</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><a href="https://trtgsjkv6r.feishu.cn/share/base/form/shrcnIt5twSVdLGD52KJBckGCgg"><img src="https://cdn.deepseek.com/harness/readme/community-wecom-survey.png" alt="DeepSeek Harness 入群问卷二维码" width="180" height="180"></a></td>
      <td align="center"><img src="https://cdn.deepseek.com/harness/readme/community-wechat-official-account.png" alt="DeepSeek Harness 团队微信公众号二维码" width="180" height="180"></td>
    </tr>
  </tbody>
</table>

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.zh.md)。

## 开发

请先阅读[开发指南](docs/development.zh.md)与[架构文档](docs/architecture.zh.md)。

`pnpm run dev:web` 会在一个终端里完成构建、启动，并在源码修改时重建 client bundle；`make help` 列出 Web 与 Desktop 对应的 Make target。完整表格见开发指南的「应用命令」一节。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 引用

```bibtex
@misc{deepseek-harness2026,
  title={DeepSeek Harness: Everything is a Plugin},
  author={DeepSeek-AI},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/deepseek-ai/deepseek-harness}},
}
```

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
