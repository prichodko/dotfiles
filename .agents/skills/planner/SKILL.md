---
name: planner
description: Produce an implementation, design, migration, or commit plan when requested. Inspect evidence and ask only for decisions that materially change the plan. Do not select this skill for an implementation request alone.
---

## Scope

Produce the requested plan. Do not edit project files unless the user asks to save the plan. A later request to implement the plan authorizes a change of workflow; this planning boundary does not override that request.

## Preparation

Inspect the relevant code, boundaries, tests, and constraints. Find facts through tools before asking the user. Infer routine details and state material assumptions.

Ask only when an unresolved decision materially changes scope, correctness, dependencies, or the result. Provide a recommendation with each question. Batch independent questions within the tool's limits. Ask dependent questions after their prerequisites are settled. Continue independent preparation while waiting for input.

## Result

Explain the goal, scope, approach, concrete files or owners, dependencies, and verification needed to complete the work. Include risks or open questions only when they affect implementation. Scale the detail to the task.

For a commit plan, choose the number of commits from useful review boundaries and dependencies. Give each commit a subject, purpose, file or hunk scope, and relevant validation. Do not impose a minimum commit count.

Make the plan specific enough to implement without reopening its main decisions. Stop when the requested plan is complete.
