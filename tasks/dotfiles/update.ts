#!/usr/bin/env bun
//MISE description="Pull and apply dotfiles without publishing local changes"

import { pullDotfiles } from "../../src/dotfiles/pull/pull-dotfiles.ts"
import { runProgram } from "../../src/runtime/run-program.ts"

runProgram(pullDotfiles)
