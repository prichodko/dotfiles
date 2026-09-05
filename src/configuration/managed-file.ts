import { dirname } from "node:path"
import { Data, Effect, FileSystem } from "effect"
import { findManagedValueDrift, mergeManagedValues, type ConfigurationDocument } from "./managed-values.ts"

export class ManagedConfigurationFailure extends Data.TaggedError("ManagedConfigurationFailure")<{
  readonly operation: string
  readonly detail: string
  readonly cause?: unknown
}> {}

export interface ManagedConfigurationPaths {
  readonly baseConfigPath: string
  readonly liveConfigPath: string
  readonly parse: (source: string) => ConfigurationDocument
  readonly render: (document: ConfigurationDocument) => string
}

export const makeManagedConfiguration = (paths: ManagedConfigurationPaths) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem
    const failure = (operation: string, detail: string, cause?: unknown) =>
      new ManagedConfigurationFailure({
        operation,
        detail,
        ...(cause === undefined ? {} : { cause }),
      })
    const readRequired = (path: string, label: string) =>
      fileSystem.readFileString(path).pipe(Effect.mapError((cause) => failure("read", `${label} could not be read: ${path}`, cause)))
    const parse = (source: string, label: string) =>
      Effect.try({
        try: () => paths.parse(source),
        catch: (cause) => failure("parse", `${label} could not be parsed.`, cause),
      })
    const readBase = readRequired(paths.baseConfigPath, "The managed base configuration").pipe(
      Effect.flatMap((source) => parse(source, "The managed base configuration")),
    )
    const readLive = readRequired(paths.liveConfigPath, "The live configuration").pipe(
      Effect.flatMap((source) => parse(source, "The live configuration")),
    )
    const writeAtomically = (source: string, mode: number) =>
      Effect.gen(function* () {
        const directory = dirname(paths.liveConfigPath)
        yield* fileSystem.makeDirectory(directory, { recursive: true })
        const temporaryPath = yield* fileSystem.makeTempFile({ directory, prefix: ".managed-config.", suffix: ".tmp" })
        yield* Effect.gen(function* () {
          yield* fileSystem.writeFileString(temporaryPath, source)
          yield* fileSystem.chmod(temporaryPath, mode)
          yield* fileSystem.rename(temporaryPath, paths.liveConfigPath)
        }).pipe(Effect.onExit(() => fileSystem.remove(temporaryPath, { force: true }).pipe(Effect.catch(() => Effect.void))))
      }).pipe(Effect.mapError((cause) => failure("write", `The live configuration could not be written: ${paths.liveConfigPath}`, cause)))
    const validateBase = readBase.pipe(Effect.asVoid)
    const validateApplied = Effect.gen(function* () {
      const base = yield* readBase
      const liveExists = yield* fileSystem
        .exists(paths.liveConfigPath)
        .pipe(
          Effect.mapError((cause) => failure("validate", `The live configuration could not be inspected: ${paths.liveConfigPath}`, cause)),
        )
      if (!liveExists) return yield* failure("validate", `The live configuration is missing: ${paths.liveConfigPath}`)
      const live = yield* readLive
      const drift = findManagedValueDrift(base, live)
      if (drift.length > 0) return yield* failure("validate", `The live configuration differs from the base at:\n${drift.join("\n")}`)
    })
    const applyBase = Effect.gen(function* () {
      const base = yield* readBase
      const liveExists = yield* fileSystem
        .exists(paths.liveConfigPath)
        .pipe(
          Effect.mapError((cause) => failure("inspect", `The live configuration could not be inspected: ${paths.liveConfigPath}`, cause)),
        )
      const live = liveExists ? yield* readLive : {}
      if (findManagedValueDrift(base, live).length === 0) return "unchanged" as const
      const merged = mergeManagedValues(base, live)
      const rendered = yield* Effect.try({
        try: () => paths.render(merged),
        catch: (cause) => failure("serialize", "The merged configuration could not be serialized.", cause),
      })
      const mode = liveExists
        ? (yield* fileSystem
            .stat(paths.liveConfigPath)
            .pipe(
              Effect.mapError((cause) =>
                failure("inspect", `The live configuration mode could not be read: ${paths.liveConfigPath}`, cause),
              ),
            )).mode & 0o777
        : 0o600
      yield* writeAtomically(rendered, mode)
      return liveExists ? ("updated" as const) : ("created" as const)
    })
    return { applyBase, validateBase, validateApplied }
  })
