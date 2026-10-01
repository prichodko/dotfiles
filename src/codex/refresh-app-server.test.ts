import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect } from "effect"
import { makeRecordingCommandRunner } from "../process/recording-command-runner.ts"
import type { CommandResult } from "../process/command-runner.ts"
import { listenerInode, parseServerVersion, processStartTime, refreshCodexAppServer, restartLegacyLinuxServer, type RefreshOptions } from "./refresh-app-server.ts"

const version = (extra: Record<string, unknown> = {}): CommandResult => ({
  exitCode: 0,
  stdout: JSON.stringify({ status: "running", cliVersion: "0.159.2", appServerVersion: "0.156.1", socketPath: "/control.sock", ...extra }),
  stderr: ""
})
const success: CommandResult = { exitCode: 0, stdout: "", stderr: "" }
const failure = (stderr: string): CommandResult => ({ exitCode: 1, stdout: "", stderr })
const current = version({ appServerVersion: "0.159.2" })
const run = async (results: ReadonlyArray<CommandResult>, options: RefreshOptions = {}) => {
  const runner = await Effect.runPromise(makeRecordingCommandRunner(results))
  const program = refreshCodexAppServer({ socketExists: async () => true, attempts: 3, retryDelay: 0, ...options }).pipe(Effect.provide(runner.layer))
  return { program, commands: () => Effect.runPromise(runner.commands) }
}

describe("refreshCodexAppServer", () => {
  test("does not start a stopped server", async () => {
    const fixture = await run([], { socketExists: async () => false })
    expect(await Effect.runPromise(fixture.program)).toBe("not running")
    expect(await fixture.commands()).toEqual([])
  })

  test.each(["Connection refused (os error 111)", "No such file or directory (os error 2)"])("ignores a stale socket: %s", async (message) => {
    const fixture = await run([failure(message)])
    expect(await Effect.runPromise(fixture.program)).toBe("not running")
    expect(await fixture.commands()).toHaveLength(1)
  })

  test("is idempotent for an already-current server", async () => {
    const fixture = await run([current, current])
    expect(await Effect.runPromise(fixture.program)).toBe("current")
    expect(await Effect.runPromise(fixture.program)).toBe("current")
    expect((await fixture.commands()).every((command) => command.args?.at(-1) === "version")).toBe(true)
  })

  test.each(["systemd", "launchd"])("restarts a %s daemon already pinned to the selected CLI", async (backend) => {
    const fixture = await run([version({ backend, managedCodexVersion: "0.159.2" }), success, current])
    expect(await Effect.runPromise(fixture.program)).toBe("restarted (0.156.1 → 0.159.2)")
    expect((await fixture.commands())[1]?.args).toEqual(["app-server", "daemon", "restart"])
  })

  test.each(["0.156.1", null])("updates a stale daemon package %s from the selected CLI, not upstream", async (managedCodexVersion) => {
    const fixture = await run([version({ backend: "systemd", managedCodexVersion }), success, current])
    await Effect.runPromise(fixture.program)
    expect((await fixture.commands())[1]?.args).toEqual(["app-server", "daemon", "update", "--from-cli", "--yes"])
  })

  test("refreshes a legacy server once and waits through disconnect and stale responses", async () => {
    const sockets: string[] = []
    const fixture = await run([version(), failure("Connection refused"), version(), current, current], {
      restartLegacy: async (socket) => { sockets.push(socket) }
    })
    expect(await Effect.runPromise(fixture.program)).toBe("restarted (0.156.1 → 0.159.2)")
    expect(await Effect.runPromise(fixture.program)).toBe("current")
    expect(sockets).toEqual(["/control.sock"])
    expect((await fixture.commands()).every((command) => command.args?.at(-1) === "version")).toBe(true)
  })

  test("does not restart after a query or parse failure", async () => {
    for (const result of [failure("Permission denied"), { ...success, stdout: "invalid json" }, version({ cliVersion: null }), version({ status: "unknown" })]) {
      let restarts = 0
      const fixture = await run([result], { restartLegacy: async () => { restarts++ } })
      await expect(Effect.runPromise(fixture.program)).rejects.toThrow()
      expect(restarts).toBe(0)
      expect(await fixture.commands()).toHaveLength(1)
    }
  })

  test("propagates managed restart failure without retrying the mutation", async () => {
    const fixture = await run([version({ backend: "systemd", managedCodexVersion: "0.159.2" }), failure("restart denied")])
    await expect(Effect.runPromise(fixture.program)).rejects.toMatchObject({ detail: expect.stringContaining("restart denied") })
    expect(await fixture.commands()).toHaveLength(2)
  })

  test("fails when legacy process identification fails", async () => {
    const fixture = await run([version()], { restartLegacy: async () => { throw new Error("identity changed") } })
    await expect(Effect.runPromise(fixture.program)).rejects.toMatchObject({ detail: expect.stringContaining("identity changed") })
    expect(await fixture.commands()).toHaveLength(1)
  })

  test("reports failure when the desktop does not reconnect with the selected version", async () => {
    const fixture = await run([version(), failure("Connection refused"), version(), version()], { restartLegacy: async () => {} })
    await expect(Effect.runPromise(fixture.program)).rejects.toMatchObject({ detail: expect.stringContaining("Reconnect the VM") })
    expect(await fixture.commands()).toHaveLength(4)
  })

  test("rejects a CLI selection changing during refresh", async () => {
    const fixture = await run([version(), version({ cliVersion: "0.160.0", appServerVersion: "0.160.0" })], { restartLegacy: async () => {} })
    await expect(Effect.runPromise(fixture.program)).rejects.toMatchObject({ detail: expect.stringContaining("CLI changed") })
  })

  test("bounds reconnection by elapsed time, not only attempt count", async () => {
    const fixture = await run([version(), failure("Connection refused")], { restartLegacy: async () => {}, retryDelay: 60_000, reconnectTimeout: 5 })
    await expect(Effect.runPromise(fixture.program)).rejects.toMatchObject({ detail: expect.stringContaining("Reconnect the VM") })
    expect(await fixture.commands()).toHaveLength(2)
  })

  test("stops polling when interrupted", async () => {
    const controller = new AbortController()
    const fixture = await run([version(), failure("Connection refused")], { restartLegacy: async () => {}, retryDelay: 60_000 })
    const promise = Effect.runPromise(fixture.program, { signal: controller.signal })
    // Wait until it is polling, then interrupt the sleep rather than waiting out the reconnect period.
    while ((await fixture.commands()).length < 2) await new Promise((resolve) => setTimeout(resolve, 1))
    controller.abort()
    await expect(promise).rejects.toThrow()
    expect(await fixture.commands()).toHaveLength(2)
  })
})

const directories: string[] = []
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }) })

const processStat = (start = "1234") => `42 (codex name (worker)) ${["S", ...Array(18).fill("0"), start].join(" ")}\n`
const unixEntry = (path: string, inode = "987", listening = true) => `000: 00000002 00000000 ${listening ? "00010000" : "00000000"} 0001 ${listening ? "01" : "03"} ${inode} ${path}\n`
const legacyFixture = () => {
  const root = mkdtempSync(join(tmpdir(), "codex-refresh-"))
  directories.push(root)
  const socket = join(root, "control.sock")
  writeFileSync(socket, "")
  mkdirSync(join(root, "net"))
  writeFileSync(join(root, "net/unix"), unixEntry(realpathSync(socket)) + unixEntry(realpathSync(socket), "456", false))
  const addProcess = (pid: string, args = ["codex", "app-server", "--listen", "unix://"], inode = "987", exe = "/mise/codex") => {
    mkdirSync(join(root, pid, "fd"), { recursive: true })
    writeFileSync(join(root, pid, "cmdline"), `${args.join("\0")}\0`)
    writeFileSync(join(root, pid, "stat"), processStat())
    symlinkSync(exe, join(root, pid, "exe"))
    symlinkSync(`socket:[${inode}]`, join(root, pid, "fd/3"))
  }
  const signals: number[] = []
  const options = { procRoot: root, platform: "linux", uid: statSync(root).uid, signal: (pid: number) => { signals.push(pid) } }
  return { root, socket, addProcess, signals, options }
}

describe("legacy Linux process identification", () => {
  test("targets only the listening socket owner, not a connected proxy or unrelated server", async () => {
    const fixture = legacyFixture()
    fixture.addProcess("42")
    fixture.addProcess("43", ["codex", "app-server", "proxy"], "456")
    fixture.addProcess("44", undefined, "111")
    await restartLegacyLinuxServer(fixture.socket, fixture.options)
    expect(fixture.signals).toEqual([42])
  })

  test("rejects ambiguous ownership, foreign users, proxies, lifecycle commands and other executables", async () => {
    for (const mode of ["ambiguous", "foreign", "proxy", "daemon", "exe"]) {
      const fixture = legacyFixture()
      fixture.addProcess("42", mode === "proxy" ? ["codex", "app-server", "proxy"] : mode === "daemon" ? ["codex", "app-server", "daemon", "--listen", "unix://"] : undefined, undefined, mode === "exe" ? "/bin/other" : undefined)
      if (mode === "ambiguous") fixture.addProcess("43")
      await expect(restartLegacyLinuxServer(fixture.socket, { ...fixture.options, uid: mode === "foreign" ? -1 : fixture.options.uid })).rejects.toThrow("unique")
      expect(fixture.signals).toEqual([])
    }
  })

  test("refuses non-Linux legacy launchers without sending a signal", async () => {
    const fixture = legacyFixture()
    await expect(restartLegacyLinuxServer(fixture.socket, { ...fixture.options, platform: "darwin" })).rejects.toThrow("Linux VM")
    expect(fixture.signals).toEqual([])
  })

  test("skips protected same-user processes while identifying the readable server", async () => {
    const fixture = legacyFixture()
    fixture.addProcess("42")
    fixture.addProcess("43")
    const readText = async (path: string) => {
      if (path.endsWith("/42/cmdline")) throw Object.assign(new Error("permission denied"), { code: "EACCES" })
      return readFileSync(path, "utf8")
    }
    await restartLegacyLinuxServer(fixture.socket, { ...fixture.options, readText })
    expect(fixture.signals).toEqual([43])
  })

  test("does not signal a reused PID or a replaced listening socket", async () => {
    for (const mode of ["pid", "socket"]) {
      const fixture = legacyFixture()
      fixture.addProcess("42")
      let reads = 0
      const readText = async (path: string) => {
        const value = readFileSync(path, "utf8")
        if (path.endsWith(mode === "pid" ? "/stat" : "/net/unix") && ++reads === 2) {
          return mode === "pid" ? processStat("5678") : unixEntry(realpathSync(fixture.socket), "999")
        }
        return value
      }
      await expect(restartLegacyLinuxServer(fixture.socket, { ...fixture.options, readText })).rejects.toThrow("identity changed")
      expect(fixture.signals).toEqual([])
    }
  })

  test("honors interruption before signalling the verified process", async () => {
    const fixture = legacyFixture()
    fixture.addProcess("42")
    const controller = new AbortController()
    controller.abort()
    await expect(restartLegacyLinuxServer(fixture.socket, { ...fixture.options, abortSignal: controller.signal })).rejects.toThrow()
    expect(fixture.signals).toEqual([])
  })

  test("requires a unique listener and handles spaces in socket paths and process names", () => {
    expect(listenerInode(unixEntry("/tmp/socket with spaces"), "/tmp/socket with spaces")).toBe("987")
    expect(processStartTime(processStat())).toBe("1234")
    expect(() => listenerInode(unixEntry("/socket", "456", false), "/socket")).toThrow()
    expect(() => listenerInode(unixEntry("/socket") + unixEntry("/socket"), "/socket")).toThrow()
    expect(() => processStartTime("malformed")).toThrow()
    expect(() => parseServerVersion("[]")).toThrow()
  })
})
