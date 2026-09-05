#!/usr/bin/env bun
//MISE description="Upgrade locked tool versions and apply them locally"

import { MachineUpgrade } from "../../src/machine/upgrade/upgrade-machine.ts"
import type { MachineProfile } from "../../src/machine/profile.ts"
import { runProgram } from "../../src/runtime/run-program.ts"

const argumentsList = process.argv.slice(2)
if (argumentsList.length > 1 || (argumentsList.length === 1 && argumentsList[0] !== "full")) {
  console.error("error: Use no argument for core, or use the positional argument full.")
  process.exit(2)
}
const profile: MachineProfile = argumentsList[0] === "full" ? "full" : "core"

runProgram(MachineUpgrade.use((service) => service.upgrade(profile)))
