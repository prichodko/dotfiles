#!/usr/bin/env bun
//MISE description="Validate the complete machine environment"

import { Console, Effect } from "effect"
import type { MachineProfile } from "../../src/machine/profile.ts"
import { MachineValidation } from "../../src/machine/validation/validate-machine.ts"
import { runProgram } from "../../src/runtime/run-program.ts"

const argumentsList = process.argv.slice(2)
if (argumentsList.length > 1 || (argumentsList.length === 1 && argumentsList[0] !== "full")) {
  console.error("error: Use no argument for core, or use the positional argument full.")
  process.exit(2)
}
const profile: MachineProfile = argumentsList[0] === "full" ? "full" : "core"

runProgram(Effect.gen(function*() {
  const validation = yield* MachineValidation
  yield* validation.validate(profile)
  yield* Console.log(`Validated the ${profile} native mise environment.`)
}))
