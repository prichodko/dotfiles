import { Duration, Effect, Layer, Schedule } from "effect"
import { CommandRunner, describeCommandError } from "../../../process/command-runner.ts"
import { DOTFILES_ROOT } from "../../../dotfiles/repository/live-dotfiles-repository.ts"
import { MachineProvider, MachineProviderFailure, type MachineSummary } from "../../lifecycle/machine-provider.ts"
import type { MachineProfile } from "../../profile.ts"

const hostFor = (name: string) => `exedev@${name}.exe.xyz`

export const quotePosixShellArgument = (argument: string): string => `'${argument.replaceAll("'", `'"'"'`)}'`

export const composeRemoteCommand = (argumentsList: ReadonlyArray<string>): string => argumentsList.map(quotePosixShellArgument).join(" ")

export const extractExeMachines = (value: unknown): ReadonlyArray<MachineSummary> => {
  const found: Array<MachineSummary> = []
  const visit = (entry: unknown): void => {
    if (Array.isArray(entry)) {
      for (const item of entry) visit(item)
      return
    }
    if (entry === null || typeof entry !== "object") return
    const record = entry as Record<string, unknown>
    const name = typeof record.vm_name === "string" ? record.vm_name : typeof record.name === "string" ? record.name : undefined
    if (name !== undefined) {
      const status = typeof record.status === "string" ? record.status : typeof record.state === "string" ? record.state : "unknown"
      found.push({ name, status })
    }
    for (const child of Object.values(record)) visit(child)
  }
  visit(value)
  return found.filter((machine, index) => found.findIndex((candidate) => candidate.name === machine.name) === index)
}

export const waitForSshWithin = <E, R>(
  attempt: Effect.Effect<void, E, R>,
  timeout: Duration.Input = "10 minutes",
  retrySpacing: Duration.Input = "5 seconds"
): Effect.Effect<void, E | MachineProviderFailure, R> => attempt.pipe(
  Effect.retry(Schedule.spaced(retrySpacing)),
  Effect.timeoutOrElse({
    duration: timeout,
    orElse: () => Effect.fail(new MachineProviderFailure({
      operation: "SSH readiness",
      detail: "SSH did not become ready within ten minutes."
    }))
  })
)

export const ExeMachineProviderLayer = Layer.effect(MachineProvider, Effect.gen(function*() {
  const runner = yield* CommandRunner
  const failure = (operation: string, detail: string, cause?: unknown) => new MachineProviderFailure({ operation, detail, ...(cause === undefined ? {} : { cause }) })
  const run = (operation: string, command: string, args: ReadonlyArray<string>, options: { readonly allowFailure?: boolean; readonly interactive?: boolean } = {}) =>
    runner.run({ command, args, cwd: DOTFILES_ROOT, ...options }).pipe(
      Effect.mapError((cause) => failure(operation, describeCommandError(cause), cause))
    )
  const list = Effect.gen(function*() {
    yield* run("access", "ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "exe.dev", "whoami"])
    const result = yield* run("list", "ssh", ["exe.dev", "ls", "--json"])
    let parsed: unknown
    try { parsed = JSON.parse(result.stdout) } catch (cause) { return yield* failure("list", "Exe returned invalid JSON.", cause) }
    return extractExeMachines(parsed)
  })
  const requirePublishedMain = Effect.gen(function*() {
    const branch = (yield* run("published main", "git", ["-C", DOTFILES_ROOT, "symbolic-ref", "--quiet", "--short", "HEAD"])).stdout.trim()
    if (branch !== "main") return yield* failure("published main", "The dotfiles repository must be on main.")
    const status = (yield* run("published main", "git", ["-C", DOTFILES_ROOT, "status", "--porcelain=v1"])).stdout.trim()
    if (status !== "") return yield* failure("published main", "The dotfiles repository must be clean.")
    yield* run("published main", "git", ["-C", DOTFILES_ROOT, "fetch", "origin", "main"])
    const local = (yield* run("published main", "git", ["-C", DOTFILES_ROOT, "rev-parse", "HEAD"])).stdout.trim()
    const remote = (yield* run("published main", "git", ["-C", DOTFILES_ROOT, "rev-parse", "refs/remotes/origin/main"])).stdout.trim()
    if (local !== remote) return yield* failure("published main", "Local main must match origin/main.")
  })
  const waitAttempt = (name: string) => run("SSH readiness", "ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=5", hostFor(name), "true"], { allowFailure: true }).pipe(
    Effect.flatMap((result) => result.exitCode === 0 ? Effect.void : Effect.fail(failure("SSH readiness", "SSH is not ready.")))
  )
  const waitForSsh = (name: string) => waitForSshWithin(waitAttempt(name)).pipe(
    Effect.mapError((cause) => cause instanceof MachineProviderFailure && cause.detail.includes("ten minutes")
      ? cause
      : failure("SSH readiness", "SSH did not become ready within ten minutes.", cause))
  )
  const bootstrap = (name: string, profile: MachineProfile) => {
    const remoteEnv = profile === "full" ? "linux,full" : "linux"
    return run("bootstrap", "mise", [
      "bootstrap",
      "remote",
      "--host",
      hostFor(name),
      "--remote-env",
      remoteEnv,
      "--yes",
      "--update",
      "--locked",
      "--fail-fast",
      "--force-dotfiles"
    ]).pipe(Effect.asVoid)
  }
  const remoteTask = (operation: string, name: string, command: string) => run(
    operation,
    "ssh",
    [hostFor(name), `export PATH="$HOME/.local/bin:$PATH"; ${command}`]
  ).pipe(Effect.asVoid)
  const ensureBootstrapped = (name: string, profile: MachineProfile) => Effect.gen(function*() {
    const inspection = yield* run("bootstrap inspection", "ssh", [
      "-o",
      "BatchMode=yes",
      "-o",
      "ConnectTimeout=10",
      hostFor(name),
      "test -x \"$HOME/.local/bin/mise\" && test -d \"$HOME/.dotfiles\""
    ], { allowFailure: true })
    if (inspection.exitCode === 0) return
    yield* waitForSsh(name)
    yield* bootstrap(name, profile)
  })
  return MachineProvider.of({
    requirePublishedMain,
    list,
    create: (input) => run("create", "ssh", ["exe.dev", "new", "--json", `--name=${input.name}`, "--cpu", String(input.cpu), "--memory", input.memory, "--disk", input.disk]).pipe(Effect.asVoid),
    waitForSsh,
    bootstrap,
    apply: (name, profile) => ensureBootstrapped(name, profile).pipe(
      Effect.andThen(remoteTask("apply", name, `cd "$HOME/.dotfiles" && mise run dotfiles:pull && mise run machine:apply${profile === "full" ? " full" : ""}`))
    ),
    validate: (name, profile) => remoteTask("validate", name, `cd "$HOME/.dotfiles" && mise run machine:validate${profile === "full" ? " full" : ""}`),
    shell: (name, command) => run("shell", "ssh", [hostFor(name), ...(command.length === 0 ? [] : [composeRemoteCommand(command)])], { interactive: true }).pipe(Effect.asVoid),
    remove: (name) => run("remove", "ssh", ["exe.dev", "rm", name], { interactive: true }).pipe(Effect.asVoid)
  })
}))
