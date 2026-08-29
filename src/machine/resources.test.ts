import { expect, test } from "bun:test"
import { InvalidMachineResources, validateMachineResources } from "./resources.ts"

test("validates machine resources", () => {
  expect(validateMachineResources({ name: "work", cpu: 2, memory: "8GB", disk: "25GB" })).toEqual({ name: "work", cpu: 2, memory: "8GB", disk: "25GB" })
  expect(validateMachineResources({ name: "work", cpu: 0, memory: "8GB", disk: "25GB" })).toBeInstanceOf(InvalidMachineResources)
  expect(validateMachineResources({ name: "work", cpu: 65, memory: "8GB", disk: "25GB" })).toBeInstanceOf(InvalidMachineResources)
})

test("rejects size injection before process execution", () => {
  expect(validateMachineResources({ name: "work", cpu: 2, memory: "8GB;whoami", disk: "25GB" })).toBeInstanceOf(InvalidMachineResources)
  expect(validateMachineResources({ name: "work", cpu: 2, memory: "8gb", disk: "$(whoami)" })).toBeInstanceOf(InvalidMachineResources)
})
