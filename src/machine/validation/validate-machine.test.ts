import { expect, test } from "bun:test"
import { expectedGitExecutable, MachineValidation } from "./validate-machine.ts"

test("machine validation has a stable service identity", () => {
  expect(MachineValidation.key).toBe("machine/validation/MachineValidation")
})

test("selects the mise-managed Git executable for each supported platform", () => {
  expect(expectedGitExecutable("darwin")).toBe("/opt/homebrew/bin/git")
  expect(expectedGitExecutable("linux")).toBe("/home/linuxbrew/.linuxbrew/bin/git")
  expect(expectedGitExecutable("win32")).toBeUndefined()
})
