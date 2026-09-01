import { Console, Data, Effect } from "effect"
import { NotificationService } from "../../notification/notification-service.ts"
import { DotfilesRepository, DotfilesRepositoryFailure } from "../repository/dotfiles-repository.ts"
import { RepositoryValidation } from "../validation/validate-repository.ts"
import { InvalidSynchronizationTransition, transitionSynchronization, type SynchronizationEvent, type SynchronizationState } from "./synchronization-state.ts"

export class SynchronizationFailure extends Data.TaggedError("SynchronizationFailure")<{
  readonly operation: string
  readonly detail: string
  readonly state: "Conflict" | "Failed"
  readonly cause: unknown
}> {}

const next = (state: SynchronizationState, event: SynchronizationEvent): Effect.Effect<SynchronizationState, InvalidSynchronizationTransition> => {
  const result = transitionSynchronization(state, event)
  return result instanceof InvalidSynchronizationTransition ? Effect.fail(result) : Effect.succeed(result)
}

export const synchronizeDotfiles = Effect.suspend(() => {
  let state: SynchronizationState = { _tag: "Idle" }
  return Effect.gen(function*() {
    const repository = yield* DotfilesRepository
    const validation = yield* RepositoryValidation
    const notifications = yield* NotificationService
    yield* repository.requireSyncPreconditions
    yield* Effect.acquireRelease(repository.acquireLock, () => repository.releaseLock)
    state = yield* next(state, { _tag: "LockAcquired" })
    yield* repository.waitForStableChanges
    state = yield* next(state, { _tag: "ChangesStable" })
    const paths = yield* repository.stageTrackedChanges
    state = yield* next(state, { _tag: "ChangesStaged", affectedPaths: paths })
    yield* validation.validateSource
    state = yield* next(state, { _tag: "RepositoryValidated" })
    const commitSha = yield* repository.commitStagedChanges(paths)
    state = yield* next(state, { _tag: "ChangesCommitted", ...(commitSha === undefined ? {} : { commitSha }) })
    let upstreamSha = yield* repository.fetchMain
    state = yield* next(state, { _tag: "UpstreamFetched", upstreamSha })
    const preflight = yield* repository.preflightRebase(upstreamSha)
    if (preflight._tag === "Conflict") {
      state = yield* next(state, { _tag: "RebaseConflict", conflictWorktreePath: preflight.conflictWorktreePath ?? "unknown" })
      return yield* new DotfilesRepositoryFailure({ operation: "rebase", detail: `Rebase conflict. Conflict worktree: ${preflight.conflictWorktreePath}` })
    }
    state = yield* next(state, { _tag: "RebasePreflightPassed" })
    yield* repository.rebaseLiveMain(upstreamSha)
    state = yield* next(state, { _tag: "LiveRebasePassed" })
    state = yield* next(state, { _tag: "PushReady", retryCount: 0 })
    let pushed = yield* repository.pushMain
    if (!pushed) {
      const previousUpstreamSha = upstreamSha
      upstreamSha = yield* repository.fetchMain
      if (upstreamSha === previousUpstreamSha) {
        return yield* new DotfilesRepositoryFailure({ operation: "push", detail: "Push failed, but origin/main did not change. The push was not retried." })
      }
      state = yield* next(state, { _tag: "PushRaceDetected", upstreamSha })
      const retryPreflight = yield* repository.preflightRebase(upstreamSha)
      if (retryPreflight._tag === "Conflict") {
        state = yield* next(state, { _tag: "RebaseConflict", conflictWorktreePath: retryPreflight.conflictWorktreePath ?? "unknown" })
        return yield* new DotfilesRepositoryFailure({ operation: "rebase", detail: `Rebase conflict. Conflict worktree: ${retryPreflight.conflictWorktreePath}` })
      }
      state = yield* next(state, { _tag: "RebasePreflightPassed" })
      yield* repository.rebaseLiveMain(upstreamSha)
      state = yield* next(state, { _tag: "LiveRebasePassed" })
      state = yield* next(state, { _tag: "PushReady", retryCount: 1 })
      pushed = yield* repository.pushMain
      if (!pushed) return yield* new DotfilesRepositoryFailure({ operation: "push", detail: "Push failed after one retry." })
    }
    state = yield* next(state, { _tag: "PushPassed" })
    yield* repository.verifyPublishedHead
    yield* validation.validateSource
    state = yield* next(state, { _tag: "PublishedHeadVerified" })
    yield* repository.applyManagedFiles
    state = yield* next(state, { _tag: "DotfilesApplied" })
    yield* validation.validateApplied
    const untrackedFiles = yield* repository.listUntrackedFiles
    if (untrackedFiles.length > 0) yield* Console.log(`Untracked files were not synchronized:\n${untrackedFiles.join("\n")}`)
    yield* notifications.notify("success", "Committed, rebased, pushed, and applied tracked changes.")
    state = yield* next(state, { _tag: "SynchronizationCompleted" })
    return state
  }).pipe(Effect.catchIf(() => true, (cause) => {
    if (state._tag !== "Conflict" && state._tag !== "Failed") {
      const failed = transitionSynchronization(state, { _tag: "OperationFailed", reason: cause instanceof Error ? cause.message : String(cause) })
      if (!(failed instanceof InvalidSynchronizationTransition)) state = failed
    }
    const operation = cause !== null && typeof cause === "object" && "operation" in cause && typeof cause.operation === "string" ? cause.operation : "synchronize"
    const detail = cause !== null && typeof cause === "object" && "detail" in cause && typeof cause.detail === "string" ? cause.detail : String(cause)
    return Effect.fail(new SynchronizationFailure({ operation, detail, state: state._tag === "Conflict" ? "Conflict" : "Failed", cause }))
  }))
}).pipe(
  Effect.onExit((exit) => exit._tag === "Failure"
    ? NotificationService.use((service) => service.notify("failure", "Sync stopped."))
    : Effect.void),
  Effect.scoped
)
