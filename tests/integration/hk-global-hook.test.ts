import { afterEach, expect, test } from "bun:test"
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const dotfilesRoot = new URL("../../", import.meta.url).pathname
const temporaryDirectories: Array<string> = []

afterEach(() => {
  for (const path of temporaryDirectories.splice(0)) rmSync(path, { recursive: true, force: true })
})

const run = (
  workingDirectory: string,
  args: ReadonlyArray<string>,
  environment: Readonly<Record<string, string>> = {}
): string => {
  const result = Bun.spawnSync([...args], {
    cwd: workingDirectory,
    env: { ...process.env, ...environment },
    stdout: "pipe",
    stderr: "pipe"
  })
  if (result.exitCode !== 0) {
    throw new Error(`${args.join(" ")} failed:\n${result.stderr.toString()}${result.stdout.toString()}`)
  }
  return result.stdout.toString()
}

test("the global pre-commit hook formats a repository without hk.pkl", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "hk-global-hook-"))
  temporaryDirectories.push(fixtureRoot)
  const repository = join(fixtureRoot, "repository")
  const xdgConfigHome = join(fixtureRoot, "config")
  const formatter = join(repository, "node_modules", ".bin", "oxfmt")
  mkdirSync(join(xdgConfigHome, "hk"), { recursive: true })
  mkdirSync(join(xdgConfigHome, "mise", "conf.d"), { recursive: true })
  mkdirSync(join(repository, "node_modules", ".bin"), { recursive: true })
  symlinkSync(
    join(dotfilesRoot, "user", "common", ".config", "hk", "config.pkl"),
    join(xdgConfigHome, "hk", "config.pkl")
  )
  symlinkSync(
    join(dotfilesRoot, "user", "common", ".config", "mise", "config.toml"),
    join(xdgConfigHome, "mise", "config.toml")
  )
  symlinkSync(
    join(dotfilesRoot, "mise", "conf.d", "core.toml"),
    join(xdgConfigHome, "mise", "conf.d", "core.toml")
  )
  writeFileSync(formatter, `#!/bin/sh
for argument in "$@"; do
  case "$argument" in
    *.ts) printf 'const value = 2\n' > "$argument" ;;
  esac
done
`)
  chmodSync(formatter, 0o755)
  run(repository, ["git", "init", "-b", "main"])
  run(repository, ["git", "config", "user.name", "Test User"])
  run(repository, ["git", "config", "user.email", "test@example.com"])
  run(repository, ["git", "config", "commit.gpgSign", "false"])
  writeFileSync(join(repository, "sample.ts"), "const value=1\n")
  run(repository, ["git", "add", "sample.ts"])
  const environment = {
    GIT_CONFIG_GLOBAL: join(dotfilesRoot, "user", "common", ".gitconfig"),
    XDG_CONFIG_HOME: xdgConfigHome
  }

  run(repository, ["git", "commit", "-m", "test global hook"], environment)

  expect(run(repository, ["git", "show", "HEAD:sample.ts"], environment)).toBe("const value = 2\n")
}, 30_000)
