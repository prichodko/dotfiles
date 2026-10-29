---
name: trails
description: Open, track, ready, and merge work as Entire trails. Use after finishing and verifying a code change in an Entire-enabled repository, when the user invokes `$trails` or `/trails`, or when work involves a trail's findings, gates, readiness, or merge.
---

# Entire trails

This skill holds workflow rules only. For command syntax, read `entire agent-help trail <command>` and the Entire MCP tool schemas; they describe the installed version and take precedence over memory.

## Rules

- Refer to work by the full trail URL that `entire trail show` prints. Say "trail", not "PR" or "Change". The backing PR exists only so GitHub CI runs; never name or link it.
- Never run `gh pr create` or `gh pr merge`. Linking a branch to a trail makes Entire open its PR.
- Merge a change only after the user says so in this conversation. Never bypass a gate unless the user asks for that specific bypass.
- Keep one trail per connected effort: link each phase of one feature, migration, or refactor to an umbrella trail. Give independent fixes their own trails, even when they share a theme.
- Do not call a change ready or done while it has open findings of any severity.

## Open work as a trail

Invoking this skill, or the standing instruction to open finished and verified work as a trail, authorizes committing the related changes, pushing, and creating or linking the trail. Skip it when the user said to keep the work uncommitted or unpushed.

1. Get the branch with `git symbolic-ref --quiet --short HEAD`. On a detached HEAD or the default branch, create a branch from the work's title with `git switch -c <branch>`. `entire trail create` does not change the local checkout.
2. Run `entire trail show`. If the branch already belongs to a trail, reuse it and skip to step 5.
3. Stage only the files and hunks that belong to this work; never use `git add -A`. Review the staged diff, then commit. Ask the user when related and unrelated changes cannot be separated safely.
4. Run `entire trail create --title <title> --body <body>`; it publishes the branch. For a phase of a connected effort, run `entire trail link <P>` to its umbrella trail instead. Pass type, priority, or assignees only when the user gives them. If linking fails after the trail was created, retry with `entire trail link`, never a second `create`.
5. Report the trail URL.

Later commits for the same task go to the same trail without invoking this skill again.

## Track and ready

- Use the Entire MCP for state: `get_trail_status` for gates, findings, and blockers (it also subscribes to trail events), `get_change` as a merge preflight, and `list_findings` for finding details.
- Ready means CI and Entire Gates pass, there are no conflicts, and `list_findings` with `status: open` and `freshness: any` returns nothing.
- Resolve a finding with `settle_findings` only after fixing it, with a reason. Dismiss one only when the user agrees.

## Merge

On the user's go-ahead, preflight with `get_change`, then merge with `merge_change`. When the user asks to merge once it turns green, use `merge_when_ready`. Confirm the result in the change status, not the project trail status.

## Known gaps

Read [references/known-gaps.md](references/known-gaps.md) before setting a change title, ready-for-review, or body, or when trail state looks wrong.
