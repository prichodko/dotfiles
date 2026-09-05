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

machine_prompt_bash() {
  local last_status=$?
  MACHINE_PROMPT_BRANCH=$(machine_prompt_branch)
  MACHINE_PROMPT_PATH=$(machine_prompt_path)
  PS1='\[\e[90m\]'
  if [[ -n "${SSH_CONNECTION:-}${SSH_TTY:-}" ]]; then
    PS1+='\u@\h '
  fi
  # Expand the path and branch as data, never as shell code embedded in PS1.
  PS1+='${MACHINE_PROMPT_PATH}${MACHINE_PROMPT_BRANCH}\[\e[0m\]'
  if (( last_status != 0 )); then
    PS1+=" [$last_status]"
  fi
  PS1+=' ❯ '
  return "$last_status"
}
if [[ "$(declare -p PROMPT_COMMAND 2>/dev/null)" == 'declare -a '* ]]; then
  PROMPT_COMMAND=(machine_prompt_bash "${PROMPT_COMMAND[@]}")
else
  PROMPT_COMMAND="machine_prompt_bash${PROMPT_COMMAND:+; $PROMPT_COMMAND}"
fi
machine_prompt_bash
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
