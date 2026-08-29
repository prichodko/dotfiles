import { Console, Data, Effect, Option } from "effect"
import { Argument, Command, Flag } from "effect/unstable/cli"
import { DOTFILES_ROOT } from "../../dotfiles/repository/live-dotfiles-repository.ts"
import { CommandRunner } from "../../process/command-runner.ts"
import { applyRemoteMachine, createMachine, removeRemoteMachine, shellRemoteMachine, validateRemoteMachine } from "../lifecycle/manage-machine.ts"
import { MachineProvider, type MachineSummary } from "../lifecycle/machine-provider.ts"
import { InvalidMachineName, parseRemoteMachineName, type MachineProfile } from "../profile.ts"
import { MachineValidation } from "../validation/validate-machine.ts"
import { InvalidMachineResources, validateMachineResources } from "../resources.ts"

export const formatMachineList = (machines: ReadonlyArray<MachineSummary>, json: boolean): string => {
  if (json) return JSON.stringify(machines, null, 2)
  if (machines.length === 0) return "No remote machines."
  return machines.map((machine) => `${machine.name}\t${machine.status}`).join("\n")
}

export class InvalidMachineCliInput extends Data.TaggedError("InvalidMachineCliInput")<{
  readonly reason: string
}> {}

export const confirmMachineRemoval = (
  name: string,
  yes: boolean,
  terminal: boolean,
  prompt: (message: string) => string | null = globalThis.prompt
): Effect.Effect<boolean, InvalidMachineCliInput> => {
  if (yes) return Effect.succeed(true)
  if (!terminal) return Effect.fail(new InvalidMachineCliInput({ reason: "Use --yes when standard input is not a terminal." }))
  return Effect.sync(() => prompt(`Remove ${name}? Type yes to continue:`) === "yes")
}

const remoteName = (value: string) => {
  const parsed = parseRemoteMachineName(value)
  return parsed instanceof InvalidMachineName ? Effect.fail(parsed) : Effect.succeed(parsed)
}

const profileFlag = Flag.choice("profile", ["core", "full"] as const).pipe(Flag.withDefault("core"))
const targetArgument = Argument.string("target").pipe(Argument.optional)

export const machineCommand = Command.make("machine").pipe(Command.withDescription("Manage local and remote machines"))

const createCommand = Command.make("create", {
  name: Argument.string("name"),
  profile: profileFlag,
  cpu: Flag.integer("cpu").pipe(Flag.withDefault(2)),
  memory: Flag.string("memory").pipe(Flag.withDefault("8GB")),
  disk: Flag.string("disk").pipe(Flag.withDefault("25GB"))
}, Effect.fn(function*({ cpu, disk, memory, name, profile }) {
  const parsedName = yield* remoteName(name)
  const input = validateMachineResources({ name: parsedName, cpu, memory, disk })
  if (input instanceof InvalidMachineResources) return yield* input
  const result = yield* createMachine(input, profile)
  yield* Console.log(`Created and bootstrapped ${result.name}.`)
})).pipe(Command.withDescription("Create and bootstrap a remote machine"))

const applyCommand = Command.make("apply", { target: targetArgument, profile: profileFlag }, Effect.fn(function*({ profile, target }) {
  const name = Option.getOrElse(target, () => "local")
  if (name !== "local") {
    yield* applyRemoteMachine(yield* remoteName(name), profile)
    yield* Console.log(`Applied ${name}.`)
    return
  }
  const runner = yield* CommandRunner
  yield* runner.run({ command: "mise", args: ["-C", DOTFILES_ROOT, "run", "machine:apply", ...(profile === "full" ? ["--", "full"] : [])], interactive: true })
})).pipe(Command.withDescription("Apply local or remote machine configuration"))

const validateCommand = Command.make("validate", { target: targetArgument, profile: profileFlag }, Effect.fn(function*({ profile, target }) {
  const name = Option.getOrElse(target, () => "local")
  if (name !== "local") {
    yield* validateRemoteMachine(yield* remoteName(name), profile)
    yield* Console.log(`Validated ${name}.`)
    return
  }
  const validation = yield* MachineValidation
  yield* validation.validate(profile)
  yield* Console.log(`Validated the ${profile} local machine.`)
})).pipe(Command.withDescription("Validate local or remote machine configuration"))

const listCommand = Command.make("list", {
  json: Flag.boolean("json").pipe(Flag.withDefault(false))
}, Effect.fn(function*({ json }) {
  const provider = yield* MachineProvider
  yield* Console.log(formatMachineList(yield* provider.list, json))
})).pipe(Command.withDescription("List remote machines"))

const statusCommand = Command.make("status", {
  target: targetArgument,
  json: Flag.boolean("json").pipe(Flag.withDefault(false))
}, Effect.fn(function*({ json, target }) {
  const name = Option.getOrElse(target, () => "local")
  if (name === "local") {
    yield* Console.log(json ? JSON.stringify({ name: "local", status: "present" }, null, 2) : "local\tpresent")
    return
  }
  const parsedName = yield* remoteName(name)
  const provider = yield* MachineProvider
  const found = (yield* provider.list).filter((machine) => machine.name === parsedName)
  yield* Console.log(formatMachineList(found, json))
})).pipe(Command.withDescription("Show machine status"))

const shellCommand = Command.make("shell", {
  name: Argument.string("name"),
  command: Argument.string("command").pipe(Argument.variadic)
}, Effect.fn(function*({ command, name }) {
  yield* shellRemoteMachine(yield* remoteName(name), command as ReadonlyArray<string>)
})).pipe(Command.withDescription("Open a remote shell or run a remote command"))

const removeCommand = Command.make("remove", {
  name: Argument.string("name"),
  yes: Flag.boolean("yes").pipe(Flag.withDefault(false))
}, Effect.fn(function*({ name, yes }) {
  const parsedName = yield* remoteName(name)
  if (!(yield* confirmMachineRemoval(parsedName, yes, process.stdin.isTTY === true))) {
    yield* Console.log("Removal cancelled.")
    return
  }
  yield* removeRemoteMachine(parsedName)
  yield* Console.log(`Removed ${parsedName}.`)
})).pipe(Command.withDescription("Remove a remote machine"))

export const machineCli = machineCommand.pipe(
  Command.withSubcommands([createCommand, applyCommand, validateCommand, listCommand, statusCommand, shellCommand, removeCommand]),
  Command.run({ version: "1.0.0" })
)

export const normalizeProfile = (value: MachineProfile): MachineProfile => value
