import { expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { makeRecordingCommandRunner } from "../../../process/recording-command-runner.ts"
import { MachineProvider } from "../../lifecycle/machine-provider.ts"
import { composeRemoteCommand, ExeMachineProviderLayer, extractExeMachines, waitForSshWithin } from "./exe-machine-provider.ts"

test("extracts Exe machines from nested JSON", () => {
  expect(extractExeMachines({ vms: [{ vm_name: "work", status: "running" }] })).toEqual([{ name: "work", status: "running" }])
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
      "linux,full",
      "--yes",
      "--update",
      "--locked",
      "--fail-fast",
      "--force-dotfiles"
    ],
    cwd: expect.any(String)
  })
})

test("exports the persistent mise path for remote apply", async () => {
  const recording = await Effect.runPromise(makeRecordingCommandRunner())
  const layer = ExeMachineProviderLayer.pipe(Layer.provide(recording.layer))
  await Effect.runPromise(MachineProvider.use((provider) => provider.apply("work", "core")).pipe(Effect.provide(layer)))
  expect(await Effect.runPromise(recording.commands)).toContainEqual({
    command: "ssh",
    args: [
      "exedev@work.exe.xyz",
      'export PATH="$HOME/.local/bin:$PATH"; cd "$HOME/.dotfiles" && mise run dotfiles:pull && mise run machine:apply'
    ],
    cwd: expect.any(String)
  })
})

test("bootstraps an incomplete machine before remote apply", async () => {
  const recording = await Effect.runPromise(makeRecordingCommandRunner([
    { exitCode: 1, stdout: "", stderr: "missing" },
    { exitCode: 0, stdout: "", stderr: "" },
    { exitCode: 0, stdout: "", stderr: "" },
    { exitCode: 0, stdout: "", stderr: "" }
  ]))
  const layer = ExeMachineProviderLayer.pipe(Layer.provide(recording.layer))
  await Effect.runPromise(MachineProvider.use((provider) => provider.apply("work", "core")).pipe(Effect.provide(layer)))
  const commands = await Effect.runPromise(recording.commands)
  expect(commands.some((command) => command.command === "mise" && command.args?.includes("--force-dotfiles"))).toBe(true)
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
    args: ["exedev@work.exe.xyz", composeRemoteCommand(command)],
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
    args: ["exedev@work.exe.xyz"],
    cwd: expect.any(String),
    interactive: true
  })
})
