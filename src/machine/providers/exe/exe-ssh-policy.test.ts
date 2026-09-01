import { expect, test } from "bun:test"
import {
  EXE_DIRECT_SSH_ARGUMENTS,
  EXE_KNOWN_HOSTS_PATH,
  EXE_MISE_SSH_OPTION_ARGUMENTS,
  EXE_SSH_HOST_KEY_FINGERPRINT,
  EXE_SSH_OPTIONS
} from "./exe-ssh-policy.ts"

test("defines one strict managed Exe SSH trust policy", () => {
  expect(EXE_SSH_HOST_KEY_FINGERPRINT).toBe("SHA256:JJOP/lwiBGOMilfONPWZCXUrfK154cnJFXcqlsi6lPo")
  expect(EXE_KNOWN_HOSTS_PATH).toEndWith("/user/common/.ssh/exe_known_hosts")
  expect(EXE_SSH_OPTIONS).toContain("StrictHostKeyChecking=yes")
  expect(EXE_SSH_OPTIONS).toContain(`UserKnownHostsFile=${EXE_KNOWN_HOSTS_PATH}`)
  expect(EXE_SSH_OPTIONS).not.toContain("StrictHostKeyChecking=accept-new")
  expect(EXE_SSH_OPTIONS).not.toContain("StrictHostKeyChecking=no")
})

test("maps the policy to direct SSH and mise remote arguments", () => {
  for (const option of EXE_SSH_OPTIONS) {
    expect(EXE_DIRECT_SSH_ARGUMENTS).toContain(option)
    expect(EXE_MISE_SSH_OPTION_ARGUMENTS).toContain(option)
  }
  expect(EXE_DIRECT_SSH_ARGUMENTS.filter((argument) => argument === "-o")).toHaveLength(EXE_SSH_OPTIONS.length)
  expect(EXE_MISE_SSH_OPTION_ARGUMENTS.filter((argument) => argument === "--ssh-option")).toHaveLength(EXE_SSH_OPTIONS.length)
})
