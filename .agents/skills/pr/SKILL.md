---
name: pr
description: "Create, update, and share GitHub pull requests with a consistent workflow and output format. Use when asked to prepare PR title/body, open PRs via gh CLI, choose between candidate PR titles with askUserTool, and finish by returning a `:review: <SUBJECT> – <PR_LINK>` one-liner copied to clipboard."
---

# PR

be terse. sacrifice grammar for speed.

Follow this workflow whenever the user asks to open a PR.

## 1. Confirm Branch And Change Scope

Run:

```bash
git status --short --branch
git log --oneline --decorate -n 8
```

If needed for summary quality, inspect changed files with `git diff --name-only` and targeted diffs.

## 2. Choose PR Title With askUserTool

Generate 2-3 candidate titles.

Use askUserTool to let user pick one:
- Show short options only.
- Put recommended option first.
- Use impact-focused descriptions.

Fallback if askUserTool is unavailable:
- Ask a plain-text question with numbered options.
- Continue with the selected title.

## 3. Draft PR Body

Use the selected concise, imperative title (for example: `feat(frontend): add dynamic OG images for marketing pages`).

Draft body inline (no temp file):

```bash
pr_body="$(cat <<'EOF'
## Why
<why-this-pr-exists>

## Changes
- <change-1>
- <change-2>

## Validation
- <command-or-check-1>
- <command-or-check-2>

## Notes
- <optional-follow-up-or-risk>
EOF
)"
```

Keep body content factual:
- What changed
- Why it changed
- How it was validated
- Follow-ups or risks

Do not add a `## Summary` heading.

## 4. Open Or Update PR With gh

Prefer `gh pr create` for new PRs:

```bash
gh pr create --base main --head <branch> --title "<title>" --body "$pr_body"
```

If a PR already exists, update it:

```bash
gh pr edit <pr-number-or-url> --title "<title>" --body "$pr_body"
```

If the repo has a different default base branch, use that branch instead of `main`.

Backtick safety fix:
- Do not use legacy backtick command substitution.
- Markdown backticks in PR content can break that form.
- Use `$(...)` plus quoted variable (`--body "$pr_body"`).

## 5. Final Output Format

Return exactly one line and nothing else.
- no preamble
- no bullets
- no `Done.`
- no branch/commit/PR recap unless user asked

Format:

```text
:review: <SUBJECT> – <PR_LINK>
```

`<SUBJECT>` rules:
- 2-6 words
- noun phrase only
- no `please`
- no `review`
- no ending punctuation

Example:

```text
:review: API docs route config – https://github.com/entirehq/entire.io/pull/1030
```

## 6. Copy Oneliner To Clipboard

Run:

```bash
review_text="<SUBJECT>"
pr_link="<PR_LINK>"
review_line=":review: ${review_text} – ${pr_link}"
printf '%s\n' "$review_line"

if command -v pbcopy >/dev/null 2>&1; then
  printf '%s' "$review_line" | pbcopy || echo "warning: unable to copy with pbcopy" >&2
fi
```
