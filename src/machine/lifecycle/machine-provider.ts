import { Context, Data, Effect } from "effect"
import type { MachineProfile } from "../profile.ts"

export interface MachineSummary {
  readonly name: string
  readonly status: string
  readonly region: string | null
  readonly regionDisplay: string | null
}

export interface CreateMachineInput {
  readonly name: string
  readonly cpu: number
  readonly memory: string
  readonly disk: string
}

export type BootstrapInspection =
  | { readonly _tag: "Complete" }
  | { readonly _tag: "Incomplete"; readonly reason: string }

export class MachineProviderFailure extends Data.TaggedError("MachineProviderFailure")<{
  readonly operation: string
  readonly detail: string
  readonly cause?: unknown
}> {}

export class MachineProvider extends Context.Service<MachineProvider, {
  readonly requirePublishedMain: Effect.Effect<void, MachineProviderFailure>
  readonly list: Effect.Effect<ReadonlyArray<MachineSummary>, MachineProviderFailure>
  readonly create: (input: CreateMachineInput) => Effect.Effect<void, MachineProviderFailure>
  readonly waitForSsh: (name: string) => Effect.Effect<void, MachineProviderFailure>
  readonly inspectBootstrap: (name: string) => Effect.Effect<BootstrapInspection, MachineProviderFailure>
  readonly bootstrap: (name: string, profile: MachineProfile) => Effect.Effect<void, MachineProviderFailure>
  readonly apply: (name: string, profile: MachineProfile) => Effect.Effect<void, MachineProviderFailure>
  readonly validate: (name: string, profile: MachineProfile) => Effect.Effect<void, MachineProviderFailure>
  readonly shell: (name: string, command: ReadonlyArray<string>) => Effect.Effect<void, MachineProviderFailure>
  readonly remove: (name: string) => Effect.Effect<void, MachineProviderFailure>
}>()("machine/lifecycle/MachineProvider") {}
