#!/usr/bin/env bun
//MISE description="Synchronize tracked dotfiles changes between trusted Macs"

import { synchronizeDotfiles } from "../../src/dotfiles/sync/synchronize-dotfiles.ts"
import { runProgram } from "../../src/runtime/run-program.ts"

runProgram(synchronizeDotfiles)
