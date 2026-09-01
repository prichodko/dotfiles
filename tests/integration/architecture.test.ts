import { expect, test } from "bun:test"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const root = new URL("../../", import.meta.url).pathname

test("removed domain name and Effect internals are absent", () => {
  const removedName = ["de", "venv"].join("")
  const nameResult = Bun.spawnSync(["rg", "-n", "--hidden", "--glob", "!.git/**", "--glob", "!node_modules/**", removedName, root])
  expect(nameResult.exitCode).toBe(1)
  const internals = Bun.spawnSync(["rg", "-n", "effect/(src|internal)", `${root}/src`, `${root}/tasks`, `${root}/bin`])
  expect(internals.exitCode).toBe(1)
})

test("source files have no default exports or barrel files", () => {
  const exports = Bun.spawnSync(["rg", "-n", "export default", `${root}/src`, `${root}/tasks`, `${root}/bin`])
  expect(exports.exitCode).toBe(1)
  const barrels = Bun.spawnSync(["find", `${root}/src`, "-name", "index.ts"])
  expect(barrels.stdout.toString().trim()).toBe("")
})

test("remote bootstrap excludes private and generated state", async () => {
  const project = await Bun.file(`${root}/mise.toml`).text()
  expect(project).toContain('".codex/**"')
  expect(project).toContain('".claude/settings.json"')
  expect(project).not.toContain('"node_modules/**"')
  const bootstrap = await Bun.file(`${root}/tasks/bootstrap`).text()
  expect(bootstrap).toContain('persistent_root="${HOME}/.dotfiles"')
  expect(bootstrap).toContain("MACHINE_BOOTSTRAP_ALLOW_LOCAL_FALLBACK")
  expect(bootstrap).toContain("bun install --frozen-lockfile --ignore-scripts")
})

test("bootstrap installs from the persistent checkout", () => {
  const temporaryHome = mkdtempSync(join(tmpdir(), "machine-bootstrap-"))
  try {
    const checkout = join(temporaryHome, ".dotfiles")
    const binaries = join(temporaryHome, "bin")
    const log = join(temporaryHome, "bun-pwd")
    mkdirSync(checkout)
    mkdirSync(binaries)
    writeFileSync(join(checkout, "package.json"), "{}\n")
    const fakeBun = join(binaries, "bun")
    writeFileSync(fakeBun, "#!/bin/sh\npwd > \"$MACHINE_BOOTSTRAP_TEST_LOG\"\n")
    chmodSync(fakeBun, 0o755)
    const result = Bun.spawnSync(["bash", `${root}/tasks/bootstrap`], {
      cwd: root,
      env: { ...process.env, HOME: temporaryHome, PATH: `${binaries}:${process.env.PATH}`, MACHINE_BOOTSTRAP_TEST_LOG: log },
      stdout: "pipe",
      stderr: "pipe"
    })
    expect(result.exitCode).toBe(0)
    expect(readFileSync(log, "utf8").trim()).toBe(checkout)
  } finally {
    rmSync(temporaryHome, { recursive: true, force: true })
  }
})

test("process environments extend the inherited environment", async () => {
  const runner = await Bun.file(`${root}/src/process/effect-command-runner.ts`).text()
  expect(runner).toContain("extendEnv: true")
  const processSites = Bun.spawnSync(["rg", "-l", "ChildProcess.make", `${root}/src`])
  expect(processSites.stdout.toString().trim()).toBe(`${root}/src/process/effect-command-runner.ts`)
})

test("task entrypoints use the shared runtime", async () => {
  const typeScriptTasks = [
    "tasks/dotfiles/check.ts",
    "tasks/dotfiles/pull.ts",
    "tasks/dotfiles/sync.ts",
    "tasks/machine/validate.ts",
    "tasks/machine/apply-codex-config.ts",
    "tasks/machine/update-locks.ts",
    "tasks/machine/exe/create.ts",
    "tasks/machine/exe/apply.ts"
  ]
  for (const task of typeScriptTasks) expect(await Bun.file(`${root}/${task}`).text()).toContain("runProgram")
  const machineApply = await Bun.file(`${root}/tasks/machine/apply`).text()
  expect(machineApply).toContain("bootstrap --skip-dirty --yes --locked")
  expect(machineApply).not.toContain("lib/machine")
  expect(await Bun.file(`${root}/tasks/bootstrap`).text()).toContain("bun install")
  expect(await Bun.file(`${root}/tasks/bootstrap`).text()).toContain("apply-codex-config.ts")
})

test("Codex uses a tracked base and an untracked local configuration", async () => {
  const project = await Bun.file(`${root}/mise.toml`).text()
  const bootstrap = await Bun.file(`${root}/tasks/bootstrap`).text()
  const shellFiles = await Promise.all([
    Bun.file(`${root}/user/common/.config/shell/bash.sh`).text(),
    Bun.file(`${root}/user/common/.config/shell/zsh.sh`).text()
  ])

  expect(await Bun.file(`${root}/user/common/.codex/base.toml`).exists()).toBe(true)
  expect(await Bun.file(`${root}/user/common/.codex/machine.config.toml`).exists()).toBe(false)
  expect(project).not.toContain("machine.config.toml")
  expect(bootstrap).toContain("apply-codex-config.ts")
  for (const shellFile of shellFiles) expect(shellFile).not.toContain("--profile machine")
})
