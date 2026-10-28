typeset -gU path PATH
path=(
  "${MISE_DATA_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/mise}/shims"
  "$HOME/.local/bin"
  $path
)



# Agent shells (Claude Code sets CLAUDECODE=1, Codex CODEX_THREAD_ID): make zsh
# accept the bash idioms models write. Interactive shells are untouched.
if [[ ! -o interactive && ( -n $CLAUDECODE || -n $CODEX_THREAD_ID ) ]]; then
  setopt sh_word_split          # t="a b"; set -- $t  →  two args, as in bash
  setopt no_nomatch             # an unmatched glob passes through: *.ts, url?x=1
  setopt no_bad_pattern         # so does a malformed one: .sha[0:9
  setopt no_equals              # `echo =====` prints instead of "not found"
  setopt interactive_comments   # `cmd # note` works
  # macOS has no timeout(1); use uutils' GNU-compatible one (mise: coreutils).
  if ! (( $+commands[timeout] )) && (( $+commands[coreutils] )); then
    timeout() { coreutils timeout "$@"; }
  fi
fi
