# dotfiles

Portable config, tools, and lifecycle management for my Mac and agent VMs.

- **mise** is the public interface: bootstrap, tools, managed files, health checks, tasks.
- **Bun** runs the remaining TypeScript automation; **Effect** handles processes, cleanup, retries, and typed failures.
- Requires mise `2026.10.17`+.

## Platforms

No profiles or `MISE_ENV`: mise loads the overlay for the current OS automatically.

| File | Loaded | Contains |
|---|---|---|
| `mise/conf.d/core.toml` | always (global) | CLI tools for every machine |
| `mise.toml` | always | shared packages, managed files, doctor checks, tasks |
| `mise.macos.toml` | macOS | brew packages, casks, fonts, macOS defaults, Mac dotfiles |
| `mise.linux.toml` | Linux (agent VMs) | apt packages, login-shell hook, VM signing key, Linux dotfiles |

`mise.lock` pins every tool.

## Layout

| Path | Owns |
|---|---|
| `user/common/`, `user/{macos,linux}/` | User config, portable and per-platform |
| `tasks/` | Mise task entrypoints |
| `src/dotfiles/` | Validation, updates, optional publication |
| `.agents/` | Shared agent instructions and skills |

## Bootstrap

Full guide: [docs/new-machine.md](docs/new-machine.md).

```sh
xcode-select --install
curl https://mise.run | sh
~/.local/bin/mise --locked bootstrap \
  --from https://github.com/prichodko/dotfiles.git \
  --from-dir "$HOME/.dotfiles" \
  --update --yes
```

For a VM, run `mise bootstrap remote --host <ssh-destination>` from this checkout; it uses `[bootstrap.remote]` in `mise.toml`.

Bootstrap installs packages, links managed files, merges Claude and Codex defaults, installs the global hk hook, runs `bun install --frozen-lockfile --ignore-scripts`, then validates the checkout. Credentials are never copied: authenticate GitHub, Entire, Codex, and Claude manually.

## Health checks

```sh
mise doctor project
```

Checks Homebrew Git 2.54+, bootstrap completeness, 1Password commit signing (macOS), and CLI sign-in. They're declared under `[doctor.checks]` in `mise.toml`.

## Managed files

Mise links files from `user/common/` and the platform directory, and owns the shell activation blocks in `~/.zshrc`, `~/.zprofile`, `~/.bashrc`, and `~/.bash_profile`.

| Config | Policy |
|---|---|
| Shell, Git, SSH, editor config | Linked from the repo |
| Global mise config and lock | Linked to the canonical repo files |
| Claude `settings.json`, Codex `config.toml` | Base keys (`user/common/.claude/base.json`, `user/common/.codex/base.toml`) merged atomically; unmanaged local keys preserved |
| Credentials, hooks, status lines, app state | Local only |

Removing a key from a base file relinquishes ownership; it doesn't delete the local value. Never link the live `~/.codex/config.toml` into the repo.

## Upgrading tools

```sh
mise upgrade hk      # one tool, within its declared range
mise -C ~ upgrade    # all tools
```

The global config is linked to this repo, so upgrades rewrite the canonical lock file. Review the diff and run `mise run dotfiles:check` before committing. Native packages and apps upgrade separately; see [maintenance](docs/new-machine.md#maintenance).

## Dotfiles tasks

```sh
mise run dotfiles:check    # typecheck, shell syntax, mise config/locks/links, managed config, gitleaks
mise run dotfiles:pull     # fast-forward origin/main and apply
mise run dotfiles:sync     # same as pull
mise run dotfiles:publish  # explicit: commit, validate, push tracked changes
mise run machine:apply     # apply this checkout
```

`pull`/`sync` require clean tracked files on `main`, take a process lock, fast-forward only, then run `tasks/machine/apply` (locked deps → source validation → `mise bootstrap` → status check → Codex app-server refresh). Failed applies are safe to repeat.

`publish` runs only on macOS `main`. It commits modified/deleted tracked files (new files need a normal reviewed commit), test-rebases in an isolated worktree, validates the exact candidate commit in a detached checkout, and pushes it without force. It retries once if `origin/main` moves. Failures leave local commits or worktrees for inspection.

The Codex refresh updates a stale app-server from the mise-selected CLI and may interrupt an active Codex turn. Run it alone with `mise run machine:refresh-codex`.

## SSH

- 1Password SSH agent for GitHub, Exe, and Tailscale hosts.
- `agent-controller`, `entire-exe-dev`, `haven`: Tailscale SSH aliases as `exedev`.
- Linux VMs sign commits with a per-machine key (`~/.ssh/agent_commit_signing`) that stays on the machine.
- Exe hosts use strict checking against `user/common/.ssh/exe_known_hosts` only. Official fingerprint: `SHA256:JJOP/lwiBGOMilfONPWZCXUrfK154cnJFXcqlsi6lPo`. To rotate, get the new key from an official Exe source, update the file, and verify with `ssh-keygen -lf user/common/.ssh/exe_known_hosts`.

## Git hooks

Mise installs Homebrew Git (2.54+ for config-based global hooks). Bootstrap runs `hk install --global --mise` against `~/.config/git/hk.conf`. The global policy (`user/common/.config/hk/config.pkl`) runs oxfmt on staged files only when the repo has `node_modules/.bin/oxfmt`. Other hooks use `--from-hook` and stay inactive unless the repo defines them.

## Agents

`.agents/AGENTS.md` is linked to `~/AGENTS.md`, Claude, and OpenCode; Codex gets `user/common/.codex/AGENTS.md`. `.agents/skills/` is the canonical skill source; Claude gets per-skill links from `.claude/skills/`.

## Development

```sh
bun install --frozen-lockfile --ignore-scripts
mise run typecheck
mise run test
mise run dotfiles:check
```

Tests never create VMs or push to GitHub.
