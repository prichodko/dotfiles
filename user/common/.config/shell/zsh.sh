if [[ -n "${MACHINE_ZSH_SHELL_INITIALIZED:-}" ]]; then
  return 0
fi
MACHINE_ZSH_SHELL_INITIALIZED=1

[[ -f "$HOME/.config/shell/common.sh" ]] && source "$HOME/.config/shell/common.sh"
[[ -f "$HOME/.config/shell/platform.sh" ]] && source "$HOME/.config/shell/platform.sh"
[[ -f "$HOME/.aliases" ]] && source "$HOME/.aliases"

typeset -gU path PATH fpath
if [[ -n "${HOMEBREW_PREFIX:-}" && -d "$HOMEBREW_PREFIX/share/zsh/site-functions" ]]; then
  fpath=("$HOMEBREW_PREFIX/share/zsh/site-functions" $fpath)
fi

autoload -Uz compinit
compinit
zmodload -i zsh/complist
_comp_options+=(globdots)

HISTFILE="$HOME/.zsh_history"
HISTSIZE=10000
SAVEHIST=10000
setopt AUTO_CD CORRECT SHARE_HISTORY HIST_IGNORE_DUPS HIST_IGNORE_SPACE

machine_prompt_zsh() {
  local last_status=$?
  psvar[1]=$(machine_prompt_branch)
  psvar[2]=$(machine_prompt_path)
  PROMPT='%F{8}'
  if [[ -n "${SSH_CONNECTION:-}${SSH_TTY:-}" ]]; then
    PROMPT+='%n@%m '
  fi
  PROMPT+='%2v%1v%f'
  if (( last_status != 0 )); then
    PROMPT+=" [$last_status]"
  fi
  PROMPT+=' ❯ '
  return 0
}
precmd_functions=(machine_prompt_zsh ${precmd_functions:#machine_prompt_zsh})
RPROMPT=''
machine_prompt_zsh
command -v fzf >/dev/null 2>&1 && eval "$(fzf --zsh)"

if [[ -n "${HOMEBREW_PREFIX:-}" ]]; then
  machine_fzf_tab="$HOMEBREW_PREFIX/opt/fzf-tab/share/fzf-tab/fzf-tab.zsh"
  if [[ -f "$machine_fzf_tab" ]]; then
    source "$machine_fzf_tab"
    zstyle ':fzf-tab:*' fzf-flags --info=hidden
  fi
  unset machine_fzf_tab
fi

command -v atuin >/dev/null 2>&1 && eval "$(atuin init zsh --disable-up-arrow)"
export _ZO_DOCTOR=0
command -v zoxide >/dev/null 2>&1 && eval "$(zoxide init zsh --cmd cd)"

if [[ -n "${HOMEBREW_PREFIX:-}" ]]; then
  machine_syntax_highlighting="$HOMEBREW_PREFIX/opt/zsh-syntax-highlighting/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh"
  if [[ -f "$machine_syntax_highlighting" ]]; then
    source "$machine_syntax_highlighting"
    ZSH_HIGHLIGHT_STYLES[unknown-token]='fg=white'
    ZSH_HIGHLIGHT_STYLES[command]='fg=green'
  fi
  unset machine_syntax_highlighting
fi
