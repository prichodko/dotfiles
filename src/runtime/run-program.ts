import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Cause, Console, Effect, Layer, Option } from "effect"
import type * as LayerTypes from "effect/Layer"
import { CliError } from "effect/unstable/cli"
import { LiveCodexConfigurationLayer } from "../codex/config/codex-configuration.ts"
import { LiveDotfilesRepositoryLayer } from "../dotfiles/repository/live-dotfiles-repository.ts"
import { LiveRepositoryValidationLayer } from "../dotfiles/validation/validate-repository.ts"
import { LiveHkConfigurationLayer } from "../hk/configuration/hk-configuration.ts"
import { ExeMachineProviderLayer } from "../machine/providers/exe/exe-machine-provider.ts"
import { LiveMachineLockUpdateLayer } from "../machine/update/update-machine-locks.ts"
import { LiveMachineValidationLayer } from "../machine/validation/validate-machine.ts"
import { LiveNotificationServiceLayer } from "../notification/live-notification-service.ts"
import { EffectCommandRunnerLayer } from "../process/effect-command-runner.ts"

const commandRunnerLayer = EffectCommandRunnerLayer.pipe(Layer.provide(BunServices.layer))
const platformLayer = Layer.merge(BunServices.layer, commandRunnerLayer)
const codexConfigurationLayer = LiveCodexConfigurationLayer.pipe(Layer.provide(BunServices.layer))
const hkConfigurationLayer = LiveHkConfigurationLayer.pipe(Layer.provide(platformLayer))
const repositoryValidationLayer = LiveRepositoryValidationLayer.pipe(Layer.provide(Layer.merge(platformLayer, hkConfigurationLayer)))
const dotfilesRepositoryLayer = LiveDotfilesRepositoryLayer.pipe(Layer.provide(platformLayer))

export const ApplicationLayer = Layer.mergeAll(
  platformLayer,
  codexConfigurationLayer,
  hkConfigurationLayer,
  LiveNotificationServiceLayer.pipe(Layer.provide(commandRunnerLayer)),
  dotfilesRepositoryLayer,
  repositoryValidationLayer,
  ExeMachineProviderLayer.pipe(Layer.provide(commandRunnerLayer)),
  LiveMachineLockUpdateLayer.pipe(Layer.provide(Layer.mergeAll(commandRunnerLayer, dotfilesRepositoryLayer, repositoryValidationLayer))),
  LiveMachineValidationLayer.pipe(Layer.provide(Layer.mergeAll(commandRunnerLayer, repositoryValidationLayer, codexConfigurationLayer, hkConfigurationLayer)))
)

const formatFailure = (error: unknown, cause: Cause.Cause<unknown>): string => {
  if (error !== null && typeof error === "object" && "detail" in error && typeof error.detail === "string") {
    const prefix = "check" in error && typeof error.check === "string"
      ? error.check
      : "operation" in error && typeof error.operation === "string"
      ? error.operation
      : "error"
    return `${prefix}: ${error.detail}`
  }
  if (error !== null && typeof error === "object" && "reason" in error && typeof error.reason === "string") {
    return error.reason
  }
  if (error instanceof Error && error.message !== "") return error.message
  return Cause.pretty(cause)
}

export const runProgram = <A, E>(program: Effect.Effect<A, E, LayerTypes.Success<typeof ApplicationLayer>>): void => {
  const main = program.pipe(
    Effect.provide(ApplicationLayer),
    Effect.catchCause((cause) => {
      const error = Cause.findErrorOption(cause)
      const cliFailure = Option.isSome(error) && CliError.isCliError(error.value)
      const domainInputFailure = Option.isSome(error) && error.value !== null && typeof error.value === "object" &&
        "_tag" in error.value && (
          error.value._tag === "InvalidMachineName" ||
          error.value._tag === "InvalidMachineProfile" ||
          error.value._tag === "InvalidMachineResources" ||
          error.value._tag === "InvalidMachineTaskArguments" ||
          error.value._tag === "InvalidMachineCliInput"
        )
      const exitCode = Cause.hasInterrupts(cause) ? 130 : cliFailure || domainInputFailure ? 2 : 1
      const setExitCode = Effect.sync(() => { process.exitCode = exitCode })
      return cliFailure ? setExitCode : Console.error(formatFailure(Option.getOrUndefined(error), cause)).pipe(Effect.andThen(setExitCode))
    })
  )
  BunRuntime.runMain(main, { disableErrorReporting: true })
}
