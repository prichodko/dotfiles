import { expect, test } from "bun:test"
import { Effect, Layer, Ref } from "effect"
import { makeRecordingDotfilesRepository } from "../../dotfiles/repository/recording-dotfiles-repository.ts"
import { RepositoryValidation } from "../../dotfiles/validation/validate-repository.ts"
import { makeRecordingCommandRunner } from "../../process/recording-command-runner.ts"
import { LiveMachineLockUpdateLayer, MachineLockUpdate } from "./update-machine-locks.ts"

test("updates core and full lock files before validation", async () => {
  const runner = await Effect.runPromise(makeRecordingCommandRunner())
  const repository = await Effect.runPromise(makeRecordingDotfilesRepository())
  const validationOperations = await Effect.runPromise(Ref.make<ReadonlyArray<string>>([]))
  const validationLayer = Layer.succeed(RepositoryValidation, RepositoryValidation.of({
    validate: Ref.update(validationOperations, (operations) => [...operations, "validate"])
  }))
  const dependencies = Layer.mergeAll(runner.layer, repository.layer, validationLayer)
  const layer = LiveMachineLockUpdateLayer.pipe(Layer.provide(dependencies))

  await Effect.runPromise(Effect.gen(function*() {
    yield* (yield* MachineLockUpdate).update
  }).pipe(Effect.provide(layer)))

  expect(await Effect.runPromise(repository.operations)).toEqual(["requirePullPreconditions"])
  expect((await Effect.runPromise(runner.commands)).map((command) => command.args?.slice(2))).toEqual([
    ["lock", "--bump"],
    ["lock", "--bump"],
    ["bootstrap", "dotfiles", "apply", "--yes"],
    ["install", "--locked", "--dry-run"],
    ["install", "--locked", "--dry-run"]
  ])
  expect(await Effect.runPromise(Ref.get(validationOperations))).toEqual(["validate"])
})
