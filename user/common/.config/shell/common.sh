if [[ -n "${MACHINE_COMMON_SHELL_INITIALIZED:-}" ]]; then
  return 0
fi
MACHINE_COMMON_SHELL_INITIALIZED=1

machine_prepend_path() {
  case ":$PATH:" in
    *":$1:"*) ;;
    *) export PATH="$1:$PATH" ;;
  esac
}

machine_prepend_path "$HOME/.cargo/bin"
machine_prepend_path "$HOME/.local/bin"
unset -f machine_prepend_path

export FZF_DEFAULT_OPTS='
  --height=40% --layout=reverse --border=rounded
  --color=bg+:#222222,fg+:#f2f2f2,hl:#a6e32d,hl+:#a6e32d
  --color=info:#67d9f0,prompt:#fa2573,pointer:#c48dff
  --color=marker:#a6e32d,spinner:#c48dff,header:#67d9f0
'
export FZF_DEFAULT_COMMAND='fd --type f --hidden --exclude .git --exclude node_modules --exclude vendor --exclude dist --exclude build'
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
export FZF_ALT_C_COMMAND='fd --type d --hidden --exclude .git --exclude node_modules --exclude vendor --exclude dist --exclude build'
export FZF_CTRL_T_OPTS="--preview 'bat --color=always --style=numbers --line-range=:500 {}'"

if [[ -t 0 ]]; then
  export GPG_TTY
  GPG_TTY="$(tty)"
fi
