# Managed skill rules

Apply these rules when using the named skill families. Follow the user's task and existing authorization. Respect platform safety rules and tool contracts. Use these rules to resolve workflow conflicts in managed packages.

## Cloudflare

For `sandbox-sdk`, inspect the project's dependencies and package manager before installation. Treat install commands as setup instructions. Install a dependency only when the authorized task needs it. Reuse authorization already given for that work.

For `workers-best-practices`, implement and review against the project's installed versions, generated types, and configuration. Use current documentation to check behavior and identify upgrade options. A request to fix existing code does not itself request an upgrade.

For `web-perf`, inspect the available tool definitions before making browser calls. Select the requested browser, profile, and target before navigation or tracing. Do not use navigation or trace recording only to probe tool availability. If the preferred tool is unavailable, use a permitted alternative that can meet the request. Report any measurement limits.

## Figma

Respect the current skill enablement settings. Do not load a disabled sibling skill only because an enabled skill links to it. Use enabled capabilities and their tool documentation when they can complete the task. If a disabled dependency is essential, explain the missing capability and identify its rule. Do not silently enable it.

Use FigJam for a diagram when the user requests that output or when it fits the requested deliverable. A generic request for a diagram does not itself require FigJam. Preserve required skill loading and validation for any Figma tool you use.

For diagram iterations, infer replacement or comparison from the user's request. Ask only when the intended change remains unclear and affects the result.

## Visualization

For `visualize`, follow the host's communication rules. Give required skill notices and useful progress updates. A skill instruction to make the final response the first message does not suppress them.

## Documents and visual artifacts

For document, presentation, spreadsheet, and PDF work, batch related edits before rendering. Inspect the final artifact. Check for concrete defects such as clipped or overlapping content, missing information, incorrect values, and unreadable text. Preserve the requested content and design.

Repeat rendering or inspection after a relevant edit, a failed check, or an unresolved visual defect. Stop when the requested result and required checks pass. Do not repeat unchanged checks for open-ended polishing. Keep disabled plugins disabled unless the user requests a configuration change.
