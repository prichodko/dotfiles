import { expect, test } from "bun:test"

const root = new URL("../../", import.meta.url).pathname

test("macOS bootstrap owns the migrated preferences", async () => {
  const config = await Bun.file(`${root}/mise.macos.toml`).text()
  expect(config).toContain("[bootstrap.macos.dock]")
  expect(config).toContain("autohide = true")
  expect(config).toContain("tilesize = 57")
  expect(config).toContain("[bootstrap.macos.keyboard]")
  expect(config).toContain("initial_key_repeat = 15")
  expect(config).toContain("key_repeat = 1")
  expect(config).toContain('"com.apple.screencapture" = { location = "~/Downloads" }')
  expect(config).toContain('"com.apple.loginwindow" = { TALLogoutSavesState = false }')
  expect(config).toContain('"com.apple.sharingd" = { DiscoverableMode = "Off" }')
  expect(config).not.toContain("KeyRepeatInterval")
  expect(config).not.toContain("KeyRepeatDelay")
  expect(config).not.toContain("ShowPathbar")
})

test("each supported platform owns its login shell", async () => {
  const macos = await Bun.file(`${root}/mise.macos.toml`).text()
  const linux = await Bun.file(`${root}/mise.linux.toml`).text()
  expect(macos).toContain('[bootstrap.user]\nlogin_shell = "/bin/zsh"')
  expect(linux).toContain('[bootstrap.user]\nlogin_shell = "/usr/bin/zsh"')
})

test("portable SSH signing state is managed", async () => {
  const project = await Bun.file(`${root}/mise.toml`).text()
  const git = await Bun.file(`${root}/user/common/.gitconfig`).text()
  const ssh = await Bun.file(`${root}/user/macos/.ssh/config`).text()
  const allowedSigners = await Bun.file(`${root}/user/common/.ssh/allowed_signers`).text()
  expect(project).not.toContain('"~/.ssh/allowed_signers"')
  expect(git).toContain("allowedSignersFile = ~/.dotfiles/user/common/.ssh/allowed_signers")
  expect(allowedSigners).toContain("ssh-ed25519")
  expect(ssh).toContain("Include ~/.colima/ssh_config")
  expect(ssh).not.toContain("/Users/pavel")
})

test("the current Mac can continue to use Homebrew Shell integration", async () => {
  const shell = await Bun.file(`${root}/user/macos/.config/shell/macos.sh`).text()
  expect(shell).toContain('eval "$(/opt/homebrew/bin/brew shellenv)"')
  expect(shell).toContain('export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"')
})
