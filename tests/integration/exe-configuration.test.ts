import { expect, test } from "bun:test"
import { EXE_SSH_HOST_KEY_FINGERPRINT, EXE_SSH_OPTIONS } from "../../src/machine/providers/exe/exe-ssh-policy.ts"

const root = new URL("../../", import.meta.url).pathname

test("the managed Exe host key has the official fingerprint", async () => {
  const path = `${root}/user/common/.ssh/exe_known_hosts`
  const result = Bun.spawnSync(["ssh-keygen", "-lf", path])
  expect(result.exitCode).toBe(0)
  expect(result.stdout.toString()).toContain(EXE_SSH_HOST_KEY_FINGERPRINT)
  expect(await Bun.file(path).text()).toStartWith("exe.dev,*.exe.xyz ssh-rsa ")
})

test("macOS SSH applies managed strict trust to every Exe host form", async () => {
  const config = await Bun.file(`${root}/user/macos/.ssh/config`).text()
  expect(config).toContain("Host exe.dev agent-controller *.exe.xyz")
  expect(config).toContain("StrictHostKeyChecking yes")
  expect(config).toContain("UserKnownHostsFile ~/.dotfiles/user/common/.ssh/exe_known_hosts")
  expect(config).toContain("GlobalKnownHostsFile /dev/null")
  expect(config).toContain("UpdateHostKeys no")
  expect(config).not.toContain("accept-new")
  expect(config).not.toContain("StrictHostKeyChecking no")
  expect(EXE_SSH_OPTIONS).toHaveLength(4)
})

test("the Exe overlay repairs the login shell before bootstrap user convergence", async () => {
  const config = await Bun.file(`${root}/mise.exe.toml`).text()
  const linux = await Bun.file(`${root}/mise.linux.toml`).text()
  expect(config).toContain("[bootstrap.hooks.pre-user]")
  expect(config).toContain("expected_shell=/usr/bin/zsh")
  expect(config).toContain('current_shell="${passwd_entry##*:}"')
  expect(config).toContain("sudo -n true")
  expect(config).toContain('sudo -n chsh -s "$expected_shell" "$user_name"')
  expect(config).toContain('if [ "$current_shell" = "$expected_shell" ]')
  expect(config).toContain("Password-free sudo is required")
  expect(linux).not.toContain("sudo -n chsh")
  const dryRun = Bun.spawnSync([
    "mise",
    "-C",
    root,
    "-E",
    "linux",
    "-E",
    "exe",
    "bootstrap",
    "--dry-run",
    "--only",
    "user"
  ], { env: { ...process.env, MISE_ENV: "" } })
  expect(dryRun.exitCode).toBe(0)
  const dryRunOutput = `${dryRun.stdout.toString()}${dryRun.stderr.toString()}`
  expect(dryRunOutput).toContain("mise bootstrap: pre-user hooks")
  expect(dryRunOutput).toContain("sudo -n chsh")
})

test("remote apply preserves provider environments and checks bootstrap status", async () => {
  const task = await Bun.file(`${root}/tasks/machine/apply`).text()
  const provider = await Bun.file(`${root}/src/machine/providers/exe/exe-machine-provider.ts`).text()
  expect(task).toContain('mise_environment="${MISE_ENV:-}"')
  expect(task).toContain('mise_environment="${mise_environment:+${mise_environment},}full"')
  expect(provider).toContain('["linux", "exe", ...machineProfileEnvironments(profile)]')
  expect(provider).toContain('["bootstrap", "status", "--missing"]')
})
