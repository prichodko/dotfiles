#!/usr/bin/env bun
//MISE description="Create and bootstrap an Exe machine"

import { Console, Effect } from "effect"
import { InvalidMachineTaskArguments, parseMachineTaskArguments } from "../../../src/machine/cli/task-arguments.ts"
import { createMachine } from "../../../src/machine/lifecycle/manage-machine.ts"
import { runProgram } from "../../../src/runtime/run-program.ts"

const parsedArguments = parseMachineTaskArguments(process.argv.slice(2))
if (parsedArguments instanceof InvalidMachineTaskArguments) {
  console.error(`error: ${parsedArguments.reason}`)
  process.exit(2)
}

runProgram(Effect.gen(function*() {
  yield* createMachine({ name: parsedArguments.name, cpu: 2, memory: "8GB", disk: "25GB" }, parsedArguments.profile)
  yield* Console.log(`Created and bootstrapped ${parsedArguments.name}.`)
}))
