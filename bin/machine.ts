#!/usr/bin/env bun

import { machineCli } from "../src/machine/cli/machine-command.ts"
import { runProgram } from "../src/runtime/run-program.ts"

runProgram(machineCli)
