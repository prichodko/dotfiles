import { afterEach, describe, expect, test } from "bun:test"
import { BunServices } from "@effect/platform-bun"
import { Effect, Layer } from "effect"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { CodexConfiguration, makeCodexConfigurationLayer } from "./codex-configuration.ts"

const temporaryDirectories: Array<string> = []

afterEach(() => {
  for (const path of temporaryDirectories.splice(0)) rmSync(path, { recursive: true, force: true })
})

const makeFixture = () => {
  const root = mkdtempSync(join(tmpdir(), "codex-config-"))
  temporaryDirectories.push(root)
  mkdirSync(join(root, ".codex"))
  return {
    root,
    baseConfigPath: join(root, "base.toml"),
    liveConfigPath: join(root, ".codex", "config.toml")
  }
}

const runWithConfiguration = <A>(
  paths: ReturnType<typeof makeFixture>,
  effect: Effect.Effect<A, unknown, CodexConfiguration>
) => Effect.runPromise(effect.pipe(
  Effect.provide(makeCodexConfigurationLayer(paths).pipe(Layer.provide(BunServices.layer)))
))

describe("CodexConfiguration", () => {
  test("creates a missing live configuration", async () => {
    const paths = makeFixture()
    writeFileSync(paths.baseConfigPath, 'model = "gpt-5.6-sol"\n')

    const result = await runWithConfiguration(paths, Effect.gen(function*() {
      return yield* (yield* CodexConfiguration).applyBase
    }))

    expect(result).toBe("created")
    expect(Bun.TOML.parse(readFileSync(paths.liveConfigPath, "utf8"))).toEqual({ model: "gpt-5.6-sol" })
  })

  test("updates managed values and preserves generated state", async () => {
    const paths = makeFixture()
    writeFileSync(paths.baseConfigPath, 'model = "gpt-5.6-sol"\n')
    writeFileSync(paths.liveConfigPath, 'model = "old"\n\n[projects."/tmp/example"]\ntrust_level = "trusted"\n')

    const result = await runWithConfiguration(paths, Effect.gen(function*() {
      return yield* (yield* CodexConfiguration).applyBase
    }))
    const live = Bun.TOML.parse(readFileSync(paths.liveConfigPath, "utf8"))

    expect(result).toBe("updated")
    expect(live).toEqual({ model: "gpt-5.6-sol", projects: { "/tmp/example": { trust_level: "trusted" } } })
  })

  test("does not rewrite an already valid local file", async () => {
    const paths = makeFixture()
    const local = 'model = "gpt-5.6-sol"\n# Local formatting stays unchanged.\n'
    writeFileSync(paths.baseConfigPath, 'model = "gpt-5.6-sol"\n')
    writeFileSync(paths.liveConfigPath, local)

    const result = await runWithConfiguration(paths, Effect.gen(function*() {
      return yield* (yield* CodexConfiguration).applyBase
    }))

    expect(result).toBe("unchanged")
    expect(readFileSync(paths.liveConfigPath, "utf8")).toBe(local)
  })
})
