import { Data, Effect } from "effect"
import { MachineProvider, type CreateMachineInput, type MachineSummary } from "./machine-provider.ts"
import type { MachineProfile } from "../profile.ts"
import { InvalidMachineResources, validateMachineResources } from "../resources.ts"

export class MachineOperationFailure extends Data.TaggedError("MachineOperationFailure")<{
  readonly operation: string
  readonly detail: string
  readonly machineKept: boolean
  readonly state: "Failed" | "FailedKept"
}> {}

const findMachine = (machines: ReadonlyArray<MachineSummary>, name: string) => machines.find((machine) => machine.name === name)

export const createMachine = (input: CreateMachineInput, profile: MachineProfile) =>
  Effect.suspend(() => {
    let created = false
    return Effect.gen(function* () {
      const resources = validateMachineResources(input)
      if (resources instanceof InvalidMachineResources) return yield* resources
      const provider = yield* MachineProvider
      yield* provider.requirePublishedMain
      if (findMachine(yield* provider.list, input.name) !== undefined) {
        return yield* new MachineOperationFailure({
          operation: "create",
          detail: `The remote machine already exists: ${input.name}`,
          machineKept: false,
          state: "Failed",
        })
      }
      yield* provider.create(resources)
      created = true
      yield* provider.waitForSsh(input.name)
      yield* provider.bootstrap(input.name, profile)
      return { name: input.name, status: "ready" } as const
    }).pipe(
      Effect.catchTag("MachineProviderFailure", (cause) => {
        return Effect.fail(
          new MachineOperationFailure({
            operation: cause.operation,
            detail: created
              ? `${cause.detail}\nThe machine was kept for inspection.\nRetry: machine apply ${input.name}${profile === "full" ? " --profile full" : ""}\nRemove: machine remove ${input.name}`
              : cause.detail,
            machineKept: created,
            state: created ? "FailedKept" : "Failed",
          }),
        )
      }),
    )
  })

const providerFailure = (cause: { readonly operation: string; readonly detail: string }, machineKept = false) =>
  new MachineOperationFailure({
    operation: cause.operation,
    detail: machineKept ? `${cause.detail}\nThe machine was kept for inspection.` : cause.detail,
    machineKept,
    state: machineKept ? "FailedKept" : "Failed",
  })

export const applyRemoteMachine = (name: string, profile: MachineProfile) =>
  Effect.suspend(() => {
    let machineFound = false
    return Effect.gen(function* () {
      const provider = yield* MachineProvider
      yield* provider.requirePublishedMain
      if (findMachine(yield* provider.list, name) === undefined) {
        return yield* new MachineOperationFailure({
          operation: "apply",
          detail: `The remote machine does not exist: ${name}`,
          machineKept: false,
          state: "Failed",
        })
      }
      machineFound = true
      const inspection = yield* provider.inspectBootstrap(name)
      if (inspection._tag === "Incomplete") {
        yield* provider.waitForSsh(name)
        yield* provider.bootstrap(name, profile)
      }
      yield* provider.apply(name, profile)
    }).pipe(Effect.catchTag("MachineProviderFailure", (cause) => Effect.fail(providerFailure(cause, machineFound))))
  })

export const validateRemoteMachine = (name: string, profile: MachineProfile) =>
  Effect.suspend(() => {
    return Effect.gen(function* () {
      const provider = yield* MachineProvider
      if (findMachine(yield* provider.list, name) === undefined) {
        return yield* new MachineOperationFailure({
          operation: "validate",
          detail: `The remote machine does not exist: ${name}`,
          machineKept: false,
          state: "Failed",
        })
      }
      yield* provider.validate(name, profile)
    }).pipe(Effect.catchTag("MachineProviderFailure", (cause) => Effect.fail(providerFailure(cause))))
  })

export const shellRemoteMachine = (name: string, command: ReadonlyArray<string>) =>
  Effect.suspend(() => {
    return Effect.gen(function* () {
      const provider = yield* MachineProvider
      if (findMachine(yield* provider.list, name) === undefined) {
        return yield* new MachineOperationFailure({
          operation: "shell",
          detail: `The remote machine does not exist: ${name}`,
          machineKept: false,
          state: "Failed",
        })
      }
      yield* provider.shell(name, command)
    }).pipe(Effect.catchTag("MachineProviderFailure", (cause) => Effect.fail(providerFailure(cause))))
  })

export const removeRemoteMachine = (name: string) =>
  Effect.suspend(() => {
    return Effect.gen(function* () {
      const provider = yield* MachineProvider
      if (findMachine(yield* provider.list, name) === undefined) {
        return yield* new MachineOperationFailure({
          operation: "remove",
          detail: `The remote machine does not exist: ${name}`,
          machineKept: false,
          state: "Failed",
        })
      }
      yield* provider.remove(name)
    }).pipe(Effect.catchTag("MachineProviderFailure", (cause) => Effect.fail(providerFailure(cause))))
  })
