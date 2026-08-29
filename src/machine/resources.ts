import { Data } from "effect"
import type { CreateMachineInput } from "./lifecycle/machine-provider.ts"

export class InvalidMachineResources extends Data.TaggedError("InvalidMachineResources")<{
  readonly reason: string
}> {}

const sizePattern = /^[1-9][0-9]{0,3}(MB|GB|TB)$/

export const validateMachineResources = (input: CreateMachineInput): CreateMachineInput | InvalidMachineResources => {
  if (!Number.isInteger(input.cpu) || input.cpu < 1 || input.cpu > 64) {
    return new InvalidMachineResources({ reason: "CPU must be an integer from 1 through 64." })
  }
  if (!sizePattern.test(input.memory)) {
    return new InvalidMachineResources({ reason: "Memory must use a positive integer followed by MB, GB, or TB." })
  }
  if (!sizePattern.test(input.disk)) {
    return new InvalidMachineResources({ reason: "Disk must use a positive integer followed by MB, GB, or TB." })
  }
  return input
}
