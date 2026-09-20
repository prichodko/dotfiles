import { afterEach, describe, expect, test } from "bun:test"
import { BunServices } from "@effect/platform-bun"
import { Effect, Layer } from "effect"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { CommandRunner, type CommandInput, type CommandResult } from "../../process/command-runner.ts"
import { HkConfiguration, makeHkConfigurationLayer, type HkConfigurationPaths } from "./hk-configuration.ts"

const temporaryDirectories: Array<string> = []

afterEach(() => {
  for (const path of temporaryDirectories.splice(0)) rmSync(path, { recursive: true, force: true })
})

const makeFixture = (): HkConfigurationPaths => {
  const root = mkdtempSync(join(tmpdir(), "hk-configuration-"))
  temporaryDirectories.push(root)
  const userConfigPath = join(root, "user", ".config", "hk", "config.pkl")
  mkdirSync(join(root, "user", ".config", "hk"), { recursive: true })
  writeFileSync(userConfigPath, "hooks {}\n")
  return {
    userConfigPath,
    hooksConfigPath: join(root, "user", ".config", "git", "hk.conf"),
    workingDirectory: root,
    commandSearchPath: "/brew/bin:/usr/bin"
  }
}

const makeCommandLayer = (
  gitVersion = "git version 2.55.0\n",
  sourcePlanOutput = "Plan: pre-commit\n  oxfmt\n",
  appliedPlanOutput = sourcePlanOutput,
  commands?: Array<CommandInput>
) => Layer.succeed(CommandRunner, CommandRunner.of({
  run: (input: CommandInput): Effect.Effect<CommandResult> => Effect.sync(() => {
    commands?.push(input)
    if (input.command === "git" && input.args?.[0] === "--version") {
      return { exitCode: 0, stdout: gitVersion, stderr: "" }
    }
    if (input.command === "which" && input.args?.[0] === "mise") {
      return { exitCode: 0, stdout: "/home/test/.local/bin/mise\n", stderr: "" }
    }
    if (input.command === "git") {
      const hookCommands: Readonly<Record<string, string>> = {
        "hook.hk-commit-msg.command": "test \"${HK:-1}\" = \"0\" || /home/test/.local/bin/mise x hk -- hk run commit-msg --from-hook",
        "hook.hk-pre-commit.command": "test \"${HK:-1}\" = \"0\" || /home/test/.local/bin/mise x hk -- hk run pre-commit --staged",
        "hook.hk-pre-push.command": "test \"${HK:-1}\" = \"0\" || /home/test/.local/bin/mise x hk -- hk run pre-push --from-hook",
        "hook.hk-prepare-commit-msg.command": "test \"${HK:-1}\" = \"0\" || /home/test/.local/bin/mise x hk -- hk run prepare-commit-msg --from-hook"
      }
      const key = input.args?.at(-1)
      if (key !== undefined && hookCommands[key] !== undefined) {
        return { exitCode: 0, stdout: `${hookCommands[key]}\n`, stderr: "" }
      }
    }
    if (input.command === "git" && input.args?.includes("hk.stashUntracked")) {
      return { exitCode: 0, stdout: "false\n", stderr: "" }
    }
    if (input.command === "mise" && input.args?.includes("--plan")) {
      const stdout = input.env?.XDG_CONFIG_HOME === undefined ? appliedPlanOutput : sourcePlanOutput
      return { exitCode: 0, stdout, stderr: "" }
    }
    return { exitCode: 0, stdout: "", stderr: "" }
  })
}))

const runWithConfiguration = <A>(
  paths: HkConfigurationPaths,
  effect: Effect.Effect<A, unknown, HkConfiguration>,
  gitVersion?: string
) => Effect.runPromise(effect.pipe(
  Effect.provide(makeHkConfigurationLayer(paths).pipe(Layer.provide(Layer.merge(BunServices.layer, makeCommandLayer(gitVersion)))))
))

describe("HkConfiguration", () => {
  test("installs machine-local global hooks through mise", async () => {
    const paths = makeFixture()
    const commands: Array<CommandInput> = []
    await Effect.runPromise(HkConfiguration.use((configuration) => configuration.applyGlobalHooks).pipe(
      Effect.provide(makeHkConfigurationLayer(paths).pipe(
        Layer.provide(Layer.merge(BunServices.layer, makeCommandLayer(undefined, undefined, undefined, commands)))
      ))
    ))

    expect(commands).toContainEqual(expect.objectContaining({
      command: "mise",
      args: ["--locked", "-C", paths.workingDirectory, "exec", "--", "hk", "install", "--global", "--mise"],
      env: expect.objectContaining({ GIT_CONFIG_GLOBAL: paths.hooksConfigPath })
    }))
    expect(commands).toContainEqual(expect.objectContaining({
      command: "git",
      args: [
        "config",
        "--file",
        paths.hooksConfigPath,
        "--replace-all",
        "hook.hk-pre-commit.command",
        'test "${HK:-1}" = "0" || /home/test/.local/bin/mise x hk -- hk run pre-commit --staged'
      ]
    }))
  })

  test("validates the managed global hooks", async () => {
    const paths = makeFixture()
    await runWithConfiguration(paths, Effect.gen(function*() {
      yield* (yield* HkConfiguration).validateApplied
    }))
  })

  test("rejects Git versions without config-based global hooks", async () => {
    const paths = makeFixture()
    const promise = runWithConfiguration(paths, Effect.gen(function*() {
      yield* (yield* HkConfiguration).validateApplied
    }), "git version 2.53.9\n")

    await expect(promise).rejects.toMatchObject({ _tag: "HkConfigurationFailure", operation: "Git version" })
  })

  test("rejects an undiscoverable global policy", async () => {
    const paths = makeFixture()
    const promise = Effect.runPromise(Effect.gen(function*() {
      yield* (yield* HkConfiguration).validateApplied
    }).pipe(
      Effect.provide(makeHkConfigurationLayer(paths).pipe(
        Layer.provide(Layer.merge(BunServices.layer, makeCommandLayer(
          "git version 2.55.0\n",
          "Plan: pre-commit\n  oxfmt\n",
          "Plan: pre-commit\n"
        )))
      ))
    ))

    await expect(promise).rejects.toMatchObject({ _tag: "HkConfigurationFailure", operation: "applied hk configuration" })
  })
})
