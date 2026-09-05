---
name: commit
description: Inspect Git changes and propose logical commit groups, or create commits when the user requests them. Use for commit planning and committing existing work. A proposal request does not authorize commits.
---

## Scope

For a review, message suggestion, or grouping request, return the proposal without changing files, the index, or history. When the user requests commits, use the authorization already given for that scope. Do not add a confirmation step for an obvious grouping. This skill does not authorize pushing.

## Inspect and group

Inspect the branch, staged diff, unstaged diff, and relevant untracked files. Read existing commit subjects to identify the repository's message style. Group changes by purpose. Preserve unrelated files and hunks, including work already staged by the user.

Ask only when the relevance of a change or the requested commit scope cannot be determined from available evidence. Use the environment's question tool when available. Respect its question limit. Use a concise text question otherwise.

For a proposal, explain each group, its files or hunks, and its proposed subject. Choose the number of commits from the work and its dependencies.

## Commit

Create only the requested commits. Stage and commit the relevant files or hunks without including unrelated index entries. Verify the exact content that the commit operation will include. Do not use a whole-index commit when unrelated changes are staged.

Preserve the user's unrelated index state. If relevant and unrelated hunks cannot be separated safely, report the concrete ambiguity before committing. Do not discard work, disable hooks, or change signing configuration to make a commit succeed.

Use a short, imperative subject with correct grammar. Match repository style. After committing, inspect the resulting commit and remaining staged and unstaged changes. Report commit hashes and subjects, plus any remaining work relevant to the request.
