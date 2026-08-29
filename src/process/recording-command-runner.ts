import { Effect, Layer, Ref } from "effect"
import { CommandRunner, type CommandInput, type CommandResult } from "./command-runner.ts"

export interface RecordingCommandRunner {
  readonly layer: Layer.Layer<CommandRunner>
  readonly commands: Effect.Effect<ReadonlyArray<CommandInput>>
}

export const makeRecordingCommandRunner = (results: ReadonlyArray<CommandResult> = []): Effect.Effect<RecordingCommandRunner> =>
  Effect.gen(function*() {
    const commands = yield* Ref.make<ReadonlyArray<CommandInput>>([])
    const queue = [...results]
    const run = (input: CommandInput) => Ref.update(commands, (items) => [...items, input]).pipe(
      Effect.as(queue.shift() ?? { exitCode: 0, stdout: "", stderr: "" })
    )
    return {
      layer: Layer.succeed(CommandRunner, CommandRunner.of({ run })),
      commands: Ref.get(commands)
    }
  })
