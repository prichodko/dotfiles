#!/usr/bin/env bun
//MISE description="Apply the portable Codex base configuration"

import { Console, Effect } from "effect"
import { CodexConfiguration } from "../../src/codex/config/codex-configuration.ts"
import { runProgram } from "../../src/runtime/run-program.ts"

runProgram(Effect.gen(function*() {
  const configuration = yield* CodexConfiguration
  const result = yield* configuration.applyBase
  yield* Console.log(`Codex configuration: ${result}.`)
}))
