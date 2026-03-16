# Frontend React Query and Prefetch Policy

This document is the canonical guide for shared frontend server-state in `src/frontend`.

Use it alongside:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-logging-and-error-handling.md`
- `docs/developer/frontend/frontend-testing.md`

## 1. Baseline contract

The frontend uses React Query as the shared server-state layer for cache, freshness, and in-flight request deduplication.

Current baseline:

- package: `@tanstack/react-query`
- pinned version: `5.90.21`
- cache scope: in-memory only for the current session
- persistence: intentionally disabled

Do not add a parallel cache layer for shared backend reads.

## 2. Query-key convention

Define shared query keys through `src/frontend/src/query/queryKeys.ts` factory helpers.
Do not scatter ad-hoc array literals through feature code.

Current shared keys:

- `authorisationStatus`
- `classPartials`
- `cohorts`
- `yearGroups`

Keep future invalidation and warm-up work aligned to these helpers.

## 3. Shared query definitions

Shared query definitions belong in dedicated React Query helper modules and must:

- delegate to existing frontend service modules
- keep backend transport access inside `callApi`
- propagate failures without adding duplicate `warn` or `error` logging
- rely on React Query for deduplication and cache reuse

Runtime validation should happen at the service boundary before data is cached.
`classPartials` therefore uses an adjacent Zod schema file in the service layer.
`cohorts` and `yearGroups` continue to reuse their existing validated service contracts.

## 4. Startup warm-up policy

Startup warm-up is intentionally narrow in this phase.

Current policy:

- startup-prefetched dataset: `classPartials` only
- trigger point: after the shared auth query resolves to authorised
- scheduling: fire-and-forget from an app-level boundary outside `App.tsx`
- query API: `fetchQuery`, so orchestration can observe failures
- logging: debug-only orchestration context if warm-up fails

Warm-up must not block initial render, shell paint, or navigation readiness.

## 5. Prefetch decision framework for future features

Future frontend work must choose one policy per feature and record that decision with the feature work:

- startup prefetch
- view-entry prefetch
- on-demand loading

Keep startup prefetch limited to slow, shared datasets where the latency trade-off is justified.
Do not add startup prefetch only to exercise React Query.

## 6. Freshness and invalidation expectations

Active screens should keep stale data visible while a background refresh runs.
The current query-client defaults support that by avoiding eager refetch on focus or reconnect and only refetching on mount when data is stale.

Deferred invalidation notes:

- future cohort mutations should invalidate the `cohorts` query when those screens migrate
- future year-group mutations should invalidate the `yearGroups` query when those screens migrate
- `classPartials` invalidation is deferred until there is a backend-supported notifier or update signal for `ABClass` changes

Do not add speculative invalidation wiring before those feature migrations exist.

## 7. Sensitive data and cache persistence

Frontend cache persistence is intentionally disabled.
Cached data remains in memory only for the current session because the app handles sensitive student-related data and should not persist shared query payloads in browser storage by default.
