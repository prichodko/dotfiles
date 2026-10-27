# dotfiles

Config, tools, and apps for my Mac and agent VMs, applied by [mise](https://mise.jdx.dev). No custom runtime: everything is mise config plus one shell task.

Requires mise `2026.10.17`+.

## Layout

| Path | Loaded | Owns |
|---|---|---|
| `mise/conf.d/core.toml` | always (global) | CLI tools for every machine |
| `mise.toml` | always | shared packages, managed files, doctor checks, tasks |
| `mise.macos.toml` | macOS | brew packages, casks, fonts, macOS defaults, Mac dotfiles |
| `mise.linux.toml` | Linux (= agent VMs) | apt packages, login-shell hook, VM signing key, Linux dotfiles |
| `mise.lock` | | pinned tool versions |
| `user/common/`, `user/{macos,linux}/` | | files linked or merged into `~` |
| `tasks/check` | | `dotfiles:check` |
| `hk.pkl` | | repo pre-push hook |
| `.agents/` | | shared agent instructions and skills |

mise picks the overlay for the current OS automatically; there are no profiles or `MISE_ENV`.

## Workflow

```sh
# edit files in ~/.dotfiles, then:
mise run dotfiles:apply   # apply this checkout (mise bootstrap, no git pull)
mise run dotfiles:check   # validate before committing
git commit && git push    # pre-push hook runs dotfiles:check again

# on another machine:
mise run dotfiles:pull    # fast-forward from origin/main, then apply
mise doctor project       # machine health
```

| Task / command | What it runs |
|---|---|
| `dotfiles:apply` | `mise bootstrap --locked --skip repos --yes` |
| `dotfiles:pull` | `mise bootstrap --locked --yes`; bootstrap fast-forwards `~/.dotfiles` and refuses if it has local changes |
| `dotfiles:check` | shell syntax, `mise tasks validate`, locked install dry-run, `mise dot status --missing` (shows `mise dot diff` on drift), hk config, shell startup test, gitleaks |
| `mise doctor project` | Homebrew Git 2.54+, bootstrap complete, 1Password signing (macOS), gh/entire/codex/claude sign-in, Codex app-server version |
| `mise dot diff` | what apply would change in `~` |

Bootstrap order: packages → repos → dotfiles → macOS defaults → login shell → tools. Failed applies are safe to repeat.

## New machine

See [docs/new-machine.md](docs/new-machine.md). In short:

```sh
xcode-select --install
curl https://mise.run | sh
~/.local/bin/mise --locked bootstrap \
  --from https://github.com/prichodko/dotfiles.git \
  --from-dir "$HOME/.dotfiles" \
  --update --yes
```

For a VM, run `mise bootstrap remote --host <ssh-destination>` from this checkout (uses `[bootstrap.remote]`). Credentials are never copied; sign in to GitHub, Entire, Codex, and Claude manually.

## Managed files

| Config | Policy |
|---|---|
| Shell, Git, hk hooks, SSH, editor config | Symlinked from `user/` |
| Global mise config and lock | Symlinked to the repo files |
| Claude `settings.json`, Codex `config.toml` | `merge = true`: keys in `user/common/.claude/base.json` / `user/common/.codex/base.toml` win; other local keys are kept |
| Credentials, app state | Local only |

Removing a key from a base file stops managing it; the local value stays. Never link the live `~/.codex/config.toml` into the repo.

## Upgrading

```sh
mise upgrade hk                              # one tool, within its declared range
mise -C ~ upgrade                            # all tools; rewrites mise.lock
mise bootstrap packages upgrade --dry-run    # brew/apt packages and apps
```

Review the `mise.lock` diff and run `dotfiles:check` before committing.

## Git hooks

Homebrew Git 2.54+ runs config-based global hooks from `~/.config/git/hk.conf` (linked, included by `~/.gitconfig`). The global pre-commit runs `~/.config/hk/config.pkl`: oxfmt on staged files when the repo has `node_modules/.bin/oxfmt`. Other hooks run only in repos with an `hk.pkl`, like this one (pre-push → `dotfiles:check`). Skip hooks once with `HK=0`.

## SSH

- 1Password SSH agent for GitHub, Exe, and Tailscale hosts.
- `agent-controller`, `entire-exe-dev`, `haven`: Tailscale SSH aliases as `exedev`.
- VMs sign commits with a per-machine key (`~/.ssh/agent_commit_signing`) that never leaves the machine.
- Exe hosts use strict checking against `user/common/.ssh/exe_known_hosts` only. Official fingerprint: `SHA256:JJOP/lwiBGOMilfONPWZCXUrfK154cnJFXcqlsi6lPo`. To rotate, get the new key from an official Exe source, update the file, and verify with `ssh-keygen -lf user/common/.ssh/exe_known_hosts`.

## Agents

`.agents/AGENTS.md` is linked to `~/AGENTS.md`, Claude, and OpenCode; Codex gets `user/common/.codex/AGENTS.md`. `.agents/skills/` is the canonical skill source; Claude gets per-skill links from `.claude/skills/`.
