import { describe, expect, test } from "bun:test"

const root = new URL("../../", import.meta.url).pathname

describe("machine CLI", () => {
  test("status defaults to local JSON", () => {
    const result = Bun.spawnSync(["bun", `${root}/bin/machine.ts`, "status", "--json"], { cwd: root })
    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout.toString())).toEqual({ name: "local", status: "present" })
  })

  test("invalid input exits with code 2", () => {
    const result = Bun.spawnSync(["bun", `${root}/bin/machine.ts`, "create"], { cwd: root })
    expect(result.exitCode).toBe(2)
  })

  test("the reserved remote name exits with code 2", () => {
    const result = Bun.spawnSync(["bun", `${root}/bin/machine.ts`, "create", "local"], { cwd: root })
    expect(result.exitCode).toBe(2)
    expect(result.stderr.toString()).toContain("reserved")
  })

  test("non-terminal removal requires yes", () => {
    const result = Bun.spawnSync(["bun", `${root}/bin/machine.ts`, "remove", "work"], { cwd: root })
    expect(result.exitCode).toBe(2)
    expect(result.stderr.toString()).toContain("Use --yes")
  })

  test("machine Exe tasks reject malformed arguments before provider access", () => {
    const cases = [
      ["tasks/machine/exe/create.ts", "work", "--unknown"],
      ["tasks/machine/exe/create.ts", "work", "--profile"],
      ["tasks/machine/exe/apply.ts", "work", "extra"],
      ["tasks/machine/exe/apply.ts", "work", "--profile", "large"]
    ]
    for (const argumentsList of cases) {
      const result = Bun.spawnSync(["bun", `${root}/${argumentsList[0]}`, ...argumentsList.slice(1)], { cwd: root })
      expect(result.exitCode).toBe(2)
    }
  })

  test("machine validation accepts only no argument or positional full", () => {
    for (const argumentsList of [["core"], ["--profile", "full"], ["full", "extra"]]) {
      const result = Bun.spawnSync(["bun", `${root}/tasks/machine/validate.ts`, ...argumentsList], { cwd: root })
      expect(result.exitCode).toBe(2)
      expect(result.stderr.toString()).toContain("no argument for core")
    }
  })
})
