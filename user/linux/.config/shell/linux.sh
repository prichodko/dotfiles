if [[ -n "${MACHINE_PLATFORM_SHELL_INITIALIZED:-}" ]]; then
  return 0
fi
MACHINE_PLATFORM_SHELL_INITIALIZED=1

export ENTIRE_TOKEN_STORE=file

if [[ -x /home/linuxbrew/.linuxbrew/bin/brew ]]; then
  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
elif [[ -d /home/linuxbrew/.linuxbrew/bin ]]; then
  export PATH="/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:$PATH"
fi
