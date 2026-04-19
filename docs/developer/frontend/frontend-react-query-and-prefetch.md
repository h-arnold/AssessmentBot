# Frontend React Query and Prefetch Policy

This document is the canonical guide for shared frontend server-state in `src/frontend`.

Use it alongside:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-logging-and-error-handling.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md` for initial-load, refresh, degraded-data, and mutation-presentation rules

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
- `backendConfig`
- `classPartials`
- `assignmentDefinitionPartials`
- `cohorts`
- `yearGroups`
- `googleClassrooms`

Keep future invalidation and warm-up work aligned to these helpers.

## 3. Shared query definitions

Shared query definitions belong in dedicated React Query helper modules and must:

- delegate to existing frontend service modules
- keep backend transport access inside `callApi`
- propagate failures without adding duplicate `warn` or `error` logging
- rely on React Query for deduplication and cache reuse

Runtime validation should happen at the service boundary before data is cached.
`classPartials` and `assignmentDefinitionPartials` therefore use adjacent Zod schema files in the service layer.
`backendConfig`, `cohorts`, and `yearGroups` continue to reuse their existing validated service contracts.

## 4. Startup warm-up policy

Startup warm-up uses the shared lookup datasets needed across the growing interface.

Current policy:

- startup-prefetched datasets: `classPartials`, `assignmentDefinitionPartials`, `cohorts`, and `yearGroups`
- trigger point: after the shared auth query resolves to authorised
- ownership: the app-level auth / warm-up boundary owns startup readiness
- scheduling: fire-and-forget from an app-level boundary outside `App.tsx`
- query API: `fetchQuery`, so orchestration can observe failures
- readiness rule: startup is considered warmed only after all four shared datasets succeed
- logging: debug-only orchestration context if warm-up fails

Warm-up must not block initial render, shell paint, or navigation readiness.

`googleClassrooms` remains a view-entry prefetch for the Classes tab rather than a startup-prefetched dataset.
`backendConfig` remains an on-demand shared query owned by the Backend settings panel rather than a startup-prefetched dataset.

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

Current invalidation and required-refresh rules:

- cohort mutations should target the shared `cohorts` query key and refresh active consumers
- year-group mutations should target the shared `yearGroups` query key and refresh active consumers
- backend settings writes should refetch the exact active `backendConfig` query after a successful save so the panel can rebase its local Ant Design form state from fresh query data
- use shared `queryKeys` directly for `backendConfig`, `cohorts`, and `yearGroups`; do not reintroduce feature-local invalidation wrapper helpers for those shared datasets
- `classPartials` refresh remains feature-driven after successful class mutations
- assignment-definition delete and manual refresh flows should target the shared `assignmentDefinitionPartials` query key only
- if a required post-mutation refresh fails for a surface that cannot trust its previously cached data, fail closed for that owned surface until a newer successful payload arrives instead of quietly leaving stale data visible
- if a required post-mutation refresh fails for the Classes table workflow, do not keep stale table data visible; surface user guidance that a page refresh is required to see changes

Do not add speculative invalidation wiring beyond the feature contracts that exist.

## 7. Sensitive data and cache persistence

Frontend cache persistence is intentionally disabled.
Cached data remains in memory only for the current session because the app handles sensitive student-related data and should not persist shared query payloads in browser storage by default.
