if command -v brew >/dev/null 2>&1; then
  eval "$(brew shellenv)"
fi

if [[ -n "${ZSH_VERSION:-}" ]]; then
  [[ -f /opt/homebrew/opt/fzf-tab/share/fzf-tab/fzf-tab.zsh ]] && source /opt/homebrew/opt/fzf-tab/share/fzf-tab/fzf-tab.zsh
  [[ -f /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh ]] && source /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
  source "$HOME/.orbstack/shell/init.zsh" 2>/dev/null || true
fi
