# dotfiles

Portable config, tools, and lifecycle management for local and remote machines.

- **mise** is the public interface: bootstrap, tools, managed files, tasks.
- **Bun** runs the TypeScript automation; **Effect** handles processes, cleanup, retries, typed failures, and the CLI.
- Requires mise `2026.10.17`+.

## Profiles

| Profile | For | Config |
|---|---|---|
| `core` (default) | Every machine | `mise/conf.d/core.toml` + platform overlay |
| `full` | Personal machines: apps and extra tools; includes `core` | `mise.full.toml` |

`mise.lock` and `mise.full.lock` pin both profiles.

## Layout

| Path | Owns |
|---|---|
| `mise.toml` | Bootstrap packages, managed files, remote settings, tasks |
| `mise/conf.d/core.toml` | Core tools |
| `mise.full.toml` | Full-profile packages and tools |
| `mise.{macos,linux,exe}.toml` | Platform and provider overlays |
| `user/common/`, `user/{macos,linux}/` | User config, portable and per-platform |
| `bin/machine.ts` | Global `machine` command |
| `tasks/` | Mise task entrypoints |
| `src/dotfiles/` | Validation, updates, optional publication |
| `src/machine/` | Machine lifecycle, validation, CLI, providers (Exe) |
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

Add `-E full` before `--locked` for the full profile.

Bootstrap installs packages, links managed files, merges Claude and Codex defaults, installs the global hk hook, runs `bun install --frozen-lockfile --ignore-scripts`, then validates the checkout. Credentials are never copied: authenticate GitHub, Entire, Codex, and Claude manually; `machine validate` reports what's missing.

## Managed files

Mise links files from `user/common/` and the platform directory, and owns the shell activation blocks in `~/.zshrc`, `~/.zprofile`, `~/.bashrc`, and `~/.bash_profile`.

| Config | Policy |
|---|---|
| Shell, Git, SSH, editor config | Linked from the repo |
| Global mise fragments and locks | Linked to the canonical repo files |
| Claude `settings.json`, Codex `config.toml` | Base keys (`user/common/.claude/base.json`, `user/common/.codex/base.toml`) merged atomically; unmanaged local keys preserved |
| Credentials, hooks, status lines, app state | Local only |

Removing a key from a base file relinquishes ownership; it doesn't delete the local value. Never link the live `~/.codex/config.toml` into the repo.

## Upgrading tools

```sh
mise upgrade hk              # one tool, within its declared range
mise -C ~ upgrade            # all core tools
mise -C ~ -E full upgrade    # core + full
```

The global config is linked to this repo, so upgrades rewrite the canonical lock files. Review the diff and run `mise run dotfiles:check` before committing. Native packages and apps upgrade separately; see [maintenance](docs/new-machine.md#maintenance).

## Dotfiles tasks

```sh
mise run dotfiles:check    # typecheck, shell syntax, mise config/locks/links, managed config, gitleaks
mise run dotfiles:pull     # fast-forward origin/main and apply
mise run dotfiles:sync     # same as pull
mise run dotfiles:publish  # explicit: commit, validate, push tracked changes
```

`pull`/`sync` require clean tracked files on `main`, take a process lock, fast-forward only, then run `tasks/machine/apply` (locked deps → source validation → `mise bootstrap` → status check → Codex app-server refresh). Failed applies are safe to repeat.

`publish` runs only on macOS `main`. It commits modified/deleted tracked files (new files need a normal reviewed commit), test-rebases in an isolated worktree, validates the exact candidate commit in a detached checkout, and pushes it without force. It retries once if `origin/main` moves. Failures leave local commits or worktrees for inspection.

The Codex refresh updates a stale app-server from the mise-selected CLI and may interrupt an active Codex turn. Run it alone with `mise run machine:refresh-codex`.

## Machines

```text
machine create <name> [--profile core|full] [--cpu 2] [--memory 8GB] [--disk 25GB]
machine apply [target] [--profile core|full]
machine validate [target] [--profile core|full]
machine list [--json]
machine status [target] [--json]
machine shell <name> [-- <command>...]
machine remove <name> [--yes]
```

- `apply`, `validate`, `status` default to `local` (reserved name). Remote names: 5–52 lowercase letters/digits, single hyphens.
- `--profile` overrides an inherited `MISE_ENV` profile but keeps provider environments.
- `create` and remote `apply` require clean local `main` matching `origin/main`.
- Exe machines use mise envs `linux,exe` (+ `full`). The Exe overlay sets the login shell to zsh via `sudo -n chsh` only when needed.
- Failed create/bootstrap keeps the machine. Only `machine remove` deletes one, with confirmation or `--yes`.
- Exit codes: `0` ok, `1` operational failure, `2` invalid input, `130` interrupted.

Mise task equivalents: `machine:validate`, `machine:exe:create`, `machine:exe:apply`.

## SSH

- 1Password SSH agent for GitHub, Exe, and Tailscale hosts.
- `agent-controller`, `entire-exe-dev`, `haven`: Tailscale SSH aliases as `exedev`.
- Linux agents sign commits with a per-machine key that stays on the machine.
- Exe hosts use strict checking against `user/common/.ssh/exe_known_hosts` only. Official fingerprint: `SHA256:JJOP/lwiBGOMilfONPWZCXUrfK154cnJFXcqlsi6lPo`.

To rotate the Exe host key: get the new key and fingerprint from an official Exe source, update `exe_known_hosts` and `EXE_SSH_HOST_KEY_FINGERPRINT` in `src/machine/providers/exe/exe-ssh-policy.ts` together, verify with `ssh-keygen -lf user/common/.ssh/exe_known_hosts`, and run the tests.

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

Tests never create Exe machines or push to GitHub.
