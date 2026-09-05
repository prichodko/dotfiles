import { expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { NotificationService } from "../../notification/notification-service.ts"
import { makeRecordingDotfilesRepository } from "../repository/recording-dotfiles-repository.ts"
import { pullDotfiles } from "./pull-dotfiles.ts"

test("pull delegates application and validation to the updated checkout", async () => {
  const repository = await Effect.runPromise(makeRecordingDotfilesRepository())
  const notifications = Layer.succeed(NotificationService, NotificationService.of({
    notify: (status) => repository.record(`notify:${status}`)
  }))
  await Effect.runPromise(pullDotfiles.pipe(Effect.provide(Layer.mergeAll(
    repository.layer,
    notifications
  ))))
  const operations = await Effect.runPromise(repository.operations)
  expect(operations).toEqual([
    "acquireLock",
    "requirePullPreconditions",
    "fetchMain",
    "fastForwardTo",
    "applyManagedFiles",
    "notify:success",
    "releaseLock"
  ])
  expect(operations).not.toContain("commitStagedChanges")
  expect(operations).not.toContain("pushMain")
})
