import { expect, test } from "bun:test"
import { Cause, Effect, Layer, Option } from "effect"
import { makeRecordingNotificationService } from "../../notification/recording-notification-service.ts"
import { makeRecordingDotfilesRepository } from "../repository/recording-dotfiles-repository.ts"
import { RepositoryValidation } from "../validation/validate-repository.ts"
import { SynchronizationFailure, synchronizeDotfiles } from "./synchronize-dotfiles.ts"

const validation = Layer.succeed(RepositoryValidation, RepositoryValidation.of({ validate: Effect.void }))

test("synchronizes and retries one push race", async () => {
  const repository = await Effect.runPromise(makeRecordingDotfilesRepository({ paths: ["b", "a"], upstreamShas: ["one", "two"], pushResults: [false, true] }))
  const notifications = await Effect.runPromise(makeRecordingNotificationService)
  const state = await Effect.runPromise(synchronizeDotfiles.pipe(
    Effect.provide(Layer.mergeAll(repository.layer, notifications.layer, validation))
  ))
  expect(state).toMatchObject({ _tag: "Completed", retryCount: 1 })
  expect((await Effect.runPromise(repository.operations)).filter((name) => name === "pushMain")).toHaveLength(2)
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
