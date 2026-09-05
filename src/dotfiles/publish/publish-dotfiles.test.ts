import { expect, test } from "bun:test"
import { Cause, Effect, Layer, Option } from "effect"
import { makeRecordingNotificationService } from "../../notification/recording-notification-service.ts"
import { makeRecordingDotfilesRepository } from "../repository/recording-dotfiles-repository.ts"
import { DotfilesRepositoryFailure } from "../repository/dotfiles-repository.ts"
import { PublicationFailure, publishDotfiles } from "./publish-dotfiles.ts"

test("synchronizes and retries one push race", async () => {
  const repository = await Effect.runPromise(
    makeRecordingDotfilesRepository({ paths: ["b", "a"], upstreamShas: ["one", "two"], pushResults: [false, true] }),
  )
  const notifications = await Effect.runPromise(makeRecordingNotificationService)
  const state = await Effect.runPromise(publishDotfiles.pipe(Effect.provide(Layer.mergeAll(repository.layer, notifications.layer))))
  expect(state).toMatchObject({ _tag: "Completed", retryCount: 1 })
  const operations = await Effect.runPromise(repository.operations)
  expect(operations.filter((name) => name === "pushMain")).toHaveLength(2)
  expect(operations.filter((name) => ["validatePublication", "pushMain"].includes(name))).toEqual([
    "validatePublication",
    "pushMain",
    "validatePublication",
    "pushMain",
  ])
})

test("preserves a conflict worktree", async () => {
  const repository = await Effect.runPromise(
    makeRecordingDotfilesRepository({ preflight: { _tag: "Conflict", conflictWorktreePath: "/tmp/conflict" } }),
  )
  const notifications = await Effect.runPromise(makeRecordingNotificationService)
  const exit = await Effect.runPromise(
    Effect.exit(publishDotfiles.pipe(Effect.provide(Layer.mergeAll(repository.layer, notifications.layer)))),
  )
  expect(exit._tag).toBe("Failure")
  if (exit._tag === "Failure") {
    const error = Cause.findErrorOption(exit.cause)
    expect(Option.isSome(error) && error.value instanceof PublicationFailure && error.value.state === "Conflict").toBe(true)
  }
  expect(await Effect.runPromise(repository.operations)).not.toContain("rebaseLiveMain")
})

test("emits Failed before returning an effectful push failure", async () => {
  const repository = await Effect.runPromise(makeRecordingDotfilesRepository({ upstreamShas: ["same", "same"], pushResults: [false] }))
  const notifications = await Effect.runPromise(makeRecordingNotificationService)
  const exit = await Effect.runPromise(
    Effect.exit(publishDotfiles.pipe(Effect.provide(Layer.mergeAll(repository.layer, notifications.layer)))),
  )
  expect((await Effect.runPromise(repository.operations)).filter((name) => name === "pushMain")).toHaveLength(1)
  expect(exit._tag).toBe("Failure")
  if (exit._tag === "Failure") {
    const error = Cause.findErrorOption(exit.cause)
    expect(Option.isSome(error) && error.value instanceof PublicationFailure && error.value.state === "Failed").toBe(true)
  }
})

test("never publishes when candidate validation fails", async () => {
  const repository = await Effect.runPromise(
    makeRecordingDotfilesRepository({
      validationFailure: new DotfilesRepositoryFailure({ operation: "validation", detail: "Invalid combined changes." }),
    }),
  )
  const notifications = await Effect.runPromise(makeRecordingNotificationService)
  const exit = await Effect.runPromiseExit(publishDotfiles.pipe(Effect.provide(Layer.mergeAll(repository.layer, notifications.layer))))
  expect(exit._tag).toBe("Failure")
  const operations = await Effect.runPromise(repository.operations)
  expect(operations).not.toContain("pushMain")
  expect(operations).not.toContain("applyManagedFiles")
  expect(operations.at(-1)).toBe("releaseLock")
})

test("reports application failure after publication and releases the lock", async () => {
  const repository = await Effect.runPromise(
    makeRecordingDotfilesRepository({
      applyFailure: new DotfilesRepositoryFailure({ operation: "apply", detail: "Managed files differ." }),
    }),
  )
  const notifications = await Effect.runPromise(makeRecordingNotificationService)
  const exit = await Effect.runPromiseExit(publishDotfiles.pipe(Effect.provide(Layer.mergeAll(repository.layer, notifications.layer))))
  expect(exit._tag).toBe("Failure")
  const operations = await Effect.runPromise(repository.operations)
  expect(operations.indexOf("pushMain")).toBeLessThan(operations.indexOf("applyManagedFiles"))
  expect(operations.at(-1)).toBe("releaseLock")
})
