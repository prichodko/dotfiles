import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { allSelectedToolsAreActive, MachineValidation } from "./validate-machine.ts"

test("machine validation has a stable service identity", () => {
  expect(MachineValidation.key).toBe("machine/validation/MachineValidation")
})

test("requires every selected mise tool to be installed and active", () => {
  const valid = JSON.parse(readFileSync(new URL("../../../tests/fixtures/mise-current.json", import.meta.url), "utf8"))
  expect(allSelectedToolsAreActive(valid)).toBe(true)
  expect(allSelectedToolsAreActive({ bun: [{ version: "1.4.0", installed: false, active: true }] })).toBe(false)
  expect(allSelectedToolsAreActive({ bun: [{ version: "1.4.0", installed: true, active: false }] })).toBe(false)
  expect(allSelectedToolsAreActive({ bun: [] })).toBe(false)
  expect(allSelectedToolsAreActive({ bun: [{ installed: true, active: true }] })).toBe(false)
  expect(allSelectedToolsAreActive({})).toBe(false)
})
