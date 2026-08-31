#!/usr/bin/env bash

MACHINE_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
MACHINE_MINIMUM_MISE_VERSION="2026.8.16"

machine_die() {
  printf 'error: %s\n' "$*" >&2
  return 1
}

machine_parse_profile() {
  if (( $# == 0 )); then
    printf 'core\n'
    return 0
  fi
  if (( $# == 1 )) && [[ "$1" == "full" ]]; then
    printf 'full\n'
    return 0
  fi
  machine_die "The only valid explicit profile is full."
}

machine_version_at_least() {
  local current="$1" required="$2"
  local current_year current_month current_patch required_year required_month required_patch
  IFS=. read -r current_year current_month current_patch <<< "${current%% *}"
  IFS=. read -r required_year required_month required_patch <<< "$required"
  current_patch="${current_patch%%[^0-9]*}"
  [[ "$current_year" =~ ^[0-9]+$ && "$current_month" =~ ^[0-9]+$ && "$current_patch" =~ ^[0-9]+$ ]] || return 1
  (( 10#$current_year > 10#$required_year )) && return 0
  (( 10#$current_year < 10#$required_year )) && return 1
  (( 10#$current_month > 10#$required_month )) && return 0
  (( 10#$current_month < 10#$required_month )) && return 1
  (( 10#$current_patch >= 10#$required_patch ))
}

machine_require_mise() {
  local installed_version
  command -v mise >/dev/null 2>&1 || { machine_die "mise is not installed."; return 1; }
  installed_version="$(mise --version)"
  machine_version_at_least "$installed_version" "$MACHINE_MINIMUM_MISE_VERSION" || {
    machine_die "mise ${MACHINE_MINIMUM_MISE_VERSION} or newer is required. Installed: ${installed_version%% *}"
    return 1
  }
}

machine_run_mise() {
  local profile="$1"
  local ignored_config_paths="$HOME/.config/mise/config.toml:$MACHINE_REPO_ROOT/.config/mise/config.toml"
  shift
  if [[ "$profile" == "full" ]]; then
    MISE_IGNORED_CONFIG_PATHS="$ignored_config_paths" MISE_ENV=full mise "$@"
    return
  fi
  MISE_IGNORED_CONFIG_PATHS="$ignored_config_paths" MISE_ENV= mise "$@"
}
