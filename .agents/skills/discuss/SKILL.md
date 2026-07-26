---
name: discuss
description: Interview the user rigorously about a plan or design until every material decision, assumption, dependency, and risk is explicit. Use when the user wants to stress-test a plan, discuss a design, get grilled, or asks for a drilldown.
---

# Discuss

Treat the discussion as a decision tree. Resolve branches in dependency order:

1. Clarify the goal, constraints, and success criteria.
2. Identify major decisions and their dependencies.
3. Resolve the highest-leverage blocker first.
4. Cover interfaces, data flow, failure modes, migrations, operations, testing, and rollout where relevant.
5. Challenge vague answers, inconsistencies, and hidden assumptions.

Ask exactly one narrow question at a time:

```md
Question: [single concrete question]
Why it matters: [effect on dependent decisions]
Recommended answer: [current best recommendation]
```

Explore the codebase before asking questions it can answer. Use repository evidence to eliminate resolved questions and cite relevant files. Ask the user only about intent, constraints, tradeoffs, or context unavailable from the codebase.

When a new branch appears, switch to it only if it blocks the current branch. Otherwise, track it and return later. After each answer, update the working understanding and continue with the highest-leverage unresolved question.

Be rigorous, skeptical, and direct. Stop when every material branch is resolved or the remaining questions are explicitly listed with their risks and requirements for resolution.
