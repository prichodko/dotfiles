import { expect, test } from "bun:test"
import { InvalidMachineTaskArguments, parseMachineTaskArguments } from "./task-arguments.ts"

test("parses machine task arguments", () => {
  expect(parseMachineTaskArguments(["work-vm"])).toEqual({ name: "work-vm", profile: "core" })
  expect(parseMachineTaskArguments(["work-vm", "--profile", "full"])).toEqual({ name: "work-vm", profile: "full" })
})

test("rejects malformed machine task arguments", () => {
  for (const args of [
    [],
    ["work-vm", "--unknown"],
    ["work-vm", "--profile"],
    ["work-vm", "--profile", "other"],
    ["work-vm", "--profile", "full", "extra"],
    ["work-vm", "extra"]
  ]) expect(parseMachineTaskArguments(args)).toBeInstanceOf(InvalidMachineTaskArguments)
})
