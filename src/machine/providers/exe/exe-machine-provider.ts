import { Duration, Effect, Layer, Schedule } from "effect"
import { CommandRunner, describeCommandError } from "../../../process/command-runner.ts"
import { DOTFILES_ROOT } from "../../../dotfiles/repository/live-dotfiles-repository.ts"
import { MachineProvider, MachineProviderFailure, type MachineSummary } from "../../lifecycle/machine-provider.ts"
import { appendMiseEnvironments, machineProfileEnvironments, type MachineProfile } from "../../profile.ts"
import { EXE_DIRECT_SSH_ARGUMENTS, EXE_MISE_SSH_OPTION_ARGUMENTS } from "./exe-ssh-policy.ts"

const hostFor = (name: string) => `exedev@${name}.exe.xyz`

export const quotePosixShellArgument = (argument: string): string => `'${argument.replaceAll("'", `'"'"'`)}'`

export const composeRemoteCommand = (argumentsList: ReadonlyArray<string>): string => argumentsList.map(quotePosixShellArgument).join(" ")

export const extractExeMachines = (value: unknown): ReadonlyArray<MachineSummary> => {
  if (value === null || typeof value !== "object") return []
  const entries = Array.isArray(value) ? value : (value as Record<string, unknown>).vms
  if (!Array.isArray(entries)) return []
  const found = entries.flatMap((entry): ReadonlyArray<MachineSummary> => {
    if (entry === null || typeof entry !== "object") return []
    const record = entry as Record<string, unknown>
    if (typeof record.vm_name !== "string" || record.vm_name === "") return []
    return [{
      name: record.vm_name,
      status: typeof record.status === "string" && record.status !== "" ? record.status : "unknown",
      region: typeof record.region === "string" && record.region !== "" ? record.region : null,
      regionDisplay: typeof record.region_display === "string" && record.region_display !== "" ? record.region_display : null
    }]
  })
  return found.filter((machine, index) => found.findIndex((candidate) => candidate.name === machine.name) === index)
}

export const exeRemoteEnvironments = (profile: MachineProfile): ReadonlyArray<string> =>
  appendMiseEnvironments(undefined, ["linux", "exe", ...machineProfileEnvironments(profile)]).split(",")

const exeMiseEnvironmentArguments = (profile: MachineProfile): ReadonlyArray<string> =>
  exeRemoteEnvironments(profile).flatMap((environment) => ["-E", environment])

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
  const ssh = (operation: string, args: ReadonlyArray<string>, options: { readonly allowFailure?: boolean; readonly interactive?: boolean } = {}) =>
    run(operation, "ssh", [...EXE_DIRECT_SSH_ARGUMENTS, ...args], options)
  const list = Effect.gen(function*() {
    yield* ssh("access", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "exe.dev", "whoami"])
    const result = yield* ssh("list", ["exe.dev", "ls", "--json"])
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
  const waitAttempt = (name: string) => ssh("SSH readiness", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=5", hostFor(name), "true"], { allowFailure: true }).pipe(
    Effect.flatMap((result) => result.exitCode === 0 ? Effect.void : Effect.fail(failure("SSH readiness", "SSH is not ready.")))
  )
  const waitForSsh = (name: string) => waitForSshWithin(waitAttempt(name)).pipe(
    Effect.mapError((cause) => cause instanceof MachineProviderFailure && cause.detail.includes("ten minutes")
      ? cause
      : failure("SSH readiness", "SSH did not become ready within ten minutes.", cause))
  )
  const remoteTask = (operation: string, name: string, command: string) => ssh(
    operation,
    [hostFor(name), `export PATH="$HOME/.local/bin:$PATH"; ${command}`]
  ).pipe(Effect.asVoid)
  const inspectBootstrap = (name: string) => Effect.gen(function*() {
    const inspection = yield* ssh("bootstrap inspection", [
      "-o",
      "BatchMode=yes",
      "-o",
      "ConnectTimeout=10",
      hostFor(name),
      "test -x \"$HOME/.local/bin/mise\" && \"$HOME/.local/bin/mise\" --version >/dev/null 2>&1 && git -C \"$HOME/.dotfiles\" rev-parse --is-inside-work-tree >/dev/null 2>&1 && git -C \"$HOME/.dotfiles\" rev-parse --verify HEAD >/dev/null 2>&1"
    ], { allowFailure: true })
    return inspection.exitCode === 0
      ? { _tag: "Complete" } as const
      : { _tag: "Incomplete", reason: "The mise binary or dotfiles Git checkout is incomplete." } as const
  })
  const bootstrap = (name: string, profile: MachineProfile) => {
    const remoteEnv = exeRemoteEnvironments(profile).join(",")
    return run("bootstrap", "mise", [
      "bootstrap",
      "remote",
      "--host",
      hostFor(name),
      "--remote-env",
      remoteEnv,
      ...EXE_MISE_SSH_OPTION_ARGUMENTS,
      "--install-mise",
      "--yes",
      "--update",
      "--locked",
      "--fail-fast",
      "--force-dotfiles"
    ]).pipe(
      Effect.andThen(inspectBootstrap(name)),
      Effect.flatMap((inspection) => inspection._tag === "Complete"
        ? Effect.void
        : Effect.fail(failure(
          "bootstrap",
          "Remote bootstrap completed without persistent mise or a valid dotfiles Git checkout."
        )))
    )
  }
  const remoteMise = (profile: MachineProfile, argumentsList: ReadonlyArray<string>): string =>
    composeRemoteCommand(["mise", ...exeMiseEnvironmentArguments(profile), ...argumentsList])
  const applyCommand = (profile: MachineProfile): string => [
    'cd "$HOME/.dotfiles"',
    remoteMise(profile, ["run", "dotfiles:pull"]),
    remoteMise(profile, ["run", "machine:apply", ...(profile === "full" ? ["--", "full"] : [])]),
    remoteMise(profile, ["bootstrap", "status", "--missing"])
  ].join(" && ")
  return MachineProvider.of({
    requirePublishedMain,
    list,
    create: (input) => ssh("create", ["exe.dev", "new", "--json", `--name=${input.name}`, "--cpu", String(input.cpu), "--memory", input.memory, "--disk", input.disk]).pipe(Effect.asVoid),
    waitForSsh,
    inspectBootstrap,
    bootstrap,
    apply: (name, profile) => remoteTask("apply", name, applyCommand(profile)),
    validate: (name, profile) => remoteTask("validate", name, `cd "$HOME/.dotfiles" && ${remoteMise(profile, ["run", "machine:validate", ...(profile === "full" ? ["--", "full"] : [])])}`),
    shell: (name, command) => ssh("shell", [hostFor(name), ...(command.length === 0 ? [] : [composeRemoteCommand(command)])], { interactive: true }).pipe(Effect.asVoid),
    remove: (name) => ssh("remove", ["exe.dev", "rm", name], { interactive: true }).pipe(Effect.asVoid)
  })
}))
