import { Context, Data, Effect, Layer } from "effect"
import { CodexConfiguration } from "../../codex/config/codex-configuration.ts"
import { DOTFILES_ROOT } from "../../dotfiles/repository/live-dotfiles-repository.ts"
import { RepositoryValidation } from "../../dotfiles/validation/validate-repository.ts"
import { HkConfiguration } from "../../hk/configuration/hk-configuration.ts"
import { homebrewBinDirectories, prependSearchPath, supportsGlobalGitHooks } from "../../hk/configuration/git-version.ts"
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

export const expectedGitExecutable = (platform: NodeJS.Platform): string | undefined => {
  if (platform === "darwin") return "/opt/homebrew/bin/git"
  if (platform === "linux") return "/home/linuxbrew/.linuxbrew/bin/git"
  return undefined
}

export const LiveMachineValidationLayer = Layer.effect(MachineValidation, Effect.gen(function*() {
  const runner = yield* CommandRunner
  const repositoryValidation = yield* RepositoryValidation
  const codexConfiguration = yield* CodexConfiguration
  const hkConfiguration = yield* HkConfiguration
  const commandEnvironment = {
    PATH: prependSearchPath(homebrewBinDirectories(process.platform), process.env.PATH)
  }
  const run = (check: string, command: string, args: ReadonlyArray<string>, profile: MachineProfile, allowFailure = false) => runner.run({
    command,
    args,
    cwd: DOTFILES_ROOT,
    allowFailure,
    env: {
      ...commandEnvironment,
      MISE_ENV: profile === "full" ? "full" : "",
      MISE_IGNORED_CONFIG_PATHS: `${process.env.HOME}/.config/mise/config.toml:${DOTFILES_ROOT}/.config/mise/config.toml`
    }
  }).pipe(Effect.mapError((cause) => new MachineValidationFailure({ check, detail: describeCommandError(cause), cause })))
  const validateGit = (profile: MachineProfile) => Effect.gen(function*() {
    const executable = (yield* run("Git executable", "which", ["git"], profile)).stdout.trim()
    const expected = expectedGitExecutable(process.platform)
    if (expected !== undefined && executable !== expected) {
      return yield* new MachineValidationFailure({ check: "Git executable", detail: `Expected ${expected}. Active executable: ${executable || "unknown"}` })
    }
    const version = (yield* run("Git version", "git", ["--version"], profile)).stdout
    if (!supportsGlobalGitHooks(version)) {
      return yield* new MachineValidationFailure({ check: "Git version", detail: `Git 2.54.0 or later is required. Active output: ${version.trim() || "unknown"}` })
    }
  })
  const validateMacSigning = (profile: MachineProfile) => Effect.gen(function*() {
    if (process.platform !== "darwin" || profile !== "full") return
    const config = (key: string) => run("Git signing configuration", "git", ["config", "--global", "--includes", "--get", key], profile)
    const format = (yield* config("gpg.format")).stdout.trim()
    if (format !== "ssh") return yield* new MachineValidationFailure({ check: "Git signing configuration", detail: `Expected SSH signing. Active format: ${format || "unset"}` })
    const signingKey = (yield* config("user.signingkey")).stdout.trim()
    if (!signingKey.startsWith("ssh-ed25519 ")) return yield* new MachineValidationFailure({ check: "Git signing configuration", detail: "The managed SSH signing key is missing." })
    const allowedSigners = (yield* config("gpg.ssh.allowedSignersFile")).stdout.trim()
    if (allowedSigners !== "~/.dotfiles/user/common/.ssh/allowed_signers") return yield* new MachineValidationFailure({ check: "Git signing configuration", detail: `Unexpected allowed signers file: ${allowedSigners || "unset"}` })
    yield* run("allowed signers", "/usr/bin/test", ["-f", `${DOTFILES_ROOT}/user/common/.ssh/allowed_signers`], profile)
    const signer = (yield* config("gpg.ssh.program")).stdout.trim()
    yield* run("1Password signer", "/usr/bin/test", ["-x", signer], profile)
    const ssh = (yield* run("GitHub SSH configuration", "ssh", ["-G", "github.com"], profile)).stdout
    if (!ssh.includes("2BUA8C4S2C.com.1password/t/agent.sock")) {
      return yield* new MachineValidationFailure({ check: "GitHub SSH configuration", detail: "GitHub does not use the managed 1Password SSH agent." })
    }
  })
  const validate = (profile: MachineProfile) => Effect.gen(function*() {
    yield* repositoryValidation.validate.pipe(Effect.mapError((cause) => new MachineValidationFailure({ check: "repository", detail: cause.detail, cause })))
    yield* validateGit(profile)
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
    yield* validateMacSigning(profile)
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
