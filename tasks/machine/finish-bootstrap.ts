#!/usr/bin/env bun

import { Console, Effect } from "effect"
import { ClaudeConfiguration } from "../../src/claude/config/claude-configuration.ts"
import { CodexConfiguration } from "../../src/codex/config/codex-configuration.ts"
import { RepositoryValidation } from "../../src/dotfiles/validation/validate-repository.ts"
import { runProgram } from "../../src/runtime/run-program.ts"

runProgram(
  Effect.gen(function* () {
    const validation = yield* RepositoryValidation
    yield* validation.validateSource
    const claude = yield* ClaudeConfiguration
    const codex = yield* CodexConfiguration
    yield* Console.log(`Claude configuration: ${yield* claude.applyBase}.`)
    yield* Console.log(`Codex configuration: ${yield* codex.applyBase}.`)
    yield* codex.validateApplied
    yield* validation.validateApplied
  }),
)
