eval "$(/opt/homebrew/bin/brew shellenv)"

path=(
  $HOME/.local/bin
  $VOLTA_HOME/bin
  $BUN_INSTALL/bin
  $HOME/.cargo/bin
  $HOME/.lmstudio/bin
  $path
)
typeset -U path

# Added by OrbStack: command-line tools and integration
# This won't be added again if you remove it.
source ~/.orbstack/shell/init.zsh 2>/dev/null || :
