import { expect, test } from "bun:test"
import { findDisallowedLockUpdatePaths } from "./lock-update-paths.ts"

test("permits only lock-owned configuration and lock files", () => {
  expect(findDisallowedLockUpdatePaths([
    "mise/conf.d/core.toml",
    "mise.full.toml",
    "mise.lock",
    "mise.full.lock"
  ])).toEqual([])
})

test("rejects unrelated tracked changes", () => {
  expect(findDisallowedLockUpdatePaths([
    "mise.full.toml",
    "README.md",
    "src/machine/upgrade/upgrade-machine.ts"
  ])).toEqual([
    "README.md",
    "src/machine/upgrade/upgrade-machine.ts"
  ])
})
