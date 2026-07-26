---
name: distill
description: Use when the user asks to run $distill, distill a session, capture end-session memory, save durable principles, create an agent memory note, wrap up a session, or extract reusable operating rules from recent work.
metadata:
  short-description: Capture durable session memory
---

# Distill

Capture durable session memory into global agent memory.

## Output

Create one new file per run:

```txt
~/.agent/memory/sessions/YYYY-MM-DD-<generated-name>.md
```

Always use `$HOME/.agent/memory/`. Do not write session memory into the repo unless the user explicitly asks.

This makes memory global across repos, branches, and worktrees.

## Filename

- Use local current date from `date +%F`.
- Generate `<generated-name>` from the session topic.
- Use short kebab-case, 2-5 words.
- Prefer specific nouns over generic names.
- Examples:
  - `2026-05-06-plan-distill-skill.md`
  - `2026-05-06-debug-auth-redirect.md`
  - `2026-05-06-review-router-cache.md`
- If the file exists, append `-2`, then `-3`, etc.
- Never overwrite an existing session file.

## Abstraction Gate

Before writing, turn session details into reusable principles.

Keep a lesson only if it is likely useful across multiple future sessions. Rewrite specific facts into general rules. Drop facts that only help with the exact prior task. Preserve concrete details only as evidence for a broader rule.

Ask of every candidate:

- Would this change future agent behavior?
- Does it apply beyond one file, bug, command, or feature?
- Can it be stated as a rule or pattern?
- Is the concrete detail evidence, not the lesson itself?

If the answer is no, skip it.

## What To Capture

Capture durable operating memory:

- user preferences or corrections
- repo conventions that generalize
- non-obvious debugging patterns
- tool or workflow gotchas
- decisions likely useful across future sessions
- reusable principles worth treating like global memory

Skip:

- generic summaries
- obvious commands
- temporary task details
- one-off implementation facts
- secrets or private data
- vague advice without future action

## Before Writing

- Inspect existing `~/.agent/memory/sessions/` files when present.
- Link related prior session files if they are clearly relevant.
- Do not merge sessions together; create a new session file for this run.
- Keep the new file concise.
- Prefer principle-level bullets over task-specific bullets.
- If nothing generalizes, write `None` rather than filling sections.

## Session File Template

```md
# YYYY-MM-DD generated-name

## Summary
One concise paragraph.

## Patterns
- Max 3 reusable patterns.

## Rules
- Max 5 operating rules.

## Evidence
- Max 5 short concrete examples that justify the patterns/rules.

## Related Sessions
- Relative links, if any.

## AGENTS.md Candidates
- Exact principle-level proposed text, if any.
```

If a section has nothing useful, write `None`.

## Example Transformations

Specific fact:

```md
Tiptap Code mark has excludes: "_", but toggleCode() is generic toggleMark("code").
```

Better:

```md
Rule: Before patching editor command behavior, write a focused editor-state test that distinguishes schema behavior from rendering behavior.
Evidence: Tiptap mixed inline-code selection exposed this risk.
```

Specific fact:

```md
pscale branch create --seed-data --wait can create a branch even if interrupted.
```

Better:

```md
Rule: Treat infrastructure CLI commands as side-effectful once submitted; verify remote state after interruption before retrying.
Evidence: PlanetScale branch creation may complete after local interruption.
```

## AGENTS.md Promotion

Do not edit `AGENTS.md` automatically.

If a memory should become a durable repo instruction, include exact proposed text under `AGENTS.md Candidates` and ask before editing. Prefer principle-level candidates unless a concrete repo rule is required.

## Style

- Be concise.
- Prefer specific rules over narration.
- Use bullets for scanability.
- Avoid duplicate memory.
- Treat `~/.agent/memory/` as a small wiki, not a transcript archive.
- Put domain/tool names in `Evidence`, not top-level rules, unless the rule is truly tool-specific.
