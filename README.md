# dotfiles

Portable configuration, tools, and lifecycle management for local and remote machines.

Mise is the public task runner and bootstrap system.

Bun runs the TypeScript automation.

Effect provides process execution, cleanup, retries, typed failures, and the command-line interface.

The repository requires mise `2026.8.16` or newer.

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
| `mise.macos.toml`, `mise.linux.toml`, and `mise.exe.toml` | Platform and provider overlays |
| `bin/machine.ts` | Global provider-neutral `machine` command |
| `tasks/` | Mise task entrypoints |
| `src/dotfiles/` | Repository validation, updates, and optional publication |
| `src/machine/` | Machine lifecycle, validation, CLI, and providers |
| `user/common/` | Portable user configuration |
| `user/macos/` and `user/linux/` | Platform-specific user configuration |
| `.agents/skills/` | Canonical shared agent skills |

Pure TypeScript owns profiles, validated input, and commit messages.

Effect owns external processes, locks, interruption, retries, SSH, Git, and notifications.

Operation results distinguish publication conflicts and retained machines.

Sequential Effect programs own execution order and cleanup.

The machine lifecycle uses a provider interface.

Exe is the first provider implementation.

## Bootstrap

See [the new-machine guide](docs/new-machine.md) for the complete laptop process.

Install Xcode Command Line Tools:

```sh
xcode-select --install
```

Install the official mise binary:

```sh
curl https://mise.run | sh
```

Bootstrap a new core machine directly from GitHub:

```sh
~/.local/bin/mise \
  --locked \
  bootstrap \
  --from https://github.com/prichodko/dotfiles.git \
  --from-dir "$HOME/.dotfiles" \
  --update \
  --yes
```

Bootstrap a new full machine directly from GitHub:

```sh
~/.local/bin/mise \
  -E full \
  --locked \
  bootstrap \
  --from https://github.com/prichodko/dotfiles.git \
  --from-dir "$HOME/.dotfiles" \
  --update \
  --yes
```

New shells use the managed mise activation and the official binary on `PATH`.

The apply task runs `mise bootstrap --skip-dirty --yes --locked`.

The final bootstrap task installs pinned TypeScript dependencies in the persistent checkout:

```sh
bun install --frozen-lockfile --ignore-scripts
```

Effect is a repository dependency.

It is not installed globally.

The bootstrap applies the global hk configuration and merges the portable Claude and Codex defaults.

After dependency installation, a new Bun process validates the current checkout and managed configuration.

## Managed user files

Common user files come from `user/common/`.

Platform files come from `user/macos/` or `user/linux/`.

Mise manages Shell activation blocks, symlinks, copied files, and platform overlays.

The global `machine` command is linked as follows:

```text
~/.local/bin/machine -> ~/.dotfiles/bin/machine.ts
```

The global mise configuration manages copies of the shared core fragment, the full overlay, and their lock files.

The repository `mise.lock` and `mise.full.lock` files remain canonical.

The upgrade task refreshes the derived global copies when it applies the selected profile, after source checks and tests pass.

New machines use mise bootstrap only.

## Dotfiles tasks

```sh
mise run dotfiles:check
mise run dotfiles:pull
mise run dotfiles:sync
```

`dotfiles:check` validates TypeScript, Shell syntax, mise configuration, tasks, locks, links, managed configuration, and secrets.

It checks core and full locked installations.

It scans the repository and staged changes with Gitleaks.

`dotfiles:pull` and `dotfiles:sync` both update without committing or pushing.

They require clean tracked files on `main` and preserve untracked files.

They acquire a local process lock, fetch `origin/main`, and permit fast-forward updates only.

The updated checkout runs the same `tasks/machine/apply` entrypoint used for local application.

The apply entrypoint prepares the locked Bun dependencies and validates source before native bootstrap changes configuration.

Native bootstrap installs platform packages and runs configuration merging with the installed tools.

The apply entrypoint checks aggregate bootstrap status before reporting success.

An interrupted or failed apply can be repeated.

If application fails after fast-forward, the updated checkout remains available for inspection and repair.

### Optional publication

Review and commit changes with normal Git commands by default.

Automatic publication is an explicit operation:

```sh
mise run dotfiles:publish
```

This command runs only on macOS and only on `main`.

It waits for stable tracked changes, stages modified and deleted tracked files, and creates a local commit.

New staged files are rejected. Add new files through a reviewed Git commit first.

It tests the rebase in an isolated worktree and preserves that worktree on conflict.

Before each push, it creates a detached checkout of the candidate commit, installs its locked dependencies, and runs its source validation.

It pushes that exact validated commit without force.

If another machine advances `origin/main`, it retries once with a new rebase and validation.

A changed local HEAD cannot cause an unvalidated commit to be pushed.

After publication, it verifies the remote revision and applies the checkout through the shared apply entrypoint.

Failures can leave a local commit or rebased branch for inspection. They never trigger a force push.

## Machine tasks

```sh
mise run machine:validate
mise run machine:validate full
mise run machine:upgrade
mise run machine:upgrade -- full
mise run machine:exe:create -- work-vm
mise run machine:exe:create -- work-vm --profile full
mise run machine:exe:apply -- work-vm
mise run machine:exe:apply -- work-vm --profile full
```

`machine:upgrade` replaces `machine:update-locks`.

Use no argument to apply core, or `full` to apply the full profile.

The command acquires the repository lock and rejects unrelated tracked changes or an active Git operation.

It updates both mise lock files to newer versions allowed by the tool declarations, then displays their diff against HEAD.

It validates source and runs the test suite before applying configuration through `machine:apply`.

Validation can download tools selected by the new locks. Application installs the selected profile, refreshes managed configuration, and checks bootstrap status.

The command does not commit or push. Review the diff and try the upgraded tools in your projects before publishing the changes.

If validation fails, application does not start. If application fails, it can leave partial machine changes. Lock-file changes remain available for inspection in either case.

After correcting a failure, rerun the upgrade to select versions again, or use `machine apply --profile core` (or `full`) to retry application with the existing locks.

Native package and desktop application upgrades remain separate. See [the maintenance guide](docs/new-machine.md#maintenance).

Remote machine names are dynamic.

Remote names contain 5 to 52 lower-case letters or digits with optional single hyphen separators.

The `local` name is reserved for the current machine.

The tasks do not copy credentials.

Complete GitHub, Entire, Codex, and Claude authentication manually.

Authentication is not part of bootstrap completeness.

`machine validate` reports missing authentication after the managed environment is complete.

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

Remote list and status output includes the Exe region code and display name when Exe provides them.

Create and remote apply require clean local `main` that matches `origin/main`.

Exe creation defaults to two CPUs, `8GB` of memory, a `25GB` disk, and the core profile.

Core Exe machines load the ordered mise environments `linux,exe`.

Full Exe machines load the ordered mise environments `linux,exe,full`.

The Exe overlay checks that `/usr/bin/zsh` is available before the mise user step.

It reads the current login shell and makes no change when the shell is already correct.

It uses `sudo -n chsh` only when a change is required.

It fails with a clear message when password-free sudo is unavailable.

SSH readiness has a ten-minute total timeout.

Remote bootstrap installs the verified official Linux binary that matches the local mise version.

The Exe adapter explicitly requests that mise remains at `~/.local/bin/mise` after remote staging is removed.

It verifies the persistent mise binary and the dotfiles Git checkout before bootstrap can succeed.

Remote apply checks that `~/.local/bin/mise` is executable and can run.

It also checks that `~/.dotfiles` is a valid Git checkout with a current commit.

An incomplete bootstrap waits for SSH and runs the bootstrap again.

A complete bootstrap does not run again.

Remote apply delegates to the shared updater with the same Exe environments.

A one-time compatibility path detects machines that still run the old updater. After their checkout advances, it starts the new apply entrypoint.

Current machines invoke the updater once.

Missing tools or managed state causes the apply operation to fail.

New machines refresh package metadata before installation.

Bootstrap replaces only the default Exe files that conflict with tracked managed files.

A failed create or bootstrap keeps the remote machine.

No failure or cancellation path removes a machine automatically.

Only `machine remove` deletes a remote machine.

Removal requires confirmation in a terminal.

Removal requires `--yes` without a terminal.

The command uses exit code `0` for success, `1` for an operational failure, `2` for invalid input, and `130` for interruption.

## Agent skills

`.agents/skills/` is the canonical skill source.

Claude receives individual links from `.claude/skills/`.

The `trail-create` skill creates one Entire trail and owns the related commit, push, and trail workflow when explicitly invoked.

The `trail-findings` skill reads every finding for the current branch trail without changing findings or code.

## SSH

The macOS SSH configuration uses the 1Password SSH agent for GitHub and Exe hosts.

The `agent-controller` alias connects to `controller.tail1cfa5f.ts.net` as `exedev` through Tailscale SSH.

The `entire-exe-dev` alias connects to `entire-exe-dev.tail1cfa5f.ts.net` as `exedev` through Tailscale SSH.

The Tailscale SSH aliases do not use the 1Password agent for login.

They forward the 1Password agent for remote Git signing.

Wildcard `*.exe.xyz` hosts use the same Exe user and identity agent.

Exe host trust is stored in `user/common/.ssh/exe_known_hosts`.

The managed RSA key applies to `exe.dev` and `*.exe.xyz`.

The official fingerprint is `SHA256:JJOP/lwiBGOMilfONPWZCXUrfK154cnJFXcqlsi6lPo`.

All direct Exe connections and mise remote bootstrap use strict host-key checking.

They use only the managed Exe host-key file.

They do not accept a new or changed key automatically.

For key rotation, first get the replacement key and fingerprint from an official Exe source.

Update `user/common/.ssh/exe_known_hosts` only after the fingerprint is verified.

Check the tracked key before use:

```sh
ssh-keygen -lf user/common/.ssh/exe_known_hosts
```

Update `EXE_SSH_HOST_KEY_FINGERPRINT` in `src/machine/providers/exe/exe-ssh-policy.ts` in the same change.

Run the SSH policy and integration tests before publication.

## Configuration ownership

| Configuration | Ownership policy |
|---|---|
| Shell files, Git configuration, SSH configuration, and editor defaults | Repository-owned files linked by mise |
| Global mise fragments and locks | Derived copies of the repository-owned files |
| Claude `settings.json` and Codex `config.toml` | Managed base keys merged into local files |
| Credentials, Claude hooks, status-line scripts, and generated application state | Local state preserved during application |

Portable configuration must use managed executables or platform-specific settings.

GitHub HTTPS credentials use `mise exec -- gh`.

The `rm` alias is enabled only on macOS when `trash` is available.

Claude defaults live in `user/common/.claude/base.json`.

Bootstrap merges those keys into the local settings file and preserves local hooks, status-line commands, and other unmanaged keys.

Fresh machines do not receive hooks that depend on another machine's scripts.

Claude and Codex use the same atomic merge implementation.

Validation compares managed values, so local formatting and trailing newlines do not cause drift.

Removing a key from a base file relinquishes ownership. It does not delete the local value.

## Codex configuration

Codex workflow instructions live in `user/common/.codex/AGENTS.md` and link to `~/.codex/AGENTS.md`.

They contain the Astra guidance for task completion, skills, communication, delegation, and verification.

Shared instructions remain in `user/common/.agents/AGENTS.md`, linked to `~/AGENTS.md`, Claude, and OpenCode.

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

## Git hooks and formatting

Mise installs Homebrew Git on macOS and Linux.

The platform Shell configuration puts the Homebrew prefix before the system path.

Git 2.54 or newer provides config-based global hooks.

The global hk policy lives in `user/common/.config/hk/config.pkl`.

It runs oxfmt on staged supported files when `node_modules/.bin/oxfmt` exists in the repository.

Repositories without local oxfmt do not run the formatter.

The managed `.gitconfig` stores portable config-based hooks for commit messages, pre-commit, pre-push, and commit-message preparation.

Each hook uses `mise x -- hk` so it receives the repository environment without an absolute machine path.

The pre-commit hook always loads the global user policy.

The other hooks use `--from-hook` and remain inactive when a repository does not define them.

## Development

```sh
bun install --frozen-lockfile --ignore-scripts
mise run typecheck
mise run test
mise run dotfiles:check
```

The test suite covers temporary Git repositories, invalid rebases, push races, locked dependency updates, repeated application, configuration preservation, CLI behavior, bootstrap Shell entrypoints, and architecture checks.

Tests do not create an Exe machine or push to GitHub.
