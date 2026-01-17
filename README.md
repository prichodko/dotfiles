# dotfiles

bare git repo, no symlinks

## setup new machine

```sh
git clone --bare git@github.com:prichodko/dotfiles.git $HOME/dotfiles
alias dotfiles='git --git-dir=$HOME/dotfiles --work-tree=$HOME'
dotfiles checkout
dotfiles config status.showUntrackedFiles no
```

if checkout fails (existing files), back them up:
```sh
dotfiles checkout 2>&1 | grep -E "\s+\." | awk '{print $1}' | xargs -I{} mv {} {}.bak
dotfiles checkout
```

## usage

```sh
dotfiles status
dotfiles add ~/.zshrc
dotfiles commit -m "msg"
dotfiles push
```

## tracked

- `.zshrc` `.zshenv` `.zprofile` - shell
- `.gitconfig` `.gitignore` - git
- `.ssh/config` - ssh hosts
- `.config/zed/` - editor
- `.config/karabiner/` - keyboard
- `.claude/` - ai
