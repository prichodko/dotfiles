import { makeManagedConfiguration, type ManagedConfigurationFailure } from "../../configuration/managed-file.ts"
import { Context, Data, Effect, Layer } from "effect"
import { DOTFILES_ROOT } from "../../dotfiles/repository/live-dotfiles-repository.ts"
import { parseCodexConfig, renderCodexConfig } from "./codex-config.ts"

export type CodexConfigurationApplyResult = "created" | "updated" | "unchanged"

export interface CodexConfigurationPaths {
  readonly baseConfigPath: string
  readonly liveConfigPath: string
}

export class CodexConfigurationFailure extends Data.TaggedError("CodexConfigurationFailure")<{
  readonly operation: string
  readonly detail: string
  readonly cause?: unknown
}> {}

export class CodexConfiguration extends Context.Service<
  CodexConfiguration,
  {
    readonly applyBase: Effect.Effect<CodexConfigurationApplyResult, CodexConfigurationFailure>
    readonly validateBase: Effect.Effect<void, CodexConfigurationFailure>
    readonly validateApplied: Effect.Effect<void, CodexConfigurationFailure>
  }
>()("codex/config/CodexConfiguration") {}

const defaultCodexHome = (): string => {
  if (process.env.CODEX_HOME !== undefined && process.env.CODEX_HOME !== "") return process.env.CODEX_HOME
  if (process.env.HOME !== undefined && process.env.HOME !== "") return `${process.env.HOME}/.codex`
  throw new Error("HOME or CODEX_HOME is required for Codex configuration.")
}

export const defaultCodexConfigurationPaths = (): CodexConfigurationPaths => ({
  baseConfigPath: `${DOTFILES_ROOT}/user/common/.codex/base.toml`,
  liveConfigPath: `${defaultCodexHome()}/config.toml`,
})

export const makeCodexConfigurationLayer = (paths: CodexConfigurationPaths) =>
  Layer.effect(
    CodexConfiguration,
    Effect.gen(function* () {
      const configuration = yield* makeManagedConfiguration({ ...paths, parse: parseCodexConfig, render: renderCodexConfig })
      const failure = (cause: ManagedConfigurationFailure) =>
        new CodexConfigurationFailure({ operation: cause.operation, detail: cause.detail, cause })
      return CodexConfiguration.of({
        applyBase: configuration.applyBase.pipe(Effect.mapError(failure)),
        validateBase: configuration.validateBase.pipe(Effect.mapError(failure)),
        validateApplied: configuration.validateApplied.pipe(Effect.mapError(failure)),
      })
    }),
  )

export const LiveCodexConfigurationLayer = makeCodexConfigurationLayer(defaultCodexConfigurationPaths())
