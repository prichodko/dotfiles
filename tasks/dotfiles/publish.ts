#!/usr/bin/env bun
//MISE description="Publish tracked changes after validating the exact commit"

import { publishDotfiles } from "../../src/dotfiles/publish/publish-dotfiles.ts"
import { runProgram } from "../../src/runtime/run-program.ts"

runProgram(publishDotfiles)
