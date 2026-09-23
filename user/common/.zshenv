typeset -gU path PATH
path=(
  "${MISE_DATA_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/mise}/shims"
  "$HOME/.local/bin"
  "$HOME/.cargo/bin"
  $path
)
