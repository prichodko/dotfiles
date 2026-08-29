import { Data } from "effect"
import { InvalidMachineName, InvalidMachineProfile, parseMachineProfile, parseRemoteMachineName, type MachineProfile } from "../profile.ts"

export class InvalidMachineTaskArguments extends Data.TaggedError("InvalidMachineTaskArguments")<{
  readonly reason: string
}> {}

export interface MachineTaskArguments {
  readonly name: string
  readonly profile: MachineProfile
}

export const parseMachineTaskArguments = (args: ReadonlyArray<string>): MachineTaskArguments | InvalidMachineTaskArguments => {
  if (args.length === 0) return new InvalidMachineTaskArguments({ reason: "A remote machine name is required." })
  const name = parseRemoteMachineName(args[0] ?? "")
  if (name instanceof InvalidMachineName) return new InvalidMachineTaskArguments({ reason: name.reason })
  if (args.length === 1) return { name, profile: "core" }
  if (args[1] !== "--profile") return new InvalidMachineTaskArguments({ reason: `Unknown option or extra argument: ${args[1]}` })
  if (args[2] === undefined) return new InvalidMachineTaskArguments({ reason: "The --profile option requires core or full." })
  if (args.length !== 3) return new InvalidMachineTaskArguments({ reason: `Unknown option or extra argument: ${args[3]}` })
  const profile = parseMachineProfile(args[2])
  if (profile instanceof InvalidMachineProfile) return new InvalidMachineTaskArguments({ reason: "The --profile option requires core or full." })
  return { name, profile }
}
