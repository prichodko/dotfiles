- In all interactions and commit messages, be extremely concise and sacrifice grammar for concision.

## Philosophy

This codebase will outlive you. Every shortcut becomes someone else's burden. Every hack compounds into technical debt that slows the whole team down.

You are not just writing code. You are shaping the future of this project. The patterns you establish will be copied. The corners you cut will be cut again.

Fight entropy. Leave the codebase better than you found it.

## GitHub Repo Defaults

When creating repos with `gh repo create`, use:
```bash
gh repo create <name> --private --disable-issues --disable-wiki
gh repo edit --enable-projects=false  # not available in create command
```

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