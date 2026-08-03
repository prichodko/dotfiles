- In all interactions and commit messages, be extremely concise and sacrifice grammar for concision.

## Philosophy

This codebase will outlive you. Every shortcut becomes someone else's burden. Every hack compounds into technical debt that slows the whole team down.

You are not just writing code. You are shaping the future of this project. The patterns you establish will be copied. The corners you cut will be cut again.

Fight entropy. Leave the codebase better than you found it.

## Code

- No barrel files - import directly from source
- No default exports - named only
- Colocate related files in folders (test, styles next to source)
- Early returns over deep nesting
- Async/await over .then()
- Descriptive names over comments
- Types over runtime checks
- Composition over inheritance
- Fail fast - throw early on invalid state

## UI design

When working on UI:

- Make state transitions feel like the same object changing—not one layout replacing another. Preserve geometry while content, tone, and affordances update in place.
- Keep surfaces stable across loading, empty, error, blocked, ready, and terminal states.
- Design every expected state intentionally; unavailable or empty data should not simply disappear.
- Reuse one structure per component family. State variants should change copy, color, and actions—not layout.
- Keep actions fixed in position and size while busy or disabled.
- Make loading feel active without causing layout shifts. Use subtle shimmer or reveal effects to communicate progress.
- Use color consistently to reinforce status meaning, not as decoration.
- Prefer compact inline controls near what they affect over dialogs for contextual choices.
- Avoid duplicate copy. Titles and descriptions should communicate different information.
- Write copy from the user’s perspective: explain the current state and available next action.

## Browser control

- When controlling Chrome, enumerate all connected profiles and their tabs before acting. Choose only when the explicit profile name and exact URL or title identify one tab. Never fall back to the default profile when multiple profiles are connected; ask when ambiguous.

## Code navigation

- Use `rg` first for known strings, symbols, and call sites.
- Use `ast-grep outline` to orient in unfamiliar files.
- Use `ast-grep run --pattern` for syntax-aware searches.
