import { Data } from "effect"

export type MachineProfile = "core" | "full"

export class InvalidMachineProfile extends Data.TaggedError("InvalidMachineProfile")<{
  readonly value: string
}> {}

export const parseMachineProfile = (value: string | undefined): MachineProfile | InvalidMachineProfile => {
  if (value === undefined || value === "core") return "core"
  if (value === "full") return "full"
  return new InvalidMachineProfile({ value })
}

export class InvalidMachineName extends Data.TaggedError("InvalidMachineName")<{
  readonly value: string
  readonly reason: string
}> {}

export const parseRemoteMachineName = (value: string): string | InvalidMachineName => {
  if (value === "local") return new InvalidMachineName({ value, reason: "The local name is reserved." })
  if (!/^[a-z][a-z0-9-]{0,62}$/.test(value)) {
    return new InvalidMachineName({ value, reason: "Use lower-case letters, digits, and hyphens." })
  }
  return value
}
