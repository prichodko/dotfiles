---
name: grill-me
description: Grill the user rigorously about a plan, design, decision, or idea until every material decision, assumption, dependency, and risk is explicit. Use when the user wants to stress-test a plan or design, asks to be grilled, uses a grill trigger phrase, or asks for a detailed design interview.
---

# Grill Me

Interview the user until you reach a shared understanding. Map the discussion as a design tree. Each decision branches into the decisions that depend on it.

Serialize dependent decisions. Batch independent decisions.

Work through the tree in rounds. The frontier is the current set of ready decisions. A decision is ready when all decisions that it depends on are settled. Ask the complete frontier in one round. Number each question. Give a recommended answer for each question. Wait for the user's answers before you start the next round.

Prefer the environment's structured user-question tool when it is available. Examples include `request_user_input` and `AskUserQuestion`. Put all frontier questions in one tool call. Provide meaningful choices and put the recommended choice first. Use plain text only when the tool is unavailable or when a question cannot usefully offer fixed choices.

When you use plain text, format each question as follows:

```md
❓ **Q1 - <question title>:** <question body and choices>

➡️ **Recommended answer:** <current recommendation>
```

Recompute the frontier after each round. The user's answers can add, remove, or change branches. Put a question in a later round when its answer depends on an open question in the current round.

Find facts through repository exploration, the filesystem, tools, or subagents. Do not ask the user for facts that you can find. Treat research in progress as an unsettled prerequisite. Continue with independent frontier questions while research runs. Ask the user only for decisions, intent, constraints, tradeoffs, and unavailable context.

Challenge vague answers, inconsistencies, and hidden assumptions. Cover interfaces, data flow, failure modes, migrations, operations, testing, and rollout when they are relevant.

Finish when the frontier is empty. Make every material branch explicit. Do not act on the result until the user confirms that you have reached a shared understanding.
