if [[ -n "${MACHINE_COMMON_SHELL_INITIALIZED:-}" ]]; then
  return 0
fi
MACHINE_COMMON_SHELL_INITIALIZED=1

machine_prompt_path() {
  local display_path="$PWD"
  local relative_path parent_path
  case "$display_path" in
    "$HOME") display_path='~' ;;
    "$HOME"/*) display_path="~/${display_path#"$HOME"/}" ;;
  esac
  relative_path=${display_path#\~/}
  relative_path=${relative_path#/}
  case "$relative_path" in
    */*/*)
      parent_path=${display_path%/*}
      display_path="…/${parent_path##*/}/${display_path##*/}"
      ;;
  esac
  printf '%s' "$display_path"
}

machine_prompt_branch() {
  local branch changes
  branch=$(git symbolic-ref --quiet --short HEAD 2>/dev/null) ||
    branch=$(git rev-parse --short HEAD 2>/dev/null) || return 0
  # Include staged, unstaged and untracked files without updating the index.
  changes=$(git --no-optional-locks status --porcelain --untracked-files=normal 2>/dev/null)
  [[ -z "$changes" ]] || branch+='*'
  printf ' %s' "$branch"
}

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
