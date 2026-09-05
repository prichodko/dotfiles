---
name: tanstack-query
description: Implement or debug TanStack Query in React projects, including query keys, caching, mutations, optimistic updates, hydration, and tests. Use the project's installed version and existing data ownership.
---

## Establish the contract

Inspect package.json, the lockfile, installed types, and existing QueryClient setup. Match the installed TanStack Query and React versions. Read the relevant current [official Query documentation](https://tanstack.com/query/latest/docs/framework/react/overview) before choosing unfamiliar APIs. Select documentation for the installed major version. Do not upgrade dependencies or replace the project's data layer unless the task requires it.

Read only the topics needed for the change. Use documentation navigation or search for the actual symbol. Do not load the full manual.

## Focus the work

Identify who owns the data, query keys, cache lifetime, and mutation result. Preserve the project's query-option factories and key conventions. Include inputs that distinguish cached results in the query key.

For mutations, choose targeted invalidation, direct cache updates, or both from the server response and affected queries. Do not invalidate every query by default. For optimistic changes, account for cancellation, rollback, overlapping mutations, and later server results.

Inspect server rendering and hydration ownership when changing QueryClient creation or data preloading. Preserve explicit pending, error, empty, and ready states. Apply the relevant React and composition guidance when changing the component API.

## Find the relevant reference

| Task | Documentation topics or symbols |
| --- | --- |
| Shared query setup | Query Keys, Query Options, queryOptions |
| Data lifetime or extra requests | Important Defaults, staleTime, gcTime, Query Invalidation |
| Mutations or optimistic state | Mutations, Optimistic Updates, Updates from Mutation Responses |
| Pagination | Paginated Queries, Infinite Queries, placeholderData |
| Server rendering | Server Rendering and Hydration, Advanced Server Rendering |
| Tests | Testing, QueryClientProvider, retry |

## Verify

Test the changed observable behavior and relevant async failure paths. Use isolated query clients for independent tests. Configure retries to match the tested behavior. Complete required repository checks and stop when the relevant concerns are resolved.
