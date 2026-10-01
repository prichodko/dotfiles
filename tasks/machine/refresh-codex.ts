#!/usr/bin/env bun
//MISE description="Refresh a running Codex app-server after a tool update"

import { Console, Effect } from "effect"
import { refreshCodexAppServer } from "../../src/codex/refresh-app-server.ts"
import { runProgram } from "../../src/runtime/run-program.ts"

runProgram(refreshCodexAppServer().pipe(Effect.flatMap((result) => Console.log(`Codex app-server: ${result}.`))))
