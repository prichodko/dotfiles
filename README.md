# dotfiles

bare git repo, no symlinks

## setup new machine

```sh
git clone --bare git@github.com:prichodko/dotfiles.git $HOME/dotfiles
alias dot='git --git-dir=$HOME/dotfiles --work-tree=$HOME'
dot checkout
dot config status.showUntrackedFiles no
```

if checkout fails (existing files), back them up:
```sh
dot checkout 2>&1 | grep -E "\s+\." | awk '{print $1}' | xargs -I{} mv {} {}.bak
dot checkout
```

## usage

```sh
dot status
dot add ~/.zshrc
dot commit -m "msg"
dot push
```

## tracked

- `.zshrc` `.zshenv` `.zprofile` - shell
- `.gitconfig` `.gitignore` - git
- `.ssh/config` - ssh hosts
- `.config/zed/` - editor
- `.config/karabiner/` - keyboard
- `.claude/` - ai
