## Repository structure

- Use mise as the public interface for bootstrap, machine, and dotfiles tasks.
- Keep shared core tools in `mise/conf.d/core.toml`.
- Keep optional full-profile tools and packages in `mise.full.toml`.
- Keep platform-specific settings in `mise.macos.toml` and `mise.linux.toml`.
- Keep reusable automation in TypeScript.
- Keep Shell code only for tasks that must run before Bun is available.

## Change safety

- Preserve unrelated working-tree files and hunks.
- Do not create, restart, resize, or remove a real machine without explicit authorization.
- Do not push changes without explicit authorization.

## Validation

- Run focused tests for each changed module.
- Run `mise run dotfiles:check` before publishing dotfiles changes.
- Use `mise upgrade <tool>` for a single managed tool within its declared version range. Use `mise run machine:upgrade` (or `mise run machine:upgrade -- full`) for a coordinated all-tools upgrade with validation and local profile application.
