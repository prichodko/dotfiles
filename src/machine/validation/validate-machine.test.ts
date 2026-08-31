import { expect, test } from "bun:test"
import { MachineValidation } from "./validate-machine.ts"

test("machine validation has a stable service identity", () => {
  expect(MachineValidation.key).toBe("machine/validation/MachineValidation")
})
