import { describe, expect, test } from "bun:test"
import { findCodexConfigDrift, mergeCodexConfig, parseCodexConfig, renderCodexConfig } from "./codex-config.ts"

describe("Codex base configuration", () => {
  test("overrides managed values and preserves local state", () => {
    const base = parseCodexConfig('model = "gpt-5.6-sol"\n\n[features]\nmulti_agent = true\n')
    const local = parseCodexConfig('model = "old"\n\n[features]\nmulti_agent = false\nhooks = true\n\n[projects."/tmp/example"]\ntrust_level = "trusted"\n')
    const merged = mergeCodexConfig(base, local)

    expect(merged).toEqual({
      model: "gpt-5.6-sol",
      features: { multi_agent: true, hooks: true },
      projects: { "/tmp/example": { trust_level: "trusted" } }
    })
  })

  test("reports only managed paths as drift", () => {
    const base = parseCodexConfig('model = "gpt-5.6-sol"\n\n[features]\nmulti_agent = true\n')
    const local = parseCodexConfig('model = "old"\n\n[features]\nmulti_agent = true\nlocal_only = true\n')

    expect(findCodexConfigDrift(base, local)).toEqual(["model"])
  })

  test("round-trips merged TOML", () => {
    const document = parseCodexConfig('model = "gpt-5.6-sol"\n\n[[skills.config]]\nname = "example"\nenabled = false\n')
    expect(parseCodexConfig(renderCodexConfig(document))).toEqual(document)
  })
})
