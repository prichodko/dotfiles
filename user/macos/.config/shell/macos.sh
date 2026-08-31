if [[ -x /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [[ -d /opt/homebrew/bin ]]; then
  export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"
fi

if [[ -n "${ZSH_VERSION:-}" ]]; then
  [[ -f /opt/homebrew/opt/fzf-tab/share/fzf-tab/fzf-tab.zsh ]] && source /opt/homebrew/opt/fzf-tab/share/fzf-tab/fzf-tab.zsh
  [[ -f /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh ]] && source /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
  source "$HOME/.orbstack/shell/init.zsh" 2>/dev/null || true
fi
