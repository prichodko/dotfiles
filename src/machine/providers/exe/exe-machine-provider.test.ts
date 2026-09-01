import { expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { makeRecordingCommandRunner } from "../../../process/recording-command-runner.ts"
import { MachineProvider } from "../../lifecycle/machine-provider.ts"
import { composeRemoteCommand, ExeMachineProviderLayer, exeRemoteEnvironments, extractExeMachines, waitForSshWithin } from "./exe-machine-provider.ts"
import { EXE_DIRECT_SSH_ARGUMENTS, EXE_MISE_SSH_OPTION_ARGUMENTS, EXE_SSH_OPTIONS } from "./exe-ssh-policy.ts"

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
      "--yes",
      "--update",
      "--locked",
      "--fail-fast",
      "--force-dotfiles"
    ],
    cwd: expect.any(String)
  })
  expect(exeRemoteEnvironments("core")).toEqual(["linux", "exe"])
  expect(exeRemoteEnvironments("full")).toEqual(["linux", "exe", "full"])
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
