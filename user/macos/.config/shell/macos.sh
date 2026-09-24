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

codex-personal() {
  local codex_home="$HOME/.codex-personal"
  local app_data="$HOME/Library/Application Support/ChatGPT-Personal"
  local shared_keybindings="$HOME/.codex/keybindings.json"

  mkdir -p "$codex_home" "$app_data" || return 1

  if [[ -e "$shared_keybindings" ]]; then
    ln -sfn "$shared_keybindings" "$codex_home/keybindings.json" || return 1
  fi

  open -n \
    --env "CODEX_HOME=$codex_home" \
    --env "CODEX_ELECTRON_USER_DATA_PATH=$app_data" \
    /Applications/ChatGPT.app \
    --args \
    --user-data-dir="$app_data"
}
