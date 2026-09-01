import { Context, Data, Effect, Layer } from "effect"
import { DotfilesRepository } from "../../dotfiles/repository/dotfiles-repository.ts"
import { DOTFILES_ROOT } from "../../dotfiles/repository/live-dotfiles-repository.ts"
import { RepositoryValidation } from "../../dotfiles/validation/validate-repository.ts"
import { CommandRunner, describeCommandError } from "../../process/command-runner.ts"

export class MachineLockUpdateFailure extends Data.TaggedError("MachineLockUpdateFailure")<{
  readonly operation: string
  readonly detail: string
  readonly cause?: unknown
}> {}

export class MachineLockUpdate extends Context.Service<MachineLockUpdate, {
  readonly update: Effect.Effect<void, MachineLockUpdateFailure>
}>()("machine/update/MachineLockUpdate") {}

export const LiveMachineLockUpdateLayer = Layer.effect(MachineLockUpdate, Effect.gen(function*() {
  const runner = yield* CommandRunner
  const repository = yield* DotfilesRepository
  const validation = yield* RepositoryValidation
  const environment = (profile: "core" | "full") => ({
    MISE_ENV: profile === "full" ? "full" : "",
    MISE_IGNORED_CONFIG_PATHS: `${process.env.HOME}/.config/mise/config.toml:${DOTFILES_ROOT}/.config/mise/config.toml`
  })
  const run = (operation: string, args: ReadonlyArray<string>, profile: "core" | "full") => runner.run({
    command: "mise",
    args: ["-C", DOTFILES_ROOT, ...args],
    cwd: DOTFILES_ROOT,
    env: environment(profile)
  }).pipe(
    Effect.mapError((cause) => new MachineLockUpdateFailure({ operation, detail: describeCommandError(cause), cause })),
    Effect.asVoid
  )
  const update = Effect.gen(function*() {
    yield* repository.requirePullPreconditions.pipe(
      Effect.mapError((cause) => new MachineLockUpdateFailure({ operation: "preconditions", detail: cause.detail, cause }))
    )
    yield* run("core lock update", ["lock", "--bump"], "core")
    yield* run("full lock update", ["lock", "--bump"], "full")
    yield* run("managed mise copies", ["bootstrap", "dotfiles", "apply", "--yes"], "core")
    yield* Effect.all([
      run("core locked install", ["install", "--locked", "--dry-run"], "core"),
      run("full locked install", ["install", "--locked", "--dry-run"], "full")
    ], { concurrency: "unbounded", discard: true })
    yield* validation.validate.pipe(
      Effect.mapError((cause) => new MachineLockUpdateFailure({ operation: "repository validation", detail: cause.detail, cause }))
    )
  })
  return MachineLockUpdate.of({ update })
}))
