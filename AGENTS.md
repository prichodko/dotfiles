## Repository structure

- Use mise as the public interface for bootstrap, health checks, and dotfiles tasks.
- Keep CLI tools for every machine in `mise/conf.d/core.toml`; tag Mac-only tools with `os = "macos"`.
- Keep platform packages and settings in `mise.macos.toml` and `mise.linux.toml` (Linux = agent VMs).
- Prefer built-in mise features over custom code.
- Keep Shell code only for tasks that must run before Bun is available.

## Change safety

- Preserve unrelated working-tree files and hunks.
- Do not create, restart, resize, or remove a real machine without explicit authorization.
- Do not push changes without explicit authorization.

## Validation

- Run focused tests for each changed module.
- Run `mise run dotfiles:check` before publishing dotfiles changes.
- Use `mise upgrade <tool>` for a single managed tool within its declared version range, or `mise -C ~ upgrade` for all tools.
