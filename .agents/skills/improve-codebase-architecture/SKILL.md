---
name: improve-codebase-architecture
description: Inspect architectural friction and propose refactors that concentrate related behavior behind a useful interface. Use for architecture reviews, refactoring opportunities, and testability analysis. Implement or update project documentation only when requested.
---

## Scope

Review the requested area and return evidence-based opportunities. A review or design discussion does not authorize code changes or edits to domain documents and architecture decision records. Follow a later request to implement or document a selected decision.

## Explore

Read relevant project documentation and existing decisions. Use CONTEXT.md, CONTEXT-MAP.md, and docs/adr/ when they exist. Their absence does not block review. Follow the project's document format if an update is requested; this skill requires no external domain-model package.

Inspect relevant source and call sites with available search and navigation tools. Use an independent exploration agent only when the environment permits delegation and the work benefits from it. Local exploration is sufficient otherwise.

Look for related behavior spread across files, interfaces that expose implementation details, repeated coordination, and tests that miss the behavior users depend on. Describe concrete friction before recommending a refactor. A small wrapper or a single implementation is not by itself a defect.

Use project terminology and familiar technical terms. Read [LANGUAGE.md](LANGUAGE.md) when the distinction between interface, implementation, and hidden complexity matters. The glossary explains concepts; it does not restrict the user's vocabulary.

## Recommend

For each useful opportunity, identify the files, observed problem, proposed change, and expected effect on maintenance and testing. Include only candidates supported by the code. Do not add refactors to fill a list.

Respect existing architecture decisions. Explain a conflict only when current evidence justifies revisiting it. Recommend a preferred candidate when the evidence supports one. Ask the user to choose only when competing goals materially affect the result.

Use [DEEPENING.md](DEEPENING.md) to assess dependency and test boundaries for a selected refactor. Use [INTERFACE-DESIGN.md](INTERFACE-DESIGN.md) when comparing alternative interfaces would resolve a real tradeoff. Do not load every reference for a routine review.

For an explicitly requested design interview, ask material decisions in dependency order. For an implementation request, carry the selected change through the relevant checks. Create or update domain documents and decision records only within the authorized scope.
