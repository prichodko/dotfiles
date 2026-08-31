import { dirname } from "node:path"
import { Context, Data, Effect, FileSystem, Layer } from "effect"
import { DOTFILES_ROOT } from "../../dotfiles/repository/live-dotfiles-repository.ts"
import { findCodexConfigDrift, mergeCodexConfig, parseCodexConfig, renderCodexConfig } from "./codex-config.ts"

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

export class CodexConfiguration extends Context.Service<CodexConfiguration, {
  readonly applyBase: Effect.Effect<CodexConfigurationApplyResult, CodexConfigurationFailure>
  readonly validateBase: Effect.Effect<void, CodexConfigurationFailure>
  readonly validateApplied: Effect.Effect<void, CodexConfigurationFailure>
}>()("codex/config/CodexConfiguration") {}

const defaultCodexHome = (): string => {
  if (process.env.CODEX_HOME !== undefined && process.env.CODEX_HOME !== "") return process.env.CODEX_HOME
  if (process.env.HOME !== undefined && process.env.HOME !== "") return `${process.env.HOME}/.codex`
  throw new Error("HOME or CODEX_HOME is required for Codex configuration.")
}

export const defaultCodexConfigurationPaths = (): CodexConfigurationPaths => ({
  baseConfigPath: `${DOTFILES_ROOT}/user/common/.codex/base.toml`,
  liveConfigPath: `${defaultCodexHome()}/config.toml`
})

export const makeCodexConfigurationLayer = (paths: CodexConfigurationPaths) => Layer.effect(CodexConfiguration, Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const failure = (operation: string, detail: string, cause?: unknown) => new CodexConfigurationFailure({
    operation,
    detail,
    ...(cause === undefined ? {} : { cause })
  })
  const readRequired = (path: string, label: string) => fileSystem.readFileString(path).pipe(
    Effect.mapError((cause) => failure("read", `${label} could not be read: ${path}`, cause))
  )
  const parse = (source: string, label: string) => Effect.try({
    try: () => parseCodexConfig(source),
    catch: (cause) => failure("parse", `${label} is not valid TOML.`, cause)
  })
  const readBase = readRequired(paths.baseConfigPath, "The Codex base configuration").pipe(
    Effect.flatMap((source) => parse(source, "The Codex base configuration"))
  )
  const readLive = readRequired(paths.liveConfigPath, "The live Codex configuration").pipe(
    Effect.flatMap((source) => parse(source, "The live Codex configuration"))
  )
  const writeAtomically = (source: string, mode: number) => Effect.gen(function*() {
    const directory = dirname(paths.liveConfigPath)
    yield* fileSystem.makeDirectory(directory, { recursive: true })
    const temporaryPath = yield* fileSystem.makeTempFile({ directory, prefix: ".config.toml.", suffix: ".tmp" })
    yield* Effect.gen(function*() {
      yield* fileSystem.writeFileString(temporaryPath, source)
      yield* fileSystem.chmod(temporaryPath, mode)
      yield* fileSystem.rename(temporaryPath, paths.liveConfigPath)
    }).pipe(Effect.onExit(() => fileSystem.remove(temporaryPath, { force: true }).pipe(Effect.catch(() => Effect.void))))
  }).pipe(Effect.mapError((cause) => failure("write", `The live Codex configuration could not be written: ${paths.liveConfigPath}`, cause)))
  const validateBase = readBase.pipe(Effect.asVoid)
  const validateApplied = Effect.gen(function*() {
    const base = yield* readBase
    const liveExists = yield* fileSystem.exists(paths.liveConfigPath).pipe(
      Effect.mapError((cause) => failure("validate", `The live Codex configuration could not be inspected: ${paths.liveConfigPath}`, cause))
    )
    if (!liveExists) return yield* failure("validate", `The live Codex configuration is missing: ${paths.liveConfigPath}`)
    const live = yield* readLive
    const drift = findCodexConfigDrift(base, live)
    if (drift.length > 0) return yield* failure("validate", `The live Codex configuration differs from the base at:\n${drift.join("\n")}`)
  })
  const applyBase = Effect.gen(function*() {
    const base = yield* readBase
    const liveExists = yield* fileSystem.exists(paths.liveConfigPath).pipe(
      Effect.mapError((cause) => failure("inspect", `The live Codex configuration could not be inspected: ${paths.liveConfigPath}`, cause))
    )
    const live = liveExists ? yield* readLive : {}
    if (findCodexConfigDrift(base, live).length === 0) return "unchanged" as const
    const merged = mergeCodexConfig(base, live)
    const rendered = yield* Effect.try({
      try: () => renderCodexConfig(merged),
      catch: (cause) => failure("serialize", "The merged Codex configuration could not be serialized.", cause)
    })
    const mode = liveExists
      ? (yield* fileSystem.stat(paths.liveConfigPath).pipe(
        Effect.mapError((cause) => failure("inspect", `The live Codex configuration mode could not be read: ${paths.liveConfigPath}`, cause))
      )).mode & 0o777
      : 0o600
    yield* writeAtomically(rendered, mode)
    return liveExists ? "updated" as const : "created" as const
  })
  return CodexConfiguration.of({ applyBase, validateBase, validateApplied })
}))

export const LiveCodexConfigurationLayer = makeCodexConfigurationLayer(defaultCodexConfigurationPaths())
