import { Data, Effect } from "effect"
import { MachineProvider, type CreateMachineInput, type MachineSummary } from "./machine-provider.ts"
import type { MachineProfile } from "../profile.ts"
import { InvalidMachineLifecycleTransition, transitionMachineLifecycle, type MachineLifecycleEvent, type MachineLifecycleState } from "./machine-lifecycle-state.ts"
import { InvalidMachineResources, validateMachineResources } from "../resources.ts"

export class MachineOperationFailure extends Data.TaggedError("MachineOperationFailure")<{
  readonly operation: string
  readonly detail: string
  readonly machineKept: boolean
  readonly state: "Failed" | "FailedKept"
}> {}

const findMachine = (machines: ReadonlyArray<MachineSummary>, name: string) => machines.find((machine) => machine.name === name)

const next = (state: MachineLifecycleState, event: MachineLifecycleEvent): Effect.Effect<MachineLifecycleState, InvalidMachineLifecycleTransition> => {
  const result = transitionMachineLifecycle(state, event)
  return result instanceof InvalidMachineLifecycleTransition ? Effect.fail(result) : Effect.succeed(result)
}

export const createMachine = (input: CreateMachineInput, profile: MachineProfile) => {
  let created = false
  let state: MachineLifecycleState = { _tag: "Inspecting" }
  return Effect.gen(function*() {
    const resources = validateMachineResources(input)
    if (resources instanceof InvalidMachineResources) return yield* resources
    const provider = yield* MachineProvider
    yield* provider.requirePublishedMain
    if (findMachine(yield* provider.list, input.name) !== undefined) {
      state = yield* next(state, { _tag: "Found" })
      state = yield* next(state, { _tag: "Failed", reason: `The remote machine already exists: ${input.name}` })
      return yield* new MachineOperationFailure({ operation: "create", detail: `The remote machine already exists: ${input.name}`, machineKept: false, state: "Failed" })
    }
    state = yield* next(state, { _tag: "NotFound" })
    state = yield* next(state, { _tag: "CreateRequested" })
    yield* provider.create(resources)
    created = true
    state = yield* next(state, { _tag: "Created" })
    yield* provider.waitForSsh(input.name)
    state = yield* next(state, { _tag: "SshReady" })
    yield* provider.bootstrap(input.name, profile)
    state = yield* next(state, { _tag: "BootstrapPassed" })
    return { name: input.name, status: state._tag.toLowerCase() } as const
  }).pipe(Effect.catchTag("MachineProviderFailure", (cause) => {
    const failureState = transitionMachineLifecycle(state, {
      _tag: created ? "FailedKept" : "Failed",
      reason: cause.detail
    })
    const terminalState = failureState instanceof InvalidMachineLifecycleTransition ? "Failed" : failureState._tag as "Failed" | "FailedKept"
    return Effect.fail(new MachineOperationFailure({
      operation: cause.operation,
      detail: created
        ? `${cause.detail}\nThe machine was kept for inspection.\nRetry: machine apply ${input.name}${profile === "full" ? " --profile full" : ""}\nRemove: machine remove ${input.name}`
        : cause.detail,
      machineKept: created,
      state: terminalState
    }))
  }))
}

const providerFailure = (
  state: MachineLifecycleState,
  cause: { readonly operation: string; readonly detail: string },
  machineKept = false
) => {
  const failureEvent = machineKept
    ? { _tag: "FailedKept", reason: cause.detail } as const
    : { _tag: "Failed", reason: cause.detail } as const
  const failed = transitionMachineLifecycle(state, failureEvent)
  return new MachineOperationFailure({
    operation: cause.operation,
    detail: machineKept ? `${cause.detail}\nThe machine was kept for inspection.` : cause.detail,
    machineKept,
    state: failed instanceof InvalidMachineLifecycleTransition ? "Failed" : failed._tag as "Failed" | "FailedKept"
  })
}

export const applyRemoteMachine = (name: string, profile: MachineProfile) => Effect.suspend(() => {
  let state: MachineLifecycleState = { _tag: "Inspecting" }
  let machineFound = false
  return Effect.gen(function*() {
    const provider = yield* MachineProvider
    yield* provider.requirePublishedMain
    if (findMachine(yield* provider.list, name) === undefined) {
      state = yield* next(state, { _tag: "NotFound" })
      state = yield* next(state, { _tag: "Failed", reason: `The remote machine does not exist: ${name}` })
      return yield* new MachineOperationFailure({ operation: "apply", detail: `The remote machine does not exist: ${name}`, machineKept: false, state: "Failed" })
    }
    state = yield* next(state, { _tag: "Found" })
    machineFound = true
    state = yield* next(state, { _tag: "BootstrapInspectionRequested" })
    const inspection = yield* provider.inspectBootstrap(name)
    if (inspection._tag === "Incomplete") {
      state = yield* next(state, { _tag: "BootstrapIncomplete" })
      yield* provider.waitForSsh(name)
      yield* provider.bootstrap(name, profile)
      state = yield* next(state, { _tag: "BootstrapRepaired" })
    } else {
      state = yield* next(state, { _tag: "BootstrapComplete" })
    }
    state = yield* next(state, { _tag: "PullRequested" })
    yield* provider.apply(name, profile)
    state = yield* next(state, { _tag: "PullPassed" })
    state = yield* next(state, { _tag: "ApplyPassed" })
  }).pipe(Effect.catchTag("MachineProviderFailure", (cause) => Effect.fail(providerFailure(state, cause, machineFound))))
})

export const validateRemoteMachine = (name: string, profile: MachineProfile) => Effect.suspend(() => {
  let state: MachineLifecycleState = { _tag: "Inspecting" }
  return Effect.gen(function*() {
    const provider = yield* MachineProvider
    if (findMachine(yield* provider.list, name) === undefined) {
      state = yield* next(state, { _tag: "NotFound" })
      state = yield* next(state, { _tag: "Failed", reason: `The remote machine does not exist: ${name}` })
      return yield* new MachineOperationFailure({ operation: "validate", detail: `The remote machine does not exist: ${name}`, machineKept: false, state: "Failed" })
    }
    state = yield* next(state, { _tag: "Found" })
    state = yield* next(state, { _tag: "ValidationRequested" })
    yield* provider.validate(name, profile)
    state = yield* next(state, { _tag: "ValidationPassed" })
  }).pipe(Effect.catchTag("MachineProviderFailure", (cause) => Effect.fail(providerFailure(state, cause))))
})

export const shellRemoteMachine = (name: string, command: ReadonlyArray<string>) => Effect.suspend(() => {
  let state: MachineLifecycleState = { _tag: "Inspecting" }
  return Effect.gen(function*() {
    const provider = yield* MachineProvider
    if (findMachine(yield* provider.list, name) === undefined) {
      state = yield* next(state, { _tag: "NotFound" })
      state = yield* next(state, { _tag: "Failed", reason: `The remote machine does not exist: ${name}` })
      return yield* new MachineOperationFailure({ operation: "shell", detail: `The remote machine does not exist: ${name}`, machineKept: false, state: "Failed" })
    }
    state = yield* next(state, { _tag: "Found" })
    yield* provider.shell(name, command)
  }).pipe(Effect.catchTag("MachineProviderFailure", (cause) => Effect.fail(providerFailure(state, cause))))
})

export const removeRemoteMachine = (name: string) => Effect.suspend(() => {
  let state: MachineLifecycleState = { _tag: "Inspecting" }
  return Effect.gen(function*() {
    const provider = yield* MachineProvider
    if (findMachine(yield* provider.list, name) === undefined) {
      state = yield* next(state, { _tag: "NotFound" })
      state = yield* next(state, { _tag: "Failed", reason: `The remote machine does not exist: ${name}` })
      return yield* new MachineOperationFailure({ operation: "remove", detail: `The remote machine does not exist: ${name}`, machineKept: false, state: "Failed" })
    }
    state = yield* next(state, { _tag: "Found" })
    state = yield* next(state, { _tag: "RemoveRequested" })
    yield* provider.remove(name)
    state = yield* next(state, { _tag: "RemovePassed" })
  }).pipe(Effect.catchTag("MachineProviderFailure", (cause) => Effect.fail(providerFailure(state, cause))))
})
