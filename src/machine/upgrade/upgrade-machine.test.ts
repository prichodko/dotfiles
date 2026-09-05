import { expect, test } from "bun:test"
import { Cause, Effect, Layer, Option } from "effect"
import { makeRecordingDotfilesRepository } from "../../dotfiles/repository/recording-dotfiles-repository.ts"
import { RepositoryValidation, RepositoryValidationFailure } from "../../dotfiles/validation/validate-repository.ts"
import { CommandFailure, CommandRunner, type CommandInput } from "../../process/command-runner.ts"
import { LiveMachineUpgradeLayer, MachineUpgrade, MachineUpgradeFailure } from "./upgrade-machine.ts"

const fixture = async (failAt?: string, blockAt?: string) => {
  const repository = await Effect.runPromise(makeRecordingDotfilesRepository())
  const commands: Array<CommandInput> = []
  const runner = Layer.succeed(CommandRunner, CommandRunner.of({
    run: (input) => Effect.gen(function*() {
      const operation = input.command === "git" ? "diff" : input.args?.slice(2).join(" ") ?? ""
      commands.push(input)
      yield* repository.record(operation)
      if (operation === blockAt) return yield* Effect.never
      if (operation === failAt) {
        return yield* new CommandFailure({ input, exitCode: 1, stdout: "", stderr: "Injected failure" })
      }
      return { exitCode: 0, stdout: input.command === "git" ? "Lock-file version changes" : "", stderr: "" }
    })
  }))
  const validation = Layer.succeed(RepositoryValidation, RepositoryValidation.of({
    validateSource: repository.record("validateSource").pipe(Effect.andThen(
      failAt === "validateSource"
        ? Effect.fail(new RepositoryValidationFailure({ check: "source", detail: "Injected failure" }))
        : Effect.void
    )),
    validateApplied: repository.record("validateApplied"),
    validate: repository.record("validate")
  }))
  const layer = LiveMachineUpgradeLayer.pipe(Layer.provide(Layer.mergeAll(repository.layer, runner, validation)))
  return { repository, commands, layer }
}

test("releases the repository lock when application is interrupted", async () => {
  const { repository, layer } = await fixture(undefined, "--locked run machine:apply")
  const result = await Effect.runPromise(MachineUpgrade.use((service) => service.upgrade("core")).pipe(
    Effect.provide(layer), Effect.timeout("50 millis"), Effect.exit
  ))
  expect(result._tag).toBe("Failure")
  const operations = await Effect.runPromise(repository.operations)
  expect(operations.at(-2)).toBe("--locked run machine:apply")
  expect(operations.at(-1)).toBe("releaseLock")
})

for (const profile of ["core", "full"] as const) {
  test(`upgrades both lock files, validates source and tests, then applies ${profile}`, async () => {
    const { repository, commands, layer } = await fixture()
    await Effect.runPromise(MachineUpgrade.use((service) => service.upgrade(profile)).pipe(Effect.provide(layer)))
    expect(await Effect.runPromise(repository.operations)).toEqual([
      "acquireLock", "requireLockUpdatePreconditions", "lock --bump", "lock --bump", "diff",
      "validateSource", "--locked run test", `--locked run machine:apply${profile === "full" ? " -- full" : ""}`, "releaseLock"
    ])
    expect(commands[0]?.env?.MISE_ENV?.split(",")).not.toContain("full")
    expect(commands[1]?.env?.MISE_ENV?.split(",")).toContain("full")
    for (const input of commands.slice(3)) {
      expect(input.env?.MISE_ENV?.split(",").includes("full")).toBe(profile === "full")
      expect(input.interactive).toBe(true)
    }
    expect(commands[2]?.args).toContain("HEAD")
    expect(commands[2]?.args?.slice(-2)).toEqual(["mise.lock", "mise.full.lock"])
    expect(commands.every((input) => !input.args?.some((argument) => ["commit", "push", "reset", "checkout"].includes(argument)))).toBe(true)
  })
}

for (const [failAt, operation] of [
  ["lock --bump", "core lock update"],
  ["diff", "version changes"],
  ["validateSource", "source validation"],
  ["--locked run test", "tests"],
  ["--locked run machine:apply", "local application"]
] as const) {
  test(`stops and releases the lock after ${operation} fails`, async () => {
    const { repository, layer } = await fixture(failAt)
    const result = await Effect.runPromise(MachineUpgrade.use((service) => service.upgrade("core")).pipe(Effect.provide(layer), Effect.exit))
    expect(result._tag).toBe("Failure")
    if (result._tag !== "Failure") throw new Error("Expected an upgrade failure")
    const failure = Option.getOrThrow(Cause.findErrorOption(result.cause))
    expect(failure).toBeInstanceOf(MachineUpgradeFailure)
    expect(failure.operation).toBe(operation)
    const operations = await Effect.runPromise(repository.operations)
    expect(operations.at(-2)).toBe(failAt)
    expect(operations.at(-1)).toBe("releaseLock")
    if (operation !== "local application") expect(operations).not.toContain("--locked run machine:apply")
  })
}
