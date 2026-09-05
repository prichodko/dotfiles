#!/usr/bin/env bash

set -euo pipefail

test_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
test_state="$(mktemp -d)"
trap 'rm -rf "$test_state"' EXIT
test_log="$test_state/mise.log"
test_path="$test_root/tests/fixtures/bin:$PATH"

HOME="$test_state" PATH="$test_path" MISE_TEST_LOG="$test_log" "$test_root/tasks/machine/apply"
HOME="$test_state" PATH="$test_path" MISE_TEST_LOG="$test_log" "$test_root/tasks/machine/apply" full
HOME="$test_state" PATH="$test_path" MISE_ENV="linux,exe" MISE_TEST_LOG="$test_log" "$test_root/tasks/machine/apply"
HOME="$test_state" PATH="$test_path" MISE_ENV="linux,exe" MISE_TEST_LOG="$test_log" "$test_root/tasks/machine/apply" full
HOME="$test_state" PATH="$test_path" MISE_ENV="linux,exe,full" MISE_TEST_LOG="$test_log" "$test_root/tasks/machine/apply" full
for invalid_arguments in "other" "full extra"; do
  read -r -a arguments <<< "$invalid_arguments"
  if HOME="$test_state" PATH="$test_path" MISE_TEST_LOG="$test_log" "$test_root/tasks/machine/apply" "${arguments[@]}" >/dev/null 2>&1; then
    printf 'machine apply accepted invalid arguments: %s\n' "$invalid_arguments" >&2
    exit 1
  fi
done

expected_command="-C $test_root bootstrap --skip-dirty --yes --locked"
expected_status="-C $test_root bootstrap status --missing"
for index in 1 2 3 4 5; do
  case "$index" in
    1) environment=core ;;
    2) environment=full ;;
    3) environment=linux,exe ;;
    *) environment=linux,exe,full ;;
  esac
  install_line=$((index * 4 - 3))
  validation_line=$((index * 4 - 2))
  command_line=$((index * 4 - 1))
  status_line=$((index * 4))
  [[ "$(sed -n "${install_line}p" "$test_log")" == "$environment"$'\t'"-C $test_root --locked exec -- bun install --frozen-lockfile --ignore-scripts" ]]
  [[ "$(sed -n "${validation_line}p" "$test_log")" == "$environment"$'\t'"-C $test_root --locked exec -- bun run tasks/dotfiles/check-source.ts" ]]
  [[ "$(sed -n "${command_line}p" "$test_log")" == "$environment"$'\t'"$expected_command" ]]
  [[ "$(sed -n "${status_line}p" "$test_log")" == "$environment"$'\t'"$expected_status" ]]
done
[[ "$(wc -l < "$test_log" | tr -d ' ')" == "20" ]]

failure_log="$test_state/failure.log"
if HOME="$test_state" PATH="$test_path" MISE_TEST_LOG="$failure_log" MISE_TEST_FAIL_MATCH="check-source.ts" "$test_root/tasks/machine/apply"; then
  printf 'machine apply ignored source validation failure.\n' >&2
  exit 1
fi
if rg -q ' bootstrap ' "$failure_log"; then
  printf 'machine apply changed configuration after source validation failed.\n' >&2
  exit 1
fi

printf 'machine-apply.test: passed\n'
