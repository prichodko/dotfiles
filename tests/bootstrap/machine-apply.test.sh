#!/usr/bin/env bash

set -euo pipefail

test_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
test_state="$(mktemp -d)"
trap 'rm -rf "$test_state"' EXIT
test_log="$test_state/mise.log"
test_path="$test_root/tests/fixtures/bin:$PATH"

HOME="$test_state" PATH="$test_path" MISE_TEST_LOG="$test_log" "$test_root/tasks/machine/apply"
if HOME="$test_state" PATH="$test_path" "$test_root/tasks/machine/apply" full >/dev/null 2>&1; then
  printf 'machine apply accepted an argument.\n' >&2
  exit 1
fi

expected="-C $test_root --locked exec -- bun install --frozen-lockfile --ignore-scripts
-C $test_root --locked exec -- bun run tasks/dotfiles/check-source.ts
-C $test_root bootstrap --skip-dirty --yes --locked
-C $test_root bootstrap status --missing
-C $test_root --locked exec -- bun run tasks/machine/refresh-codex.ts"
[[ "$(cat "$test_log")" == "$expected" ]]

failure_log="$test_state/failure.log"
if HOME="$test_state" PATH="$test_path" MISE_TEST_LOG="$failure_log" MISE_TEST_FAIL_MATCH="check-source.ts" "$test_root/tasks/machine/apply"; then
  printf 'machine apply ignored source validation failure.\n' >&2
  exit 1
fi

for failure_match in "bootstrap --skip-dirty" "bootstrap status" "refresh-codex.ts"; do
  phase_log="$test_state/$failure_match.log"
  if HOME="$test_state" PATH="$test_path" MISE_TEST_LOG="$phase_log" MISE_TEST_FAIL_MATCH="$failure_match" "$test_root/tasks/machine/apply"; then
    printf 'machine apply ignored failure: %s\n' "$failure_match" >&2
    exit 1
  fi
  if [[ "$failure_match" != "refresh-codex.ts" ]] && rg -q 'refresh-codex.ts' "$phase_log"; then
    printf 'machine apply refreshed Codex after bootstrap failed.\n' >&2
    exit 1
  fi
done
if rg -q ' bootstrap ' "$failure_log"; then
  printf 'machine apply changed configuration after source validation failed.\n' >&2
  exit 1
fi

printf 'machine-apply.test: passed\n'
