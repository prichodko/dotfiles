import { Data } from "effect"

export type MachineLifecycleState =
  | { readonly _tag: "Inspecting" }
  | { readonly _tag: "Absent" }
  | { readonly _tag: "Present" }
  | { readonly _tag: "Creating" }
  | { readonly _tag: "WaitingForSsh" }
  | { readonly _tag: "Bootstrapping" }
  | { readonly _tag: "CheckingBootstrap" }
  | { readonly _tag: "RepairingBootstrap" }
  | { readonly _tag: "BootstrapReady" }
  | { readonly _tag: "Pulling" }
  | { readonly _tag: "Applying" }
  | { readonly _tag: "Validating" }
  | { readonly _tag: "Ready" }
  | { readonly _tag: "Removing" }
  | { readonly _tag: "Removed" }
  | { readonly _tag: "FailedKept"; readonly reason: string }
  | { readonly _tag: "Failed"; readonly reason: string }

export type MachineLifecycleEvent =
  | { readonly _tag: "NotFound" }
  | { readonly _tag: "Found" }
  | { readonly _tag: "CreateRequested" }
  | { readonly _tag: "Created" }
  | { readonly _tag: "SshReady" }
  | { readonly _tag: "BootstrapPassed" }
  | { readonly _tag: "BootstrapInspectionRequested" }
  | { readonly _tag: "BootstrapComplete" }
  | { readonly _tag: "BootstrapIncomplete" }
  | { readonly _tag: "BootstrapRepaired" }
  | { readonly _tag: "PullRequested" }
  | { readonly _tag: "PullPassed" }
  | { readonly _tag: "ApplyPassed" }
  | { readonly _tag: "ValidationRequested" }
  | { readonly _tag: "ValidationPassed" }
  | { readonly _tag: "RemoveRequested" }
  | { readonly _tag: "RemovePassed" }
  | { readonly _tag: "FailedKept"; readonly reason: string }
  | { readonly _tag: "Failed"; readonly reason: string }

export class InvalidMachineLifecycleTransition extends Data.TaggedError("InvalidMachineLifecycleTransition")<{
  readonly state: MachineLifecycleState["_tag"]
  readonly event: MachineLifecycleEvent["_tag"]
}> {}

export const transitionMachineLifecycle = (
  state: MachineLifecycleState,
  event: MachineLifecycleEvent
): MachineLifecycleState | InvalidMachineLifecycleTransition => {
  if (state._tag === "Ready" || state._tag === "Removed" || state._tag === "FailedKept" || state._tag === "Failed") {
    return new InvalidMachineLifecycleTransition({ state: state._tag, event: event._tag })
  }
  if (event._tag === "FailedKept") return { _tag: "FailedKept", reason: event.reason }
  if (event._tag === "Failed") return { _tag: "Failed", reason: event.reason }
  if (state._tag === "Inspecting" && event._tag === "NotFound") return { _tag: "Absent" }
  if (state._tag === "Inspecting" && event._tag === "Found") return { _tag: "Present" }
  if (state._tag === "Absent" && event._tag === "CreateRequested") return { _tag: "Creating" }
  if (state._tag === "Creating" && event._tag === "Created") return { _tag: "WaitingForSsh" }
  if (state._tag === "WaitingForSsh" && event._tag === "SshReady") return { _tag: "Bootstrapping" }
  if (state._tag === "Bootstrapping" && event._tag === "BootstrapPassed") return { _tag: "Ready" }
  if (state._tag === "Present" && event._tag === "BootstrapInspectionRequested") return { _tag: "CheckingBootstrap" }
  if (state._tag === "CheckingBootstrap" && event._tag === "BootstrapComplete") return { _tag: "BootstrapReady" }
  if (state._tag === "CheckingBootstrap" && event._tag === "BootstrapIncomplete") return { _tag: "RepairingBootstrap" }
  if (state._tag === "RepairingBootstrap" && event._tag === "BootstrapRepaired") return { _tag: "BootstrapReady" }
  if (state._tag === "BootstrapReady" && event._tag === "PullRequested") return { _tag: "Pulling" }
  if (state._tag === "Pulling" && event._tag === "PullPassed") return { _tag: "Applying" }
  if (state._tag === "Applying" && event._tag === "ApplyPassed") return { _tag: "Ready" }
  if (state._tag === "Present" && event._tag === "ValidationRequested") return { _tag: "Validating" }
  if (state._tag === "Validating" && event._tag === "ValidationPassed") return { _tag: "Ready" }
  if (state._tag === "Present" && event._tag === "RemoveRequested") return { _tag: "Removing" }
  if (state._tag === "Removing" && event._tag === "RemovePassed") return { _tag: "Removed" }
  return new InvalidMachineLifecycleTransition({ state: state._tag, event: event._tag })
}
