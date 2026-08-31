#!/usr/bin/env bash

set -euo pipefail

test_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
source "$test_root/lib/machine/bootstrap.sh"

[[ "$(machine_parse_profile)" == "core" ]]
[[ "$(machine_parse_profile full)" == "full" ]]
if machine_parse_profile other >/dev/null 2>&1; then
  printf 'machine_parse_profile accepted invalid input.\n' >&2
  exit 1
fi
machine_version_at_least 2026.8.16 2026.8.16
machine_version_at_least 2027.1.0 2026.8.16
if machine_version_at_least 2026.8.15 2026.8.16; then
  printf 'machine_version_at_least accepted an old version.\n' >&2
  exit 1
fi

printf 'machine-apply.test: passed\n'
