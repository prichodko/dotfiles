---
name: grill-me
description: Grill the user rigorously about a plan, design, decision, or idea until every material decision, assumption, dependency, and risk is explicit. Use when the user wants to stress-test a plan or design, asks to be grilled, uses a grill trigger phrase, or asks for a detailed design interview.
---

# Grill Me

Interview the user until you reach a shared understanding. Map the discussion as a design tree. Each decision branches into the decisions that depend on it.

Serialize dependent decisions. Batch independent decisions.

Work through the tree in rounds. The frontier is the current set of ready decisions. A decision is ready when all decisions that it depends on are settled. Batch independent ready decisions within the question tool's limit and the user's capacity to answer. Number each question. Give a recommended answer for each question. Keep remaining ready decisions for a later batch. Wait for answers before asking questions that depend on them.

Prefer the environment's structured user-question tool when it is available. Respect its supported question types and limits. Provide meaningful choices and put the recommended choice first. Use plain text when the tool is unavailable or cannot represent the question.

When you use plain text, format each question as follows:

```md
❓ **Q1 - <question title>:** <question body and choices>

➡️ **Recommended answer:** <current recommendation>
```

Recompute the frontier after each round. The user's answers can add, remove, or change branches. Put a question in a later round when its answer depends on an open question in the current round.

Find facts through repository exploration, the filesystem, tools, or permitted subagents. Do not ask the user for facts that you can find. Treat research in progress as an unsettled prerequisite. Continue with independent frontier questions while research runs. Ask the user only for decisions, intent, constraints, tradeoffs, and unavailable context.

Challenge vague answers, inconsistencies, and hidden assumptions. Cover interfaces, data flow, failure modes, migrations, operations, testing, and rollout when they are relevant.

Finish when no material decisions remain open. Summarize the agreed result. Keep the interview separate from implementation. A later explicit request to implement the result provides authorization without another confirmation of shared understanding.
