export VOLTA_HOME="$HOME/.volta"
export BUN_INSTALL="$HOME/.bun"
export PATH="$HOME/.local/bin:$VOLTA_HOME/bin:$BUN_INSTALL/bin:$HOME/.cargo/bin:$PATH"

if [[ -t 0 ]]; then
  export GPG_TTY
  GPG_TTY="$(tty)"
fi
