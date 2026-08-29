import { Effect, Layer, Ref } from "effect"
import { MachineProvider, MachineProviderFailure, type MachineSummary } from "./machine-provider.ts"

export interface RecordingMachineProviderOptions {
  readonly failBootstrap?: boolean
  readonly blockBootstrap?: boolean
  readonly failOperation?: "apply" | "validate" | "shell" | "remove"
}

export const makeRecordingMachineProvider = (
  initialMachines: ReadonlyArray<MachineSummary> = [],
  options: RecordingMachineProviderOptions = {}
) => Effect.gen(function*() {
  const machines = yield* Ref.make(initialMachines)
  const operations = yield* Ref.make<ReadonlyArray<string>>([])
  const record = (operation: string) => Ref.update(operations, (items) => [...items, operation])
  const operation = (name: "apply" | "validate" | "shell" | "remove", recorded: string) => record(recorded).pipe(
    Effect.andThen(options.failOperation === name
      ? Effect.fail(new MachineProviderFailure({ operation: name, detail: `${name} failed.` }))
      : Effect.void)
  )
  return {
    layer: Layer.succeed(MachineProvider, MachineProvider.of({
      requirePublishedMain: record("requirePublishedMain"),
      list: Ref.get(machines),
      create: (input) => record(`create:${input.name}`).pipe(Effect.andThen(Ref.update(machines, (items) => [...items, { name: input.name, status: "running" }]))),
      waitForSsh: (name) => record(`waitForSsh:${name}`),
      bootstrap: (name, profile) => record(`bootstrap:${name}:${profile}`).pipe(
        Effect.andThen(options.failBootstrap
          ? Effect.fail(new MachineProviderFailure({ operation: "bootstrap", detail: "Bootstrap failed." }))
          : options.blockBootstrap ? Effect.never : Effect.void)
      ),
      apply: (name, profile) => operation("apply", `apply:${name}:${profile}`),
      validate: (name, profile) => operation("validate", `validate:${name}:${profile}`),
      shell: (name, command) => operation("shell", `shell:${name}:${command.join(" ")}`),
      remove: (name) => operation("remove", `remove:${name}`).pipe(Effect.andThen(Ref.update(machines, (items) => items.filter((item) => item.name !== name))))
    })),
    operations: Ref.get(operations),
    machines: Ref.get(machines)
  }
})
