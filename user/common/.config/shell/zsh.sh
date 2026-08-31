[[ -f "$HOME/.config/shell/common.sh" ]] && source "$HOME/.config/shell/common.sh"
[[ -f "$HOME/.config/shell/platform.sh" ]] && source "$HOME/.config/shell/platform.sh"
[[ -f "$HOME/.aliases" ]] && source "$HOME/.aliases"

HISTFILE="$HOME/.zsh_history"
HISTSIZE=10000
SAVEHIST=10000
setopt AUTO_CD CORRECT SHARE_HISTORY HIST_IGNORE_DUPS HIST_IGNORE_SPACE

command -v starship >/dev/null 2>&1 && eval "$(starship init zsh)"
command -v fzf >/dev/null 2>&1 && eval "$(fzf --zsh)"
command -v atuin >/dev/null 2>&1 && eval "$(atuin init zsh --disable-up-arrow)"
command -v zoxide >/dev/null 2>&1 && eval "$(zoxide init zsh --cmd cd)"
