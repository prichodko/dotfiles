---
name: tanstack-router
description: Implement or debug TanStack Router routes, search parameters, loaders, navigation, and route states. Match the installed version and the project's routing conventions.
---

## Establish the contract

Inspect package.json, the lockfile, installed types, route configuration, and generator settings. Use the project's installed router version. Read the relevant [official Router documentation](https://tanstack.com/router/latest/docs/overview) before choosing unfamiliar APIs. Do not convert the routing strategy or upgrade dependencies unless requested or necessary for the authorized change.

Read only documentation for the affected feature. Use the documentation navigation or search for the actual symbol.

## Focus the work

Find the route that owns the interaction and its parent layout. Preserve route identity, generated-file ownership, search parameter conventions, and loader dependencies. Edit source routes instead of generated route trees.

Validate untrusted route and search input at the appropriate boundary. Inspect existing authentication checks, redirects, error handling, and not-found behavior. A client route guard does not replace server authorization.

When the project uses TanStack Query, keep one clear owner for cached server data. Preserve the existing integration between loaders, query options, preloading, and hydration.

Keep relevant loading, empty, error, blocked, and ready layouts stable. Apply React and composition guidance when the change affects component state or interfaces.

## Find the relevant reference

| Task | Documentation topics or symbols |
| --- | --- |
| Route structure or generation | Routing Concepts, File-Based Routing, Code-Based Routing |
| Search and path input | Search Params, Path Params, validateSearch |
| Loading and cache integration | Data Loading, External Data Loading, loaderDeps |
| Authentication | Authenticated Routes, beforeLoad, redirect |
| Navigation | Navigation, Navigation Blocking, useNavigate |
| Failure states | Not Found Errors, pendingComponent, errorComponent |

## Verify

Verify the relevant direct URL, client navigation, and browser history behavior. For async changes, check interruption and stale completion. Run the project's generator and affected checks when route definitions change. Do not broaden testing to unrelated routes without evidence.
