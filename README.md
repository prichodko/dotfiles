# dotfiles

managed with [dot](https://github.com/prichodko/dot) - bash tool for dotfiles via git + symlinks

## setup

```sh
dot init https://github.com/prichodko/dotfiles
```

## cli

### shell enhancements

| tool                    | what it does                                |
| ----------------------- | ------------------------------------------- |
| starship                | minimal prompt with git info                |
| fzf                     | fuzzy finder (Ctrl+R history, Ctrl+T files) |
| zsh-autosuggestions     | fish-like suggestions                       |
| zsh-syntax-highlighting | command highlighting                        |

### modern replacements

| alias  | tool       | replaces | notes                           |
| ------ | ---------- | -------- | ------------------------------- |
| `ls`   | eza        | ls       | colored output, icons           |
| `ll`   | eza -la    | ls -la   | long list                       |
| `lt`   | eza --tree | tree     | tree view (2 levels)            |
| `rm`   | trash      | rm       | moves to Trash (safer)          |
| `top`  | btop       | top/htop | better process viewer           |
| `f`    | fd         | find     | fast, respects .gitignore       |
| `grep` | rg         | grep     | ripgrep, much faster            |
| `help` | tldr       | man      | quick command examples          |
| `cd`   | zoxide     | cd       | smart jump, learns frecency     |
| `cat`  | bat        | -        | not aliased, use `bat` directly |

### shortcuts

| alias | command       |
| ----- | ------------- |
| `..`  | cd ..         |
| `...` | cd ../..      |
| `cdp` | cd ~/Projects |
| `g`   | git           |
| `gs`  | git status    |
| `y`   | yarn          |
| `p`   | pnpm          |
| `pi`  | pnpm install  |
| `b`   | bun           |
| `bi`  | bun install   |
| `br`  | bun run       |
| `bd`  | bun dev       |

### other tools

| tool     | what it does                |
| -------- | --------------------------- |
| gh       | GitHub CLI                  |
| mise     | version manager (node, bun) |
| jq       | JSON processor              |
| ffmpeg   | video/audio processing      |
| websocat | websocket client            |

## tracked files

- `.zshrc` `.zshenv` `.zprofile` - zsh config
- `.bashrc` `.bash_profile` - bash config
- `.aliases` - shell aliases
- `.gitconfig` `.gitignore` - git config
- `.ssh/config` - ssh hosts
- `.config/starship.toml` - prompt
- `.config/zed/` - zed editor
- `.config/karabiner/` - keyboard remapping
- `.config/opencode/` - opencode config
- `.claude/` - claude config
- `.brewfile` - homebrew packages
