import { expect, test } from "bun:test"
import { Effect } from "effect"
import { confirmMachineRemoval, formatMachineList } from "./machine-command.ts"

test("formats machine output", () => {
  const machines = [{ name: "work", status: "running" }]
  expect(formatMachineList(machines, false)).toBe("work\trunning")
  expect(JSON.parse(formatMachineList(machines, true))).toEqual(machines)
})

test("confirms destructive removal only with terminal consent or yes", async () => {
  expect(await Effect.runPromise(confirmMachineRemoval("work", true, false))).toBe(true)
  expect(await Effect.runPromise(confirmMachineRemoval("work", false, true, () => "yes"))).toBe(true)
  expect(await Effect.runPromise(confirmMachineRemoval("work", false, true, () => "no"))).toBe(false)
  expect((await Effect.runPromiseExit(confirmMachineRemoval("work", false, false)))._tag).toBe("Failure")
})
