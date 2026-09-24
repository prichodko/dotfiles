---
name: figma
description: Explicit-only router for workflows provided by the installed Figma plugin. Use only when the user invokes `$figma`; load only the relevant upstream Figma skill for the requested operation.
---

# Figma

Route an explicitly requested Figma task to the current installed
`figma@openai-curated` plugin without exposing every bundled skill in the initial
model context.

## Resolve the plugin

Run `codex plugin list` and locate the enabled `figma@openai-curated` entry. Use
its reported path as the plugin root. If it is missing or disabled, report that
the Figma plugin is unavailable instead of guessing a cached version path.

## Load the relevant workflow

Choose the smallest applicable workflow and read its `SKILL.md` completely
before calling a Figma tool:

- Implement a Figma design in code: `skills/figma-design-to-code/SKILL.md`
- Generate a diagram in FigJam: `skills/figma-generate-diagram/SKILL.md`
- Perform Figma writes or programmatic reads: `skills/figma-use/SKILL.md`

For a different explicitly requested Figma workflow, inspect the names and
frontmatter descriptions under `skills/*/SKILL.md`, choose the closest match,
and then read only that selected skill completely. Load multiple workflows only
when the task genuinely spans them.

Follow the selected upstream instructions, including all prerequisites and tool
ordering. Do not edit the installed plugin or its cache.
