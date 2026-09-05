import { MachineProvider, MachineProviderFailure } from "./machine-provider.ts"
import { expect, test } from "bun:test"
import { Cause, Effect, Layer, Option } from "effect"
import {
  applyRemoteMachine,
  createMachine,
  MachineOperationFailure,
  removeRemoteMachine,
  shellRemoteMachine,
  validateRemoteMachine,
} from "./manage-machine.ts"
import { makeRecordingMachineProvider } from "./recording-machine-provider.ts"

const workMachine = { name: "work", status: "running", region: "fra", regionDisplay: "Frankfurt, Germany" } as const

test("creates a named machine with explicit resources", async () => {
  const provider = await Effect.runPromise(makeRecordingMachineProvider())
  const result = await Effect.runPromise(
    createMachine({ name: "work", cpu: 4, memory: "16GB", disk: "50GB" }, "full").pipe(Effect.provide(provider.layer)),
  )
  expect(result).toEqual({ name: "work", status: "ready" })
  expect(await Effect.runPromise(provider.operations)).toContain("bootstrap:work:full")
})

test("rejects unsafe resources before provider access", async () => {
  const provider = await Effect.runPromise(makeRecordingMachineProvider())
  const exit = await Effect.runPromise(
    Effect.exit(createMachine({ name: "work", cpu: 2, memory: "8GB;whoami", disk: "25GB" }, "core").pipe(Effect.provide(provider.layer))),
  )
  expect(exit._tag).toBe("Failure")
  expect(await Effect.runPromise(provider.operations)).toEqual([])
})

test("rejects an existing create target", async () => {
  const provider = await Effect.runPromise(makeRecordingMachineProvider([workMachine]))
  const exit = await Effect.runPromise(
    Effect.exit(createMachine({ name: "work", cpu: 2, memory: "8GB", disk: "25GB" }, "core").pipe(Effect.provide(provider.layer))),
  )
  expect(exit._tag).toBe("Failure")
  expect(await Effect.runPromise(provider.operations)).not.toContain("create:work")
})

test("does not repair a complete bootstrap", async () => {
  const provider = await Effect.runPromise(makeRecordingMachineProvider([workMachine]))
  await Effect.runPromise(applyRemoteMachine("work", "core").pipe(Effect.provide(provider.layer)))
  expect(await Effect.runPromise(provider.operations)).toEqual(["requirePublishedMain", "inspectBootstrap:work", "apply:work:core"])
})

test("repairs an incomplete bootstrap before apply", async () => {
  const provider = await Effect.runPromise(makeRecordingMachineProvider([workMachine], { bootstrapInspection: "incomplete" }))
  await Effect.runPromise(applyRemoteMachine("work", "full").pipe(Effect.provide(provider.layer)))
  expect(await Effect.runPromise(provider.operations)).toEqual([
    "requirePublishedMain",
    "inspectBootstrap:work",
    "waitForSsh:work",
    "bootstrap:work:full",
    "apply:work:full",
  ])
})

test("keeps an existing machine after bootstrap repair failure", async () => {
  const provider = await Effect.runPromise(
    makeRecordingMachineProvider([workMachine], {
      bootstrapInspection: "incomplete",
      failBootstrapPostcondition: true,
    }),
  )
  const exit = await Effect.runPromiseExit(applyRemoteMachine("work", "core").pipe(Effect.provide(provider.layer)))
  expect(exit._tag).toBe("Failure")
  if (exit._tag === "Failure") {
    const error = Cause.findErrorOption(exit.cause)
    expect(Option.isSome(error) && error.value instanceof MachineOperationFailure && error.value.state === "FailedKept").toBe(true)
  }
  expect(await Effect.runPromise(provider.operations)).not.toContain("remove:work")
})

test("keeps a fresh machine when bootstrap persistence is incomplete", async () => {
  const provider = await Effect.runPromise(makeRecordingMachineProvider([], { failBootstrapPostcondition: true }))
  const exit = await Effect.runPromiseExit(
    createMachine(
      {
        name: "kept",
        cpu: 2,
        memory: "8GB",
        disk: "25GB",
      },
      "core",
    ).pipe(Effect.provide(provider.layer)),
  )
  expect(exit._tag).toBe("Failure")
  if (exit._tag === "Failure") {
    const error = Cause.findErrorOption(exit.cause)
    expect(Option.isSome(error) && error.value instanceof MachineOperationFailure && error.value.state === "FailedKept").toBe(true)
    if (Option.isSome(error) && error.value instanceof MachineOperationFailure) {
      expect(error.value.detail).toContain("without persistent mise or a valid dotfiles Git checkout")
    }
  }
  expect(await Effect.runPromise(provider.operations)).not.toContain("remove:kept")
})

test("rejects a missing apply target", async () => {
  const provider = await Effect.runPromise(makeRecordingMachineProvider())
  const exit = await Effect.runPromise(Effect.exit(applyRemoteMachine("missing", "core").pipe(Effect.provide(provider.layer))))
  expect(exit._tag).toBe("Failure")
  if (exit._tag === "Failure") expect(exit.cause.toString()).toContain(MachineOperationFailure.name)
})

test("keeps a created machine after bootstrap failure", async () => {
  const provider = await Effect.runPromise(makeRecordingMachineProvider([], { failBootstrap: true }))
  const exit = await Effect.runPromise(
    Effect.exit(createMachine({ name: "kept", cpu: 2, memory: "8GB", disk: "25GB" }, "core").pipe(Effect.provide(provider.layer))),
  )
  expect(exit._tag).toBe("Failure")
  if (exit._tag === "Failure") {
    const error = Cause.findErrorOption(exit.cause)
    expect(Option.isSome(error) && error.value instanceof MachineOperationFailure && error.value.state === "FailedKept").toBe(true)
  }
  expect(await Effect.runPromise(provider.operations)).not.toContain("remove:kept")
})

test("does not remove a created machine when bootstrap is interrupted", async () => {
  const provider = await Effect.runPromise(makeRecordingMachineProvider([], { blockBootstrap: true }))
  const exit = await Effect.runPromise(
    Effect.exit(
      createMachine({ name: "kept", cpu: 2, memory: "8GB", disk: "25GB" }, "core").pipe(
        Effect.provide(provider.layer),
        Effect.timeout("20 millis"),
      ),
    ),
  )
  expect(exit._tag).toBe("Failure")
  expect(await Effect.runPromise(provider.operations)).toContain("bootstrap:kept:core")
  expect(await Effect.runPromise(provider.operations)).not.toContain("remove:kept")
})

test("reports Failed state for every effectful remote operation failure", async () => {
  for (const operation of ["apply", "validate", "shell", "remove"] as const) {
    const provider = await Effect.runPromise(makeRecordingMachineProvider([workMachine], { failOperation: operation }))
    const effect =
      operation === "apply"
        ? applyRemoteMachine("work", "core")
        : operation === "validate"
          ? validateRemoteMachine("work", "core")
          : operation === "shell"
            ? shellRemoteMachine("work", ["true"])
            : removeRemoteMachine("work")
    const exit = await Effect.runPromiseExit(effect.pipe(Effect.provide(provider.layer)))
    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      const error = Cause.findErrorOption(exit.cause)
      const expectedState = operation === "apply" ? "FailedKept" : "Failed"
      expect(Option.isSome(error) && error.value instanceof MachineOperationFailure && error.value.state === expectedState).toBe(true)
    }
  }
})

test("reusing a create operation does not retain ownership from a previous execution", async () => {
  const recorded = await Effect.runPromise(makeRecordingMachineProvider())
  let checks = 0
  const layer = Layer.effect(
    MachineProvider,
    Effect.gen(function* () {
      const provider = yield* MachineProvider
      return MachineProvider.of({
        ...provider,
        requirePublishedMain: Effect.suspend(() => {
          checks++
          return checks === 1
            ? Effect.void
            : Effect.fail(new MachineProviderFailure({ operation: "published main", detail: "precondition failed" }))
        }),
      })
    }),
  ).pipe(Layer.provide(recorded.layer))
  const operation = createMachine({ name: "work", cpu: 2, memory: "8GB", disk: "25GB" }, "core")
  await Effect.runPromise(operation.pipe(Effect.provide(layer)))
  const exit = await Effect.runPromiseExit(operation.pipe(Effect.provide(layer)))
  expect(exit._tag).toBe("Failure")
  if (exit._tag === "Failure") {
    const error = Cause.findErrorOption(exit.cause)
    expect(Option.getOrUndefined(error)).toMatchObject({ machineKept: false, state: "Failed" })
  }
})

test("keeps an existing machine when bootstrap inspection fails", async () => {
  const provider = await Effect.runPromise(makeRecordingMachineProvider([workMachine], { failOperation: "inspectBootstrap" }))
  const exit = await Effect.runPromiseExit(applyRemoteMachine("work", "core").pipe(Effect.provide(provider.layer)))
  expect(exit._tag).toBe("Failure")
  if (exit._tag === "Failure")
    expect(Option.getOrUndefined(Cause.findErrorOption(exit.cause))).toMatchObject({ machineKept: true, state: "FailedKept" })
  expect(await Effect.runPromise(provider.operations)).toEqual(["requirePublishedMain", "inspectBootstrap:work"])
  expect(await Effect.runPromise(provider.machines)).toEqual([workMachine])
})
