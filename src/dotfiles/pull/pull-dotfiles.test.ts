import { expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { makeRecordingNotificationService } from "../../notification/recording-notification-service.ts"
import { makeRecordingDotfilesRepository } from "../repository/recording-dotfiles-repository.ts"
import { RepositoryValidation } from "../validation/validate-repository.ts"
import { pullDotfiles } from "./pull-dotfiles.ts"

test("pull never commits or pushes", async () => {
  const repository = await Effect.runPromise(makeRecordingDotfilesRepository())
  const notifications = await Effect.runPromise(makeRecordingNotificationService)
  await Effect.runPromise(pullDotfiles.pipe(Effect.provide(Layer.mergeAll(
    repository.layer,
    notifications.layer,
    Layer.succeed(RepositoryValidation, RepositoryValidation.of({ validate: Effect.void }))
  ))))
  const operations = await Effect.runPromise(repository.operations)
  expect(operations).not.toContain("commitStagedChanges")
  expect(operations).not.toContain("pushMain")
})
