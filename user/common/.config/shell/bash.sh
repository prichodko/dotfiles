[[ -f "$HOME/.config/shell/common.sh" ]] && source "$HOME/.config/shell/common.sh"
[[ -f "$HOME/.config/shell/platform.sh" ]] && source "$HOME/.config/shell/platform.sh"
[[ -f "$HOME/.aliases" ]] && source "$HOME/.aliases"

HISTSIZE=10000
HISTFILESIZE=10000
HISTCONTROL=ignoredups:ignorespace
shopt -s histappend
shopt -s autocd cdspell

command -v starship >/dev/null 2>&1 && eval "$(starship init bash)"
command -v fzf >/dev/null 2>&1 && eval "$(fzf --bash)"
command -v zoxide >/dev/null 2>&1 && eval "$(zoxide init bash --cmd cd)"
