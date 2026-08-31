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

  test("consumes recorded results in execution order", async () => {
    const recording = await Effect.runPromise(makeRecordingCommandRunner([
      { exitCode: 0, stdout: "first\n", stderr: "" },
      { exitCode: 0, stdout: "second\n", stderr: "" }
    ]))
    const results = await Effect.runPromise(Effect.gen(function*() {
      const runner = yield* CommandRunner
      const constructedFirst = runner.run({ command: "first" })
      const constructedSecond = runner.run({ command: "second" })
      return [yield* constructedSecond, yield* constructedFirst]
    }).pipe(Effect.provide(recording.layer)))
    expect(results.map((result) => result.stdout)).toEqual(["first\n", "second\n"])
    expect(await Effect.runPromise(recording.commands)).toEqual([{ command: "second" }, { command: "first" }])
  })
})
