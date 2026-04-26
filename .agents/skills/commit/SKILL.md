---
name: commit
description: "Review git changes, split into logical commit chunks, suggest concise commit messages, and commit. Use when user asks to commit work or structure commits. If grouping is unclear, use askUserTool to confirm grouping before commit."
---

# Commit

be terse. sacrifice grammar for speed.

## 1. review changes

run:

```bash
git status --short --branch
git diff --name-only
git diff
```

group by intent, not by folder.

## 2. propose chunks + msgs

for each chunk, show:
- files
- why grouped
- commit msg

msg rules:
- short
- imperative
- use repo style if obvious
- if no style, use `type(scope): msg` when helpful

## 3. if unclear, ask

use askUserTool to choose grouping.
- 2-3 options
- recommended first
- short impact text

if askUserTool unavailable, ask plain text question.

## 4. commit by chunk

for each approved chunk:

```bash
git add <files>
git commit -m "<msg>"
```

never mix unrelated changes in same commit.

## 5. final output

report:
- commits made (hash + msg)
- files left uncommitted
