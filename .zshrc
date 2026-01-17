fpath+=/opt/homebrew/share/zsh/site-functions

# autoload -U promptinit; promptinit
# prompt pure
eval "$(starship init zsh)"


autoload -U compinit && compinit
zmodload -i zsh/complist

export GPG_TTY=$(tty)

# command aliases
alias ..="cd ../"
alias ...="cd ../../"
alias cdp="cd ~/Projects"
alias ll="ls -la"

alias y="yarn"
alias p="pnpm"
alias pi="pnpm install"
alias b="bun"
alias bi="bun install"
alias br="bun run"
alias bd="bun dev"
alias g="git "
alias gs="git status"
alias cc="claude --dangerously-skip-permissions"

# dotfiles management
alias dotfiles='git --git-dir=$HOME/dotfiles --work-tree=$HOME'

export VOLTA_HOME="$HOME/.volta"
export PATH="$VOLTA_HOME/bin:$PATH"


# bun completions
[ -s "/Users/pavel/.bun/_bun" ] && source "/Users/pavel/.bun/_bun"

# Bun
export BUN_INSTALL="/Users/pavel/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Added by LM Studio CLI (lms)
export PATH="$PATH:/Users/pavel/.lmstudio/bin"
