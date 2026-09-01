import { expect, test } from "bun:test"
import {
  appendMiseEnvironments,
  InvalidMachineName,
  InvalidMachineProfile,
  machineProfileEnvironments,
  parseMachineProfile,
  parseRemoteMachineName
} from "./profile.ts"

test("parses machine profiles", () => {
  expect(parseMachineProfile(undefined)).toBe("core")
  expect(parseMachineProfile("full")).toBe("full")
  expect(parseMachineProfile("other")).toBeInstanceOf(InvalidMachineProfile)
})

test("preserves ordered mise environments and appends profile overlays once", () => {
  expect(appendMiseEnvironments("linux,exe", machineProfileEnvironments("core"))).toBe("linux,exe")
  expect(appendMiseEnvironments("linux,exe", machineProfileEnvironments("full"))).toBe("linux,exe,full")
  expect(appendMiseEnvironments("linux,exe,full", machineProfileEnvironments("full"))).toBe("linux,exe,full")
})

test("reserves the local target", () => {
  expect(parseRemoteMachineName("local")).toBeInstanceOf(InvalidMachineName)
  expect(parseRemoteMachineName("work-1")).toBe("work-1")
})

test("validates provider-compatible remote names", () => {
  expect(parseRemoteMachineName("test1")).toBe("test1")
  expect(parseRemoteMachineName("a-vm-name")).toBe("a-vm-name")
  for (const invalid of ["test", "test-", "test--vm", "1test", "a".repeat(53)]) {
    expect(parseRemoteMachineName(invalid)).toBeInstanceOf(InvalidMachineName)
  }
})
