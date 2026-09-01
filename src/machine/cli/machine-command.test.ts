import { expect, test } from "bun:test"
import { Effect } from "effect"
import { confirmMachineRemoval, formatLocalMachineStatus, formatMachineList, formatMachineStatus } from "./machine-command.ts"

test("formats machine output", () => {
  const machines = [
    { name: "work", status: "running", region: "fra", regionDisplay: "Frankfurt, Germany" },
    { name: "longer-work", status: "stopped", region: "pdx", regionDisplay: "Oregon, USA" }
  ]
  expect(formatMachineList(machines, false)).toBe([
    "NAME         STATUS   REGION",
    "work         running  Frankfurt, Germany (fra)",
    "longer-work  stopped  Oregon, USA (pdx)"
  ].join("\n"))
  expect(JSON.parse(formatMachineList(machines, true))).toEqual(machines)
  expect(formatMachineStatus(machines[0]!, false)).toBe([
    "Name:   work",
    "Status: running",
    "Region: Frankfurt, Germany (fra)"
  ].join("\n"))
  expect(JSON.parse(formatMachineStatus(machines[0]!, true))).toEqual(machines[0])
})

test("formats incomplete region data without inventing a display value", () => {
  expect(formatMachineStatus({ name: "work", status: "running", region: "fra", regionDisplay: null }, false)).toContain("Region: fra")
  expect(formatMachineStatus({ name: "work", status: "running", region: null, regionDisplay: null }, false)).toContain("Region: unknown")
})

test("formats local status without remote region fields", () => {
  expect(formatLocalMachineStatus(false)).toBe("Name:   local\nStatus: present")
  expect(JSON.parse(formatLocalMachineStatus(true))).toEqual({ name: "local", status: "present" })
})

test("confirms destructive removal only with terminal consent or yes", async () => {
  expect(await Effect.runPromise(confirmMachineRemoval("work", true, false))).toBe(true)
  expect(await Effect.runPromise(confirmMachineRemoval("work", false, true, () => "yes"))).toBe(true)
  expect(await Effect.runPromise(confirmMachineRemoval("work", false, true, () => "no"))).toBe(false)
  expect((await Effect.runPromiseExit(confirmMachineRemoval("work", false, false)))._tag).toBe("Failure")
})
