import { expect, test } from "bun:test"
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const root = new URL("../../", import.meta.url).pathname
const configuration = `${root}/user/common/.gitconfig`
const isolatedGit = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", HK: "0" }
const git = (directory: string, args: ReadonlyArray<string>) => {
  const result = Bun.spawnSync(["git", "-C", directory, ...args], { env: isolatedGit, stdout: "pipe", stderr: "pipe" })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
  return result.stdout.toString().trim()
}
const alias = (name: string) => git(root, ["config", "--file", configuration, "--get", `alias.${name}`])

test("short aliases have one meaning and automatic staging has an explicit name", () => {
  expect(git(root, ["config", "--file", configuration, "--get-all", "alias.c"])).toBe("commit")
  expect(git(root, ["config", "--file", configuration, "--get-all", "alias.r"])).toBe("rebase")
  expect(alias("commit-all")).toBe("!git add --all && git commit -m")
})

test("Git sync runs push only after a successful fast-forward pull", () => {
  const directory = mkdtempSync(join(tmpdir(), "git-sync-alias-"))
  try {
    const executable = join(directory, "git")
    writeFileSync(executable, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$ALIAS_LOG"\nif [ "$1" = pull ]; then exit "$PULL_STATUS"; fi\n')
    chmodSync(executable, 0o755)
    for (const status of [0, 7]) {
      const log = join(directory, `log-${status}`)
      const result = Bun.spawnSync(["/bin/sh", "-c", alias("sync").slice(1)], {
        env: { ...isolatedGit, PATH: `${directory}:/usr/bin:/bin`, ALIAS_LOG: log, PULL_STATUS: String(status) },
      })
      expect(result.exitCode).toBe(status)
      expect(readFileSync(log, "utf8").trim().split("\n")).toEqual(status === 0 ? ["pull --ff-only", "push"] : ["pull --ff-only"])
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("prune-gone removes only branches whose upstream is gone", () => {
  const directory = mkdtempSync(join(tmpdir(), "git-prune-alias-"))
  try {
    git(directory, ["init", "-b", "main"])
    git(directory, ["config", "user.name", "Test"])
    git(directory, ["config", "user.email", "test@example.com"])
    git(directory, ["-c", "commit.gpgsign=false", "commit", "--allow-empty", "-m", "initial"])
    git(directory, ["remote", "add", "origin", join(directory, "unused-remote")])
    const revision = git(directory, ["rev-parse", "HEAD"])
    git(directory, ["update-ref", "refs/remotes/origin/removed", revision])
    git(directory, ["branch", "--track", "removed", "origin/removed"])
    git(directory, ["branch", "local-only"])
    git(directory, ["update-ref", "-d", "refs/remotes/origin/removed"])
    git(directory, ["-c", `alias.prune-gone=${alias("prune-gone")}`, "prune-gone"])
    expect(git(directory, ["branch", "--format=%(refname:short)"])).toBe("local-only\nmain")
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("the GitHub credential helper resolves gh through mise", () => {
  const directory = mkdtempSync(join(tmpdir(), "git-credential-alias-"))
  try {
    const executable = join(directory, "mise")
    writeFileSync(executable, '#!/bin/sh\nprintf "%s\\n" "$*"\n')
    chmodSync(executable, 0o755)
    const helper = git(root, [
      "config",
      "--file",
      `${root}/user/macos/.config/git/platform.conf`,
      "--get",
      "credential.https://github.com.helper",
    ])
    const result = Bun.spawnSync(["/bin/sh", "-c", `${helper.slice(1)} get`], {
      env: { ...isolatedGit, PATH: `${directory}:/usr/bin:/bin` },
      stdout: "pipe",
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout.toString().trim()).toBe("exec -- gh auth git-credential get")
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("shared aliases preserve the system rm command without a trash installation", () => {
  const checked = Bun.spawnSync(
    ["zsh", "-df", "-c", 'source "$1"; whence -p rm; if (( $+aliases[rm] )); then exit 1; fi', "test", `${root}/user/common/.aliases`],
    { env: { PATH: "/usr/bin:/bin" }, stdout: "pipe", stderr: "pipe" },
  )
  expect(checked.exitCode).toBe(0)
  expect(checked.stdout.toString().trim()).toBe("/bin/rm")
})
