import { Context, Data, Effect, FileSystem, Layer } from "effect"
import { parseCodexConfig } from "../../codex/config/codex-config.ts"
import { HkConfiguration } from "../../hk/configuration/hk-configuration.ts"
import { appendMiseEnvironments, machineProfileEnvironments } from "../../machine/profile.ts"
import { CommandRunner, describeCommandError } from "../../process/command-runner.ts"
import { DOTFILES_ROOT } from "../repository/live-dotfiles-repository.ts"

export class RepositoryValidationFailure extends Data.TaggedError("RepositoryValidationFailure")<{
  readonly check: string
  readonly detail: string
  readonly cause?: unknown
}> {}

export class RepositoryValidation extends Context.Service<RepositoryValidation, {
  readonly validate: Effect.Effect<void, RepositoryValidationFailure>
}>()("dotfiles/validation/RepositoryValidation") {}

export const dotfileStatusArguments = ["-C", DOTFILES_ROOT, "bootstrap", "dotfiles", "status", "--missing"] as const

export const LiveRepositoryValidationLayer = Layer.effect(RepositoryValidation, Effect.gen(function*() {
  const runner = yield* CommandRunner
  const fileSystem = yield* FileSystem.FileSystem
  const hkConfiguration = yield* HkConfiguration
  const miseEnv = (profile: "core" | "full") => ({
    MISE_ENV: appendMiseEnvironments(process.env.MISE_ENV, machineProfileEnvironments(profile)),
    MISE_IGNORED_CONFIG_PATHS: `${process.env.HOME}/.config/mise/config.toml:${DOTFILES_ROOT}/.config/mise/config.toml`
  })
  const run = (check: string, command: string, args: ReadonlyArray<string>, env?: Readonly<Record<string, string | undefined>>) =>
    runner.run({ command, args, cwd: DOTFILES_ROOT, ...(env === undefined ? {} : { env }) }).pipe(
      Effect.mapError((cause) => new RepositoryValidationFailure({ check, detail: describeCommandError(cause), cause })),
      Effect.asVoid
    )
  const gitOutput = (args: ReadonlyArray<string>) => runner.run({ command: "git", args: ["-C", DOTFILES_ROOT, ...args], cwd: DOTFILES_ROOT }).pipe(
    Effect.map((result) => result.stdout),
    Effect.mapError((cause) => new RepositoryValidationFailure({ check: "git", detail: String(cause), cause }))
  )
  const validateShell = Effect.gen(function*() {
    const listed = (yield* gitOutput(["ls-files", "-co", "--exclude-standard", "lib", "tasks", "tests", "user"])).split("\n").filter(Boolean)
    const tracked: Array<string> = []
    for (const path of listed) {
      const exists = yield* fileSystem.exists(`${DOTFILES_ROOT}/${path}`).pipe(
        Effect.mapError((cause) => new RepositoryValidationFailure({ check: "Shell syntax", detail: `The file could not be inspected: ${path}`, cause }))
      )
      if (exists) tracked.push(path)
    }
    const bashFiles = tracked.filter((path) => path.endsWith(".sh") || path === "tasks/bootstrap" || path === "tasks/machine/apply").map((path) => `${DOTFILES_ROOT}/${path}`)
    const zshFiles = tracked.filter((path) => /zsh|\.zshenv|\.zprofile|\.zshrc/.test(path)).map((path) => `${DOTFILES_ROOT}/${path}`)
    yield* Effect.forEach(bashFiles, (path) => run(`bash syntax: ${path}`, "bash", ["-n", path]), { concurrency: "unbounded", discard: true })
    yield* Effect.forEach(zshFiles, (path) => run(`zsh syntax: ${path}`, "zsh", ["-n", path]), { concurrency: "unbounded", discard: true })
  })
  const validateLocks = Effect.gen(function*() {
    for (const name of ["mise.lock", "mise.full.lock", "bun.lock"]) {
      const path = `${DOTFILES_ROOT}/${name}`
      const exists = yield* fileSystem.exists(path).pipe(Effect.mapError((cause) => new RepositoryValidationFailure({ check: "lock files", detail: String(cause), cause })))
      if (!exists) return yield* new RepositoryValidationFailure({ check: "lock files", detail: `Lock file is missing: ${path}` })
      const info = yield* fileSystem.stat(path).pipe(Effect.mapError((cause) => new RepositoryValidationFailure({ check: "lock files", detail: String(cause), cause })))
      if (info.size === 0n) return yield* new RepositoryValidationFailure({ check: "lock files", detail: `Lock file is empty: ${path}` })
    }
  })
  const validateLinks = Effect.gen(function*() {
    const entries = (yield* gitOutput(["ls-files", "-s"])).split("\n").filter((line) => line.startsWith("120000 "))
    for (const entry of entries) {
      const path = `${DOTFILES_ROOT}/${entry.slice(entry.indexOf("\t") + 1)}`
      if (!(yield* fileSystem.exists(path))) return yield* new RepositoryValidationFailure({ check: "tracked links", detail: `Broken tracked link: ${path}` })
    }
  }).pipe(Effect.mapError((cause) => cause instanceof RepositoryValidationFailure ? cause : new RepositoryValidationFailure({ check: "tracked links", detail: String(cause), cause })))
  const validateArchitecture = Effect.gen(function*() {
    const forbiddenName = yield* runner.run({ command: "rg", args: ["-n", "--hidden", "--glob", "!.git/**", "--glob", "!node_modules/**", "de" + "venv", DOTFILES_ROOT], cwd: DOTFILES_ROOT, allowFailure: true })
    if (forbiddenName.exitCode === 0) return yield* new RepositoryValidationFailure({ check: "architecture", detail: `A removed domain identifier remains:\n${forbiddenName.stdout}` })
    const internalImports = yield* runner.run({ command: "rg", args: ["-n", "effect/(src|internal)", `${DOTFILES_ROOT}/src`, `${DOTFILES_ROOT}/tasks`, `${DOTFILES_ROOT}/bin`], cwd: DOTFILES_ROOT, allowFailure: true })
    if (internalImports.exitCode === 0) return yield* new RepositoryValidationFailure({ check: "architecture", detail: `An Effect internal import remains:\n${internalImports.stdout}` })
  }).pipe(Effect.mapError((cause) => cause instanceof RepositoryValidationFailure ? cause : new RepositoryValidationFailure({ check: "architecture", detail: String(cause), cause })))
  const validateCodexBase = fileSystem.readFileString(`${DOTFILES_ROOT}/user/common/.codex/base.toml`).pipe(
    Effect.mapError((cause) => new RepositoryValidationFailure({ check: "Codex base", detail: "The Codex base configuration could not be read.", cause })),
    Effect.flatMap((source) => Effect.try({
      try: () => parseCodexConfig(source),
      catch: (cause) => new RepositoryValidationFailure({ check: "Codex base", detail: "The Codex base configuration is not valid TOML.", cause })
    })),
    Effect.asVoid
  )
  const validate = Effect.gen(function*() {
    yield* run("TypeScript", "bun", ["run", "typecheck"])
    yield* validateCodexBase
    yield* hkConfiguration.validateSource.pipe(
      Effect.mapError((cause) => new RepositoryValidationFailure({ check: "hk configuration", detail: cause.detail, cause }))
    )
    yield* validateShell
    yield* Effect.all([
      run("mise macOS configuration", "mise", ["-C", DOTFILES_ROOT, "-E", "macos", "config", "ls"], miseEnv("core")),
      run("mise Linux configuration", "mise", ["-C", DOTFILES_ROOT, "-E", "linux", "config", "ls"], miseEnv("core")),
      run("mise Exe configuration", "mise", ["-C", DOTFILES_ROOT, "-E", "linux", "-E", "exe", "config", "ls"], miseEnv("core")),
      run("mise tasks", "mise", ["-C", DOTFILES_ROOT, "tasks", "validate"], miseEnv("core"))
    ], { concurrency: "unbounded", discard: true })
    yield* validateLocks
    yield* validateLinks
    yield* run("dotfile status", "mise", dotfileStatusArguments, miseEnv("core"))
    yield* Effect.all([
      run("core locked install", "mise", ["-C", DOTFILES_ROOT, "install", "--locked", "--dry-run"], miseEnv("core")),
      run("full locked install", "mise", ["-C", DOTFILES_ROOT, "install", "--locked", "--dry-run"], miseEnv("full"))
    ], { concurrency: "unbounded", discard: true })
    yield* run("gitleaks directory", "gitleaks", ["dir", "--no-banner", "--redact", "--config", `${DOTFILES_ROOT}/.gitleaks.toml`, DOTFILES_ROOT])
    const staged = yield* gitOutput(["diff", "--cached", "--name-only"])
    if (staged.trim() !== "") yield* run("gitleaks staged", "gitleaks", ["git", "--staged", "--no-banner", "--redact", "--config", `${DOTFILES_ROOT}/.gitleaks.toml`, DOTFILES_ROOT])
    yield* validateArchitecture
  })
  return RepositoryValidation.of({ validate })
}))
