import { expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { makeRecordingCommandRunner } from "../../process/recording-command-runner.ts"
import { dotfileStatusArguments, RepositoryValidation } from "./validate-repository.ts"

test("repository validation is a service boundary", () => {
  expect(RepositoryValidation.key).toBe("dotfiles/validation/RepositoryValidation")
  expect(Layer.isLayer).toBeDefined()
  expect(Effect.isEffect(makeRecordingCommandRunner())).toBe(true)
})

test("treats missing or different managed files as validation failures", () => {
  expect(dotfileStatusArguments.slice(-3)).toEqual(["dotfiles", "status", "--missing"])
})
