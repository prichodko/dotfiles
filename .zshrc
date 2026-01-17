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

# aliases
[ -f ~/.aliases ] && source ~/.aliases

# bun completions
[ -s "$BUN_INSTALL/_bun" ] && source "$BUN_INSTALL/_bun"

# syntax highlighting (must be last)
source /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
