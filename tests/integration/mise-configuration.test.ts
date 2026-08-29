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
  expect(await Bun.file(`${root}/mise/mise.lock`).exists()).toBe(true)
})

test("the global machine command is managed", async () => {
  const project = await Bun.file(`${root}/mise.toml`).text()
  expect(project).toContain('"~/.local/bin/machine" = { source = "~/.dotfiles/bin/machine.ts" }')
})

test("the final bootstrap task is explicit", async () => {
  const project = await Bun.file(`${root}/mise.toml`).text()
  expect(project).toContain("[tasks.bootstrap]")
  expect(project).toContain('file = "tasks/bootstrap"')
})
