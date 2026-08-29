import { Data } from "effect"

export type PushRetryCount = 0 | 1

export type SynchronizationState =
  | { readonly _tag: "Idle" }
  | { readonly _tag: "Locked" }
  | { readonly _tag: "Stable" }
  | { readonly _tag: "Staged"; readonly affectedPaths: ReadonlyArray<string> }
  | { readonly _tag: "Validated"; readonly affectedPaths: ReadonlyArray<string> }
  | { readonly _tag: "Committed"; readonly affectedPaths: ReadonlyArray<string>; readonly commitSha?: string }
  | { readonly _tag: "Fetched"; readonly affectedPaths: ReadonlyArray<string>; readonly commitSha?: string; readonly upstreamSha: string; readonly retryCount: PushRetryCount }
  | { readonly _tag: "Preflighted"; readonly affectedPaths: ReadonlyArray<string>; readonly commitSha?: string; readonly upstreamSha: string; readonly retryCount: PushRetryCount }
  | { readonly _tag: "Rebased"; readonly affectedPaths: ReadonlyArray<string>; readonly commitSha?: string; readonly upstreamSha: string; readonly retryCount: PushRetryCount }
  | { readonly _tag: "ReadyToPush"; readonly affectedPaths: ReadonlyArray<string>; readonly commitSha?: string; readonly upstreamSha: string; readonly retryCount: PushRetryCount }
  | { readonly _tag: "Pushed"; readonly affectedPaths: ReadonlyArray<string>; readonly commitSha?: string; readonly upstreamSha: string; readonly retryCount: PushRetryCount }
  | { readonly _tag: "Verified"; readonly affectedPaths: ReadonlyArray<string>; readonly commitSha?: string; readonly upstreamSha: string; readonly retryCount: PushRetryCount }
  | { readonly _tag: "Applied"; readonly affectedPaths: ReadonlyArray<string>; readonly commitSha?: string; readonly upstreamSha: string; readonly retryCount: PushRetryCount }
  | { readonly _tag: "Completed"; readonly affectedPaths: ReadonlyArray<string>; readonly commitSha?: string; readonly upstreamSha: string; readonly retryCount: PushRetryCount }
  | { readonly _tag: "Conflict"; readonly conflictWorktreePath: string }
  | { readonly _tag: "Failed"; readonly reason: string }

export type SynchronizationEvent =
  | { readonly _tag: "LockAcquired" }
  | { readonly _tag: "ChangesStable" }
  | { readonly _tag: "ChangesStaged"; readonly affectedPaths: ReadonlyArray<string> }
  | { readonly _tag: "RepositoryValidated" }
  | { readonly _tag: "ChangesCommitted"; readonly commitSha?: string }
  | { readonly _tag: "UpstreamFetched"; readonly upstreamSha: string }
  | { readonly _tag: "PushRaceDetected"; readonly upstreamSha: string }
  | { readonly _tag: "RebasePreflightPassed" }
  | { readonly _tag: "LiveRebasePassed" }
  | { readonly _tag: "PushReady"; readonly retryCount: PushRetryCount }
  | { readonly _tag: "PushPassed" }
  | { readonly _tag: "PublishedHeadVerified" }
  | { readonly _tag: "DotfilesApplied" }
  | { readonly _tag: "SynchronizationCompleted" }
  | { readonly _tag: "RebaseConflict"; readonly conflictWorktreePath: string }
  | { readonly _tag: "OperationFailed"; readonly reason: string }

export class InvalidSynchronizationTransition extends Data.TaggedError("InvalidSynchronizationTransition")<{
  readonly state: SynchronizationState["_tag"]
  readonly event: SynchronizationEvent["_tag"]
}> {}

export const comparePathsByByte = (left: string, right: string): number => {
  const leftBytes = new TextEncoder().encode(left)
  const rightBytes = new TextEncoder().encode(right)
  const sharedLength = Math.min(leftBytes.length, rightBytes.length)
  for (let index = 0; index < sharedLength; index += 1) {
    const difference = (leftBytes[index] ?? 0) - (rightBytes[index] ?? 0)
    if (difference !== 0) return difference
  }
  return leftBytes.length - rightBytes.length
}

export const sortPaths = (paths: ReadonlyArray<string>): ReadonlyArray<string> => [...paths].sort(comparePathsByByte)

const carry = (state: Extract<SynchronizationState, { readonly affectedPaths: ReadonlyArray<string> }>) => ({
  affectedPaths: state.affectedPaths,
  ...(!("commitSha" in state) || state.commitSha === undefined ? {} : { commitSha: state.commitSha }),
  ...(!("upstreamSha" in state) || state.upstreamSha === undefined ? {} : { upstreamSha: state.upstreamSha })
})

export const transitionSynchronization = (
  state: SynchronizationState,
  event: SynchronizationEvent
): SynchronizationState | InvalidSynchronizationTransition => {
  if (state._tag === "Completed" || state._tag === "Conflict" || state._tag === "Failed") {
    return new InvalidSynchronizationTransition({ state: state._tag, event: event._tag })
  }
  if (event._tag === "OperationFailed") return { _tag: "Failed", reason: event.reason }
  if (event._tag === "RebaseConflict" && state._tag === "Fetched") {
    return { _tag: "Conflict", conflictWorktreePath: event.conflictWorktreePath }
  }
  if (state._tag === "Idle" && event._tag === "LockAcquired") return { _tag: "Locked" }
  if (state._tag === "Locked" && event._tag === "ChangesStable") return { _tag: "Stable" }
  if (state._tag === "Stable" && event._tag === "ChangesStaged") {
    return { _tag: "Staged", affectedPaths: sortPaths(event.affectedPaths) }
  }
  if (state._tag === "Staged" && event._tag === "RepositoryValidated") return { _tag: "Validated", ...carry(state) }
  if (state._tag === "Validated" && event._tag === "ChangesCommitted") {
    return { _tag: "Committed", ...carry(state), ...(event.commitSha === undefined ? {} : { commitSha: event.commitSha }) }
  }
  if (state._tag === "Committed" && event._tag === "UpstreamFetched") {
    return { _tag: "Fetched", ...carry(state), upstreamSha: event.upstreamSha, retryCount: 0 }
  }
  if (state._tag === "ReadyToPush" && state.retryCount === 0 && event._tag === "PushRaceDetected") {
    return { _tag: "Fetched", ...carry(state), upstreamSha: event.upstreamSha, retryCount: 1 }
  }
  if (state._tag === "Fetched" && event._tag === "RebasePreflightPassed") return { _tag: "Preflighted", ...carry(state), upstreamSha: state.upstreamSha, retryCount: state.retryCount }
  if (state._tag === "Preflighted" && event._tag === "LiveRebasePassed") return { _tag: "Rebased", ...carry(state), upstreamSha: state.upstreamSha, retryCount: state.retryCount }
  if (state._tag === "Rebased" && event._tag === "PushReady" && state.retryCount === event.retryCount) return { _tag: "ReadyToPush", ...carry(state), upstreamSha: state.upstreamSha, retryCount: event.retryCount }
  if (state._tag === "ReadyToPush" && event._tag === "PushPassed") return { _tag: "Pushed", ...carry(state), upstreamSha: state.upstreamSha, retryCount: state.retryCount }
  if (state._tag === "Pushed" && event._tag === "PublishedHeadVerified") return { _tag: "Verified", ...carry(state), upstreamSha: state.upstreamSha, retryCount: state.retryCount }
  if (state._tag === "Verified" && event._tag === "DotfilesApplied") return { _tag: "Applied", ...carry(state), upstreamSha: state.upstreamSha, retryCount: state.retryCount }
  if (state._tag === "Applied" && event._tag === "SynchronizationCompleted") return { _tag: "Completed", ...carry(state), upstreamSha: state.upstreamSha, retryCount: state.retryCount }
  return new InvalidSynchronizationTransition({ state: state._tag, event: event._tag })
}

export const buildCommitMessage = (inputPaths: ReadonlyArray<string>): { readonly subject: string; readonly body?: string } => {
  const paths = sortPaths(inputPaths)
  const subject = `sync: ${paths.join(", ")}`
  if (subject.length <= 72) return { subject }
  return { subject: `sync: ${paths.length} tracked paths`, body: paths.join("\n") }
}
