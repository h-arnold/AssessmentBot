# Assignments Management v1 Specification

## Status

- Draft v1.4 replacement
- Replaces the earlier Assignments Management v1 spec with the final locked decisions for startup warm-up semantics, strict legacy-row validation, and strict `definitionKey` deletion safety.

## Purpose

This document defines the intended behaviour for **Assignments Management v1**.

The feature will be used to:

- expose reusable assignment-definition records on the frontend Assignments page
- let users review assignment-definition metadata without rehydrating full task artifacts
- allow safe deletion of assignment definitions that meet the strict key-safety rules

This feature is **not** intended to:

- create or edit assignment definitions from the frontend
- launch assessment processing, grading, or submission-level workflows from this surface
- auto-repair or silently normalise legacy assignment-definition records

## Agreed product decisions

1. Assignments Management v1 manages **assignment-definition partials** rather than full assignment runs or submission payloads.
2. The canonical frontend entry point is the existing shell **Assignments** page.
3. Startup warm-up remains a **global app-level warm-up** triggered from the auth-aware boundary after authorisation succeeds.
4. Startup warm-up becomes **dataset-granular**. A failure in one warm-up dataset must not make unrelated surfaces appear failed or unavailable.
5. The startup warm-up dataset set becomes: `classPartials`, `cohorts`, `yearGroups`, and `assignmentDefinitionPartials`.
6. Classes and Settings must not regress because `assignmentDefinitionPartials` failed, became untrustworthy, or is still loading.
7. The Assignments surface is blocked by the readiness and trustworthiness of `assignmentDefinitionPartials` only.
8. `assignmentDefinitionPartials` continues to be backed by the `assignment_definitions` registry collection and preserves partial-hydration semantics with `tasks: null`.
9. Legacy assignment-definition rows fail the Assignments surface if either `createdAt` or `updatedAt` is missing or invalid. Missing or invalid timestamp values must **not** be coerced to `null`.
10. For the Assignments transport contract, `createdAt` and `updatedAt` are valid only when each value is either an explicit `null` or a valid ISO datetime string.
11. `deleteAssignmentDefinition` uses the **strict-only** key policy immediately. There is no permissive legacy deletion mode.
12. `deleteAssignmentDefinition` requires keys to be already trimmed (`definitionKey === definitionKey.trim()`), rejects empty keys, and rejects unsafe keys. Unsafe keys are any keys containing `/`, `\\`, `..`, or control characters.
13. Some legacy rows may therefore remain visible but undeletable by design. This is acceptable in v1.
14. The feature fails closed for untrustworthy assignment-definition data instead of hiding defects or dropping bad rows.
15. For `assignmentDefinitionPartials`, missing required non-timestamp fields are strict-fail defects, not canonicalisation cases.
16. This strict-fail field-presence rule applies to: `primaryTitle`, `primaryTopic`, `courseId`, `yearGroup`, `alternateTitles`, `alternateTopics`, `documentType`, `referenceDocumentId`, `templateDocumentId`, `assignmentWeighting`, `definitionKey`, `tasks`, `createdAt`, and `updatedAt`.
17. If any required field is missing from any row in the transport payload, the payload fails and the Assignments surface is blocked, even where a backend model constructor could otherwise supply a default.

## Existing system constraints

Documented constraints that materially shape this feature.

### Backend or API constraints already in place

- The active backend transport boundary is `src/backend/z_Api/**`; frontend code must consume backend behaviour only through allowlisted API methods.
- `AssignmentDefinitionController.getAllPartialDefinitions()` already exists and reads from the `assignment_definitions` registry collection.
- Legacy helper paths outside `z_Api` (for example `src/backend/y_controllers/globals.js`) are not hardened by this feature and remain out of scope.
- Full assignment definitions are persisted in dedicated collections named `assdef_full_<definitionKey>`.
- `AssignmentDefinitionController.getDefinitionByKey(definitionKey, { form: 'full' | 'partial' })` already distinguishes between the registry partial and full-store records.
- `AssignmentDefinition.toPartialJSON()` emits `tasks: null` and keeps document-routing metadata needed for later rehydration.
- Startup warm-up is currently orchestrated in `AppAuthGate` via `warmStartupQueries(queryClient)`.

### Current data-shape constraints

- Partial assignment-definition records are modelled through `AssignmentDefinition` and currently include:
  - `primaryTitle`
  - `primaryTopic`
  - `courseId`
  - `yearGroup`
  - `alternateTitles`
  - `alternateTopics`
  - `documentType`
  - `referenceDocumentId`
  - `templateDocumentId`
  - `assignmentWeighting`
  - `definitionKey`
  - `tasks: null`
  - `createdAt`
  - `updatedAt`
- The current model constructor can default some missing or nullish values. That behaviour must not be allowed to hide malformed legacy rows at the Assignments transport boundary.
- Full collection names are derived directly from `definitionKey`, so unsafe key validation is required before any delete path constructs a collection name.

### Frontend or consumer architecture constraints

- All frontend-to-backend calls must go through `callApi(...)` in `src/frontend/src/services/apiService.ts`.
- Frontend runtime validation must use Zod schemas adjacent to the consuming service layer.
- Shared query keys must be defined in `src/frontend/src/query/queryKeys.ts`.
- Shared warm-up orchestration lives outside `App.tsx` and must stay non-blocking for shell render and navigation readiness.
- Required degraded or untrustworthy data must fail closed for the affected owned surface under `docs/developer/frontend/frontend-loading-and-width-standards.md`.

## Domain and contract recommendations

These recommendations are intended to be treated as the concrete v1 contract unless later superseded by an explicit replacement decision.

### Why this approach is preferable

- It preserves the existing global warm-up orchestration while preventing cross-surface regressions from unrelated dataset failures.
- It keeps the Assignments page fast by listing partial definitions instead of rehydrating full task artifact payloads.
- It prevents silent legacy-data corruption from being normalised into apparently trustworthy UI state.
- It blocks unsafe deletion paths before they can derive JsonDb collection names from hostile or malformed keys.

### Recommended data shapes

#### Assignment definition partial transport

```ts
type AssignmentDefinitionPartial = {
  primaryTitle: string;
  primaryTopic: string;
  courseId: string;
  yearGroup: number | null;
  alternateTitles: string[];
  alternateTopics: string[];
  documentType: 'SLIDES' | 'SHEETS';
  referenceDocumentId: string | null;
  templateDocumentId: string | null;
  assignmentWeighting: number | null;
  definitionKey: string;
  tasks: null;
  createdAt: string | null;
  updatedAt: string | null;
};
```

Contract notes:

- Every listed property is required to be present on every transport row, even when the contract allows the value itself to be `null`.
- `tasks` must always be explicit `null` in this transport.
- `definitionKey` must be present, non-empty, and already trimmed (`definitionKey === definitionKey.trim()`).
- The list transport may include rows whose keys are safe for display but unsafe for deletion; those rows stay visible with delete disabled.
- `createdAt` and `updatedAt` must both be present on every record.
- `yearGroup`, `referenceDocumentId`, `templateDocumentId`, and `assignmentWeighting` may be explicit `null`, but they must not be omitted.
- `alternateTitles` and `alternateTopics` must be present arrays and must not be omitted.
- Each timestamp field is valid only when its value is either:
  - an explicit `null`
  - a valid ISO datetime string
- Missing properties are invalid even if the model layer could otherwise default them.

#### Delete assignment definition input

```ts
type DeleteAssignmentDefinitionInput = {
  definitionKey: string;
};
```

#### Delete assignment definition success response

```ts
type DeleteAssignmentDefinitionResponse = void;
```

#### Startup warm-up dataset state

```ts
type StartupWarmupDatasetKey =
  | 'classPartials'
  | 'cohorts'
  | 'yearGroups'
  | 'assignmentDefinitionPartials';

type StartupWarmupDatasetState = {
  status: 'loading' | 'ready' | 'failed';
  isTrustworthy: boolean;
};

type StartupWarmupSnapshot = {
  datasets: Record<StartupWarmupDatasetKey, StartupWarmupDatasetState>;
};

type StartupWarmupContextValue = {
  snapshot: StartupWarmupSnapshot;
  isDatasetReady: (key: StartupWarmupDatasetKey) => boolean;
  isDatasetFailed: (key: StartupWarmupDatasetKey) => boolean;
};
```

Contract notes:

- `status: 'ready'` means the latest payload for that dataset is both loaded and trustworthy for normal rendering.
- `status: 'failed'` means the latest attempt did not produce a trustworthy payload for that dataset.
- Dataset trustworthiness is evaluated per dataset. One failed dataset must not flip every dataset to failed.
- `errorCode` and `requestId` remain logging metadata and are not required members of the shared warm-up context consumed by feature hooks.

### Naming recommendation

Prefer:

- `assignmentDefinitionPartials`
- `getAssignmentDefinitionPartials`
- `deleteAssignmentDefinition`
- `definitionKey`

Avoid:

- `assignmentsWarmup`
- `assignmentDefinitionsRegistry` as the transport name
- `key` for assignment-definition deletion payloads

This keeps the API contract aligned with the existing assignment-definition domain terminology and avoids conflating definitions with assignment runs.

### Validation recommendation

#### Frontend

- Validate `getAssignmentDefinitionPartials` responses with a dedicated Zod schema before caching the payload.
- Reject the entire payload if any row is missing any required transport field.
- Reject the entire payload if any row has a missing `definitionKey`, uses an empty trimmed key, or uses a non-trimmed key (`definitionKey !== definitionKey.trim()`).
- Reject the entire `assignmentDefinitionPartials` payload if any row uses a non-null non-string timestamp value or uses an invalid ISO datetime string.
- Do not canonicalise missing fields from legacy rows.
- Do not coerce invalid or missing timestamp fields to `null`.
- Frontend may mirror the strict delete-key safety rule to disable invalid delete launches early, but backend validation remains authoritative.

#### Backend

- Add allowlisted API methods for `getAssignmentDefinitionPartials` and `deleteAssignmentDefinition`.
- `getAssignmentDefinitionPartials` must return plain partial JSON records only; it must not return full task artifacts.
- The list path must fail the whole response if any returned row is missing any required transport field.
- The list path must fail the whole response if any returned row violates the timestamp contract.
- The list path must not canonicalise missing fields by reusing model defaults or synthetic fallback values.
- `deleteAssignmentDefinition` must reject keys that are not already trimmed (`definitionKey !== definitionKey.trim()`).
- `deleteAssignmentDefinition` must reject the request if the key is empty or contains `/`, `\\`, `..`, or control characters.
- `deleteAssignmentDefinition` must use the original validated key value for deletion targets and must not rewrite keys by trimming.
- `deleteAssignmentDefinition` must not silently rewrite unsafe keys, fall back to alternate lookup strategies, or bypass full-collection deletion.

### Display-resolution recommendation

- The Assignments page should render directly from `assignmentDefinitionPartials` plus local derived view state.
- `yearGroup: null` should display as an explicit unset value rather than a fabricated year-group label.
- Timestamp display should derive from the stored `updatedAt` and `createdAt` values only after the transport layer has already established they are trustworthy.

## Feature architecture

This feature spans the frontend Assignments page, shared frontend warm-up orchestration, and the backend assignment-definition API transport.

### Placement

- Frontend ownership: `src/frontend/src/pages/AssignmentsPage.tsx` and adjacent Assignments feature code.
- Shared frontend data ownership: React Query shared query definitions, query keys, and startup warm-up orchestration.
- Backend ownership: `src/backend/z_Api/**` transport entrypoints plus assignment-definition controller behaviour.
- The supported user entry point for this feature is the existing shell **Assignments** navigation item.

### Proposed high-level tree

```text
App shell
└── Assignments page
    ├── Assignments status / blocking region
    └── Assignment-definition list region
```

### Out of scope for this surface

- Assignment-definition create and edit workflows
- Full assignment-run inspection
- Submission-level inspection or marking workflows
- Bulk deletion
- Search and secondary navigation layers
- Legacy-data repair tooling

## Data loading and orchestration

### Required datasets or dependencies

- `assignmentDefinitionPartials`

The Assignments page does not require `classPartials`, `cohorts`, or `yearGroups` to become ready before it can render its normal ready state.

### Prefetch or initialisation policy

#### Startup

- Keep the global startup warm-up triggered from the auth-aware boundary after authorisation succeeds.
- Add `assignmentDefinitionPartials` to the startup warm-up dataset set.
- Warm the datasets in parallel.
- Record readiness and failures per dataset rather than collapsing the whole warm-up cycle to a single page-blocking success or failure state.
- Continue logging debug-only orchestration context for warm-up failures, but include the failing dataset key in that context.

#### Feature entry

- The Assignments page must consume the shared `assignmentDefinitionPartials` query.
- If the shared query is already ready and trustworthy from startup warm-up, the page enters the ready state immediately.
- If the shared query is still loading, the page shows only Assignments-owned loading treatment while the wider shell remains usable.
- If the shared query failed or is untrustworthy, the page shows only the Assignments-owned blocking treatment while Dashboard, Settings, and class-related workflows remain governed by their own data dependencies.

#### Manual refresh

- The Assignments surface should expose a retry / refresh action that refetches `assignmentDefinitionPartials` only.
- A retry on the Assignments surface must not trigger a whole-app restart or reset unrelated warm-up datasets.

### Query or transport additions

- Add the shared query key `assignmentDefinitionPartials`.
- Add a frontend service wrapper `getAssignmentDefinitionPartials()`.
- Add a frontend service wrapper `deleteAssignmentDefinition(input)`.
- Add adjacent Zod schemas for:
  - `AssignmentDefinitionPartial`
  - `AssignmentDefinitionPartialsResponse`
  - `DeleteAssignmentDefinitionInput`
  - `DeleteAssignmentDefinitionResponse`
- Add backend allowlisted transport methods for:
  - `getAssignmentDefinitionPartials`
  - `deleteAssignmentDefinition`
- After a successful delete, refetch `assignmentDefinitionPartials`.
- If the required post-delete refresh fails, the Assignments owned surface becomes blocking-failed until a later successful payload arrives.

## Core view model or behavioural model

The Assignments surface should derive a lightweight row model from each validated assignment-definition partial.

### Suggested shape

```ts
type AssignmentDefinitionListItem = {
  definitionKey: string;
  primaryTitle: string;
  primaryTopic: string;
  yearGroup: number | null;
  documentType: 'SLIDES' | 'SHEETS';
  updatedAt: string | null;
  createdAt: string | null;
  canDelete: boolean;
};
```

### Derivation or merge rules

#### Dataset trust state

- The list model may be derived only from a payload that has already passed transport validation.
- If the payload is missing, failed, or untrustworthy, the list model does not exist and the page remains in its blocking treatment.

#### Delete capability

- `canDelete` is `true` only when the row’s `definitionKey` passes the same strict safety rule used by the backend delete endpoint.
- Rows with unsafe keys remain visible if the list payload itself is otherwise valid.
- Rows with unsafe keys must not present a normal enabled delete action.

### Sort order or priority rules

1. `updatedAt` descending, with valid timestamps before `null`
2. `primaryTitle` ascending
3. `definitionKey` ascending

Rows with invalid non-null timestamps never enter sorting because the entire payload is rejected before ready-state rendering.

## Main user-facing surface specification

### Recommended components or primitives

- a page-level owned-surface status region for loading, empty, and blocking states
- a data list or table for assignment-definition partials
- a row-level delete action

### Fields, columns, or visible sections

1. Assignment title (`primaryTitle`)
2. Topic (`primaryTopic`)
3. Year group (`yearGroup`, explicit unset rendering when null)
4. Document type (`documentType`)
5. Last updated (`updatedAt`)
6. Delete action

`createdAt` is part of the transport contract and row model but does not need to be a primary visible column in v1.

### Sorting, filtering, or navigation rules

- Apply the default sort order defined above.
- Provide deterministic filtering on all displayed columns.
- Filter options are derived from currently loaded rows and sorted deterministically (`localeCompare` with numeric ordering and base sensitivity for text labels).
- String columns (`primaryTitle`, `primaryTopic`, `documentType`) use exact option-value matching against raw row values.
- `yearGroup` filter uses stringified values with a dedicated `null` token rendered as `—`.
- `updatedAt` filter operates on displayed date labels (`DD/MM/YYYY`) with a dedicated `null` token rendered as `—`.
- Provide an explicit reset control that restores default sort and all default filters.
- v1 does not introduce search, bulk selection, or nested Assignments sub-navigation.
- The Assignments page is a single-surface workflow in v1.

### Delete workflow rules

- Use explicit confirmation before delete via an Ant Design confirmation modal.
- Confirmation copy must include the assignment title and warn that deletion is permanent.
- Confirm action shows modal confirm-loading while delete is in flight.
- Conflicting delete actions on the same surface are disabled while mutation is in flight.
- On success, close confirmation, remove row after refetch, and show local success feedback.
- On failure, keep row visible and show local error feedback with a retry path.

### Rendering rules

#### Loading

- While `assignmentDefinitionPartials` is loading and no trustworthy payload exists yet, the Assignments owned surface renders loading treatment only for its own region.
- The surrounding shell, page navigation, and unrelated pages remain interactive.

#### Ready with rows

- Render the validated list of assignment-definition partials using the defined sort order.
- Rows with `canDelete: false` remain visible but do not expose an enabled delete action.

#### Ready but empty

- Render an explicit empty state for the Assignments owned surface when the validated payload is an empty array.

#### Blocking failure

- If `assignmentDefinitionPartials` fails to load, fails validation, or becomes untrustworthy after a required refresh, suppress the normal Assignments content and show the blocking-state treatment for the Assignments owned surface.
- The blocking state must explain that assignment definitions could not be trusted or loaded.
- The blocking state must offer the Assignments retry / refresh action.

#### Delete in progress

- Keep the rest of the list visible.
- Disable conflicting delete launches on the same owned surface while the delete mutation is in flight.
- Do not hide the existing list behind a whole-page skeleton for a row-level delete.

## API and backend behaviour

### `getAssignmentDefinitionPartials`

- Returns all assignment-definition partials required for the Assignments v1 list surface.
- Returns only partial registry records and never full task-artifact content.
- Removes storage-only metadata such as `_id`.
- Fails the whole request if any row is missing any required transport field.
- Fails the whole request if any row violates the transport contract.
- Strict malformed-row validation is scoped to this `z_Api` transport contract; legacy non-`z_Api` consumers are unchanged in v1.

### `deleteAssignmentDefinition`

- Accepts `{ definitionKey: string }`.
- Returns no payload on success.
- Trims the incoming key to evaluate emptiness.
- Rejects the request if the key is not already trimmed (`definitionKey !== definitionKey.trim()`).
- Rejects the request if the key is empty.
- Rejects the request if the key contains:
  - `/`
  - `\\`
  - `..`
  - any control character
- Uses the original validated key for both the registry delete and the full-collection delete path.
- Does not offer a permissive legacy fallback for unsafe keys.
- Treats safe-key deletes as idempotent when records are already absent.

### Error expectations

- Unsafe delete keys must produce a validation failure rather than a silent no-op.
- Missing required non-timestamp fields in the list dataset must produce a request failure rather than a canonicalised success payload.
- Legacy timestamp defects in the list dataset must produce a request failure rather than a partially filtered success payload.
- Surface-specific failures should preserve the existing app-level pattern where unrelated surfaces continue to operate if their own datasets remain ready and trustworthy.

## Non-goals and explicit exclusions

- No hidden migration path that rewrites malformed timestamps on read
- No automatic conversion of unsafe legacy `definitionKey` values into safe aliases
- No parallel legacy API surface outside `src/backend/z_Api`
- No full-definition fetch on initial Assignments page render
- No create, edit, duplicate, or archive flows in v1

## Open questions

None.
