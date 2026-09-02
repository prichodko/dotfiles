if [[ -n "${MACHINE_BASH_SHELL_INITIALIZED:-}" ]]; then
  return 0
fi
MACHINE_BASH_SHELL_INITIALIZED=1

[[ -f "$HOME/.config/shell/common.sh" ]] && source "$HOME/.config/shell/common.sh"
[[ -f "$HOME/.config/shell/platform.sh" ]] && source "$HOME/.config/shell/platform.sh"
[[ -f "$HOME/.aliases" ]] && source "$HOME/.aliases"

HISTSIZE=10000
HISTFILESIZE=10000
HISTCONTROL=ignoredups:ignorespace
shopt -s histappend
shopt -s cdspell
if (( BASH_VERSINFO[0] >= 4 )); then
  shopt -s autocd
fi

command -v starship >/dev/null 2>&1 && eval "$(starship init bash)"
command -v fzf >/dev/null 2>&1 && eval "$(fzf --bash)"
command -v zoxide >/dev/null 2>&1 && eval "$(zoxide init bash --cmd cd)"

machine_deduplicate_bash_path() {
  local deduplicated_path=""
  local path_entry
  while IFS= read -r path_entry; do
    case ":$deduplicated_path:" in
      *":$path_entry:"*) ;;
      *) deduplicated_path="${deduplicated_path:+$deduplicated_path:}$path_entry" ;;
    esac
  done < <(printf '%s\n' "$PATH" | tr ':' '\n')
  export PATH="$deduplicated_path"
}

machine_deduplicate_bash_path
unset -f machine_deduplicate_bash_path
