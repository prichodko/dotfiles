---
name: tanstack-start
description: Implement or debug TanStack Start server functions, middleware, SSR, hydration, and deployment integration. Inspect the installed version and build configuration before choosing APIs.
---

## Establish the contract

Inspect package.json, the lockfile, installed types, build configuration, router setup, and server entrypoints. Read the relevant [official Start documentation](https://tanstack.com/start/latest/docs/framework/react/overview) before selecting unfamiliar APIs. Use documentation and examples compatible with the installed version.

Determine the actual build tool and deployment adapter from the project. Do not assume a release status, Vinxi, Nitro, or a deployment preset from an old example. An implementation request does not automatically authorize dependency upgrades, scaffolding over an existing project, or deployment.

## Focus the work

Trace the request across its route, server function or handler, middleware, and response. Keep server-only code and secrets out of client bundles. Validate untrusted server input and enforce authorization on the server.

Use the project's conventions for request methods, serialized results, error handling, and redirects. Preserve request ownership and the intended SSR and hydration behavior.

Use the [Router skill](../tanstack-router/SKILL.md) for route ownership and loading. Use the [Query skill](../tanstack-query/SKILL.md) only when the project uses it for server-state caching. Load the relevant guidance instead of duplicating its examples here.

## Find the relevant reference

| Task | Documentation topics or symbols |
| --- | --- |
| Project configuration | Build from Scratch, Client Entry Point, Server Entry Point |
| Server calls | Server Functions, Input Validation |
| Request handling | Server Routes, Middleware |
| Rendering | SSR, Streaming, Hydration |
| Access control | Authentication, server-side authorization |
| Deployment | Hosting, the project's configured provider or adapter |

## Verify

Check the affected server response and client interaction. Verify direct requests and hydration when rendering changes. Run the relevant build and tests. Use a deployment check only when it is within the authorized task, and report local verification separately from deployed verification.
