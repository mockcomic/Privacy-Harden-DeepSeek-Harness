/**
 * Keyless zero-egress boot proof: the shipped headless profile boots and completes one no-op
 * turn with every outbound hop forced through a recording CONNECT proxy, and the proxy must
 * observe exactly the declared allowlist of hosts — empty by default.
 *
 * The harness resolves the proxy environment through installProxyFromEnvironment, so both
 * `fetch` and node:http/https connections reach the recording proxy and name their target
 * there. A new startup egress path that upstream merges breaks this test loudly: add the host
 * to BOOT_EGRESS_ALLOWLIST only with a comment stating why the connection exists and which
 * data crosses it.
 * @module
 */
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'
import { resolveExampleLaunch } from '@deepseek-ai/dsh-loader-smoke'

const dshBinScript = fileURLToPath(new URL('../src/bin.ts', import.meta.url))
const tsconfigPath = fileURLToPath(new URL('../../../tsconfig.json', import.meta.url))
const noopFixture = pathToFileURL(fileURLToPath(
  new URL('./profiles/headless/tests/fixtures/noop-llm.mjs', import.meta.url),
)).href

/** Hosts a keyless headless boot may contact, with the reason each one earns its entry. */
const BOOT_EGRESS_ALLOWLIST: readonly string[] = [
  // Empty by default: the fork refuses reporting collectors and mounts no analytics.
  // Example entry: 'cdn.example.test' — 'connector guide archive download at plugin load'.
]

const processTimeoutMs = 90_000

interface RecordingProxy {
  server: Server
  url: string
  /** Bare hostnames of every CONNECT or absolute-form request the child attempted. */
  hosts: string[]
  close(): Promise<void>
}

async function startRecordingProxy(): Promise<RecordingProxy> {
  const hosts: string[] = []
  const record = (raw: string): void => {
    try {
      hosts.push(new URL(raw.startsWith('http') ? raw : `http://${raw}`).hostname)
    } catch {
      hosts.push(raw)
    }
  }
  const server = createServer((request, response) => {
    if (request.url !== undefined) record(request.url)
    // Fail any full request closed: the point is the observation, not the answer.
    response.writeHead(502)
    response.end()
  })
  server.on('connect', (request, socket) => {
    if (request.url !== undefined) record(request.url)
    socket.write('HTTP/1.1 502 Connection refused by test proxy\r\n\r\n')
    socket.destroy()
  })
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve) })
  const address = server.address() as AddressInfo
  return {
    server,
    url: `http://127.0.0.1:${String(address.port)}`,
    hosts,
    close: () => new Promise<void>((resolve) => { server.close(() => { resolve() }) }),
  }
}

describe('keyless headless boot makes no outbound connection', () => {
  it('boots the shipped profile and completes one no-op turn through a recording proxy', async () => {
    const proxy = await startRecordingProxy()
    const cwd = await mkdtemp(join(tmpdir(), 'dsh-zero-egress-'))
    try {
      const home = join(cwd, '.dsh')
      const profileDir = join(home, 'profiles', 'headless')
      await mkdir(profileDir, { recursive: true })
      await writeFile(join(profileDir, 'package.json'), JSON.stringify({
        name: 'dsh-profile-headless',
        private: true,
        dependencies: {},
        dsh: {
          profile: {
            bundles: [
              '@deepseek-ai/dsh-base',
              '@deepseek-ai/dsh-headless',
            ],
          },
        },
      }, undefined, 2) + '\n')
      await writeFile(join(profileDir, 'cordis.patch.yml'), [
        '- id: llm-deepseek',
        '  disabled: true',
        '- insert:',
        '    - id: noop-fixture-llm',
        `      name: '${noopFixture}'`,
        '',
      ].join('\n'))
      const launch = resolveExampleLaunch({
        srcBin: dshBinScript,
        configArgs: ['--profile', 'headless', 'respond with the single word BOOT_OK'],
        tsconfigPath,
        env: {
          DSH_HOME: home,
          DSH_AGENTS_HOME: join(cwd, '.agents'),
          DSH_TELEMETRY_DISABLED: '1',
          DEEPSEEK_API_KEY: '',
          HTTP_PROXY: proxy.url,
          HTTPS_PROXY: proxy.url,
          NODE_OPTIONS: [
            process.env.NODE_OPTIONS,
            '--disable-warning=ExperimentalWarning',
            '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
          ].filter(Boolean).join(' '),
        },
      })
      const result = await execa(launch.command, launch.args, {
        cwd,
        env: launch.env,
        input: '',
        timeout: processTimeoutMs,
        killSignal: 'SIGKILL',
        reject: false,
      })
      expect(
        result.exitCode,
        `dsh headless boot exited unexpectedly.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
      ).toBe(0)
      expect(result.stdout).toContain('BOOT_OK')
      expect([...new Set(proxy.hosts)].sort()).toEqual([...BOOT_EGRESS_ALLOWLIST].sort())
    } finally {
      await proxy.close()
      await rm(cwd, { recursive: true, force: true })
    }
  }, processTimeoutMs + 30_000)
})
