import { Context, Data, Effect } from "effect"

export class DotfilesRepositoryFailure extends Data.TaggedError("DotfilesRepositoryFailure")<{
  readonly operation: string
  readonly detail: string
  readonly cause?: unknown
}> {}

export type RebasePreflightResult =
  | { readonly _tag: "Passed" }
  | { readonly _tag: "Conflict"; readonly conflictWorktreePath: string }

export class DotfilesRepository extends Context.Service<DotfilesRepository, {
  readonly requirePublishPreconditions: Effect.Effect<void, DotfilesRepositoryFailure>
  readonly requirePullPreconditions: Effect.Effect<void, DotfilesRepositoryFailure>
  readonly requireLockUpdatePreconditions: Effect.Effect<void, DotfilesRepositoryFailure>
  readonly acquireLock: Effect.Effect<void, DotfilesRepositoryFailure>
  readonly releaseLock: Effect.Effect<void>
  readonly waitForStableChanges: Effect.Effect<void, DotfilesRepositoryFailure>
  readonly stageTrackedChanges: Effect.Effect<ReadonlyArray<string>, DotfilesRepositoryFailure>
  readonly commitStagedChanges: (paths: ReadonlyArray<string>) => Effect.Effect<string | undefined, DotfilesRepositoryFailure>
  readonly fetchMain: Effect.Effect<string, DotfilesRepositoryFailure>
  readonly preflightRebase: (upstreamSha: string) => Effect.Effect<RebasePreflightResult, DotfilesRepositoryFailure>
  readonly rebaseLiveMain: (upstreamSha: string) => Effect.Effect<void, DotfilesRepositoryFailure>
  readonly validatePublication: Effect.Effect<string, DotfilesRepositoryFailure>
  readonly pushMain: (commitSha: string) => Effect.Effect<boolean, DotfilesRepositoryFailure>
  readonly verifyPublishedHead: Effect.Effect<void, DotfilesRepositoryFailure>
  readonly applyManagedFiles: Effect.Effect<void, DotfilesRepositoryFailure>
  readonly listUntrackedFiles: Effect.Effect<ReadonlyArray<string>, DotfilesRepositoryFailure>
  readonly fastForwardTo: (upstreamSha: string) => Effect.Effect<void, DotfilesRepositoryFailure>
}>()("dotfiles/repository/DotfilesRepository") {}
