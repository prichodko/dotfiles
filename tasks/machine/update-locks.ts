#!/usr/bin/env bun
//MISE description="Refresh core and full tool lock files"

import { Console, Effect } from "effect"
import { MachineLockUpdate } from "../../src/machine/update/update-machine-locks.ts"
import { runProgram } from "../../src/runtime/run-program.ts"

if (process.argv.length > 2) {
  console.error("error: machine:update-locks does not accept arguments.")
  process.exit(2)
}

runProgram(Effect.gen(function*() {
  yield* (yield* MachineLockUpdate).update
  yield* Console.log("Updated the core and full mise lock files.")
}))
