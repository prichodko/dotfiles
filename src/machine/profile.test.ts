import { expect, test } from "bun:test"
import { InvalidMachineName, InvalidMachineProfile, parseMachineProfile, parseRemoteMachineName } from "./profile.ts"

test("parses machine profiles", () => {
  expect(parseMachineProfile(undefined)).toBe("core")
  expect(parseMachineProfile("full")).toBe("full")
  expect(parseMachineProfile("other")).toBeInstanceOf(InvalidMachineProfile)
})

test("reserves the local target", () => {
  expect(parseRemoteMachineName("local")).toBeInstanceOf(InvalidMachineName)
  expect(parseRemoteMachineName("work-1")).toBe("work-1")
})
