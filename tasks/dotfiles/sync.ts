#!/usr/bin/env bun
//MISE description="Update dotfiles without committing or publishing local changes"

import { pullDotfiles } from "../../src/dotfiles/pull/pull-dotfiles.ts"
import { runProgram } from "../../src/runtime/run-program.ts"

runProgram(pullDotfiles)
