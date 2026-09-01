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
[[ "$(sed -n '1p' "$test_log")" == $'core\t'"$expected_command" ]]
[[ "$(sed -n '2p' "$test_log")" == $'full\t'"$expected_command" ]]
[[ "$(sed -n '3p' "$test_log")" == $'linux,exe\t'"$expected_command" ]]
[[ "$(sed -n '4p' "$test_log")" == $'linux,exe,full\t'"$expected_command" ]]
[[ "$(sed -n '5p' "$test_log")" == $'linux,exe,full\t'"$expected_command" ]]
[[ "$(wc -l < "$test_log" | tr -d ' ')" == "5" ]]

printf 'machine-apply.test: passed\n'
