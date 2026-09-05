import { Console, Data, Effect } from "effect"
import { NotificationService } from "../../notification/notification-service.ts"
import { DotfilesRepository, DotfilesRepositoryFailure } from "../repository/dotfiles-repository.ts"

export class PublicationFailure extends Data.TaggedError("PublicationFailure")<{
  readonly operation: string
  readonly detail: string
  readonly state: "Conflict" | "Failed"
  readonly cause: unknown
}> {}

export const publishDotfiles = Effect.suspend(() => {
  let conflict = false
  return Effect.gen(function* () {
    const repository = yield* DotfilesRepository
    const notifications = yield* NotificationService
    yield* Effect.acquireRelease(repository.acquireLock, () => repository.releaseLock)
    yield* repository.requirePublishPreconditions
    yield* repository.waitForStableChanges
    const paths = yield* repository.stageTrackedChanges
    yield* repository.commitStagedChanges(paths)
    let upstreamSha = yield* repository.fetchMain
    let retryCount: 0 | 1 = 0
    while (true) {
      const preflight = yield* repository.preflightRebase(upstreamSha)
      if (preflight._tag === "Conflict") {
        conflict = true
        return yield* new DotfilesRepositoryFailure({
          operation: "rebase",
          detail: `Rebase conflict. Conflict worktree: ${preflight.conflictWorktreePath}`,
        })
      }
      yield* repository.rebaseLiveMain(upstreamSha)
      const commitSha = yield* repository.validatePublication
      if (yield* repository.pushMain(commitSha)) break
      if (retryCount === 1) return yield* new DotfilesRepositoryFailure({ operation: "push", detail: "Push failed after one retry." })
      const previousUpstreamSha = upstreamSha
      upstreamSha = yield* repository.fetchMain
      if (upstreamSha === previousUpstreamSha) {
        return yield* new DotfilesRepositoryFailure({
          operation: "push",
          detail: "Push failed, but origin/main did not change. The push was not retried.",
        })
      }
      retryCount = 1
    }
    yield* repository.verifyPublishedHead
    yield* repository.applyManagedFiles
    const untrackedFiles = yield* repository.listUntrackedFiles
    if (untrackedFiles.length > 0) yield* Console.log(`Untracked files were not published:\n${untrackedFiles.join("\n")}`)
    yield* notifications.notify("success", "Published the validated commit and applied the checkout.")
    return { _tag: "Completed", retryCount } as const
  }).pipe(
    Effect.catch((cause) => {
      const operation = cause instanceof DotfilesRepositoryFailure ? cause.operation : "publish"
      const detail = cause instanceof DotfilesRepositoryFailure ? cause.detail : String(cause)
      return Effect.fail(new PublicationFailure({ operation, detail, state: conflict ? "Conflict" : "Failed", cause }))
    }),
  )
}).pipe(
  Effect.onExit((exit) =>
    exit._tag === "Failure" ? NotificationService.use((service) => service.notify("failure", "Publication stopped.")) : Effect.void,
  ),
  Effect.scoped,
)
