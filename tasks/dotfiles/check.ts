#!/usr/bin/env bun
//MISE description="Validate managed dotfiles and scan for secrets"

import { Console, Effect } from "effect"
import { RepositoryValidation } from "../../src/dotfiles/validation/validate-repository.ts"
import { runProgram } from "../../src/runtime/run-program.ts"

runProgram(Effect.gen(function*() {
  const validation = yield* RepositoryValidation
  yield* validation.validate
  yield* Console.log("Dotfiles validation passed.")
}))
