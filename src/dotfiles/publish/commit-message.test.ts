import { expect, test } from "bun:test"
import { buildCommitMessage, sortPaths } from "./commit-message.ts"

test("builds bounded commit subjects and preserves all paths in the body", () => {
  expect(buildCommitMessage(["b", "a"])).toEqual({ subject: "sync: a, b" })
  expect(buildCommitMessage(["a/" + "x".repeat(80), "b"])).toEqual({ subject: "sync: 2 tracked paths", body: `a/${"x".repeat(80)}\nb` })
  expect(sortPaths(["a", "_", "Z", "A", "-", "z"])).toEqual(["-", "A", "Z", "_", "a", "z"])
})
