import { expect, test } from "bun:test"
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

const root = new URL("../../", import.meta.url).pathname

test("mise owns one core tool fragment, one full overlay, and their canonical locks", async () => {
  const project = await Bun.file(`${root}/mise.toml`).text()
  const settings = await Bun.file(`${root}/user/common/.config/mise/config.toml`).text()
  const core = await Bun.file(`${root}/mise/conf.d/core.toml`).text()
  expect(project).not.toContain("\n[tools]\n")
  expect(settings).not.toContain("\n[tools]\n")
  expect(core).toContain("[tools]")
  expect(project).toContain('"~/.config/mise/config.full.toml" = { source = "~/.dotfiles/mise.full.toml", mode = "copy" }')
  expect(project).toContain('"~/.config/mise/conf.d/core.toml" = { source = "~/.dotfiles/mise/conf.d/core.toml", mode = "copy" }')
  expect(project).toContain('"~/.config/mise/miserc.toml" = { source = "~/.dotfiles/.miserc.toml", mode = "copy" }')
  expect(project).toContain('"~/.config/mise/mise.lock" = { source = "~/.dotfiles/mise.lock", mode = "copy" }')
  expect(project).toContain(
    '"~/.config/mise/mise.full.lock" = { source = "~/.dotfiles/mise.full.lock", mode = "copy" }',
  )
  expect(await Bun.file(`${root}/mise/mise.lock`).exists()).toBe(true)
  expect(await Bun.file(`${root}/mise.lock`).exists()).toBe(true)
  expect(await Bun.file(`${root}/mise.full.lock`).exists()).toBe(true)
  expect(realpathSync(`${root}/mise/mise.lock`)).toBe(realpathSync(`${root}/mise.lock`))
})

test("global mise uses copied configuration with canonical repository locks", () => {
  const temporaryHome = mkdtempSync(join(tmpdir(), "mise-global-locks-"))
  try {
    const canonicalCoreLock = readFileSync(`${root}/mise.lock`, "utf8")
    const canonicalFullLock = readFileSync(`${root}/mise.full.lock`, "utf8")
    const lockedEntireVersion = /\[\[tools\."github:entireio\/cli"\]\]\nversion = "([^"]+)"/u.exec(canonicalCoreLock)?.[1]
    if (lockedEntireVersion === undefined) throw new Error("The canonical Entire lock version is missing.")
    const configDirectory = join(temporaryHome, ".config", "mise")
    mkdirSync(join(configDirectory, "conf.d"), { recursive: true })
    symlinkSync(`${root}/user/common/.config/mise/config.toml`, join(configDirectory, "config.toml"))
    copyFileSync(`${root}/mise.full.toml`, join(configDirectory, "config.full.toml"))
    copyFileSync(`${root}/mise/conf.d/core.toml`, join(configDirectory, "conf.d", "core.toml"))
    copyFileSync(`${root}/mise.lock`, join(configDirectory, "mise.lock"))
    copyFileSync(`${root}/mise.full.lock`, join(configDirectory, "mise.full.lock"))
    expect(realpathSync(join(configDirectory, "mise.lock"))).not.toBe(realpathSync(`${root}/mise.lock`))
    expect(realpathSync(join(configDirectory, "mise.full.lock"))).not.toBe(realpathSync(`${root}/mise.full.lock`))
    expect(readFileSync(join(configDirectory, "mise.lock"), "utf8")).toBe(canonicalCoreLock)
    expect(readFileSync(join(configDirectory, "mise.full.lock"), "utf8")).toBe(canonicalFullLock)
    const { MISE_IGNORED_CONFIG_PATHS: _ignored, ...inheritedEnvironment } = process.env
    const isolatedEnvironment = {
      ...inheritedEnvironment,
      HOME: temporaryHome,
      MISE_CEILING_PATHS: dirname(root),
      MISE_CONFIG_DIR: configDirectory,
      MISE_GLOBAL_CONFIG_FILE: join(configDirectory, "config.toml"),
      XDG_CONFIG_HOME: join(temporaryHome, ".config"),
      MISE_ENV: "",
      MISE_STATE_DIR: join(temporaryHome, ".local", "state", "mise")
    }
    for (const trustedRoot of [temporaryHome, root]) {
      const trust = Bun.spawnSync(["mise", "-C", trustedRoot, "trust", "--all", "--yes"], {
        cwd: temporaryHome,
        env: isolatedEnvironment,
        stdout: "pipe",
        stderr: "pipe"
      })
      if (trust.exitCode !== 0) throw new Error(trust.stderr.toString())
      expect(trust.exitCode).toBe(0)
    }
    for (const cwd of [temporaryHome, root]) {
      const entireList = Bun.spawnSync(["mise", "ls", "github:entireio/cli", "--json"], {
        cwd,
        env: isolatedEnvironment,
        stdout: "pipe",
        stderr: "pipe"
      })
      if (entireList.exitCode !== 0) throw new Error(entireList.stderr.toString())
      const entireTools = JSON.parse(entireList.stdout.toString()) as Array<{
        requested_version?: string
        source?: unknown
        version: string
      }>
      const resolvedEntireTools = entireTools.filter((tool) => tool.source !== undefined)
      expect(resolvedEntireTools).toHaveLength(1)
      expect(resolvedEntireTools[0]?.version).toBe(lockedEntireVersion)
      expect(resolvedEntireTools[0]?.requested_version).toBe(`v${lockedEntireVersion}`)
    }
    for (const profile of ["core", "full"] as const) {
      const lockArguments = [
        "mise",
        ...(profile === "full" ? ["-E", "full"] : []),
        "lock",
        "--global",
        "--dry-run",
        "--json"
      ]
      const homeLock = Bun.spawnSync(lockArguments, {
        cwd: temporaryHome,
        env: isolatedEnvironment,
        stdout: "pipe",
        stderr: "pipe"
      })
      if (homeLock.exitCode !== 0) throw new Error(homeLock.stderr.toString())
      const homeChanges = JSON.parse(homeLock.stdout.toString()) as Array<{
        backend: string
        name: string
        new_versions: Array<string>
        old_versions: Array<string>
      }>
      expect(homeChanges.every((change) => change.new_versions.length === 0)).toBe(true)
      if (process.platform === "darwin") {
        expect(homeChanges).toHaveLength(1)
        expect(homeChanges[0]?.backend).toBe("aqua:eza-community/eza")
        expect(homeChanges[0]?.name).toBe("aqua:eza-community/eza")
        expect(homeChanges[0]?.old_versions.length).toBeGreaterThan(0)
      } else if (process.platform === "linux") {
        expect(homeChanges).toEqual([])
      } else {
        throw new Error(`Unsupported test platform: ${process.platform}`)
      }
      const repositoryLock = Bun.spawnSync(lockArguments, {
        cwd: root,
        env: isolatedEnvironment,
        stdout: "pipe",
        stderr: "pipe"
      })
      if (repositoryLock.exitCode !== 0) throw new Error(repositoryLock.stderr.toString())
      expect(repositoryLock.exitCode).toBe(0)
      expect(readFileSync(`${root}/mise.lock`, "utf8")).toBe(canonicalCoreLock)
      expect(readFileSync(`${root}/mise.full.lock`, "utf8")).toBe(canonicalFullLock)
    }
    const lockedInstall = Bun.spawnSync(["mise", "-E", "full", "install", "--locked", "--dry-run"], {
      cwd: temporaryHome,
      env: isolatedEnvironment,
      stdout: "pipe",
      stderr: "pipe"
    })
    if (lockedInstall.exitCode !== 0) throw new Error(lockedInstall.stderr.toString())
    expect(lockedInstall.exitCode).toBe(0)
    expect(readFileSync(join(configDirectory, "mise.lock"), "utf8")).toBe(canonicalCoreLock)
    expect(readFileSync(join(configDirectory, "mise.full.lock"), "utf8")).toBe(canonicalFullLock)
  } finally {
    rmSync(temporaryHome, { recursive: true, force: true })
  }
})

test("the global machine command is managed", async () => {
  const project = await Bun.file(`${root}/mise.toml`).text()
  expect(project).toContain('"~/.local/bin/machine" = { source = "~/.dotfiles/bin/machine.ts" }')
})

test("Homebrew Git is active on every supported platform", async () => {
  const project = await Bun.file(`${root}/mise.toml`).text()
  const macos = await Bun.file(`${root}/mise.macos.toml`).text()
  const linux = await Bun.file(`${root}/mise.linux.toml`).text()
  expect(project).toContain('"brew:git" = { os = ["linux", "macos"] }')
  expect(project).toContain('"apt:git" = { os = "linux" }')
  expect(macos).toContain('_.path = ["/opt/homebrew/bin", "/opt/homebrew/sbin"]')
  expect(linux).toContain('_.path = ["/home/linuxbrew/.linuxbrew/bin", "/home/linuxbrew/.linuxbrew/sbin"]')
})

test("macOS Git signing uses the managed 1Password signer", async () => {
  const commonGit = await Bun.file(`${root}/user/common/.gitconfig`).text()
  const macos = await Bun.file(`${root}/mise.macos.toml`).text()
  const platformGit = await Bun.file(`${root}/user/macos/.config/git/platform.conf`).text()
  expect(commonGit).toContain("path = ~/.config/git/platform.conf")
  expect(macos).toContain(
    '"~/.config/git/platform.conf" = { source = "~/.dotfiles/user/macos/.config/git/platform.conf" }',
  )
  expect(platformGit).toContain("[gpg \"ssh\"]")
  expect(platformGit).toContain("/Applications/1Password.app/Contents/MacOS/op-ssh-sign")
})

test("global hk configuration is managed", async () => {
  const project = await Bun.file(`${root}/mise.toml`).text()
  const settings = await Bun.file(`${root}/user/common/.config/mise/config.toml`).text()
  const git = await Bun.file(`${root}/user/common/.gitconfig`).text()
  const hk = await Bun.file(`${root}/user/common/.config/hk/config.pkl`).text()
  const lock = await Bun.file(`${root}/mise.lock`).text()
  const lockedVersion = /\[\[tools\."aqua:jdx\/hk"\]\]\nversion = "([^"]+)"/u.exec(lock)?.[1]
  if (lockedVersion === undefined) throw new Error("The hk lock version is missing.")
  expect(project).toContain('"~/.config/hk/config.pkl" = { source = "~/.dotfiles/user/common/.config/hk/config.pkl" }')
  expect(git).toContain("stashUntracked = false")
  for (const event of ["commit-msg", "pre-commit", "pre-push", "prepare-commit-msg"]) {
    expect(git).toContain(`[hook "hk-${event}"]`)
  }
  expect(git).toContain('mise x -- hk run pre-commit --staged \\"$@\\"')
  expect(git).not.toContain("hk run pre-commit --from-hook")
  expect(hk).toContain(`min_hk_version = "${lockedVersion}"`)
  expect(hk).toContain(`/v${lockedVersion}/hk@${lockedVersion}#/Config.pkl`)
  expect(hk).toContain("node_modules/.bin/oxfmt")
  expect(settings).toContain('HK_MISE = "1"')
  expect(settings).toContain('trusted_config_paths = ["~/.codex", "~/.dotfiles", "~/Projects"]')
})

test("the final bootstrap task is explicit", async () => {
  const project = await Bun.file(`${root}/mise.toml`).text()
  expect(project).toContain("[tasks.bootstrap]")
  expect(project).toContain('file = "tasks/bootstrap"')
  expect(project).toContain("install_mise = true")
  expect(await Bun.file(`${root}/user/common/.codex/base.toml`).exists()).toBe(true)
  expect(await Bun.file(`${root}/user/common/.config/hk/config.pkl`).exists()).toBe(true)
  expect(project).not.toContain("machine.config.toml")
  expect(project).not.toContain('"brew:mise"')
})
