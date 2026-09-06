import { expect, test } from "bun:test"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect } from "effect"
import { confirmMachineRemoval, formatLocalMachineStatus, formatMachineList, formatMachineStatus } from "./machine-command.ts"

test("formats machine output", () => {
  const machines = [
    { name: "work", status: "running", region: "fra", regionDisplay: "Frankfurt, Germany" },
    { name: "longer-work", status: "stopped", region: "pdx", regionDisplay: "Oregon, USA" }
  ]
  expect(formatMachineList(machines, false)).toBe([
    "NAME         STATUS   REGION",
    "work         running  Frankfurt, Germany (fra)",
    "longer-work  stopped  Oregon, USA (pdx)"
  ].join("\n"))
  expect(JSON.parse(formatMachineList(machines, true))).toEqual(machines)
  expect(formatMachineStatus(machines[0]!, false)).toBe([
    "Name:   work",
    "Status: running",
    "Region: Frankfurt, Germany (fra)"
  ].join("\n"))
  expect(JSON.parse(formatMachineStatus(machines[0]!, true))).toEqual(machines[0])
})

test("formats incomplete region data without inventing a display value", () => {
  expect(formatMachineStatus({ name: "work", status: "running", region: "fra", regionDisplay: null }, false)).toContain("Region: fra")
  expect(formatMachineStatus({ name: "work", status: "running", region: null, regionDisplay: null }, false)).toContain("Region: unknown")
})

test("formats local status without remote region fields", () => {
  expect(formatLocalMachineStatus(false)).toBe("Name:   local\nStatus: present")
  expect(JSON.parse(formatLocalMachineStatus(true))).toEqual({ name: "local", status: "present" })
})

test("confirms destructive removal only with terminal consent or yes", async () => {
  expect(await Effect.runPromise(confirmMachineRemoval("work", true, false))).toBe(true)
  expect(await Effect.runPromise(confirmMachineRemoval("work", false, true, () => "yes"))).toBe(true)
  expect(await Effect.runPromise(confirmMachineRemoval("work", false, true, () => "no"))).toBe(false)
  expect((await Effect.runPromiseExit(confirmMachineRemoval("work", false, false)))._tag).toBe("Failure")
})

test("explicit local profiles override an inherited full environment", () => {
  const state = mkdtempSync(join(tmpdir(), "machine-cli-profile-"))
  const repositoryRoot = new URL("../../../", import.meta.url).pathname.replace(/\/$/, "")
  try {
    const bin = join(state, "bin")
    const log = join(state, "mise.log")
    mkdirSync(bin, { recursive: true })
    const mise = join(bin, "mise")
    writeFileSync(mise, [
      "#!/bin/sh",
      "set -eu",
      'printf \'%s\\t%s\\n\' "$MISE_ENV" "$*" >> "$MISE_TEST_LOG"',
      'if [ "${3:-}" = run ] && [ "${4:-}" = machine:apply ]; then',
      "  shift 4",
      '  if [ "${1:-}" = -- ]; then shift; fi',
      '  exec bash "$MISE_TEST_APPLY" "$@"',
      "fi",
      "",
    ].join("\n"))
    chmodSync(mise, 0o755)
    for (const profile of ["core", "full"] as const) {
      const result = Bun.spawnSync([process.execPath, "bin/machine.ts", "apply", "--profile", profile], {
        cwd: repositoryRoot,
        env: {
          ...process.env,
          HOME: state,
          PATH: `${bin}:${process.env.PATH}`,
          MISE_ENV: "linux,exe,full",
          MISE_TEST_LOG: log,
          MISE_TEST_APPLY: join(repositoryRoot, "tasks", "machine", "apply"),
        },
        stdout: "pipe",
        stderr: "pipe",
      })
      expect(result.exitCode, result.stderr.toString()).toBe(0)
    }
    const commands = readFileSync(log, "utf8").trim().split("\n")
    expect(commands).toHaveLength(10)
    expect(commands.filter((line) => line.includes(" bootstrap --skip-dirty"))).toEqual([
      `linux,exe\t-C ${repositoryRoot} bootstrap --skip-dirty --yes --locked`,
      `linux,exe,full\t-C ${repositoryRoot} bootstrap --skip-dirty --yes --locked`,
    ])
    expect(commands.slice(0, 5).every((line) => line.startsWith("linux,exe\t"))).toBe(true)
    expect(commands.slice(5).every((line) => line.startsWith("linux,exe,full\t"))).toBe(true)
  } finally {
    rmSync(state, { recursive: true, force: true })
  }
})
