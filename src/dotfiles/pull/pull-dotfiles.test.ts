import { expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { NotificationService } from "../../notification/notification-service.ts"
import { makeRecordingDotfilesRepository } from "../repository/recording-dotfiles-repository.ts"
import { RepositoryValidation, RepositoryValidationFailure } from "../validation/validate-repository.ts"
import { pullDotfiles } from "./pull-dotfiles.ts"

test("pull validates source, applies managed state, and then validates applied state", async () => {
  const repository = await Effect.runPromise(makeRecordingDotfilesRepository())
  const validation = Layer.succeed(RepositoryValidation, RepositoryValidation.of({
    validateSource: repository.record("validateSource"),
    validateApplied: Effect.gen(function*() {
      const operations = yield* repository.operations
      if (!operations.includes("applyManagedFiles")) {
        return yield* new RepositoryValidationFailure({
          check: "dotfile status",
          detail: "Managed mode drift remains before apply."
        })
      }
      yield* repository.record("validateApplied")
    }),
    validate: repository.record("validate")
  }))
  const notifications = Layer.succeed(NotificationService, NotificationService.of({
    notify: (status) => repository.record(`notify:${status}`)
  }))
  await Effect.runPromise(pullDotfiles.pipe(Effect.provide(Layer.mergeAll(
    repository.layer,
    notifications,
    validation
  ))))
  const operations = await Effect.runPromise(repository.operations)
  expect(operations).toEqual([
    "acquireLock",
    "requirePullPreconditions",
    "fetchMain",
    "fastForwardTo",
    "validateSource",
    "applyManagedFiles",
    "validateApplied",
    "notify:success",
    "releaseLock"
  ])
  expect(operations).not.toContain("commitStagedChanges")
  expect(operations).not.toContain("pushMain")
})
