import { expect, test } from "bun:test"
import { InvalidMachineLifecycleTransition, transitionMachineLifecycle, type MachineLifecycleEvent, type MachineLifecycleState } from "./machine-lifecycle-state.ts"

test("models create without automatic removal", () => {
  expect(transitionMachineLifecycle({ _tag: "Creating" }, { _tag: "FailedKept", reason: "failed" })).toEqual({ _tag: "FailedKept", reason: "failed" })
  expect(transitionMachineLifecycle({ _tag: "Creating" }, { _tag: "RemoveRequested" })).toBeInstanceOf(InvalidMachineLifecycleTransition)
})

test("implements the complete machine transition table", () => {
  const states: ReadonlyArray<MachineLifecycleState> = [
    { _tag: "Inspecting" }, { _tag: "Absent" }, { _tag: "Present" }, { _tag: "Creating" },
    { _tag: "WaitingForSsh" }, { _tag: "Bootstrapping" }, { _tag: "Pulling" }, { _tag: "Applying" },
    { _tag: "Validating" }, { _tag: "Ready" }, { _tag: "Removing" }, { _tag: "Removed" },
    { _tag: "FailedKept", reason: "failed" }, { _tag: "Failed", reason: "failed" }
  ]
  const events: ReadonlyArray<MachineLifecycleEvent> = [
    { _tag: "NotFound" }, { _tag: "Found" }, { _tag: "CreateRequested" }, { _tag: "Created" },
    { _tag: "SshReady" }, { _tag: "BootstrapPassed" }, { _tag: "PullRequested" }, { _tag: "PullPassed" },
    { _tag: "ApplyPassed" }, { _tag: "ValidationRequested" }, { _tag: "ValidationPassed" },
    { _tag: "RemoveRequested" }, { _tag: "RemovePassed" }, { _tag: "FailedKept", reason: "failed" }, { _tag: "Failed", reason: "failed" }
  ]
  const legal = new Set([
    "Inspecting:NotFound", "Inspecting:Found", "Absent:CreateRequested", "Creating:Created",
    "WaitingForSsh:SshReady", "Bootstrapping:BootstrapPassed", "Present:PullRequested", "Pulling:PullPassed",
    "Applying:ApplyPassed", "Present:ValidationRequested", "Validating:ValidationPassed",
    "Present:RemoveRequested", "Removing:RemovePassed"
  ])
  const terminals = new Set(["Ready", "Removed", "FailedKept", "Failed"])
  for (const state of states) {
    for (const event of events) {
      const result = transitionMachineLifecycle(state, event)
      const expected = legal.has(`${state._tag}:${event._tag}`) || (!terminals.has(state._tag) && (event._tag === "Failed" || event._tag === "FailedKept"))
      expect(result instanceof InvalidMachineLifecycleTransition).toBe(!expected)
    }
  }
})
