## Repository structure

- Use mise as the public interface: `mise bootstrap`, `[dotfiles]`, `[doctor.checks]`, and tasks in `mise.toml`.
- `mise/` is the global mise config dir (`~/.config/mise` links to it). Keep CLI tools for every machine in `mise/conf.d/core.toml`; tag Mac-only tools with `os = "macos"`.
- Keep platform packages and settings in `mise.macos.toml` and `mise.linux.toml` (Linux = agent VMs).
- Prefer built-in mise features over custom code; keep any remaining automation as small shell tasks in `tasks/`.

## Change safety

- Preserve unrelated working-tree files and hunks.
- Do not create, restart, resize, or remove a real machine without explicit authorization.
- Do not push changes without explicit authorization.

## Validation

- Run `mise run dotfiles:check` before committing; the repo pre-push hook runs it too.
- Run `mise doctor project` to check machine health.
- Use `mise upgrade <tool>` for a single managed tool within its declared version range, or `mise -C ~ upgrade` for all tools.
