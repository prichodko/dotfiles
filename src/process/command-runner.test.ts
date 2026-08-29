import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { makeRecordingCommandRunner } from "./recording-command-runner.ts"
import { CommandRunner } from "./command-runner.ts"

describe("CommandRunner", () => {
  test("records commands", async () => {
    const recording = await Effect.runPromise(makeRecordingCommandRunner())
    await Effect.runPromise(Effect.gen(function*() {
      const runner = yield* CommandRunner
      yield* runner.run({ command: "git", args: ["status"] })
    }).pipe(Effect.provide(recording.layer)))
    expect(await Effect.runPromise(recording.commands)).toEqual([{ command: "git", args: ["status"] }])
  })
})
