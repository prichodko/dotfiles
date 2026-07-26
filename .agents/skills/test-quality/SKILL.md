---
name: test-quality
description: Use when the user explicitly invokes $test-quality to write, review, or improve tests for useful failure signal, assertion quality, test boundaries, coverage use, testability, or flaky-test handling.
---

# test-quality

Write and review tests for signal quality. A useful test validates intention and fails for the right reason.

This skill distills Artem Zakharchenko's Epic Web testing series into a working checklist:

- https://www.epicweb.dev/the-true-purpose-of-testing
- https://www.epicweb.dev/the-golden-rule-of-assertions
- https://www.epicweb.dev/anatomy-of-a-test
- https://www.epicweb.dev/implicit-assertions
- https://www.epicweb.dev/inverse-assertions
- https://www.epicweb.dev/making-use-of-code-coverage
- https://www.epicweb.dev/good-code-testable-code
- https://www.epicweb.dev/what-is-a-test-boundary
- https://www.epicweb.dev/be-smart-about-flaky-tests
- https://www.epicweb.dev/writing-tests-that-fail

## Core Rule

A test is good when it fails only because the tested intention is not met.

Do not value a test because it exists. Value it by the signal it produces when behavior is broken.

## Workflow

Before writing or reviewing a test:

1. Name the tested intention in plain language.
2. Choose the boundary: what is real, what is replaced, and why.
3. Shape the test as setup, action, assertion.
4. Grade each assertion: it should fail when the intention is broken and stay quiet when irrelevant internals change.
5. Prefer stronger observable behavior over implementation detail.
6. Remove redundant assertions when an action or stronger assertion already proves the same thing.
7. Use implicit assertions when the operation itself proves the expectation, such as a thrown error, rejected promise, failed lookup, or successful user interaction.
8. For "did not happen" checks, avoid sleeps. Use an inverse assertion pattern that can prove the absence without false positives.
9. Use coverage as an audit signal for untested paths, not as a target by itself.
10. Treat painful setup as design feedback. Improve boundaries or code shape before contorting public APIs for tests.

## Test Boundaries

Pick the smallest boundary that still proves the user- or system-relevant behavior.

Call out the boundary when proposing tests:

- **Real dependency**: use when behavior depends on integration semantics.
- **Fake/in-memory dependency**: use when local state and deterministic behavior are enough.
- **Mock/spied dependency**: use when the test intention is interaction with an external collaborator.
- **End-to-end boundary**: use when wiring, routing, persistence, or browser/runtime behavior is the point.

Avoid mocking the thing the test claims to prove.

## Assertion Quality

Prefer assertions that describe outcomes:

- visible UI state
- returned value
- persisted state
- emitted event
- external call at the chosen boundary
- thrown/rejected failure

Be suspicious of:

- asserting private calls
- asserting every intermediate step
- asserting setup details
- asserting implementation shape
- adding many weak assertions instead of one strong one

## Flaky Tests

Handle flaky tests with SMART:

- **Skip** only to unblock while keeping the failure visible.
- **Mitigate** immediate disruption without hiding the root problem.
- **Assess** whether the flake is test timing, environment, data, or real product nondeterminism.
- **Rewrite** the test around deterministic signals and correct boundaries.
- **Throw away** tests whose signal is not worth preserving.

Never treat flakiness as normal background noise.

## Output Shape

When writing tests, present:

- tested intention
- chosen boundary
- setup/action/assertion
- what failure proves
- why this assertion is sufficient

When reviewing tests, lead with issues:

- unclear intention
- weak or redundant assertion
- wrong boundary
- implementation coupling
- false-positive inverse assertion
- coverage theater
- flaky timing
- setup complexity revealing poor design

Keep recommendations concise and directly actionable.
