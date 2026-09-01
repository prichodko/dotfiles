import { expect, test } from "bun:test"
import { Cause, Effect, Layer, Option } from "effect"
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { makeRecordingCommandRunner } from "../../../process/recording-command-runner.ts"
import { MachineProvider, MachineProviderFailure } from "../../lifecycle/machine-provider.ts"
import {
  buildExeApplyCommand,
  composeRemoteCommand,
  ExeMachineProviderLayer,
  exeRemoteEnvironments,
  extractExeMachines,
  waitForSshWithin
} from "./exe-machine-provider.ts"
import { EXE_DIRECT_SSH_ARGUMENTS, EXE_MISE_SSH_OPTION_ARGUMENTS, EXE_SSH_OPTIONS } from "./exe-ssh-policy.ts"

const runExeApplyCommand = (input: {
  readonly firstPullStatus: number
  readonly headAfter: string
  readonly secondPullStatus?: number
}) => {
  const temporaryHome = mkdtempSync(join(tmpdir(), "exe-apply-command-"))
  try {
    mkdirSync(join(temporaryHome, ".dotfiles"), { recursive: true })
    const traceFile = join(temporaryHome, "trace")
    const shell = `
git() {
  if [ ! -e "$HEAD_MARKER" ]; then
    touch "$HEAD_MARKER"
    printf '%s\\n' "$HEAD_BEFORE"
  else
    printf '%s\\n' "$HEAD_AFTER"
  fi
}
mise() {
  printf '%s\\n' "$*" >> "$TRACE_FILE"
  case "$*" in
    *"run dotfiles:pull"*)
      if [ ! -e "$PULL_MARKER" ]; then
        touch "$PULL_MARKER"
        return "$FIRST_PULL_STATUS"
      fi
      return "$SECOND_PULL_STATUS"
      ;;
  esac
  return 0
}
${buildExeApplyCommand("core")}
`
    const result = Bun.spawnSync(["/bin/sh", "-c", shell], {
      cwd: temporaryHome,
      env: {
        ...process.env,
        FIRST_PULL_STATUS: String(input.firstPullStatus),
        HEAD_AFTER: input.headAfter,
        HEAD_BEFORE: "before",
        HEAD_MARKER: join(temporaryHome, "head-marker"),
        HOME: temporaryHome,
        PULL_MARKER: join(temporaryHome, "pull-marker"),
        SECOND_PULL_STATUS: String(input.secondPullStatus ?? 0),
        TRACE_FILE: traceFile
      },
      stdout: "pipe",
      stderr: "pipe"
    })
    return {
      exitCode: result.exitCode,
      trace: readFileSync(traceFile, "utf8").trim().split("\n")
    }
  } finally {
    rmSync(temporaryHome, { recursive: true, force: true })
  }
}

test("extracts Exe machines from nested JSON", () => {
  expect(extractExeMachines({ vms: [{
    vm_name: "work",
    status: "running",
    region: "fra",
    region_display: "Frankfurt, Germany"
  }] })).toEqual([{
    name: "work",
    status: "running",
    region: "fra",
    regionDisplay: "Frankfurt, Germany"
  }])
})

test("uses explicit null values for missing or unknown Exe regions", () => {
  expect(extractExeMachines({ vms: [{ vm_name: "work", status: 42, region: 42 }] })).toEqual([{
    name: "work",
    status: "unknown",
    region: null,
    regionDisplay: null
  }])
  expect(extractExeMachines({ machines: [{ name: "work", state: "running" }] })).toEqual([])
})

test("uses a dynamic ad-hoc bootstrap host", async () => {
  const recording = await Effect.runPromise(makeRecordingCommandRunner())
  const layer = ExeMachineProviderLayer.pipe(Layer.provide(recording.layer))
  await Effect.runPromise(MachineProvider.use((provider) => provider.bootstrap("work", "full")).pipe(Effect.provide(layer)))
  expect(await Effect.runPromise(recording.commands)).toContainEqual({
    command: "mise",
    args: [
      "bootstrap",
      "remote",
      "--host",
      "exedev@work.exe.xyz",
      "--remote-env",
      "linux,exe,full",
      ...EXE_MISE_SSH_OPTION_ARGUMENTS,
      "--install-mise",
      "--yes",
      "--update",
      "--locked",
      "--fail-fast",
      "--force-dotfiles"
    ],
    cwd: expect.any(String)
  })
  expect((await Effect.runPromise(recording.commands)).at(-1)).toMatchObject({
    command: "ssh",
    args: [
      ...EXE_DIRECT_SSH_ARGUMENTS,
      "-o",
      "BatchMode=yes",
      "-o",
      "ConnectTimeout=10",
      "exedev@work.exe.xyz",
      expect.stringContaining('"$HOME/.local/bin/mise" --version')
    ]
  })
  expect(exeRemoteEnvironments("core")).toEqual(["linux", "exe"])
  expect(exeRemoteEnvironments("full")).toEqual(["linux", "exe", "full"])
})

test("fails bootstrap when persistent remote state is incomplete", async () => {
  const recording = await Effect.runPromise(makeRecordingCommandRunner([
    { exitCode: 0, stdout: "", stderr: "" },
    { exitCode: 1, stdout: "", stderr: "missing" }
  ]))
  const layer = ExeMachineProviderLayer.pipe(Layer.provide(recording.layer))
  const exit = await Effect.runPromiseExit(MachineProvider.use((provider) => provider.bootstrap("work", "core")).pipe(Effect.provide(layer)))
  expect(exit._tag).toBe("Failure")
  if (exit._tag === "Failure") {
    const error = Cause.findErrorOption(exit.cause)
    expect(Option.isSome(error) && error.value instanceof MachineProviderFailure).toBe(true)
    if (Option.isSome(error) && error.value instanceof MachineProviderFailure) {
      expect(error.value.operation).toBe("bootstrap")
      expect(error.value.detail).toBe("Remote bootstrap completed without persistent mise or a valid dotfiles Git checkout.")
    }
  }
})

test("applies and checks bootstrap postconditions with the complete Exe environment", async () => {
  const recording = await Effect.runPromise(makeRecordingCommandRunner())
  const layer = ExeMachineProviderLayer.pipe(Layer.provide(recording.layer))
  await Effect.runPromise(MachineProvider.use((provider) => provider.apply("work", "core")).pipe(Effect.provide(layer)))
  expect(await Effect.runPromise(recording.commands)).toContainEqual({
    command: "ssh",
    args: [
      ...EXE_DIRECT_SSH_ARGUMENTS,
      "exedev@work.exe.xyz",
      expect.stringContaining("'mise' '-E' 'linux' '-E' 'exe' 'bootstrap' 'status' '--missing'")
    ],
    cwd: expect.any(String)
  })
})

test("re-runs remote pull only when pull changes the checked-out code", () => {
  const command = buildExeApplyCommand("full")
  const pull = "'mise' '-E' 'linux' '-E' 'exe' '-E' 'full' 'run' 'dotfiles:pull'"
  const apply = "'mise' '-E' 'linux' '-E' 'exe' '-E' 'full' 'run' 'machine:apply' '--' 'full'"
  const status = "'mise' '-E' 'linux' '-E' 'exe' '-E' 'full' 'bootstrap' 'status' '--missing'"
  const pullOccurrences = command.split(pull).length - 1

  expect(pullOccurrences).toBe(2)
  expect(command).toContain("dotfiles_head_before=$(git rev-parse HEAD) || exit $?")
  expect(command).toContain("dotfiles_head_after=$(git rev-parse HEAD) || exit $?")
  expect(command).toContain('if [ "$dotfiles_head_before" != "$dotfiles_head_after" ]; then')
  expect(command).toContain(`${pull} || dotfiles_pull_status=$?`)
  expect(command).toContain(`  ${pull} || exit $?`)
  expect(command).toContain('elif [ "$dotfiles_pull_status" -ne 0 ]; then\n  exit "$dotfiles_pull_status"')
  expect(command.indexOf("dotfiles_head_after=")).toBeLessThan(command.indexOf("if ["))
  expect(command.lastIndexOf(pull)).toBeLessThan(command.indexOf(apply))
  expect(command.indexOf(apply)).toBeLessThan(command.indexOf(status))
})

test("retries a failed pull after HEAD changes before apply and status", () => {
  expect(runExeApplyCommand({ firstPullStatus: 7, headAfter: "after" })).toEqual({
    exitCode: 0,
    trace: [
      "-E linux -E exe run dotfiles:pull",
      "-E linux -E exe run dotfiles:pull",
      "-E linux -E exe run machine:apply",
      "-E linux -E exe bootstrap status --missing"
    ]
  })
})

test("propagates a failed pull without a HEAD change", () => {
  expect(runExeApplyCommand({ firstPullStatus: 7, headAfter: "before" })).toEqual({
    exitCode: 7,
    trace: ["-E linux -E exe run dotfiles:pull"]
  })
})

test("does not retry a successful pull without a HEAD change", () => {
  expect(runExeApplyCommand({ firstPullStatus: 0, headAfter: "before" })).toEqual({
    exitCode: 0,
    trace: [
      "-E linux -E exe run dotfiles:pull",
      "-E linux -E exe run machine:apply",
      "-E linux -E exe bootstrap status --missing"
    ]
  })
})

test("inspects the executable mise binary and the dotfiles Git checkout", async () => {
  const recording = await Effect.runPromise(makeRecordingCommandRunner([
    { exitCode: 1, stdout: "", stderr: "missing" }
  ]))
  const layer = ExeMachineProviderLayer.pipe(Layer.provide(recording.layer))
  const inspection = await Effect.runPromise(MachineProvider.use((provider) => provider.inspectBootstrap("work")).pipe(Effect.provide(layer)))
  expect(inspection._tag).toBe("Incomplete")
  const commands = await Effect.runPromise(recording.commands)
  expect(commands[0]?.args?.at(-1)).toContain('"$HOME/.local/bin/mise" --version')
  expect(commands[0]?.args?.at(-1)).toContain("rev-parse --is-inside-work-tree")
  expect(commands[0]?.args?.at(-1)).toContain("rev-parse --verify HEAD")
})

test("uses strict managed trust on every direct Exe SSH connection", async () => {
  const recording = await Effect.runPromise(makeRecordingCommandRunner([
    { exitCode: 0, stdout: "", stderr: "" },
    { exitCode: 0, stdout: '{"vms":[]}', stderr: "" }
  ]))
  const layer = ExeMachineProviderLayer.pipe(Layer.provide(recording.layer))
  await Effect.runPromise(MachineProvider.use((provider) => Effect.gen(function*() {
    yield* provider.list
    yield* provider.create({ name: "work-vm", cpu: 2, memory: "8GB", disk: "25GB" })
    yield* provider.waitForSsh("work-vm")
    yield* provider.inspectBootstrap("work-vm")
    yield* provider.apply("work-vm", "core")
    yield* provider.validate("work-vm", "full")
    yield* provider.shell("work-vm", ["true"])
    yield* provider.remove("work-vm")
  })).pipe(Effect.provide(layer)))
  const sshCommands = (await Effect.runPromise(recording.commands)).filter((command) => command.command === "ssh")
  expect(sshCommands).not.toHaveLength(0)
  for (const command of sshCommands) {
    expect(command.args?.slice(0, EXE_DIRECT_SSH_ARGUMENTS.length)).toEqual(EXE_DIRECT_SSH_ARGUMENTS)
    expect(command.args?.join(" ")).not.toContain("accept-new")
    expect(command.args?.join(" ")).not.toContain("StrictHostKeyChecking=no")
  }
  for (const option of EXE_SSH_OPTIONS) expect(sshCommands.every((command) => command.args?.includes(option))).toBe(true)
})

test("bounds SSH readiness by one total timeout", async () => {
  const startedAt = performance.now()
  const result = await Effect.runPromiseExit(waitForSshWithin(
    Effect.fail("not ready"),
    "20 millis",
    "1 millis"
  ))
  expect(result._tag).toBe("Failure")
  expect(performance.now() - startedAt).toBeLessThan(250)
})

test("quotes shell command arguments for the remote POSIX shell", async () => {
  const recording = await Effect.runPromise(makeRecordingCommandRunner())
  const layer = ExeMachineProviderLayer.pipe(Layer.provide(recording.layer))
  const command = ["printf", "%s", "a b", "it's", ";whoami", "$HOME", "$(whoami)"]
  await Effect.runPromise(MachineProvider.use((provider) => provider.shell("work", command)).pipe(Effect.provide(layer)))
  expect(await Effect.runPromise(recording.commands)).toContainEqual({
    command: "ssh",
    args: [...EXE_DIRECT_SSH_ARGUMENTS, "exedev@work.exe.xyz", composeRemoteCommand(command)],
    cwd: expect.any(String),
    interactive: true
  })
  expect(composeRemoteCommand(command)).toBe("'printf' '%s' 'a b' 'it'\"'\"'s' ';whoami' '$HOME' '$(whoami)'")
})

test("opens an interactive SSH session for an empty command", async () => {
  const recording = await Effect.runPromise(makeRecordingCommandRunner())
  const layer = ExeMachineProviderLayer.pipe(Layer.provide(recording.layer))
  await Effect.runPromise(MachineProvider.use((provider) => provider.shell("work", [])).pipe(Effect.provide(layer)))
  expect(await Effect.runPromise(recording.commands)).toContainEqual({
    command: "ssh",
    args: [...EXE_DIRECT_SSH_ARGUMENTS, "exedev@work.exe.xyz"],
    cwd: expect.any(String),
    interactive: true
  })
})
