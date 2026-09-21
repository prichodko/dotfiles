if [[ -n "${MACHINE_PLATFORM_SHELL_INITIALIZED:-}" ]]; then
  return 0
fi
MACHINE_PLATFORM_SHELL_INITIALIZED=1

MACHINE_PACKAGE_PREFIX=/opt/homebrew
export PATH="$MACHINE_PACKAGE_PREFIX/bin:$MACHINE_PACKAGE_PREFIX/sbin:$PATH"

if [[ -n "${ZSH_VERSION:-}" ]]; then
  source "$HOME/.orbstack/shell/init.zsh" 2>/dev/null || true
fi

if command -v trash >/dev/null 2>&1; then
  alias rm='trash'
fi
