eval "$(/opt/homebrew/bin/brew shellenv)"

path=(
  $VOLTA_HOME/bin
  $BUN_INSTALL/bin
  $HOME/.cargo/bin
  $HOME/.lmstudio/bin
  $path
)
typeset -U path
