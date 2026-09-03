---
name: browser
description: Select and control the correct browser surface for UI inspection, authenticated interaction, local web testing, Playwright debugging, and test generation. Use when a task requires visible or interactive browser state. Do not use for semantic operations that a dedicated connector, API, or CLI can complete.
---

# Browser

Choose the browser surface before any browser action.

## Select the surface

An explicit user choice is a constraint. Use the requested Browser, Chrome, Edge, or Playwright surface. Do not substitute another surface without approval.

When the user did not select a surface:

1. Use a dedicated connector, API, or CLI for semantic operations on linked resources.
2. Use the Browser plugin for an existing signed-in session, visible interaction, annotation, or desktop browser state.
3. Use Playwright CLI for remote machines, isolated sessions, reproducible local testing, request inspection, mocking, tracing, or video.
4. Use the repository Playwright runner when the result must be an automated test or project fixtures control browser setup.

When the Browser plugin is selected, read and follow its available skill. Treat that skill as authoritative for setup, browser selection, and interaction. Do not copy its internal setup steps into this skill.

Follow the repository `AGENTS.md` rules for Chrome profile and tab selection.

## Playwright ownership

The dotfiles full profile owns `npm:@playwright/cli`. Do not install it globally with npm.

Use a repository-local Playwright dependency when the repository already declares it. Do not add or update a dependency unless the user authorizes that change.

If `playwright-cli` is unavailable outside a repository, report that the full machine profile is required. Do not change the machine profile without authorization.

Read only the reference required for the current operation:

- For the command loop and inspection commands, read [references/playwright/cli.md](references/playwright/cli.md).
- For running or debugging existing tests, read [references/playwright/playwright-tests.md](references/playwright/playwright-tests.md).
- For creating or repairing tests, read [references/playwright/test-generation.md](references/playwright/test-generation.md).
- For named, persistent, attached, or concurrent sessions, read [references/playwright/session-management.md](references/playwright/session-management.md).
- For cookies and application storage in test-created sessions, read [references/playwright/storage-state.md](references/playwright/storage-state.md).
- For request interception, read [references/playwright/request-mocking.md](references/playwright/request-mocking.md).
- For custom Playwright code, read [references/playwright/running-code.md](references/playwright/running-code.md).
- For element metadata, read [references/playwright/element-attributes.md](references/playwright/element-attributes.md).
- For traces, read [references/playwright/tracing.md](references/playwright/tracing.md).
- For recordings, read [references/playwright/video-recording.md](references/playwright/video-recording.md).

## Interaction rules

Capture current page state before using an element reference. Refresh page state after navigation or a substantial update. Do not reuse stale references.

Use role, label, or test ID locators before fragile CSS selectors when stable references are unavailable.

When application behavior is incorrect, inspect console errors and failed requests before changing code.

For UI changes, verify the applicable loading, empty, error, blocked, ready, and completed states. Verify relevant desktop and mobile sizes. Capture screenshots when geometry or appearance is part of the result.

When a project test provides fixtures, routes, storage state, or authentication, enter the browser through that test. Do not open the application separately and bypass project setup.

## Data and process safety

Use isolated, test-created profiles by default. Use a persistent or personal profile only when the user requests it or the selected Browser plugin provides the required signed-in session.

Do not inspect personal cookies, passwords, profiles, or stored browser data. Modify cookies or storage only in a test-created session or when the user explicitly requests that operation.

Close only browser sessions created for the task. Do not use broad process termination when ownership is uncertain.

Browser access does not authorize external writes. Confirm that a submission, purchase, publication, or destructive action is within the user request before execution.

## Report evidence

Report the browser surface, tested URL, relevant viewport sizes, observed console or network failures, and automated test results. Distinguish direct browser verification from source inspection.
