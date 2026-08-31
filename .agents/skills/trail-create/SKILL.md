---
name: trail-create
description: Commit relevant current work and create an Entire trail for the current repository. Use only when the user explicitly invokes `$trail-create` in Codex or `/trail-create` in Claude.
---

# Create an Entire trail

Create one trail for the current repository. Treat explicit invocation as authorization to commit the trail-related changes, push the branch, and create the remote trail.

Read [references/entire-trail-cli.md](references/entire-trail-cli.md) before selecting an `entire trail` command or flag. The reference contains the complete API for the captured CLI version. If the installed version differs, run `entire agent-help trail --json` in an Entire-enabled repository and use the live output as authoritative.

Treat version comparison and schema refresh as internal preparation. Do not mention them in progress updates when the refresh succeeds. Report them only when schema retrieval or version incompatibility blocks trail creation.

1. Confirm that `entire` is available and the current directory is in a Git repository.
2. Detect the current branch with `git symbolic-ref --quiet --short HEAD`. Do this before any `entire trail` command.
3. Inspect all tracked, untracked, staged, and unstaged changes. Identify only the files and hunks related to the requested trail. Treat all other changes as unrelated.
4. Derive a concise title, body, and valid unused branch name from the user request and relevant changes. Ask only when the purpose or relevance boundary is unclear.
5. If HEAD is detached, create and check out the local title-derived branch with `git switch -c <branch>`. Do not force, reset, or overwrite an existing branch. Stop if branch creation fails.
6. If relevant uncommitted changes exist on the default branch, create and check out the local title-derived branch before committing. Stop if branch creation fails.
7. Run `entire trail show` only after a branch is checked out.
8. If a trail exists, do not create another trail. Return its canonical URL.
9. If the check fails for any reason other than no trail, report the exact error and stop.
10. Stage only relevant files and hunks. Do not use `git add -A`. Preserve unrelated staged, unstaged, and untracked changes.
11. Review the staged diff before committing. Do not include unrelated changes. If relevant and unrelated changes cannot be separated safely, ask the user before continuing.
12. Commit the relevant changes with a concise message derived from the work. Stop if the commit fails.
13. Before any push, verify that no relevant changes remain uncommitted. Unrelated changes may remain in the worktree or index.
14. Run `entire trail create --title <title> --body <body> --checkout`.
15. Use the CLI defaults for the base branch and status.
16. Pass type, priority, assignees, branch, base, or other options only when the user supplies them explicitly.
17. Return only the canonical trail URL from the successful CLI output. Do not open a browser.
18. If creation fails, report the exact error and stop. Do not repeat the mutation unless the output proves that no trail or branch was created.

After a trail is created or confirmed, validate, commit, and push each later related change. Do not require another `$trail-create` invocation. If the trail is created before the current requested work is complete, ask once before applying this rule to the remaining work. An explicit instruction to keep work uncommitted or not push overrides this rule.
