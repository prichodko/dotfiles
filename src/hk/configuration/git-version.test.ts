import { describe, expect, test } from "bun:test"
import {
  homebrewBinDirectories,
  isGitVersionAtLeast,
  parseGitVersion,
  prependSearchPath,
  supportsGlobalGitHooks
} from "./git-version.ts"

describe("Git version selection", () => {
  test("parses Git version output with platform suffixes", () => {
    expect(parseGitVersion("git version 2.50.1 (Apple Git-155)\n")).toEqual({ major: 2, minor: 50, patch: 1 })
    expect(parseGitVersion("unexpected")).toBeUndefined()
  })

  test("requires Git 2.54 or later for global hooks", () => {
    expect(supportsGlobalGitHooks("git version 2.53.9")).toBe(false)
    expect(supportsGlobalGitHooks("git version 2.54.0")).toBe(true)
    expect(supportsGlobalGitHooks("git version 2.55.0")).toBe(true)
    expect(isGitVersionAtLeast({ major: 3, minor: 0, patch: 0 }, { major: 2, minor: 54, patch: 0 })).toBe(true)
  })

  test("puts the Homebrew prefix before the inherited path", () => {
    expect(homebrewBinDirectories("darwin")).toEqual(["/opt/homebrew/bin", "/opt/homebrew/sbin"])
    expect(homebrewBinDirectories("linux")).toEqual(["/home/linuxbrew/.linuxbrew/bin", "/home/linuxbrew/.linuxbrew/sbin"])
    expect(prependSearchPath(["/brew/bin"], "/usr/bin")).toBe("/brew/bin:/usr/bin")
  })
})
