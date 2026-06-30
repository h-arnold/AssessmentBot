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
- `abClass`
- `assignmentDefinitionPartials`
- `assignmentDefinitionByKey`
- `assignmentTopics`
- `cohorts`
- `yearGroups`
- `googleClassrooms`
- `googleClassroomAssignments`

Keep future invalidation and warm-up work aligned to these helpers.

The `assignmentDefinitionByKey` factory creates scoped query keys for full-definition reads by `definitionKey`, used by the assignment-definition wizard modal for update-mode entry.

The `abClass` factory creates scoped query keys for individual class detail reads by `classId`. It is NOT part of the startup warm-up set; use `invalidateQueries({ queryKey: queryKeys.abClass(classId) })` for invalidation. See the `getABClassQueryOptions` shared query definition in `sharedQueries.ts`.

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

- startup-prefetched datasets: `classPartials`, `assignmentDefinitionPartials`, `assignmentTopics`, `cohorts`, and `yearGroups`
- trigger point: after the shared auth query resolves to authorised
- ownership: the app-level auth / warm-up boundary owns startup readiness
- scheduling: fire-and-forget from an app-level boundary outside `App.tsx`
- query API: `fetchQuery`, so orchestration can observe failures
- readiness rule: startup is considered warmed only after all five shared datasets succeed
- logging: debug-only orchestration context if warm-up fails

Warm-up must not block initial render, shell paint, or navigation readiness.

`assignmentTopics` is now part of the startup warm-up surface because the same reference-data set supports the assignment-definition wizard modal workflow. The `yearGroupKey` and `yearGroupLabel` contract is used throughout, with resolved labels provided for display while authoritative keys are persisted.

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
- assignment-definition create (stage-one), final save, and document-change re-parse flows should invalidate both `assignmentDefinitionPartials` and the scoped `assignmentDefinitionByKey` query for the affected definition so the Assignments table and open modal remain trustworthy
- if a required post-mutation refresh fails for a surface that cannot trust its previously cached data, fail closed for that owned surface until a newer successful payload arrives instead of quietly leaving stale data visible
- if a required post-mutation refresh fails for the Classes table workflow, do not keep stale table data visible; surface user guidance that a page refresh is required to see changes

Do not add speculative invalidation wiring beyond the feature contracts that exist.

## 7. Mutation and Invalidation Patterns

### Preferred Pattern: Let Invalidation Trigger Background Refetch

**Preferred Pattern:** Use React Query's `invalidateQueries` to trigger background refetch. Do not call `fetchQuery` explicitly in mutation cleanup or after invalidation.

```typescript
// ✅ CORRECT: Let React Query background refetch handle it
await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionPartials() });
await queryClient.invalidateQueries({
  queryKey: queryKeys.assignmentDefinitionByKey(definitionKey),
});
```

**Rationale:** React Query's invalidation automatically triggers background refetches for active observers. Explicit `fetchQuery` calls are unnecessary and can cause errors to propagate incorrectly.

### Anti-Pattern: Explicit fetchQuery in Mutation Cleanup

**Anti-Pattern:** Calling `fetchQuery` explicitly after invalidation causes errors to propagate to the wrong scope (e.g., modal instead of page).

```typescript
// ❌ AVOID: Explicit fetchQuery causes errors to propagate incorrectly
await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionPartials() });
await queryClient.fetchQuery({ queryKey: queryKeys.assignmentDefinitionPartials() }); // ← Error propagates here
```

**Why this fails:** When `fetchQuery` fails, the error is thrown at the call site. In modal contexts, this causes the modal's error handler to catch it instead of the page-level query error handler. Let React Query's automatic background refetch handle cache updates.

### Cache Check Anti-Pattern: Create Mode

**Anti-Pattern:** Query for `assignmentDefinitionByKey` is disabled in create mode — never check it for cached data.

```typescript
// ❌ AVOID: Query is disabled in create mode, cache is never populated
const cached = queryClient.getQueryData(queryKeys.assignmentDefinitionByKey(localDefinitionKey));
// In create mode, this will always be undefined
```

**Context:** In `AssignmentDefinitionWizardModal.tsx`, the `useQuery` for `getAssignmentDefinitionQueryOptions(definitionKey ?? '')` has `enabled: open && !isCreateMode && definitionKey !== null`. In create mode, this query never runs and never populates the cache.

**Correct Approach:** In create mode, always use the parsed baseline reference instead of checking query cache:

```typescript
// ✅ CORRECT: In create mode, use parse baseline reference
if (!isCreateMode && localDefinitionKey) {
  // Only check cache in update mode
  const cached = queryClient.getQueryData(queryKeys.assignmentDefinitionByKey(localDefinitionKey));
  if (cached) {
    return buildBaselineFromCached(cached);
  }
}
// In create mode: always use parse baseline reference
return parsedCreateBaselineReference.current;
```

## 8. Data Contract Patterns

### Preferred Pattern: yearGroupKey/yearGroupLabel Pair

**Preferred Pattern:** Use `yearGroupKey` (string) and `yearGroupLabel` (string) pair, not numeric `yearGroup`.

```typescript
// ✅ CORRECT: Use yearGroupKey/yearGroupLabel pair
interface AssignmentDefinitionPartial {
  yearGroupKey: string; // Authoritative key for persistence
  yearGroupLabel: string; // Resolved display label
  // ... other fields
}
```

**Rationale:** Assignment definitions should store the selected year-group reference-data key rather than the numeric `yearGroup` value. This ensures:

- Consistent reference to authoritative year-group records
- Display labels can be resolved from cached reference-data datasets
- Persisted records store keys, not display values that may change

## 9. Sensitive data and cache persistence

Frontend cache persistence is intentionally disabled.
Cached data remains in memory only for the current session because the app handles sensitive student-related data and should not persist shared query payloads in browser storage by default.

### Disabled query pattern: use `skipToken`

When a `useQuery` call is intentionally disabled (for example `enabled: false`) and the query
should never execute, use `skipToken` from `@tanstack/react-query` as the `queryFn` value
instead of providing a dummy async function that returns an empty value.

```typescript
import { skipToken, useQuery } from '@tanstack/react-query';

// ✅ Correct — idiomatic, intent is clear, never executes
const { data } = useQuery({
  queryKey: queryKeys.assignmentDefinitionPartials(),
  queryFn: skipToken,
});

// ❌ Wrong — dummy queryFn is unnecessary and misleading
const { data } = useQuery({
  queryKey: queryKeys.assignmentDefinitionPartials(),
  queryFn: () => Promise.resolve([]),
  enabled: false,
});
```

`skipToken` makes the disabled intent explicit and eliminates the need for `enabled: false`
(the query is implicitly skipped when `queryFn` is `skipToken`).
