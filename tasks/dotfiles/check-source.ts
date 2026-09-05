#!/usr/bin/env bun

import { Effect } from "effect"
import { RepositoryValidation } from "../../src/dotfiles/validation/validate-repository.ts"
import { runProgram } from "../../src/runtime/run-program.ts"

runProgram(RepositoryValidation.use((validation) => validation.validateSource))
