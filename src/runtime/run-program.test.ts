import { expect, test } from "bun:test"
import { ApplicationLayer } from "./run-program.ts"

test("application layer is defined", () => {
  expect(ApplicationLayer).toBeDefined()
})
