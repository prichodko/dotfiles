export const buildRemoteUpdateCommand = (updateCommand: string, applyCommand: string): string =>
  [
    'cd "$HOME/.dotfiles" || exit $?',
    "if [ -f tasks/dotfiles/update.ts ]; then",
    `  ${updateCommand}`,
    "else",
    "  previous_revision=$(git rev-parse HEAD) || exit $?",
    "  update_status=0",
    `  ${updateCommand} || update_status=$?`,
    "  current_revision=$(git rev-parse HEAD) || exit $?",
    '  if [ "$previous_revision" != "$current_revision" ] && [ -f tasks/dotfiles/update.ts ]; then',
    `    ${applyCommand}`,
    "  else",
    '    exit "$update_status"',
    "  fi",
    "fi",
  ].join("\n")
