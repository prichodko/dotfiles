import { Console, Context, Data, Effect, Layer } from "effect"
import { DotfilesRepository } from "../../dotfiles/repository/dotfiles-repository.ts"
import { DOTFILES_ROOT } from "../../dotfiles/repository/live-dotfiles-repository.ts"
import { RepositoryValidation } from "../../dotfiles/validation/validate-repository.ts"
import { CommandRunner, describeCommandError } from "../../process/command-runner.ts"
import { appendMiseEnvironments, machineProfileEnvironments, type MachineProfile } from "../profile.ts"

export class MachineUpgradeFailure extends Data.TaggedError("MachineUpgradeFailure")<{
  readonly operation: string
  readonly detail: string
  readonly cause?: unknown
}> {}

export class MachineUpgrade extends Context.Service<MachineUpgrade, {
  readonly upgrade: (profile: MachineProfile) => Effect.Effect<void, MachineUpgradeFailure>
}>()("machine/upgrade/MachineUpgrade") {}

export const LiveMachineUpgradeLayer = Layer.effect(MachineUpgrade, Effect.gen(function*() {
  const runner = yield* CommandRunner
  const repository = yield* DotfilesRepository
  const validation = yield* RepositoryValidation
  const environment = (profile: MachineProfile) => ({
    MISE_ENV: appendMiseEnvironments(
      (process.env.MISE_ENV ?? "").split(",").filter((name) => name.trim() !== "full").join(","),
      machineProfileEnvironments(profile)
    ),
    MISE_IGNORED_CONFIG_PATHS: `${process.env.HOME}/.config/mise/config.toml:${DOTFILES_ROOT}/.config/mise/config.toml`
  })
  const failure = (operation: string, cause: { readonly detail: string }) =>
    new MachineUpgradeFailure({ operation, detail: cause.detail, cause })
  const run = (operation: string, args: ReadonlyArray<string>, profile: MachineProfile) => runner.run({
    command: "mise",
    args: ["-C", DOTFILES_ROOT, ...args],
    cwd: DOTFILES_ROOT,
    env: environment(profile),
    interactive: true
  }).pipe(
    Effect.mapError((cause) => new MachineUpgradeFailure({ operation, detail: describeCommandError(cause), cause })),
    Effect.asVoid
  )
  const upgrade = (profile: MachineProfile) => Effect.gen(function*() {
    yield* Effect.acquireRelease(
      repository.acquireLock.pipe(Effect.mapError((cause) => failure("lock", cause))),
      () => repository.releaseLock
    )
    yield* repository.requireLockUpdatePreconditions.pipe(Effect.mapError((cause) => failure("preconditions", cause)))
    yield* Console.log("Selecting newer versions for the core and full profiles.")
    yield* run("core lock update", ["lock", "--bump"], "core")
    yield* run("full lock update", ["lock", "--bump"], "full")
    const diff = yield* runner.run({
      command: "git",
      args: ["-C", DOTFILES_ROOT, "diff", "--no-ext-diff", "--no-textconv", "HEAD", "--", "mise.lock", "mise.full.lock"],
      cwd: DOTFILES_ROOT
    }).pipe(Effect.mapError((cause) => new MachineUpgradeFailure({ operation: "version changes", detail: describeCommandError(cause), cause })))
    yield* Console.log(diff.stdout.trim() || "The lock files already contain the selected versions.")
    yield* Console.log("Checking source and tests before applying configuration.")
    yield* validation.validateSource.pipe(Effect.mapError((cause) => failure("source validation", cause)))
    yield* run("tests", ["--locked", "run", "test"], profile)
    yield* Console.log(`Installing locked tools and applying the ${profile} profile.`)
    yield* run("local application", ["--locked", "run", "machine:apply", ...(profile === "full" ? ["--", "full"] : [])], profile)
    yield* Console.log(`Upgraded the ${profile} profile. Review and commit the lock-file changes when ready.`)
  }).pipe(Effect.scoped)
  return MachineUpgrade.of({ upgrade })
}))
