import { Context, Data, Effect, Layer } from "effect"
import { CodexConfiguration } from "../../codex/config/codex-configuration.ts"
import { DOTFILES_ROOT } from "../../dotfiles/repository/live-dotfiles-repository.ts"
import { RepositoryValidation } from "../../dotfiles/validation/validate-repository.ts"
import { HkConfiguration } from "../../hk/configuration/hk-configuration.ts"
import { CommandRunner, describeCommandError } from "../../process/command-runner.ts"
import type { MachineProfile } from "../profile.ts"

export class MachineValidationFailure extends Data.TaggedError("MachineValidationFailure")<{
  readonly check: string
  readonly detail: string
  readonly cause?: unknown
}> {}

export class MachineValidation extends Context.Service<MachineValidation, {
  readonly validate: (profile: MachineProfile) => Effect.Effect<void, MachineValidationFailure>
}>()("machine/validation/MachineValidation") {}

export const LiveMachineValidationLayer = Layer.effect(MachineValidation, Effect.gen(function*() {
  const runner = yield* CommandRunner
  const repositoryValidation = yield* RepositoryValidation
  const codexConfiguration = yield* CodexConfiguration
  const hkConfiguration = yield* HkConfiguration
  const run = (check: string, command: string, args: ReadonlyArray<string>, profile: MachineProfile, allowFailure = false) => runner.run({
    command,
    args,
    cwd: DOTFILES_ROOT,
    allowFailure,
    env: {
      MISE_ENV: profile === "full" ? "full" : "",
      MISE_IGNORED_CONFIG_PATHS: `${process.env.HOME}/.config/mise/config.toml:${DOTFILES_ROOT}/.config/mise/config.toml`
    }
  }).pipe(Effect.mapError((cause) => new MachineValidationFailure({ check, detail: describeCommandError(cause), cause })))
  const validate = (profile: MachineProfile) => Effect.gen(function*() {
    yield* repositoryValidation.validate.pipe(Effect.mapError((cause) => new MachineValidationFailure({ check: "repository", detail: cause.detail, cause })))
    yield* run("bootstrap status", "mise", ["-C", DOTFILES_ROOT, "bootstrap", "status", "--missing"], profile)
    yield* run("locked install", "mise", ["-C", DOTFILES_ROOT, "install", "--locked", "--dry-run"], profile)
    const lockChanges = yield* run("lock drift", "mise", ["-C", DOTFILES_ROOT, "lock", "--dry-run", "--json"], profile)
    let lockValue: unknown
    try { lockValue = JSON.parse(lockChanges.stdout) } catch (cause) { return yield* new MachineValidationFailure({ check: "lock drift", detail: "mise returned invalid lock JSON.", cause }) }
    if (!Array.isArray(lockValue)) return yield* new MachineValidationFailure({ check: "lock drift", detail: "mise returned invalid lock data." })
    const versionChanges = lockValue.filter((entry) => {
      if (entry === null || typeof entry !== "object") return true
      const versions = (entry as { readonly new_versions?: unknown }).new_versions
      return !Array.isArray(versions) || versions.length > 0
    })
    if (versionChanges.length > 0) return yield* new MachineValidationFailure({ check: "lock drift", detail: `Lock file versions changed:\n${JSON.stringify(versionChanges, null, 2)}` })
    yield* codexConfiguration.validateApplied.pipe(
      Effect.mapError((cause) => new MachineValidationFailure({ check: "Codex configuration", detail: cause.detail, cause }))
    )
    yield* hkConfiguration.validateApplied.pipe(
      Effect.mapError((cause) => new MachineValidationFailure({ check: "hk configuration", detail: cause.detail, cause }))
    )
    const authentication = yield* Effect.all([
      run("GitHub authentication", "gh", ["auth", "status"], profile, true),
      run("Entire authentication", "entire", ["auth", "status"], profile, true),
      run("Codex authentication", "codex", ["login", "status"], profile, true),
      run("Claude authentication", "claude", ["auth", "status"], profile, true)
    ], { concurrency: "unbounded" })
    const names = ["GitHub", "Entire", "Codex", "Claude"] as const
    const missingAuthentication = authentication.flatMap((result, index) => result.exitCode === 0 ? [] : [names[index]])
    if (missingAuthentication.length > 0) return yield* new MachineValidationFailure({ check: "authentication", detail: `Authentication is missing for: ${missingAuthentication.join(", ")}` })
  })
  return MachineValidation.of({ validate })
}))
