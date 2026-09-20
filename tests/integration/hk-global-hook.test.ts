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
  const xdgConfigHome = join(fixtureRoot, ".config")
  const staleBin = join(fixtureRoot, "stale-bin")
  const formatter = join(repository, "node_modules", ".bin", "oxfmt")
  mkdirSync(join(xdgConfigHome, "hk"), { recursive: true })
  mkdirSync(join(xdgConfigHome, "git"), { recursive: true })
  mkdirSync(join(xdgConfigHome, "mise", "conf.d"), { recursive: true })
  mkdirSync(join(repository, "node_modules", ".bin"), { recursive: true })
  mkdirSync(join(fixtureRoot, ".local", "bin"), { recursive: true })
  mkdirSync(staleBin, { recursive: true })
  symlinkSync(run(repository, ["which", "mise"]).trim(), join(fixtureRoot, ".local", "bin", "mise"))
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
  symlinkSync(join(dotfilesRoot, "mise.lock"), join(xdgConfigHome, "mise", "mise.lock"))
  writeFileSync(formatter, `#!/bin/sh
for argument in "$@"; do
  case "$argument" in
    *.ts) printf 'const value = 2\n' > "$argument" ;;
  esac
done
`)
  chmodSync(formatter, 0o755)
  const staleHk = join(staleBin, "hk")
  writeFileSync(staleHk, "#!/bin/sh\necho 'stale hk was invoked' >&2\nexit 99\n")
  chmodSync(staleHk, 0o755)
  run(repository, ["git", "init", "-b", "main"])
  run(repository, ["git", "config", "user.name", "Test User"])
  run(repository, ["git", "config", "user.email", "test@example.com"])
  run(repository, ["git", "config", "commit.gpgSign", "false"])
  run(repository, ["mise", "--locked", "-C", dotfilesRoot, "exec", "--", "hk", "install", "--global", "--mise"], {
    GIT_CONFIG_GLOBAL: join(xdgConfigHome, "git", "hk.conf"),
    PATH: `/opt/homebrew/bin:${process.env.PATH ?? ""}`,
    XDG_CONFIG_HOME: xdgConfigHome
  })
  const miseExecutable = run(repository, ["which", "mise"]).trim()
  run(repository, [
    "git",
    "config",
    "--file",
    join(xdgConfigHome, "git", "hk.conf"),
    "--replace-all",
    "hook.hk-pre-commit.command",
    `test "\${HK:-1}" = "0" || ${miseExecutable} x hk -- hk run pre-commit --staged`
  ])
  writeFileSync(join(repository, "sample.ts"), "const value=1\n")
  run(repository, ["git", "add", "sample.ts"])
  const environment = {
    GIT_CONFIG_GLOBAL: join(dotfilesRoot, "user", "common", ".gitconfig"),
    HOME: fixtureRoot,
    MISE_DATA_DIR: join(process.env.HOME ?? "", ".local", "share", "mise"),
    PATH: `${staleBin}:${process.env.PATH ?? ""}`,
    XDG_CONFIG_HOME: xdgConfigHome
  }

  run(repository, ["git", "commit", "-m", "test global hook"], environment)

  expect(run(repository, ["git", "show", "HEAD:sample.ts"], environment)).toBe("const value = 2\n")
}, 30_000)
