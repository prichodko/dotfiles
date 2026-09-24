---
name: cloudflare
description: Explicit-only router for workflows provided by the installed Cloudflare plugin. Use only when the user invokes `$cloudflare`; load only the relevant upstream Cloudflare skill for the requested operation.
---

# Cloudflare

Route an explicitly requested Cloudflare task to the current installed
`cloudflare@openai-curated` plugin without exposing every bundled skill in the
initial model context.

## Resolve the plugin

Run `codex plugin list` and locate the enabled `cloudflare@openai-curated`
entry. Use its reported path as the plugin root. If it is missing or disabled,
report that the Cloudflare plugin is unavailable instead of guessing a cached
version path.

## Load the relevant workflow

Choose the smallest applicable workflow and read its `SKILL.md` completely
before acting:

- Product selection or broad platform work: `skills/cloudflare/SKILL.md`
- Agents SDK: `skills/agents-sdk/SKILL.md`
- Build an AI agent: `skills/building-ai-agent-on-cloudflare/SKILL.md`
- Build an MCP server: `skills/building-mcp-server-on-cloudflare/SKILL.md`
- Durable Objects: `skills/durable-objects/SKILL.md`
- Sandbox SDK: `skills/sandbox-sdk/SKILL.md`
- Web performance: `skills/web-perf/SKILL.md`
- Workers code and configuration: `skills/workers-best-practices/SKILL.md`
- Wrangler CLI: `skills/wrangler/SKILL.md`

Load multiple workflows only when the task genuinely spans them. Follow the
selected upstream instructions and read any references they require. Do not
edit the installed plugin or its cache.
