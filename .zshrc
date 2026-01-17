# completions
fpath+=/opt/homebrew/share/zsh/site-functions
autoload -Uz compinit && compinit
zmodload -i zsh/complist

# prompt
eval "$(starship init zsh)"

# options
setopt AUTO_CD CORRECT
setopt SHARE_HISTORY HIST_IGNORE_DUPS
HISTSIZE=10000
SAVEHIST=10000
HISTFILE=~/.zsh_history

# navigation
alias ..='cd ..'
alias ...='cd ../..'
alias ll='ls -la'
alias cdp='cd ~/Projects'

# tools
alias y='yarn'
alias p='pnpm'
alias pi='pnpm install'
alias b='bun'
alias bi='bun install'
alias br='bun run'
alias bd='bun dev'
alias g='git'
alias gs='git status'
alias cc='claude --dangerously-skip-permissions'
alias dot='git --git-dir=$HOME/dotfiles --work-tree=$HOME'

# bun completions
[ -s "$BUN_INSTALL/_bun" ] && source "$BUN_INSTALL/_bun"

# syntax highlighting (must be last)
source /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
