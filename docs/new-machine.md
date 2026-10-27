# New machine

Set up an Apple Silicon Mac. The `full` profile adds personal apps and extra tools; `core` is the portable environment only.

## Before bootstrap

1. Install macOS updates and enable FileVault.
2. Install Xcode Command Line Tools and wait for it to finish:

   ```sh
   xcode-select --install
   ```

3. Install mise:

   ```sh
   curl https://mise.run | sh
   ```

## Bootstrap

```sh
~/.local/bin/mise -E full --locked bootstrap \
  --from https://github.com/prichodko/dotfiles.git \
  --from-dir "$HOME/.dotfiles" \
  --update --yes
```

Drop `-E full` for core only. Never add `--force-dotfiles` or `--skip-dirty`; if bootstrap reports a conflict, stop and inspect the files. Rust comes from mise in both profiles.

## Manual setup

1. Start a new login shell.
2. Sign in to Apple ID/iCloud and 1Password; enable the 1Password SSH agent.
3. Grant Accessibility, Screen Recording, and Full Disk Access where needed.
4. Authenticate CLIs:

   ```sh
   gh auth login --git-protocol ssh --web --skip-ssh-key
   entire auth login
   codex login
   claude auth login
   ```

5. Restore browser profiles, app data, and repos from backup. Mise copies no credentials.

## Validation

```sh
cd "$HOME/.dotfiles"
mise run machine:validate full
mise exec -- rustc --version
mise exec -- cargo --version
mise exec -- xcrun --show-sdk-version
git --version
ssh -T git@github.com
```

Then, in a temporary repo:

- make a signed commit and confirm 1Password approves it;
- with `node_modules/.bin/oxfmt` present, confirm the global hk pre-commit hook formats staged files.

## Maintenance

Tools:

```sh
mise upgrade hk              # one tool, within its declared range
mise -C ~ upgrade            # all core tools
mise -C ~ -E full upgrade    # core + full
```

Upgrades rewrite the repo lock files. Review the diff, run `mise run dotfiles:check`, and try the tools in your projects before committing. On a new machine, bootstrap with the current locks first and upgrade only after validation passes.

Native packages and apps:

```sh
mise -E full bootstrap packages upgrade --dry-run
mise -E full bootstrap packages upgrade --yes
```

App upgrades can require new macOS privacy approvals.
