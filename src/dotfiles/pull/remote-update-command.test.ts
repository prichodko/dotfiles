import { expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildRemoteUpdateCommand } from "./remote-update-command.ts"

for (const oldStatus of [0, 7]) {
  test(`upgrades an old updater that advances HEAD and exits ${oldStatus}`, () => {
    const home = mkdtempSync(join(tmpdir(), "legacy-dotfiles-update-"))
    try {
      const repository = join(home, ".dotfiles")
      mkdirSync(join(repository, "tasks", "machine"), { recursive: true })
      const shell = `
        git() { if [ -f tasks/dotfiles/update.ts ]; then printf new; else printf old; fi; }
        legacy_update() {
          mkdir -p tasks/dotfiles
          touch tasks/dotfiles/update.ts
          printf '%s\\n' '#!/bin/sh' 'printf updated > applied' > tasks/machine/apply
          return ${oldStatus}
        }
        ${buildRemoteUpdateCommand("legacy_update", "sh tasks/machine/apply")}
      `
      const result = Bun.spawnSync(["/bin/sh", "-c", shell], { env: { ...process.env, HOME: home }, stdout: "pipe", stderr: "pipe" })
      expect(result.exitCode).toBe(0)
      expect(readFileSync(join(repository, "applied"), "utf8")).toBe("updated")
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
}

test("does not apply when the old updater fails before advancing the checkout", () => {
  const home = mkdtempSync(join(tmpdir(), "failed-legacy-update-"))
  try {
    mkdirSync(join(home, ".dotfiles"))
    const command = `git() { printf old; }; ${buildRemoteUpdateCommand("false", "touch applied")}`
    const result = Bun.spawnSync(["/bin/sh", "-c", command], { env: { ...process.env, HOME: home }, stdout: "pipe", stderr: "pipe" })
    expect(result.exitCode).toBe(1)
    expect(existsSync(join(home, ".dotfiles", "applied"))).toBe(false)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
