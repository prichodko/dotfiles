#!/usr/bin/env bash

set -euo pipefail

test_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
rg -Fq '"~/.local/bin/machine" = { source = "~/.dotfiles/bin/machine.ts" }' "$test_root/mise.toml"
rg -Fq '"~/.config/mise/conf.d/core.toml" = { source = "~/.dotfiles/mise/conf.d/core.toml", mode = "copy" }' "$test_root/mise.toml"
rg -Fq '"~/.config/mise/config.full.toml" = { source = "~/.dotfiles/mise.full.toml", mode = "copy" }' "$test_root/mise.toml"
rg -Fq '"~/.config/mise/mise.lock" = { source = "~/.dotfiles/mise.lock", mode = "copy" }' "$test_root/mise.toml"
rg -Fq '"~/.config/mise/mise.full.lock" = { source = "~/.dotfiles/mise.full.lock", mode = "copy" }' "$test_root/mise.toml"
rg -Fq '"~/.config/hk/config.pkl" = { source = "~/.dotfiles/user/common/.config/hk/config.pkl" }' "$test_root/mise.toml"
rg -Fq '"~/.config/git/platform.conf" = { source = "~/.dotfiles/user/macos/.config/git/platform.conf" }' "$test_root/mise.macos.toml"
if rg -Fq 'machine.config.toml' "$test_root/mise.toml"; then
  printf 'managed-files.test: legacy Codex profile remains.\n' >&2
  exit 1
fi

printf 'managed-files.test: passed\n'
