import { dirname } from "node:path"
import { Context, Data, Effect, FileSystem, Layer } from "effect"
import { DOTFILES_ROOT } from "../../dotfiles/repository/live-dotfiles-repository.ts"
import { CommandRunner, describeCommandError } from "../../process/command-runner.ts"
import {
  homebrewBinDirectories,
  MINIMUM_GLOBAL_HOOK_GIT_VERSION,
  prependSearchPath,
  supportsGlobalGitHooks
} from "./git-version.ts"

export interface HkConfigurationPaths {
  readonly userConfigPath: string
  readonly workingDirectory: string
  readonly commandSearchPath: string
}

export class HkConfigurationFailure extends Data.TaggedError("HkConfigurationFailure")<{
  readonly operation: string
  readonly detail: string
  readonly cause?: unknown
}> {}

export class HkConfiguration extends Context.Service<HkConfiguration, {
  readonly validateSource: Effect.Effect<void, HkConfigurationFailure>
  readonly validateApplied: Effect.Effect<void, HkConfigurationFailure>
}>()("hk/configuration/HkConfiguration") {}

const requiredHome = (): string => {
  if (process.env.HOME !== undefined && process.env.HOME !== "") return process.env.HOME
  throw new Error("HOME is required for hk configuration.")
}

export const defaultHkConfigurationPaths = (): HkConfigurationPaths => {
  const home = requiredHome()
  return {
    userConfigPath: `${DOTFILES_ROOT}/user/common/.config/hk/config.pkl`,
    workingDirectory: DOTFILES_ROOT,
    commandSearchPath: prependSearchPath(homebrewBinDirectories(process.platform), process.env.PATH)
  }
}

export const makeHkConfigurationLayer = (paths: HkConfigurationPaths) => Layer.effect(HkConfiguration, Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const runner = yield* CommandRunner
  const failure = (operation: string, detail: string, cause?: unknown) => new HkConfigurationFailure({
    operation,
    detail,
    ...(cause === undefined ? {} : { cause })
  })
  const run = (operation: string, command: string, args: ReadonlyArray<string>, env?: Readonly<Record<string, string | undefined>>) =>
    runner.run({ command, args, cwd: paths.workingDirectory, ...(env === undefined ? {} : { env }) }).pipe(
      Effect.mapError((cause) => failure(operation, describeCommandError(cause), cause))
    )
  const commandEnvironment = { PATH: paths.commandSearchPath }
  const runHk = (operation: string, args: ReadonlyArray<string>, env?: Readonly<Record<string, string | undefined>>) => run(
    operation,
    "mise",
    ["--locked", "-C", paths.workingDirectory, "exec", "--", "hk", ...args],
    env
  )
  const readRequired = (path: string, label: string) => fileSystem.readFileString(path).pipe(
    Effect.mapError((cause) => failure("read", `${label} could not be read: ${path}`, cause))
  )
  const validateGit = Effect.gen(function*() {
    const result = yield* run("Git version", "git", ["--version"], commandEnvironment)
    if (!supportsGlobalGitHooks(result.stdout)) {
      return yield* failure(
        "Git version",
        `Homebrew Git ${MINIMUM_GLOBAL_HOOK_GIT_VERSION} or later is required. Active output: ${result.stdout.trim() || "unknown"}`
      )
    }
  })
  const validateUserConfig = Effect.gen(function*() {
    yield* readRequired(paths.userConfigPath, "The global hk configuration")
    yield* runHk("hk configuration", [
      "run",
      "pre-commit",
      "--cd",
      paths.workingDirectory,
      "--plan"
    ], {
      ...commandEnvironment,
      XDG_CONFIG_HOME: dirname(dirname(paths.userConfigPath))
    })
  })
  const validateGlobalResolution = Effect.gen(function*() {
    const hooks = [
      ["commit-msg", "mise x -- hk run commit-msg --from-hook"],
      ["pre-commit", "mise x -- hk run pre-commit --from-hook --staged"],
      ["pre-push", "mise x -- hk run pre-push --from-hook"],
      ["prepare-commit-msg", "mise x -- hk run prepare-commit-msg --from-hook"]
    ] as const
    for (const [event, expectedCommand] of hooks) {
      const hook = yield* run("global hk hook", "git", ["config", "--global", "--includes", "--get", `hook.hk-${event}.command`], commandEnvironment)
      if (!hook.stdout.includes(expectedCommand)) {
        return yield* failure("global hk hook", `The managed global Git configuration does not include the hk ${event} hook.`)
      }
    }
    const stashUntracked = yield* run("global hk settings", "git", ["config", "--global", "--includes", "--get", "hk.stashUntracked"], commandEnvironment)
    if (stashUntracked.stdout.trim() !== "false") {
      return yield* failure("global hk settings", "The global hk.stashUntracked setting must be false.")
    }
  })
  const validateApplied = Effect.gen(function*() {
    yield* validateGit
    yield* validateUserConfig
    yield* validateGlobalResolution
  })
  return HkConfiguration.of({ validateSource: validateUserConfig, validateApplied })
}))

export const LiveHkConfigurationLayer = makeHkConfigurationLayer(defaultHkConfigurationPaths())
