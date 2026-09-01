import { describe, expect, test } from "bun:test"

const root = new URL("../../", import.meta.url).pathname

describe("machine CLI", () => {
  test("status defaults to local JSON", () => {
    const result = Bun.spawnSync(["bun", `${root}/bin/machine.ts`, "status", "--json"], { cwd: root })
    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout.toString())).toEqual({ name: "local", status: "present" })
  })

  test("local status has no remote region fields", () => {
    const result = Bun.spawnSync(["bun", `${root}/bin/machine.ts`, "status"], { cwd: root })
    expect(result.exitCode).toBe(0)
    expect(result.stdout.toString().trim()).toBe("Name:   local\nStatus: present")
  })

  test("remote list and status include region data in text and JSON", () => {
    const machine = {
      vm_name: "work-vm",
      status: "running",
      region: "fra",
      region_display: "Frankfurt, Germany"
    }
    const env = {
      ...process.env,
      PATH: `${root}/tests/fixtures/bin:${process.env.PATH}`,
      SSH_TEST_LIST_JSON: JSON.stringify({ vms: [machine] })
    }
    const list = Bun.spawnSync(["bun", `${root}/bin/machine.ts`, "list"], { cwd: root, env })
    expect(list.exitCode).toBe(0)
    expect(list.stdout.toString().trim()).toBe([
      "NAME     STATUS   REGION",
      "work-vm  running  Frankfurt, Germany (fra)"
    ].join("\n"))

    const textStatus = Bun.spawnSync(["bun", `${root}/bin/machine.ts`, "status", "work-vm"], { cwd: root, env })
    expect(textStatus.exitCode).toBe(0)
    expect(textStatus.stdout.toString().trim()).toBe([
      "Name:   work-vm",
      "Status: running",
      "Region: Frankfurt, Germany (fra)"
    ].join("\n"))

    const status = Bun.spawnSync(["bun", `${root}/bin/machine.ts`, "status", "work-vm", "--json"], { cwd: root, env })
    expect(status.exitCode).toBe(0)
    expect(JSON.parse(status.stdout.toString())).toEqual({
      name: "work-vm",
      status: "running",
      region: "fra",
      regionDisplay: "Frankfurt, Germany"
    })
  })

  test("remote JSON uses null for missing region data", () => {
    const env = {
      ...process.env,
      PATH: `${root}/tests/fixtures/bin:${process.env.PATH}`,
      SSH_TEST_LIST_JSON: JSON.stringify({ vms: [{ vm_name: "work-vm", status: "running", region: 42 }] })
    }
    const result = Bun.spawnSync(["bun", `${root}/bin/machine.ts`, "list", "--json"], { cwd: root, env })
    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout.toString())).toEqual([{
      name: "work-vm",
      status: "running",
      region: null,
      regionDisplay: null
    }])
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
    const result = Bun.spawnSync(["bun", `${root}/bin/machine.ts`, "remove", "work-vm"], { cwd: root })
    expect(result.exitCode).toBe(2)
    expect(result.stderr.toString()).toContain("Use --yes")
  })

  test("machine Exe tasks reject malformed arguments before provider access", () => {
    const cases = [
      ["tasks/machine/exe/create.ts", "work-vm", "--unknown"],
      ["tasks/machine/exe/create.ts", "work-vm", "--profile"],
      ["tasks/machine/exe/apply.ts", "work-vm", "extra"],
      ["tasks/machine/exe/apply.ts", "work-vm", "--profile", "large"]
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
