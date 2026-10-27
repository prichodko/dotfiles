#!/usr/bin/env bun

import { Effect } from "effect"
import { RepositoryValidation } from "../../src/dotfiles/validation/validate-repository.ts"
import { HkConfiguration } from "../../src/hk/configuration/hk-configuration.ts"
import { runProgram } from "../../src/runtime/run-program.ts"

runProgram(
  Effect.gen(function* () {
    const validation = yield* RepositoryValidation
    yield* validation.validateSource
    const hk = yield* HkConfiguration
    yield* hk.applyGlobalHooks
    yield* validation.validateApplied
  }),
)
