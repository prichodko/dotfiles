import { Effect, Layer, Stream } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process"
import { CommandFailure, CommandRunner, CommandStartFailure, type CommandInput, type CommandResult } from "./command-runner.ts"

const collectText = (stream: Stream.Stream<Uint8Array, unknown>) =>
  stream.pipe(Stream.decodeText(), Stream.runFold(() => "", (text, chunk) => text + chunk))

const runCommandScoped = Effect.fn("CommandRunner.run")(function*(input: CommandInput) {
  const interactive = input.interactive === true
  const command = ChildProcess.make(input.command, input.args ?? [], {
    ...(input.cwd === undefined ? {} : { cwd: input.cwd }),
    ...(input.env === undefined ? {} : { env: { ...input.env }, extendEnv: true }),
    stdin: interactive ? "inherit" : "ignore",
    stdout: interactive ? "inherit" : "pipe",
    stderr: interactive ? "inherit" : "pipe"
  })
  const handle = yield* command
  let result: CommandResult
  if (interactive) {
    const exitCode = Number(yield* handle.exitCode)
    result = { exitCode, stdout: "", stderr: "" }
  } else {
    const [stdout, stderr, exitCode] = yield* Effect.all(
      [collectText(handle.stdout), collectText(handle.stderr), handle.exitCode] as const,
      { concurrency: "unbounded" }
    )
    result = { exitCode: Number(exitCode), stdout, stderr }
  }
  if (result.exitCode !== 0 && input.allowFailure !== true) {
    return yield* new CommandFailure({ input, ...result })
  }
  return result
})

const runCommand = (input: CommandInput) => runCommandScoped(input).pipe(Effect.scoped)

export const EffectCommandRunnerLayer = Layer.effect(CommandRunner, Effect.gen(function*() {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  return CommandRunner.of({
    run: (input) => runCommand(input).pipe(
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
      Effect.mapError((cause) => {
        if (cause instanceof CommandFailure) return cause
        return new CommandStartFailure({ input, cause })
      })
    )
  })
}))
