import { DOTFILES_ROOT } from "../../../dotfiles/repository/live-dotfiles-repository.ts"

export const EXE_SSH_HOST_KEY_FINGERPRINT = "SHA256:JJOP/lwiBGOMilfONPWZCXUrfK154cnJFXcqlsi6lPo"
export const EXE_KNOWN_HOSTS_PATH = `${DOTFILES_ROOT}/user/common/.ssh/exe_known_hosts`

export const EXE_SSH_OPTIONS = [
  "StrictHostKeyChecking=yes",
  `UserKnownHostsFile=${EXE_KNOWN_HOSTS_PATH}`,
  "GlobalKnownHostsFile=/dev/null",
  "UpdateHostKeys=no"
] as const

export const EXE_DIRECT_SSH_ARGUMENTS = EXE_SSH_OPTIONS.flatMap((option) => ["-o", option])
export const EXE_MISE_SSH_OPTION_ARGUMENTS = EXE_SSH_OPTIONS.flatMap((option) => ["--ssh-option", option])
