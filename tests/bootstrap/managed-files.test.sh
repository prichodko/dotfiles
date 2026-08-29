#!/usr/bin/env bash

set -euo pipefail

test_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
rg -Fq '"~/.local/bin/machine" = { source = "~/.dotfiles/bin/machine.ts" }' "$test_root/mise.toml"
rg -Fq '"~/.config/mise/conf.d/core.toml" = { source = "~/.dotfiles/mise/conf.d/core.toml" }' "$test_root/mise.toml"
rg -Fq '"~/.config/mise/config.full.toml" = { source = "~/.dotfiles/mise.full.toml" }' "$test_root/mise.toml"

printf 'managed-files.test: passed\n'
