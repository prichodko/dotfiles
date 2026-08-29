# Machine and dotfiles automation

This repository manages portable user files, tools, and local or remote machines.

It requires mise `2026.8.14` or newer.

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

The final bootstrap task installs the pinned TypeScript dependencies with Bun.

## Dotfiles tasks

```sh
mise run dotfiles:check
mise run dotfiles:pull
mise run dotfiles:sync
```

`dotfiles:check` validates TypeScript, Shell, mise configuration, locks, managed links, and secrets.

`dotfiles:pull` requires a clean tracked tree.

It fast-forwards and applies `origin/main`.

It preserves untracked files.

It never commits or pushes.

`dotfiles:sync` runs only on macOS.

It stages modified and deleted tracked files only.

It tests a rebase in an isolated worktree before it changes live `main`.

It keeps a conflict worktree for inspection.

It pushes without force.

It retries one push race.

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

Complete remote authentication manually.

## Machine command

The managed `~/.local/bin/machine` link points to `~/.dotfiles/bin/machine.ts`.

```text
machine create <name> [--profile core|full] [--cpu 2] [--memory 8GB] [--disk 25GB]
machine apply [target] [--profile core|full]
machine validate [target] [--profile core|full]
machine list [--json]
machine status [target] [--json]
machine shell <name> [-- <command>...]
machine remove <name> [--yes]
```

Create and remote apply require clean local `main` that matches `origin/main`.

A failed create keeps the remote machine.

Only `machine remove` deletes a remote machine.

Removal requires confirmation in a terminal.

Removal requires `--yes` without a terminal.

## Development

```sh
bun install --frozen-lockfile --ignore-scripts
mise run typecheck
mise run test
mise run dotfiles:check
```

The TypeScript tests do not connect to Exe or push to GitHub.
