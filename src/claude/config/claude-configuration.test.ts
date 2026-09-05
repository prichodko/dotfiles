import { afterEach, expect, test } from "bun:test"
import { BunServices } from "@effect/platform-bun"
import { Effect, Layer } from "effect"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ClaudeConfiguration, makeClaudeConfigurationLayer } from "./claude-configuration.ts"

const directories: Array<string> = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), "claude-configuration-"))
  directories.push(directory)
  mkdirSync(join(directory, ".claude"))
  const paths = { baseConfigPath: join(directory, "base.json"), liveConfigPath: join(directory, ".claude", "settings.json") }
  writeFileSync(paths.baseConfigPath, JSON.stringify({ permissions: { defaultMode: "auto" }, effortLevel: "high" }))
  const layer = makeClaudeConfigurationLayer(paths).pipe(Layer.provide(BunServices.layer))
  const apply = () => Effect.runPromise(ClaudeConfiguration.use((c) => c.applyBase).pipe(Effect.provide(layer)))
  return { ...paths, layer, apply }
}

test("creates portable settings in a fresh home and applies them repeatedly", async () => {
  const f = fixture()
  expect(await f.apply()).toBe("created")
  expect(statSync(f.liveConfigPath).mode & 0o777).toBe(0o600)
  const first = readFileSync(f.liveConfigPath, "utf8")
  expect(JSON.parse(first)).toEqual({ permissions: { defaultMode: "auto" }, effortLevel: "high" })
  expect(await f.apply()).toBe("unchanged")
  expect(readFileSync(f.liveConfigPath, "utf8")).toBe(first)
})

test("updates owned keys while preserving local integrations and permissions", async () => {
  const f = fixture()
  const local = {
    permissions: { defaultMode: "old", allow: ["Read"] },
    hooks: { SessionStart: [{ command: "local-script" }] },
    statusLine: { command: "local-status" },
    enabledPlugins: { "local-plugin": true },
  }
  writeFileSync(f.liveConfigPath, JSON.stringify(local))
  chmodSync(f.liveConfigPath, 0o640)
  expect(await f.apply()).toBe("updated")
  expect(JSON.parse(readFileSync(f.liveConfigPath, "utf8"))).toEqual({
    ...local,
    permissions: { defaultMode: "auto", allow: ["Read"] },
    effortLevel: "high",
  })
  expect(statSync(f.liveConfigPath).mode & 0o777).toBe(0o640)
})

test("accepts semantic equality without rewriting application formatting", async () => {
  const f = fixture()
  const source = '{"effortLevel":"high","permissions":{"defaultMode":"auto"}}'
  writeFileSync(f.liveConfigPath, source)
  expect(await f.apply()).toBe("unchanged")
  await Effect.runPromise(ClaudeConfiguration.use((c) => c.validateApplied).pipe(Effect.provide(f.layer)))
  expect(readFileSync(f.liveConfigPath, "utf8")).toBe(source)
})

test("preserves an invalid local file for repair", async () => {
  const f = fixture()
  writeFileSync(f.liveConfigPath, "{invalid local state")
  const result = await Effect.runPromiseExit(ClaudeConfiguration.use((c) => c.applyBase).pipe(Effect.provide(f.layer)))
  expect(result._tag).toBe("Failure")
  expect(readFileSync(f.liveConfigPath, "utf8")).toBe("{invalid local state")
})
