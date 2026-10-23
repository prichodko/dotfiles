## Communication

Use the language requested by the user. Write concise, direct sentences with correct grammar and consistent technical terms. Preserve the wording and language of quoted source text.

## Code

Keep changes maintainable and within the requested scope. Treat code-style preferences as defaults, subject to framework requirements and established project conventions.

Prefer direct source imports, named exports, early returns, async/await, and composition. Colocate tests and styles with the relevant code. Use descriptive names and comments that explain non-obvious decisions or constraints.

Use types to prevent invalid internal states. Validate untrusted values at the boundary that owns them, then pass typed values inward. Avoid repeating checks already guaranteed by validation or construction. Fail early on broken programmer invariants. Represent expected user and network failures as explicit states.

Extract helpers when they name a meaningful concept, isolate a complex boundary, or support reuse. Keep simple expressions inline.

Keep defensive complexity proportional to an evidenced failure mode. Before adding safeguards, identify what can fail, why it is plausible in this system, and what complexity the safeguard introduces.

Avoid expanding scope for hypothetical robustness. If a proposed safeguard materially expands the task, explain the tradeoff and get user approval before implementing it. Handle established correctness and security requirements within the authorized scope without requesting approval again.

## UI design and state

- Make state transitions feel like the same object changing—not one layout replacing another. Preserve geometry while content, tone, and affordances update in place.
- Design loading, empty, error, blocked, ready, and terminal states explicitly. Reuse the component structure across state variants.
- Keep actions fixed in position and size while busy or disabled. Show loading progress without layout shifts.
- Use color consistently for status. Prefer compact inline controls for contextual choices.
- Choose theme tokens by semantic purpose. When a required role is missing, extend the theme using project conventions rather than borrowing an unrelated token for its appearance.
- Write copy from the user's perspective: explain the current state and next action. Give titles and descriptions distinct information.
- Define valid states, transitions, and invariants before implementation. Represent only valid state combinations and expose only valid actions.
- Place state in the narrowest component that owns the interaction and its effects. Apply an async result only while it still belongs to the current interaction.
- Apply relevant framework and composition skills before choosing the component API.

## Verification

Test the changed behavior and relevant failure paths. For interaction changes, cover affected transitions, interruptions, repeated actions, and out-of-order async completion.

Test the real implementation and observable behavior. Mock external boundaries when needed; do not reproduce implementation logic in tests.

Complete required repository checks. Broaden or repeat checks only after a new change, failure, or unresolved concern.

## Trails

After finishing and verifying a code-change task in an Entire-enabled repository, create a trail for it with the `trail-create` skill without waiting to be asked. Skip this when the user said to keep the work uncommitted or unpushed, or when the branch already has a trail.

## Browser control

When controlling Chrome, enumerate all connected profiles and their tabs before acting. Choose only when the explicit profile name and exact URL or title identify one tab. Never fall back to the default profile when multiple profiles are connected; ask when ambiguous.

## Tools

Use `rg` first for known strings, symbols, and call sites. Use `ast-grep outline` when supported to orient in unfamiliar files, and `ast-grep run --pattern` for syntax-aware searches. Use available equivalents when these tools are missing.

For media processing, prefer available local, deterministic tools: `svgo` for SVG optimization, `oxipng` for lossless PNG optimization, `sharp` for raster transformations, and `ffmpeg` for audio and video.
