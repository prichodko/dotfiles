---
name: trail-findings
description: Read and summarize all findings for the Entire trail associated with the current Git branch. Use only when the user explicitly invokes `$trail-findings` in Codex or `/trail-findings` in Claude.
---

# Read Entire trail findings

Read all findings for the current branch's trail. Keep this workflow read-only.

1. Confirm that `entire` is available and the current directory is in a Git repository.
2. Detect the current branch with `git symbolic-ref --quiet --short HEAD`. Stop if HEAD is detached.
3. Run `entire agent-help trail show --json` and `entire agent-help trail finding --json`. Use the live schemas as authoritative. Keep successful schema discovery internal. Report it only when it blocks the workflow.
4. Run `entire trail show --json` without a selector. If the current branch has no trail, report the exact error and stop. Do not select a recent trail automatically.
5. Run `entire trail finding --status any --freshness any --include-dismissed --limit 100 --offset 0 --json` without a trail selector.
6. If `has_more` is true, repeat the command with the offset increased by the number of findings already received. Continue until `has_more` is false. Stop and report the exact error if any page fails.
7. Summarize the trail number, title, branch, and status. Include the returned finding counts.
8. List every finding in the CLI order. Include its ID, severity, status, freshness, body, file path and line when available, and status reason when present. Do not omit a finding because its title or location is absent.
9. Show an explicit no-findings state when the result is empty.

Do not add, update, apply, resolve, dismiss, or reopen findings. Do not inspect the code or recommend fixes unless the user asks for analysis.
