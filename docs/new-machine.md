# New machine

This guide configures a new Apple Silicon Mac from the dotfiles repository.

The full profile installs personal applications and additional tools.

The core profile installs the portable machine environment only.

## Before bootstrap

Install current macOS updates.

Enable FileVault.

Install Xcode Command Line Tools:

```sh
xcode-select --install
```

Wait for the installation to finish.

Install the official mise binary:

```sh
curl https://mise.run | sh
```

## Full profile

Run the complete personal-machine bootstrap:

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

## Core profile

Run the portable bootstrap without the full overlay:

```sh
~/.local/bin/mise \
  --locked \
  bootstrap \
  --from https://github.com/prichodko/dotfiles.git \
  --from-dir "$HOME/.dotfiles" \
  --update \
  --yes
```

Do not add `--force-dotfiles`.

Do not add `--skip-dirty`.

Stop and inspect the files when bootstrap reports a conflict.

## Manual setup

Start a new login Shell.

Sign in to Apple ID and iCloud.

Sign in to 1Password.

Enable the 1Password SSH agent.

Grant the required Accessibility permissions.

Grant the required Screen Recording permissions.

Grant the required Full Disk Access permissions.

Authenticate the command-line tools:

```sh
gh auth login --git-protocol ssh --web --skip-ssh-key
entire auth login
codex login
claude auth login
```

Restore browser profiles, application data, project repositories, and other untracked data from backup.

Mise does not copy credentials from another machine.

## Validation

Validate the complete machine:

```sh
cd "$HOME/.dotfiles"
mise run machine:validate full
```

Verify Git and GitHub SSH:

```sh
command -v git
git --version
ssh -T git@github.com
```

Create a signed commit in a temporary repository.

Confirm that 1Password approves the signature.

Create a temporary repository with an available `node_modules/.bin/oxfmt` executable.

Confirm that the global hk pre-commit hook runs the formatter.

## Maintenance

Upgrade one managed tool within its declared version range:

```sh
mise upgrade hk
```

Upgrade every core tool, or include the full profile:

```sh
mise -C ~ upgrade
mise -C ~ -E full upgrade
```

The linked global configuration writes version changes to the canonical repository lock files. Review the diff, run `mise run dotfiles:check`, and try the upgraded tools in your projects before committing and pushing the lock-file changes.

For a new machine, bootstrap with the current tested locks first. Upgrade tools only after the initial setup validates successfully.

Preview native package and application upgrades:

```sh
mise -E full bootstrap packages upgrade --dry-run
```

Apply approved native package and application upgrades:

```sh
mise -E full bootstrap packages upgrade --yes
```

An application upgrade can require new macOS privacy approval.
