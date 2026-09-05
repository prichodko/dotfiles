#!/usr/bin/env bash

set -euo pipefail

test_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
test_state="$(mktemp -d)"
trap 'rm -rf "$test_state"' EXIT
test_home="$test_state/home"
test_bin="$test_home/bin"
test_homebrew="$test_home/homebrew"

mkdir -p \
  "$test_bin" \
  "$test_home/.config/shell" \
  "$test_homebrew/opt/fzf-tab/share/fzf-tab" \
  "$test_homebrew/opt/zsh-syntax-highlighting/share/zsh-syntax-highlighting" \
  "$test_homebrew/share/zsh/site-functions"

ln -s "$test_root/user/common/.config/shell/common.sh" "$test_home/.config/shell/common.sh"
ln -s "$test_root/user/common/.config/shell/zsh.sh" "$test_home/.config/shell/zsh.sh"
ln -s "$test_root/user/common/.config/shell/bash.sh" "$test_home/.config/shell/bash.sh"

printf '%s\n' \
  'if [[ -n "${MACHINE_PLATFORM_SHELL_INITIALIZED:-}" ]]; then return 0; fi' \
  'MACHINE_PLATFORM_SHELL_INITIALIZED=1' \
  "export HOMEBREW_PREFIX='$test_homebrew'" \
  "export PATH=\"$test_bin:\$PATH:$test_bin\"" \
  > "$test_home/.config/shell/platform.sh"

printf '%s\n' \
  '#!/usr/bin/env bash' \
  'printf '\''MACHINE_TEST_STARSHIP=1\n'\''' \
  > "$test_bin/starship"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'if [[ "${1:-}" == "--zsh" ]]; then' \
  '  printf '\''MACHINE_TEST_FZF=1; zle -N fzf-completion; bindkey "^I" fzf-completion\n'\''' \
  'else' \
  '  printf '\''MACHINE_TEST_FZF=1\n'\''' \
  'fi' \
  > "$test_bin/fzf"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'printf '\''MACHINE_TEST_ATUIN=1\n'\''' \
  > "$test_bin/atuin"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'printf '\''MACHINE_TEST_ZOXIDE=1\n'\''' \
  > "$test_bin/zoxide"
chmod +x "$test_bin/starship" "$test_bin/fzf" "$test_bin/atuin" "$test_bin/zoxide"

printf '%s\n' \
  '(( $+functions[_main_complete] )) || return 90' \
  '[[ "$(bindkey "^I")" == *fzf-completion* ]] || return 91' \
  '_ftb__main_complete() { :; }' \
  'fzf-tab-complete() { :; }' \
  'zle -N fzf-tab-complete' \
  'bindkey "^I" fzf-tab-complete' \
  'MACHINE_TEST_FZF_TAB=1' \
  > "$test_homebrew/opt/fzf-tab/share/fzf-tab/fzf-tab.zsh"

printf '%s\n' \
  '[[ -z "${MACHINE_TEST_STARSHIP:-}" && "$PROMPT" == *❯* ]] || return 92' \
  '[[ "${MACHINE_TEST_FZF:-}" == 1 ]] || return 93' \
  '[[ "${MACHINE_TEST_FZF_TAB:-}" == 1 ]] || return 94' \
  '[[ "${MACHINE_TEST_ATUIN:-}" == 1 ]] || return 95' \
  '[[ "${MACHINE_TEST_ZOXIDE:-}" == 1 ]] || return 96' \
  'unset ZSH_HIGHLIGHT_STYLES' \
  'typeset -gA ZSH_HIGHLIGHT_STYLES' \
  'MACHINE_TEST_SYNTAX_HIGHLIGHTING=1' \
  > "$test_homebrew/opt/zsh-syntax-highlighting/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh"

while IFS= read -r shell_file; do
  bash -n "$shell_file"
done < <({ find "$test_root/tests/bootstrap" -type f -name '*.sh'; printf '%s\n' "$test_root/tasks/bootstrap" "$test_root/tasks/machine/apply"; } | sort -u)

while IFS= read -r zsh_file; do
  zsh -n "$zsh_file"
done < <(find "$test_root/user" -type f \( -name '*zsh*.sh' -o -name '.zshenv' \) | sort -u)

rg -Fq 'eval "$(/opt/homebrew/bin/brew shellenv)"' "$test_root/user/macos/.config/shell/macos.sh"
rg -Fq 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"' "$test_root/user/linux/.config/shell/linux.sh"
rg -Fq 'export ENTIRE_TOKEN_STORE=file' "$test_root/user/linux/.config/shell/linux.sh"
rg -Fq '"brew:zsh-syntax-highlighting" = { os = ["linux", "macos"] }' "$test_root/mise.toml"
rg -Fq '"brew:fzf-tab" = { os = ["linux", "macos"] }' "$test_root/mise.toml"
rg -Fq '[ -f "$HOME/.config/shell/bash.sh" ] && source "$HOME/.config/shell/bash.sh"' "$test_root/mise.toml"

for obsolete_startup_file in .zshrc .zprofile .bashrc .bash_profile; do
  if [[ -e "$test_root/$obsolete_startup_file" ]]; then
    printf 'shell-startup.test: obsolete startup file remains: %s\n' "$obsolete_startup_file" >&2
    exit 1
  fi
done

# Exercise prompt transitions in both shells using an isolated Git repository.
mkdir -p "$test_home/repo" "$test_home/plain"
git -C "$test_home/repo" init -q -b main
git -C "$test_home/repo" config core.hooksPath /dev/null
printf 'initial\n' > "$test_home/repo/tracked"
git -C "$test_home/repo" add tracked
git -C "$test_home/repo" -c user.name=Test -c user.email=test@example.com -c commit.gpgsign=false commit -q --allow-empty -m initial
cat > "$test_home/check-prompt.sh" <<'PROMPT_TEST'
check_prompt() {
  local rendered
  if [[ -n "${ZSH_VERSION:-}" ]]; then
    rendered=$(print -rP -- "$PROMPT")
  else
    # Bash 3.2 has no ${parameter@P}; its PS1 expansion is checked separately.
    rendered="$PS1 $MACHINE_PROMPT_PATH$MACHINE_PROMPT_BRANCH"
  fi
  [[ "$rendered" == *"$1"* ]] || { printf 'Missing prompt text: %s\nActual: %s\n' "$1" "$rendered" >&2; exit 40; }
}
cd "$HOME/repo" || exit 41
git checkout -q main
true
"$prompt_hook"
check_prompt ' main'
check_prompt "$prompt_default"
false
"$prompt_hook"
check_prompt '[1] ❯ '
(exit 130)
"$prompt_hook"
check_prompt '[130] ❯ '
true
"$prompt_hook"
check_prompt "$prompt_default"
# Untracked, staged, modified and deleted files all mark the branch dirty.
printf 'new\n' > new-file
"$prompt_hook"
check_prompt ' main*'
git add new-file
"$prompt_hook"
check_prompt ' main*'
git reset -q -- new-file
rm new-file
printf 'changed\n' >> tracked
"$prompt_hook"
check_prompt ' main*'
git checkout -- tracked
rm tracked
"$prompt_hook"
check_prompt ' main*'
git checkout -- tracked
"$prompt_hook"
[[ "$(machine_prompt_branch)" == ' main' ]] || exit 51
printf 'ignored\n' > .git/info/exclude
touch ignored
"$prompt_hook"
[[ "$(machine_prompt_branch)" == ' main' ]] || exit 52
rm ignored
# Prompt metacharacters in a branch name must remain literal.
git checkout -q -B 'topic%F{red}$branch'
"$prompt_hook"
check_prompt ' topic%F{red}$branch'
git checkout -q --detach
"$prompt_hook"
check_prompt " $(git rev-parse --short HEAD)"
cd "$HOME/plain" || exit 43
"$prompt_hook"
if [[ -n "${ZSH_VERSION:-}" ]]; then
  [[ -z "${psvar[1]}" ]] || exit 44
else
  [[ -z "$MACHINE_PROMPT_BRANCH" ]] || exit 44
fi
SSH_CONNECTION='127.0.0.1 1000 127.0.0.1 22'
"$prompt_hook"
check_prompt "$prompt_ssh"
unset SSH_CONNECTION
"$prompt_hook"
if [[ -n "${ZSH_VERSION:-}" ]]; then
  [[ "$PROMPT" != *'%n@%m'* ]] || exit 45
else
  [[ "$PS1" != *'\u@\h'* ]] || exit 45
fi
# Keep short paths intact and shorten only paths beyond two directories.
cd "$HOME" || exit 46
"$prompt_hook"
check_prompt '~'
mkdir -p "$HOME/one/space dir/three"
cd "$HOME/one/space dir" || exit 47
"$prompt_hook"
check_prompt '~/one/space dir'
cd three || exit 48
"$prompt_hook"
check_prompt '…/space dir/three'
cd / || exit 49
[[ "$(machine_prompt_path)" == / ]] || exit 50
PROMPT_TEST

env -i \
  HOME="$test_home" \
  USER=test \
  LOGNAME=test \
  SHELL=/bin/zsh \
  LC_ALL=C.UTF-8 \
  TERM=xterm-256color \
  PATH=/usr/bin:/bin:/usr/sbin:/sbin \
  zsh -dfi -c '
    source "$HOME/.config/shell/zsh.sh"
    source "$HOME/.config/shell/zsh.sh"
    (( $+functions[_main_complete] )) || exit 10
    zmodload -e zsh/complist || exit 11
    (( ${_comp_options[(Ie)globdots]} )) || exit 12
    [[ "$(bindkey "^I")" == *fzf-tab-complete* ]] || exit 13
    zstyle -s ":fzf-tab:*" fzf-flags fzf_tab_flags || exit 14
    [[ "$fzf_tab_flags" == "--info=hidden" ]] || exit 15
    [[ "$FZF_DEFAULT_OPTS" == *"pointer:#c48dff"* ]] || exit 16
    [[ "$FZF_DEFAULT_COMMAND" == *"--exclude node_modules"* ]] || exit 17
    [[ "$FZF_CTRL_T_OPTS" == *"bat --color=always"* ]] || exit 18
    [[ "$_ZO_DOCTOR" == 0 ]] || exit 23
    [[ "${ZSH_HIGHLIGHT_STYLES[unknown-token]}" == "fg=white" ]] || exit 19
    [[ "${ZSH_HIGHLIGHT_STYLES[command]}" == "fg=green" ]] || exit 20
    [[ "${MACHINE_TEST_SYNTAX_HIGHLIGHTING:-}" == 1 ]] || exit 21
    typeset -A seen
    for path_entry in $path; do
      (( seen[$path_entry]++ ))
      (( seen[$path_entry] == 1 )) || exit 22
    done
    [[ ${(M)#precmd_functions:#machine_prompt_zsh} == 1 ]] || exit 24
    prompt_hook=machine_prompt_zsh
    prompt_default=$'\''\e[39m ❯ '\''
    prompt_ssh="$(id -un)@"
    source "$HOME/check-prompt.sh"
  ' </dev/null

env -i \
  HOME="$test_home" \
  USER=test \
  LOGNAME=test \
  SHELL=/bin/bash \
  LC_ALL=C.UTF-8 \
  TERM=xterm-256color \
  PATH=/usr/bin:/bin:/usr/bin:/usr/sbin:/sbin \
  bash --noprofile --norc -i -c '
    PROMPT_COMMAND="MACHINE_TEST_EXISTING_HOOK=1"
    source "$HOME/.config/shell/bash.sh"
    source "$HOME/.config/shell/bash.sh"
    [[ -z "${MACHINE_TEST_STARSHIP:-}" && "$PS1" == *❯* ]] || exit 30
    [[ "${MACHINE_TEST_FZF:-}" == 1 ]] || exit 31
    [[ "${MACHINE_TEST_ZOXIDE:-}" == 1 ]] || exit 32
    [[ "$FZF_DEFAULT_COMMAND" == *"--exclude node_modules"* ]] || exit 33
    deduplicated_path=":"
    IFS=: read -ra path_entries <<< "$PATH"
    for path_entry in "${path_entries[@]}"; do
      case "$deduplicated_path" in
        *":$path_entry:"*) exit 34 ;;
        *) deduplicated_path="$deduplicated_path$path_entry:" ;;
      esac
    done
    [[ "$PROMPT_COMMAND" == "machine_prompt_bash; MACHINE_TEST_EXISTING_HOOK=1" ]] || exit 35
    eval "$PROMPT_COMMAND"
    [[ "$MACHINE_TEST_EXISTING_HOOK" == 1 ]] || exit 36
    prompt_hook=machine_prompt_bash
    prompt_default="\[\e[0m\] ❯ "
    prompt_ssh="\u@\h"
    source "$HOME/check-prompt.sh"
  ' </dev/null

printf 'shell-startup.test: passed\n'
