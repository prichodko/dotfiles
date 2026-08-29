import { expect, test } from "bun:test"
import { InvalidMachineTaskArguments, parseMachineTaskArguments } from "./task-arguments.ts"

test("parses machine task arguments", () => {
  expect(parseMachineTaskArguments(["work"])).toEqual({ name: "work", profile: "core" })
  expect(parseMachineTaskArguments(["work", "--profile", "full"])).toEqual({ name: "work", profile: "full" })
})

test("rejects malformed machine task arguments", () => {
  for (const args of [
    [],
    ["work", "--unknown"],
    ["work", "--profile"],
    ["work", "--profile", "other"],
    ["work", "--profile", "full", "extra"],
    ["work", "extra"]
  ]) expect(parseMachineTaskArguments(args)).toBeInstanceOf(InvalidMachineTaskArguments)
})
