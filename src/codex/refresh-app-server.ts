import { readFile, readdir, readlink, realpath, stat } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { Data, Effect } from "effect"
import { CommandRunner } from "../process/command-runner.ts"

export class CodexRefreshFailure extends Data.TaggedError("CodexRefreshFailure")<{
  readonly detail: string
}> {}

interface ServerVersion {
  readonly cliVersion: string
  readonly appServerVersion: string
  readonly socketPath: string
  readonly backend?: string
  readonly managedCodexVersion?: string | null
}

export interface RefreshOptions {
  readonly socketExists?: () => Promise<boolean>
  readonly restartLegacy?: (socketPath: string) => Promise<void>
  readonly attempts?: number
  readonly retryDelay?: number
  readonly reconnectTimeout?: number
}

const controlSocketExists = async (): Promise<boolean> => {
  const socket = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "app-server-control/app-server-control.sock")
  try {
    return (await stat(socket)).isSocket()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
    throw error
  }
}

export const parseServerVersion = (output: string): ServerVersion => {
  const value: unknown = JSON.parse(output)
  if (typeof value !== "object" || value === null) throw new Error("Invalid Codex version response.")
  const record = value as Record<string, unknown>
  for (const key of ["cliVersion", "appServerVersion", "socketPath"] as const) {
    if (typeof record[key] !== "string" || record[key] === "") throw new Error(`Missing Codex ${key}.`)
  }
  if (record.status !== "running") throw new Error("Codex did not report a running server.")
  if (record.backend !== undefined && typeof record.backend !== "string") throw new Error("Invalid Codex daemon backend.")
  return record as unknown as ServerVersion
}

// Connected sockets share the listener's path, but only the listener identifies the server.
export const listenerInode = (table: string, socketPath: string): string => {
  const matches = table.split("\n").map((line) => line.trim().split(/\s+/)).filter((fields) =>
    fields[3] === "00010000" && fields[5] === "01" && fields.slice(7).join(" ") === socketPath
  )
  if (matches.length !== 1 || !/^\d+$/.test(matches[0]![6]!)) throw new Error("Cannot identify a unique Codex control socket listener.")
  return matches[0]![6]!
}

export const processStartTime = (value: string): string => {
  const start = value.slice(value.lastIndexOf(")") + 2).split(/\s+/)[19]
  if (!start || !/^\d+$/.test(start)) throw new Error("Cannot read the Codex process start time.")
  return start
}

interface LegacyOptions {
  readonly procRoot?: string
  readonly platform?: string
  readonly uid?: number
  readonly signal?: (pid: number) => void
  readonly abortSignal?: AbortSignal
  readonly readText?: (path: string) => Promise<string>
}

const ownsSocket = async (procRoot: string, pid: string, inode: string): Promise<boolean> => {
  const directory = join(procRoot, pid, "fd")
  for (const fd of await readdir(directory)) {
    try {
      if (await readlink(join(directory, fd)) === `socket:[${inode}]`) return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
  }
  return false
}

export const restartLegacyLinuxServer = async (socketPath: string, options: LegacyOptions = {}): Promise<void> => {
  if ((options.platform ?? process.platform) !== "linux") throw new Error("This unmanaged Codex server must be reconnected in the desktop app; automatic refresh supports the Linux VM launcher.")
  const procRoot = options.procRoot ?? "/proc"
  const uid = options.uid ?? process.getuid!()
  const readText = options.readText ?? ((path: string) => readFile(path, "utf8"))
  const socket = await realpath(socketPath)
  const socketTable = () => readText(join(procRoot, "net/unix"))
  const inode = listenerInode(await socketTable(), socket)
  const isServer = async (pid: string) => {
    const args = (await readText(join(procRoot, pid, "cmdline"))).split("\0")
    const listen = args.indexOf("--listen")
    return args.includes("app-server") && !args.includes("daemon") && listen !== -1 &&
      args[listen + 1]?.startsWith("unix://") === true &&
      (await readlink(join(procRoot, pid, "exe"))).replace(/ \(deleted\)$/, "").endsWith("/codex")
  }
  const startTime = async (pid: string) => processStartTime(await readText(join(procRoot, pid, "stat")))
  const candidates: Array<{ pid: string; start: string }> = []
  for (const pid of await readdir(procRoot)) {
    if (!/^\d+$/.test(pid)) continue
    try {
      if ((await stat(join(procRoot, pid))).uid !== uid) continue
      if (!await ownsSocket(procRoot, pid, inode) || !await isServer(pid)) continue
      candidates.push({ pid, start: await startTime(pid) })
    } catch (error) {
      // Linux can expose a same-user process directory while protecting its descriptors
      // (for example, after a privileged exec). Such a process cannot be verified as our server.
      if (!["ENOENT", "ESRCH", "EACCES", "EPERM"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error
    }
  }
  if (candidates.length !== 1) throw new Error("Cannot identify a unique, user-owned Codex app-server process; no process was stopped.")
  const candidate = candidates[0]!
  if (await startTime(candidate.pid) !== candidate.start ||
    !await ownsSocket(procRoot, candidate.pid, inode) || !await isServer(candidate.pid) ||
    listenerInode(await socketTable(), socket) !== inode) {
    throw new Error("Codex process identity changed before refresh; no process was stopped.")
  }
  // The connected desktop owns launch/reconnection. Do not install a competing supervisor.
  options.abortSignal?.throwIfAborted()
  if (options.signal) options.signal(Number(candidate.pid))
  else process.kill(Number(candidate.pid), "SIGTERM")
}

export const refreshCodexAppServer = (options: RefreshOptions = {}) => Effect.gen(function*() {
  const runner = yield* CommandRunner
  const attempt = <A>(action: (signal: AbortSignal) => Promise<A>) => Effect.tryPromise({
    try: action,
    catch: (error) => new CodexRefreshFailure({ detail: String(error) })
  })
  if (!(yield* attempt(options.socketExists ?? controlSocketExists))) return "not running" as const
  const query = () => runner.run({ command: "codex", args: ["app-server", "daemon", "version"], allowFailure: true }).pipe(
    Effect.timeoutOrElse({ duration: "5 seconds", orElse: () => Effect.fail(new CodexRefreshFailure({ detail: "Codex version query timed out; no further action was taken." })) })
  )
  const result = yield* query()
  if (result.exitCode !== 0) {
    if (/No such file or directory|Connection refused/i.test(result.stderr)) return "not running" as const
    return yield* Effect.fail(new CodexRefreshFailure({ detail: `Cannot query Codex app-server: ${result.stderr.trim()}` }))
  }
  const parse = (output: string) => Effect.try({ try: () => parseServerVersion(output), catch: (error) => new CodexRefreshFailure({ detail: String(error) }) })
  const before = yield* parse(result.stdout)
  if (before.appServerVersion === before.cliVersion) return "current" as const
  if (before.backend) {
    // Restart alone keeps the daemon's pinned package. Update from the mise-selected CLI when necessary.
    const args = before.managedCodexVersion === before.cliVersion
      ? ["app-server", "daemon", "restart"]
      : ["app-server", "daemon", "update", "--from-cli", "--yes"]
    const restart = yield* runner.run({ command: "codex", args, allowFailure: true }).pipe(
      Effect.timeoutOrElse({ duration: "60 seconds", orElse: () => Effect.fail(new CodexRefreshFailure({ detail: "Codex daemon refresh timed out; inspect daemon status before repeating machine:apply." })) })
    )
    if (restart.exitCode !== 0) return yield* Effect.fail(new CodexRefreshFailure({ detail: `Cannot refresh Codex app-server: ${restart.stderr.trim()}` }))
  } else {
    yield* attempt((signal) => options.restartLegacy ? options.restartLegacy(before.socketPath) : restartLegacyLinuxServer(before.socketPath, { abortSignal: signal }))
  }
  const reconnectFailure = () => Effect.fail(new CodexRefreshFailure({ detail: `Codex app-server did not reconnect with ${before.cliVersion}. Reconnect the VM in the desktop app, then repeat machine:apply.` }))
  return yield* Effect.gen(function*() {
    for (let index = 0; index < (options.attempts ?? 30); index++) {
      const after = yield* query()
      if (after.exitCode === 0) {
        const version = yield* parse(after.stdout)
        if (version.cliVersion !== before.cliVersion) return yield* Effect.fail(new CodexRefreshFailure({ detail: "The selected Codex CLI changed during refresh; repeat machine:apply." }))
        if (version.appServerVersion === before.cliVersion) return `restarted (${before.appServerVersion} → ${before.cliVersion})`
      }
      if (index + 1 < (options.attempts ?? 30)) yield* Effect.sleep(options.retryDelay ?? 1000)
    }
    return yield* reconnectFailure()
  }).pipe(Effect.timeoutOrElse({ duration: options.reconnectTimeout ?? 30_000, orElse: reconnectFailure }))
})
