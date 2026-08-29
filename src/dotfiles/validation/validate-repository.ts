import { Context, Data, Effect, FileSystem, Layer } from "effect"
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
  const miseEnv = (profile: "core" | "full") => ({
    MISE_ENV: profile === "full" ? "full" : "",
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
    const tracked = (yield* gitOutput(["ls-files", "-co", "--exclude-standard", "lib", "tasks", "tests", "user"])).split("\n").filter(Boolean)
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
  const validate = Effect.gen(function*() {
    yield* run("TypeScript", "bun", ["run", "typecheck"])
    yield* validateShell
    yield* Effect.all([
      run("mise macOS configuration", "mise", ["-C", DOTFILES_ROOT, "-E", "macos", "config", "ls"], miseEnv("core")),
      run("mise Linux configuration", "mise", ["-C", DOTFILES_ROOT, "-E", "linux", "config", "ls"], miseEnv("core")),
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
