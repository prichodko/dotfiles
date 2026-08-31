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
    workingDirectory: root,
    commandSearchPath: "/brew/bin:/usr/bin"
  }
}

const makeCommandLayer = (gitVersion = "git version 2.55.0\n") => Layer.succeed(CommandRunner, CommandRunner.of({
  run: (input: CommandInput): Effect.Effect<CommandResult> => Effect.sync(() => {
    if (input.command === "git" && input.args?.[0] === "--version") {
      return { exitCode: 0, stdout: gitVersion, stderr: "" }
    }
    if (input.command === "git") {
      const hookCommands: Readonly<Record<string, string>> = {
        "hook.hk-commit-msg.command": "mise x -- hk run commit-msg --from-hook",
        "hook.hk-pre-commit.command": "mise x -- hk run pre-commit --from-hook --staged",
        "hook.hk-pre-push.command": "mise x -- hk run pre-push --from-hook",
        "hook.hk-prepare-commit-msg.command": "mise x -- hk run prepare-commit-msg --from-hook"
      }
      const key = input.args?.at(-1)
      if (key !== undefined && hookCommands[key] !== undefined) {
        return { exitCode: 0, stdout: `${hookCommands[key]}\n`, stderr: "" }
      }
    }
    if (input.command === "git" && input.args?.includes("hk.stashUntracked")) {
      return { exitCode: 0, stdout: "false\n", stderr: "" }
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
})
