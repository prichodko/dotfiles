import { Effect, Layer, Ref } from "effect"
import { DotfilesRepository, type DotfilesRepositoryFailure, type RebasePreflightResult } from "./dotfiles-repository.ts"

export interface RecordingDotfilesRepositoryOptions {
  readonly validationFailure?: DotfilesRepositoryFailure
  readonly applyFailure?: DotfilesRepositoryFailure
  readonly paths?: ReadonlyArray<string>
  readonly commitSha?: string
  readonly upstreamShas?: ReadonlyArray<string>
  readonly pushResults?: ReadonlyArray<boolean>
  readonly preflight?: RebasePreflightResult
  readonly untrackedFiles?: ReadonlyArray<string>
}

export const makeRecordingDotfilesRepository = (options: RecordingDotfilesRepositoryOptions = {}) =>
  Effect.gen(function*() {
    const operations = yield* Ref.make<ReadonlyArray<string>>([])
    const upstreamShas = [...(options.upstreamShas ?? ["upstream"])]
    const pushResults = [...(options.pushResults ?? [true])]
    const record = (name: string) => Ref.update(operations, (items) => [...items, name])
    const layer = Layer.succeed(DotfilesRepository, DotfilesRepository.of({
      requirePublishPreconditions: record("requirePublishPreconditions"),
      requirePullPreconditions: record("requirePullPreconditions"),
      requireLockUpdatePreconditions: record("requireLockUpdatePreconditions"),
      acquireLock: record("acquireLock"),
      releaseLock: record("releaseLock"),
      waitForStableChanges: record("waitForStableChanges"),
      stageTrackedChanges: record("stageTrackedChanges").pipe(Effect.as(options.paths ?? [])),
      commitStagedChanges: () => record("commitStagedChanges").pipe(Effect.as(options.commitSha)),
      fetchMain: record("fetchMain").pipe(Effect.map(() => upstreamShas.shift() ?? "upstream")),
      preflightRebase: () => record("preflightRebase").pipe(Effect.as(options.preflight ?? { _tag: "Passed" as const })),
      rebaseLiveMain: () => record("rebaseLiveMain"),
      validatePublication: record("validatePublication").pipe(Effect.andThen(options.validationFailure === undefined ? Effect.succeed(options.commitSha ?? "validated") : Effect.fail(options.validationFailure))),
      pushMain: () => record("pushMain").pipe(Effect.map(() => pushResults.shift() ?? true)),
      verifyPublishedHead: record("verifyPublishedHead"),
      applyManagedFiles: record("applyManagedFiles").pipe(Effect.andThen(options.applyFailure === undefined ? Effect.void : Effect.fail(options.applyFailure))),
      listUntrackedFiles: record("listUntrackedFiles").pipe(Effect.as(options.untrackedFiles ?? [])),
      fastForwardTo: () => record("fastForwardTo")
    }))
    return { layer, operations: Ref.get(operations), record }
  })
