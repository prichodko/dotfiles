import { describe, expect, test } from "bun:test"
import { InvalidSynchronizationTransition, buildCommitMessage, sortPaths, transitionSynchronization, type SynchronizationEvent, type SynchronizationState } from "./synchronization-state.ts"

describe("synchronization state", () => {
  test("supports the success transition table", () => {
    const events: ReadonlyArray<SynchronizationEvent> = [
      { _tag: "LockAcquired" },
      { _tag: "ChangesStable" },
      { _tag: "ChangesStaged", affectedPaths: ["z", "a"] },
      { _tag: "RepositoryValidated" },
      { _tag: "ChangesCommitted", commitSha: "commit" },
      { _tag: "UpstreamFetched", upstreamSha: "upstream" },
      { _tag: "RebasePreflightPassed" },
      { _tag: "LiveRebasePassed" },
      { _tag: "PushReady", retryCount: 0 },
      { _tag: "PushPassed" },
      { _tag: "PublishedHeadVerified" },
      { _tag: "DotfilesApplied" },
      { _tag: "SynchronizationCompleted" }
    ]
    let state: SynchronizationState = { _tag: "Idle" }
    for (const event of events) state = transitionSynchronization(state, event) as SynchronizationState
    expect(state).toMatchObject({ _tag: "Completed", affectedPaths: ["a", "z"] })
  })

  test("rejects invalid transitions", () => {
    expect(transitionSynchronization({ _tag: "Idle" }, { _tag: "PushPassed" })).toBeInstanceOf(InvalidSynchronizationTransition)
  })

  test("implements the complete legal transition table", () => {
    const data = { affectedPaths: ["a"], commitSha: "c", upstreamSha: "u", retryCount: 0 as const }
    const states: ReadonlyArray<SynchronizationState> = [
      { _tag: "Idle" }, { _tag: "Locked" }, { _tag: "Stable" },
      { _tag: "Staged", affectedPaths: ["a"] }, { _tag: "Validated", affectedPaths: ["a"] },
      { _tag: "Committed", affectedPaths: ["a"], commitSha: "c" }, { _tag: "Fetched", ...data },
      { _tag: "Preflighted", ...data }, { _tag: "Rebased", ...data }, { _tag: "ReadyToPush", ...data },
      { _tag: "Pushed", ...data }, { _tag: "Verified", ...data }, { _tag: "Applied", ...data },
      { _tag: "Completed", ...data }, { _tag: "Conflict", conflictWorktreePath: "/tmp/conflict" }, { _tag: "Failed", reason: "failed" }
    ]
    const events: ReadonlyArray<SynchronizationEvent> = [
      { _tag: "LockAcquired" }, { _tag: "ChangesStable" }, { _tag: "ChangesStaged", affectedPaths: ["a"] },
      { _tag: "RepositoryValidated" }, { _tag: "ChangesCommitted", commitSha: "c" }, { _tag: "UpstreamFetched", upstreamSha: "u" },
      { _tag: "PushRaceDetected", upstreamSha: "u2" }, { _tag: "RebasePreflightPassed" }, { _tag: "LiveRebasePassed" },
      { _tag: "PushReady", retryCount: 0 }, { _tag: "PushPassed" }, { _tag: "PublishedHeadVerified" },
      { _tag: "DotfilesApplied" }, { _tag: "SynchronizationCompleted" }, { _tag: "RebaseConflict", conflictWorktreePath: "/tmp/conflict" },
      { _tag: "OperationFailed", reason: "failed" }
    ]
    const legal = new Set([
      "Idle:LockAcquired", "Locked:ChangesStable", "Stable:ChangesStaged", "Staged:RepositoryValidated",
      "Validated:ChangesCommitted", "Committed:UpstreamFetched", "Fetched:RebasePreflightPassed", "Fetched:RebaseConflict",
      "Preflighted:LiveRebasePassed", "Rebased:PushReady", "ReadyToPush:PushRaceDetected", "ReadyToPush:PushPassed",
      "Pushed:PublishedHeadVerified", "Verified:DotfilesApplied", "Applied:SynchronizationCompleted"
    ])
    for (const state of states) {
      for (const event of events) {
        const result = transitionSynchronization(state, event)
        const expected = legal.has(`${state._tag}:${event._tag}`) || (!new Set(["Completed", "Conflict", "Failed"]).has(state._tag) && event._tag === "OperationFailed")
        expect(result instanceof InvalidSynchronizationTransition).toBe(!expected)
      }
    }
  })

  test("builds short and long commit messages", () => {
    expect(buildCommitMessage(["b", "a"])).toEqual({ subject: "sync: a, b" })
    const long = buildCommitMessage(["a/" + "x".repeat(80), "b"])
    expect(long).toEqual({ subject: "sync: 2 tracked paths", body: `a/${"x".repeat(80)}\nb` })
  })

  test("uses C byte ordering", () => {
    expect(sortPaths(["a", "_", "Z", "A", "-", "z"])).toEqual(["-", "A", "Z", "_", "a", "z"])
  })
})
