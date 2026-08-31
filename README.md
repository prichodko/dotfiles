# dotfiles

Portable configuration, tools, and lifecycle management for local and remote machines.

Mise is the public task runner and bootstrap system.

Bun runs the TypeScript automation.

Effect provides process execution, cleanup, retries, typed failures, and the command-line interface.

The repository requires mise `2026.8.14` or newer.

## Profiles

| Profile | Purpose | Configuration |
|---|---|---|
| `core` | Every local or remote machine | `mise/conf.d/core.toml` and the platform overlay |
| `full` | Personal machines with applications and additional tools | `mise.full.toml` |

The core profile is the default.

The full profile includes the core profile.

Mise lock files pin both profiles.

## Repository ownership

| Path | Ownership |
|---|---|
| `mise.toml` | Bootstrap packages, managed files, remote settings, and public tasks |
| `mise/conf.d/core.toml` | Shared core tools |
| `mise.full.toml` | Full-profile packages and tools |
| `mise.macos.toml` and `mise.linux.toml` | Platform overlays |
| `bin/machine.ts` | Global provider-neutral `machine` command |
| `tasks/` | Mise task entrypoints |
| `src/dotfiles/` | Repository validation, pull, and synchronization |
| `src/machine/` | Machine lifecycle, validation, CLI, and providers |
| `user/common/` | Portable user configuration |
| `user/macos/` and `user/linux/` | Platform-specific user configuration |
| `.agents/skills/` | Canonical shared agent skills |

Pure TypeScript owns profiles, validated input, commit messages, and finite-state transitions.

Effect owns external processes, locks, interruption, retries, SSH, Git, and notifications.

Synchronization and machine lifecycle use explicit finite-state machines.

The machine lifecycle uses a provider interface.

Exe is the first provider implementation.

## Bootstrap

Clone the repository at `~/.dotfiles`.

Apply the core profile:

```sh
mise run machine:apply
```

Apply the full profile:

```sh
mise run machine:apply full
```

The apply task runs `mise bootstrap --skip-dirty --yes --locked`.

The final bootstrap task installs pinned TypeScript dependencies in the persistent checkout:

```sh
bun install --frozen-lockfile --ignore-scripts
```

Effect is a repository dependency.

It is not installed globally.

## Managed user files

Common user files come from `user/common/`.

Platform files come from `user/macos/` or `user/linux/`.

Mise manages Shell activation blocks, symlinks, copied files, and platform overlays.

The global `machine` command is linked as follows:

```text
~/.local/bin/machine -> ~/.dotfiles/bin/machine.ts
```

The global mise configuration links the shared core fragment and the full overlay directly from this repository.

The one-time legacy-link conversion is not part of the repository.

New machines use mise bootstrap only.

## Dotfiles tasks

```sh
mise run dotfiles:check
mise run dotfiles:pull
mise run dotfiles:sync
```

### `dotfiles:check`

This task validates TypeScript, Shell syntax, startup files, mise configuration, tasks, locks, managed links, managed-file status, and secrets.

It checks core and full locked installations.

It scans the repository and staged changes with Gitleaks.

### `dotfiles:pull`

This task requires a clean tracked tree.

It preserves untracked files.

It fetches `origin/main` and permits fast-forward updates only.

It validates and applies the final repository state.

It never commits or pushes.

Use this task on remote machines.

### `dotfiles:sync`

This task runs only on macOS and only on `main`.

It acquires a local process lock.

It waits for tracked changes to become stable.

It stages modified and deleted tracked files only.

It validates before and after publication.

It creates commit subjects from sorted affected paths.

It fetches `origin/main` and tests the rebase in an isolated worktree.

It preserves the isolated worktree when a conflict occurs.

It keeps the live worktree unchanged after a preflight conflict.

It pushes without force.

It retries once only when another machine updated `origin/main` first.

It applies the final repository state and reports preserved untracked files.

## Machine tasks

```sh
mise run machine:validate
mise run machine:validate full
mise run machine:exe:create -- work
mise run machine:exe:create -- work --profile full
mise run machine:exe:apply -- work
mise run machine:exe:apply -- work --profile full
```

Remote machine names are dynamic.

The `local` name is reserved for the current machine.

The tasks do not copy credentials.

Complete GitHub, Entire, Codex, and Claude authentication manually.

## Machine command

```text
machine create <name> [--profile core|full] [--cpu 2] [--memory 8GB] [--disk 25GB]
machine apply [target] [--profile core|full]
machine validate [target] [--profile core|full]
machine list [--json]
machine status [target] [--json]
machine shell <name> [-- <command>...]
machine remove <name> [--yes]
```

`apply`, `validate`, and `status` default to `local`.

`create` requires a remote name.

Create and remote apply require clean local `main` that matches `origin/main`.

Exe creation defaults to two CPUs, `8GB` of memory, a `25GB` disk, and the core profile.

SSH readiness has a five-minute total timeout.

A failed create or bootstrap keeps the remote machine.

No failure or cancellation path removes a machine automatically.

Only `machine remove` deletes a remote machine.

Removal requires confirmation in a terminal.

Removal requires `--yes` without a terminal.

The command uses exit code `0` for success, `1` for an operational failure, `2` for invalid input, and `130` for interruption.

## Agent skills

`.agents/skills/` is the canonical skill source.

Claude receives individual links from `.claude/skills/`.

The `grill-me` skill replaces the old `discuss` name.

The `trail-create` skill creates one Entire trail and owns the related commit, push, and trail workflow when explicitly invoked.

The `trail-findings` skill reads every finding for the current branch trail without changing findings or code.

## SSH

The macOS SSH configuration uses the 1Password SSH agent for GitHub and Exe hosts.

The `agent-controller` alias connects to `controller.exe.xyz` as `exedev`.

Wildcard `*.exe.xyz` hosts use the same Exe user and identity agent.

## Codex configuration

Portable Codex defaults live in `user/common/.codex/base.toml`.

The final machine bootstrap task merges every base value into `~/.codex/config.toml`.

Base values override matching local values.

The merge preserves every local value that the base does not own.

The merge writes the local file atomically only when a managed value changed.

Codex runs without a managed profile wrapper.

See the official [configuration basics](https://developers.openai.com/codex/config-basic/) and [configuration reference](https://developers.openai.com/codex/config-reference/).

The live `~/.codex/config.toml` can contain generated application state, trusted project paths, runtime hashes, application versions, and cache paths.

The live file is local state and is not tracked.

Do not link the live file into the repository.

## Development

```sh
bun install --frozen-lockfile --ignore-scripts
mise run typecheck
mise run test
mise run dotfiles:check
```

The test suite includes unit tests, finite-state transition tables, temporary Git repositories, CLI integration tests, bootstrap Shell tests, and architecture checks.

Tests do not create an Exe machine or push to GitHub.
