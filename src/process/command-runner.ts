import { Context, Data, Effect } from "effect"

export interface CommandInput {
  readonly command: string
  readonly args?: ReadonlyArray<string>
  readonly cwd?: string
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly interactive?: boolean
  readonly allowFailure?: boolean
}

export interface CommandResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

export class CommandFailure extends Data.TaggedError("CommandFailure")<{
  readonly input: CommandInput
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}> {}

export class CommandStartFailure extends Data.TaggedError("CommandStartFailure")<{
  readonly input: CommandInput
  readonly cause: unknown
}> {}

export class CommandRunner extends Context.Service<CommandRunner, {
  readonly run: (input: CommandInput) => Effect.Effect<CommandResult, CommandFailure | CommandStartFailure>
}>()("dotfiles/process/CommandRunner") {}

export const describeCommandError = (error: CommandFailure | CommandStartFailure): string => {
  if (error instanceof CommandFailure) {
    const output = error.stderr.trim() || error.stdout.trim()
    return output === "" ? `${error.input.command} exited with code ${error.exitCode}.` : output
  }
  return `Could not start ${error.input.command}: ${String(error.cause)}`
}
