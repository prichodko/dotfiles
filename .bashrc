# env
export VOLTA_HOME="$HOME/.volta"
export BUN_INSTALL="$HOME/.bun"
[ -t 0 ] && export GPG_TTY=$(tty)

# PATH
export PATH="$VOLTA_HOME/bin:$BUN_INSTALL/bin:$HOME/.cargo/bin:$HOME/.lmstudio/bin:$PATH"

# history
HISTSIZE=10000
HISTFILESIZE=10000
HISTCONTROL=ignoredups:ignorespace
shopt -s histappend

# options
shopt -s autocd cdspell

# prompt
eval "$(starship init bash)"

# aliases
[ -f ~/.aliases ] && source ~/.aliases

# plugins
eval "$(fzf --bash)"
eval "$(zoxide init bash --cmd cd)"
