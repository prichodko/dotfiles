import { expect, test } from "bun:test"
import { Cause, Effect, Layer, Option } from "effect"
import { makeRecordingNotificationService } from "../../notification/recording-notification-service.ts"
import { makeRecordingDotfilesRepository } from "../repository/recording-dotfiles-repository.ts"
import { RepositoryValidation, RepositoryValidationFailure } from "../validation/validate-repository.ts"
import { SynchronizationFailure, synchronizeDotfiles } from "./synchronize-dotfiles.ts"

const validation = Layer.succeed(RepositoryValidation, RepositoryValidation.of({
  validateSource: Effect.void,
  validateApplied: Effect.void,
  validate: Effect.void
}))

test("synchronizes and retries one push race", async () => {
  const repository = await Effect.runPromise(makeRecordingDotfilesRepository({ paths: ["b", "a"], upstreamShas: ["one", "two"], pushResults: [false, true] }))
  const notifications = await Effect.runPromise(makeRecordingNotificationService)
  const recordingValidation = Layer.succeed(RepositoryValidation, RepositoryValidation.of({
    validateSource: repository.record("validateSource"),
    validateApplied: repository.record("validateApplied"),
    validate: repository.record("validate")
  }))
  const state = await Effect.runPromise(synchronizeDotfiles.pipe(
    Effect.provide(Layer.mergeAll(repository.layer, notifications.layer, recordingValidation))
  ))
  expect(state).toMatchObject({ _tag: "Completed", retryCount: 1 })
  const operations = await Effect.runPromise(repository.operations)
  expect(operations.filter((name) => name === "pushMain")).toHaveLength(2)
  expect(operations.filter((name) => [
    "validateSource",
    "commitStagedChanges",
    "verifyPublishedHead",
    "applyManagedFiles",
    "validateApplied",
    "listUntrackedFiles"
  ].includes(name))).toEqual([
    "validateSource",
    "commitStagedChanges",
    "verifyPublishedHead",
    "validateSource",
    "applyManagedFiles",
    "validateApplied",
    "listUntrackedFiles"
  ])
})

test("preserves a conflict worktree", async () => {
  const repository = await Effect.runPromise(makeRecordingDotfilesRepository({ preflight: { _tag: "Conflict", conflictWorktreePath: "/tmp/conflict" } }))
  const notifications = await Effect.runPromise(makeRecordingNotificationService)
  const exit = await Effect.runPromise(Effect.exit(synchronizeDotfiles.pipe(
    Effect.provide(Layer.mergeAll(repository.layer, notifications.layer, validation))
  )))
  expect(exit._tag).toBe("Failure")
  if (exit._tag === "Failure") {
    const error = Cause.findErrorOption(exit.cause)
    expect(Option.isSome(error) && error.value instanceof SynchronizationFailure && error.value.state === "Conflict").toBe(true)
  }
  expect(await Effect.runPromise(repository.operations)).not.toContain("rebaseLiveMain")
})

test("emits Failed before returning an effectful push failure", async () => {
  const repository = await Effect.runPromise(makeRecordingDotfilesRepository({ upstreamShas: ["same", "same"], pushResults: [false] }))
  const notifications = await Effect.runPromise(makeRecordingNotificationService)
  const exit = await Effect.runPromise(Effect.exit(synchronizeDotfiles.pipe(
    Effect.provide(Layer.mergeAll(repository.layer, notifications.layer, validation))
  )))
  expect((await Effect.runPromise(repository.operations)).filter((name) => name === "pushMain")).toHaveLength(1)
  expect(exit._tag).toBe("Failure")
  if (exit._tag === "Failure") {
    const error = Cause.findErrorOption(exit.cause)
    expect(Option.isSome(error) && error.value instanceof SynchronizationFailure && error.value.state === "Failed").toBe(true)
  }
})

test("reports applied-state validation failure after managed files were applied", async () => {
  const repository = await Effect.runPromise(makeRecordingDotfilesRepository())
  const notifications = await Effect.runPromise(makeRecordingNotificationService)
  const appliedFailure = new RepositoryValidationFailure({
    check: "dotfile status",
    detail: "Managed files remain out of sync."
  })
  const failingValidation = Layer.succeed(RepositoryValidation, RepositoryValidation.of({
    validateSource: repository.record("validateSource"),
    validateApplied: repository.record("validateApplied").pipe(Effect.andThen(Effect.fail(appliedFailure))),
    validate: Effect.void
  }))
  const exit = await Effect.runPromise(Effect.exit(synchronizeDotfiles.pipe(
    Effect.provide(Layer.mergeAll(repository.layer, notifications.layer, failingValidation))
  )))

  expect(exit._tag).toBe("Failure")
  if (exit._tag === "Failure") {
    const error = Cause.findErrorOption(exit.cause)
    expect(Option.isSome(error)).toBe(true)
    if (Option.isSome(error)) {
      expect(error.value).toBeInstanceOf(SynchronizationFailure)
      if (error.value instanceof SynchronizationFailure) {
        expect(error.value).toMatchObject({
          operation: "synchronize",
          detail: "Managed files remain out of sync.",
          state: "Failed"
        })
      }
    }
  }
  const operations = await Effect.runPromise(repository.operations)
  expect(operations).toContain("applyManagedFiles")
  expect(operations.indexOf("applyManagedFiles")).toBeLessThan(operations.indexOf("validateApplied"))
  expect(operations.at(-1)).toBe("releaseLock")
})
