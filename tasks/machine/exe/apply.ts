#!/usr/bin/env bun
//MISE description="Update and reapply an Exe machine"

import { Console, Effect } from "effect"
import { InvalidMachineTaskArguments, parseMachineTaskArguments } from "../../../src/machine/cli/task-arguments.ts"
import { applyRemoteMachine } from "../../../src/machine/lifecycle/manage-machine.ts"
import { runProgram } from "../../../src/runtime/run-program.ts"

const parsedArguments = parseMachineTaskArguments(process.argv.slice(2))
if (parsedArguments instanceof InvalidMachineTaskArguments) {
  console.error(`error: ${parsedArguments.reason}`)
  process.exit(2)
}

runProgram(Effect.gen(function*() {
  yield* applyRemoteMachine(parsedArguments.name, parsedArguments.profile)
  yield* Console.log(`Updated and reapplied ${parsedArguments.name}.`)
}))
