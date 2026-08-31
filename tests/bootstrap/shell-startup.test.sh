#!/usr/bin/env bash

set -euo pipefail

test_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"

while IFS= read -r shell_file; do
  bash -n "$shell_file"
done < <({ find "$test_root/lib" "$test_root/tests/bootstrap" -type f -name '*.sh'; printf '%s\n' "$test_root/tasks/bootstrap" "$test_root/tasks/machine/apply"; } | sort -u)

while IFS= read -r zsh_file; do
  zsh -n "$zsh_file"
done < <(find "$test_root/user" -type f \( -name '*zsh*.sh' -o -name '.zshenv' \) | sort -u)

rg -Fq 'eval "$(/opt/homebrew/bin/brew shellenv)"' "$test_root/user/macos/.config/shell/macos.sh"
rg -Fq 'export PATH="/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:$HOME/.local/bin:$PATH"' "$test_root/user/linux/.config/shell/linux.sh"

printf 'shell-startup.test: passed\n'
