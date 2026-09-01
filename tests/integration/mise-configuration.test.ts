import { expect, test } from "bun:test"

const root = new URL("../../", import.meta.url).pathname

test("mise owns one core tool fragment and one full overlay", async () => {
  const project = await Bun.file(`${root}/mise.toml`).text()
  const settings = await Bun.file(`${root}/user/common/.config/mise/config.toml`).text()
  const core = await Bun.file(`${root}/mise/conf.d/core.toml`).text()
  expect(project).not.toContain("\n[tools]\n")
  expect(settings).not.toContain("\n[tools]\n")
  expect(core).toContain("[tools]")
  expect(project).toContain('"~/.config/mise/config.full.toml" = { source = "~/.dotfiles/mise.full.toml" }')
  expect(project).toContain('"~/.config/mise/miserc.toml" = { source = "~/.dotfiles/user/common/.config/mise/miserc.toml", mode = "copy" }')
  expect(project).not.toContain('"~/.config/mise/mise.lock"')
  expect(project).not.toContain('"~/.config/mise/mise.full.lock"')
  expect(await Bun.file(`${root}/mise/mise.lock`).exists()).toBe(true)
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
