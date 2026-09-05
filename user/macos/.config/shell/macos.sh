if [[ -n "${MACHINE_PLATFORM_SHELL_INITIALIZED:-}" ]]; then
  return 0
fi
MACHINE_PLATFORM_SHELL_INITIALIZED=1

if [[ -x /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [[ -d /opt/homebrew/bin ]]; then
  export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"
fi

if [[ -n "${ZSH_VERSION:-}" ]]; then
  source "$HOME/.orbstack/shell/init.zsh" 2>/dev/null || true
fi

if command -v trash >/dev/null 2>&1; then
  alias rm='trash'
fi
