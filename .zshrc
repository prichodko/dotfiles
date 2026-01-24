# completions
fpath+=/opt/homebrew/share/zsh/site-functions
autoload -Uz compinit && compinit
zmodload -i zsh/complist

# prompt
eval "$(starship init zsh)"

# options
setopt AUTO_CD CORRECT
setopt SHARE_HISTORY HIST_IGNORE_DUPS HIST_IGNORE_SPACE
export GPG_TTY=$(tty)
HISTSIZE=10000
SAVEHIST=10000
HISTFILE=~/.zsh_history

# aliases
[ -f ~/.aliases ] && source ~/.aliases

# fzf config
export FZF_DEFAULT_OPTS='
  --height=40% --layout=reverse --border=rounded
  --color=bg+:#222222,fg+:#f2f2f2,hl:#a6e32d,hl+:#a6e32d
  --color=info:#67d9f0,prompt:#fa2573,pointer:#c48dff
  --color=marker:#a6e32d,spinner:#c48dff,header:#67d9f0
'
export FZF_DEFAULT_COMMAND='fd --type f --hidden --exclude .git'
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
export FZF_ALT_C_COMMAND='fd --type d --hidden --exclude .git'
export FZF_CTRL_T_OPTS="--preview 'bat --color=always --style=numbers --line-range=:500 {}'"

# plugins
eval "$(fzf --zsh)"
eval "$(zoxide init zsh --cmd cd)"
# autosuggestions config
ZSH_AUTOSUGGEST_STRATEGY=(history completion)
ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=#555555'
[ -f /opt/homebrew/share/zsh-autosuggestions/zsh-autosuggestions.zsh ] && \
  source /opt/homebrew/share/zsh-autosuggestions/zsh-autosuggestions.zsh

# tab accepts suggestion if visible, otherwise normal completion
_autosuggest_or_complete() {
  if [[ -n "$POSTDISPLAY" ]]; then
    zle autosuggest-accept
  else
    zle expand-or-complete
  fi
}
zle -N _autosuggest_or_complete
bindkey '^I' _autosuggest_or_complete

# bun completions
[ -s "$BUN_INSTALL/_bun" ] && source "$BUN_INSTALL/_bun"

# syntax highlighting (must be last)
[ -f /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh ] && \
  source /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
ZSH_HIGHLIGHT_STYLES[unknown-token]='fg=white'
ZSH_HIGHLIGHT_STYLES[command]='fg=green'
