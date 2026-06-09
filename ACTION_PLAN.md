# Assess Task Happy Path — Action Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md`.
2. Read `src/backend/AGENTS.md` and `src/frontend/AGENTS.md`.
3. Treat the SPEC as the source of truth for product behaviour, contracts, and layout rules.

## Scope and assumptions

### Scope

- Backend: extend `ClassroomApiClient.fetchCourseWork` and `getGoogleClassroomAssignments_` to include `topicId` and resolved `topicName`.
- Frontend: extend Zod schema for GC assignments; create pure matching function; create `assignmentAssessmentService`; wire the "Start Assessment" button in `AssessTaskModal`.
- No new pages, routes, or layout surfaces.

### Out of scope

- Manual definition selection fallback.
- Batch assessment triggering.
- Assessment progress/result display.
- Topic name resolution for display purposes beyond matching.
- Modifying `ClassesPage` or its layout.

### Assumptions

1. `assignmentDefinitionPartials` and `classPartials` are available in the React Query cache when the modal opens (startup-prefetched).
2. `ClassroomApiClient.fetchTopicName` correctly resolves topic names from topic IDs.
3. The `courseId` for `startAssessmentRun` is the `classId` prop passed to `AssessTaskModal` — they are the same identifier.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API/entry points thin and delegate behaviour to services or controllers.
- Fail fast on invalid inputs and persistence failures.
- Avoid defensive guards that hide wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents, the plan must define and enforce mandatory documentation reads.

For each delegated phase (`Testing Specialist`, `Implementation`, `Code Reviewer`, `Docs`):

1. list required documentation file paths under that phase before delegation
2. require the sub-agent handoff to include `Files read` with explicit file paths
3. verify every mandatory file is listed before accepting the handoff
4. if any mandatory file is missing, return the work to the same sub-agent and block progression to the next phase

### Shared-helper planning gate

When a section is likely to introduce helper reuse, helper extension, or new shared helpers:

1. record helper decisions in that section before implementation
2. include: decision (`reuse` | `extend` | `new` | `keep local`), owning path, and call-site rationale
3. add planned helper entries to the relevant canonical docs with status `Not implemented`
4. during documentation pass, reconcile planned entries against actual implementation and update status/details accordingly

### Validation commands hierarchy

- Backend lint: `npm run lint:backend`
- Frontend lint: `npm run lint:frontend`
- Backend tests: `npm test -- <target>`
- Frontend unit tests: `npm run frontend:test -- <target>`

---

## Section 1 — Backend: Extend `ClassroomApiClient.fetchCourseWork` to include `topicId`

### Objective

Add `topicId` to the mapped response from `ClassroomApiClient.fetchCourseWork` so downstream consumers can access the topic identifier.

### Constraints

- The `topicId` field is nullable (some Google Classroom assignments have no topic).
- `fetchCourseWork` is only called from `getGoogleClassroomAssignments_`; no other callers to worry about.
- Preserve the existing `id`, `title`, `updateTime` mapping and sort behaviour.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `docs/developer/backend/backend-testing.md`
- `src/backend/AGENTS.md`

Implementation mandatory docs:

- `src/backend/AGENTS.md`
- `src/backend/GoogleClassroom/ClassroomApiClient.js`

Code Reviewer mandatory docs:

- `src/backend/AGENTS.md`
- `SPEC.md`

### Shared helper plan

None — this is a field addition to an existing method.

### Acceptance criteria

- `fetchCourseWork` returns objects with `{ id, title, updateTime, topicId }`.
- When `cw.topicId` is absent/null/undefined, `topicId` is `null`.
- Existing sort behaviour (by `updateTime` descending) is preserved.
- JSDoc `@returns` tag is updated to include `topicId`.

### Required test cases (Red first)

Backend API/unit tests:

1. `fetchCourseWork` returns `topicId` when present on the Google Classroom API response.
2. `fetchCourseWork` returns `topicId: null` when `cw.topicId` is `undefined` or `null`.
3. Response still includes `id`, `title`, `updateTime` alongside `topicId`.
4. Sort order is unchanged (by `updateTime` descending).

### Section checks

- `npm test -- tests/...` (backend tests for `ClassroomApiClient`)
- `npm run lint:backend`
- Mandatory-read evidence gate passed for all delegated handoffs.

### Optional `@remarks` JSDoc follow-through

None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Add `topicId: cw.topicId || null` to the `response.courseWork.map(...)` callback that currently returns `{ id, title, updateTime }`; update `@returns` JSDoc. Update all `.toEqual()` assertions on `fetchCourseWork` results in `tests/googleClassroom/classroomApiClient.test.js` to include `topicId: null` (existing mocks don't set `topicId` on `CourseWork.list` responses so the field will always be null after the mapping change).
- **Deviations from plan:**
- **Follow-up implications for later sections:** Section 2 depends on this field being present.

---

## Section 2 — Backend: Extend `getGoogleClassroomAssignments_` to resolve and return `topicName`

### Objective

Extend the transport handler to resolve `topicName` from `topicId` via `ClassroomApiClient.fetchTopicName` and include both `topicId` and `topicName` in the returned assignment objects.

### Constraints

- `topicName` resolution should be skipped when `topicId` is null (avoid unnecessary API calls).
- When `fetchTopicName` throws (API transport error), propagate the error — fail-fast. One bad topic resolution blocks the entire assignment listing.
- When `fetchTopicName` returns `null` (topic exists but name is not found), `topicName` is `null` in the response — the assignment is still listed but matching will not proceed for that assignment.
- `topicName` is null when `topicId` is null.
- The `@returns` JSDoc tag and function-level comment must be updated.
- Follow the existing validation and error-handling patterns.
- Resolve `topicName` sequentially per assignment (GAS synchronous execution model; parallel resolution via `UrlFetchApp.fetchAll` is deferred to v2 if needed).

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `docs/developer/backend/backend-testing.md`
- `src/backend/AGENTS.md`

Implementation mandatory docs:

- `src/backend/AGENTS.md`
- `src/backend/z_Api/googleClassroomAssignments.js`
- `src/backend/GoogleClassroom/ClassroomApiClient.js`

Code Reviewer mandatory docs:

- `src/backend/AGENTS.md`
- `SPEC.md`

### Shared helper plan

None — adding fields to an existing handler's response.

### Acceptance criteria

- Response objects include `{ assignmentId, title, topicId, topicName }`.
- When `topicId` is non-null, `topicName` is resolved via `ClassroomApiClient.fetchTopicName`.
- When `topicId` is null, `topicName` is also null.
- Malformed-record validation still works (checks `cw.id` and `cw.title`).
- JSDoc is updated to reflect new fields.

### Required test cases (Red first)

Backend API tests:

1. Assignments with `topicId` get a resolved `topicName`.
2. Assignments with null `topicId` get `topicName: null`.
3. `fetchTopicName` is called only for non-null `topicId` values. Mock `ClassroomApiClient.fetchTopicName` and assert call count per assignment.
4. When `fetchTopicName` returns `null` (topic name not found), `topicName` is `null` in the response and the assignment is still listed.
5. When `fetchTopicName` throws an error, it is propagated (not swallowed); the assignment listing fails entirely (fail-fast).
6. Malformed records (missing `id` or `title`) still throw `ApiValidationError`.
7. Response shape includes all four fields.

### Section checks

- `npm test -- tests/api/googleClassroomAssignments...`
- `npm run lint:backend`
- Mandatory-read evidence gate passed for all delegated handoffs.

### Optional `@remarks` JSDoc follow-through

None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** In the `courseWorkList.map()` callback, resolve `topicName` conditionally via `ClassroomApiClient.fetchTopicName(classId, mapped.topicId)` when `mapped.topicId` is non-null. Add `topicId` and `topicName` to the return object. Extend the test mock setup to include `ClassroomApiClient.fetchTopicName` as a mockable dependency (following the existing `fetchCourseWork` mock pattern). Every mock `classroomApiClient` must include both `fetchCourseWork` and `fetchTopicName`; the helper function that constructs mock clients must ensure this. Update all existing `fetchCourseWork` mock return values in the test file to include `topicId` (null where appropriate).
- **Deviations from plan:**
- **Follow-up implications for later sections:** Section 3 depends on these fields being present in the backend response.

---

## Section 3 — Frontend: Extend Zod schema for Google Classroom assignments

### Objective

Add `topicId` and `topicName` to `GoogleClassroomAssignmentSchema` so the frontend can parse the extended backend response.

### Constraints

- Both fields are nullable (`z.string().nullable()`).
- The schema change must not break the `AssessTaskModal` (which destructures only `assignmentId` and `title`). The existing `googleClassroomAssignmentsService.spec.ts` `.toEqual()` assertions on parsed response shape must be updated to include `topicId: null, topicName: null` on all expected objects.
- Since `GoogleClassroomAssignmentSchema` uses `z.strictObject({...})`, use `z.string().nullable().default(null)` for both new fields. This ensures absent keys are accepted (defaulting to `null`) rather than rejected by `strictObject`.
- Follow existing Zod patterns in `googleClassroomAssignments.zod.ts`.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/AGENTS.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/services/googleClassroomAssignments.zod.ts`
- `SPEC.md`

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC.md`

### Shared helper plan

None — extending an existing schema.

### Acceptance criteria

- `GoogleClassroomAssignmentSchema` accepts objects with `topicId: string | null` and `topicName: string | null`.
- Existing valid assignment objects (without `topicId`/`topicName`) continue to pass validation (fields are `.nullable()` so absent = `null` after parse).
- TypeScript types are automatically updated via `z.infer`.

### Required test cases (Red first)

Frontend Zod tests:

1. Schema accepts object with `topicId: "abc123"` and `topicName: "Algebra"`.
2. Schema accepts object with `topicId: null` and `topicName: null`.
3. Schema accepts object without `topicId`/`topicName` fields (`.default(null)` provides `null` for absent keys).
4. Schema rejects `topicId: 123` (not a string).

### Section checks

- `npm run frontend:test -- googleClassroomAssignments.zod`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed for all delegated handoffs.

### Optional `@remarks` JSDoc follow-through

None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Add `topicId: z.string().nullable().default(null)` and `topicName: z.string().nullable().default(null)` to the `z.strictObject({...})` call in `googleClassroomAssignments.zod.ts`. Create `googleClassroomAssignments.zod.spec.ts` if it does not already exist.
- **Deviations from plan:**
- **Follow-up implications for later sections:** `AssessTaskModal` will use these fields for matching.

---

## Section 4 — Frontend: Create matching function

### Objective

Create a pure function `findMatchingDefinition` that matches a selected GC assignment against `AssignmentDefinitionPartial` records by title, topic name, and year group.

### Constraints

- Function must be a pure function (no React dependencies, no side effects).
- Return a discriminated union: `{ kind: 'matched'; definition } | { kind: 'no-match' } | { kind: 'ambiguous'; matches }`.
- Input shapes match `SPEC.md` § Core view model or behavioural model.
- Title matching is case-sensitive exact match against `primaryTitle` and each `alternateTitles`.
- Topic matching is exact string equality between `topicName` and `primaryTopic`.
- Year group matching is exact string equality between class's `yearGroupKey` and partial's `yearGroupKey`.
- Place the function in a new module `src/frontend/src/features/classes/AssessTaskModal/matchDefinitionForAssignment.ts` (co-located with the modal in its domain subfolder).

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/AGENTS.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC.md`
- `src/frontend/src/services/assignmentDefinitionPartials.zod.ts` (for `AssignmentDefinitionPartial` type)
- `src/frontend/src/services/classPartials.zod.ts` (for `ClassPartial` type)
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC.md`

### Shared helper plan

1. Helper: `findMatchingDefinition`
   - Decision: `new`
   - Owning module/path: `src/frontend/src/features/classes/AssessTaskModal/matchDefinitionForAssignment.ts`
   - Call-site rationale: Pure matching logic extracted for independent unit testing; no existing helper covers this combination of lookups.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented`

### Acceptance criteria

- Function returns `{ kind: 'matched', definition }` when exactly one partial matches.
- Function returns `{ kind: 'no-match' }` when no partial matches.
- Function returns `{ kind: 'ambiguous', matches }` when multiple partials match.
- Returns `{ kind: 'no-match' }` when `classPartial.yearGroupKey` is null.
- Returns `{ kind: 'no-match' }` when `selectedAssignment.topicName` is null.
- Title matching checks both `primaryTitle` and `alternateTitles`.

### Required test cases (Red first)

Frontend unit tests:

1. Match on `primaryTitle` + `topicName` + `yearGroupKey` → returns matched.
2. Match on `alternateTitles[0]` + `topicName` + `yearGroupKey` → returns matched.
3. No match on title → returns no-match.
4. No match on topic → returns no-match.
5. No match on year group → returns no-match.
6. Null `topicName` → returns no-match.
7. Null `yearGroupKey` → returns no-match.
8. Multiple partials match all three → returns ambiguous.
9. Empty `definitionPartials` array → returns no-match.
10. Empty `alternateTitles` array on partial → only `primaryTitle` is checked.

### Section checks

- `npm run frontend:test -- matchDefinitionForAssignment`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed for all delegated handoffs.
- Planned helper entry added to `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` with status `Not implemented`.

### Optional `@remarks` JSDoc follow-through

- Document why topic matching uses `topicName` (display name resolved from `topicId`) rather than `topicId` (opaque key) — the key-to-name resolution happens in the backend transport handler (Section 2).

### Implementation notes / deviations / follow-up

- **Implementation notes:**
- **Deviations from plan:**
- **Follow-up implications for later sections:** Section 6 uses this function.

---

## Section 5 — Frontend: Create `assignmentAssessmentService`

### Objective

Create a frontend service that wraps the `startAssessmentRun` backend API call, with Zod request/response validation.

### Constraints

- Must route through `callApi` in `apiService.ts`.
- Request schema: `{ definitionKey: string; assignmentId: string; courseId: string }`.
- Response schema: `z.void().nullable()` (backend returns `null` on success).
- Follow existing service patterns (e.g., `assignmentDefinitionPartialsService.ts`).
- Place files: `src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts` and `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` (with co-located `.spec.ts` companions). Per `src/frontend/AGENTS.md` §12, files sharing a domain prefix must be grouped in a subfolder.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/AGENTS.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/services/apiService.ts`
- `SPEC.md`

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC.md`

### Shared helper plan

1. Helper: `startAssessmentRun` service function
   - Decision: `new`
   - Owning module/path: `src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts`
   - Call-site rationale: Wraps the existing backend `startAssessmentRun` method; no existing frontend service for this API.
   - Relevant canonical doc target: N/A (service, not a shared helper)
   - Planned doc status: N/A

### Acceptance criteria

- `startAssessmentRun({ definitionKey, assignmentId, courseId })` calls `callApi('startAssessmentRun', ...)` with the correct payload.
- Request is validated against the Zod schema before calling `callApi`.
- Response is validated against `z.void().nullable()`.
- On success, returns `null` (the parsed response).
- On backend error, the error propagates through `callApi` (no additional error handling in the service).

### Required test cases (Red first)

Frontend service tests:

1. Successful call returns `null` (parsed from `{ ok: true, data: null }` envelope).
2. Request schema rejects missing `definitionKey`.
3. Request schema rejects non-string `assignmentId`.
4. Response schema accepts `null` data.
5. Response schema rejects non-null data (backend contract returns null).
6. Calls `callApi` with correct method name and payload.

### Section checks

- `npm run frontend:test -- assignmentAssessmentService`
- `npm run frontend:test -- assignmentAssessment.zod`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed for all delegated handoffs.

### Optional `@remarks` JSDoc follow-through

None.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
- **Deviations from plan:**
- **Follow-up implications for later sections:** Section 6 calls this service from the modal.

---

## Section 6 — Frontend: Wire AssessTaskModal

### Objective

Wire the "Start Assessment" button in `AssessTaskModal` to the matching logic and `startAssessmentRun` service, with success/error/no-match states.

### Constraints

- Read `classPartials` and `assignmentDefinitionPartials` from React Query cache via `useQueryClient().getQueryData()`.
- Cache-miss tests (cases 10–12) require `renderWithFrontendProviders` (`src/frontend/src/test/renderWithFrontendProviders.tsx`) to supply React Query context.
- Preserve existing assignment-fetching behaviour (local state + useEffect for GC assignments).
- The "Start Assessment" button remains disabled when assignments are loading, errored, or no assignment is selected (existing behaviour).
- On success: replace modal body with inline success `Alert`; footer becomes single "Close" button.
- On no-match / ambiguous / backend error: show error `Alert` in modal body; modal remains open; user can select a different assignment.
- Detect `DefinitionStaleError` via `error.code === 'DEFINITION_STALE'` on the `ApiTransportError` thrown by the service call.
- Button must show loading state (Ant Design `loading` prop) while the `startAssessmentRun` call is in flight.
- Follow existing component testing patterns in `AssessTaskModal.spec.tsx`.
- Extend the local `Assignment` type to include `topicId` and `topicName`, and update existing mock assignment data in the spec file to carry these fields. The `Select` component still uses `assignmentId` as the `value` and `title` as the `label`.
- **Prerequisite:** Create the `AssessTaskModal/` subfolder under `features/classes/`, move `AssessTaskModal.tsx` and `AssessTaskModal.spec.tsx` into it, and update the import in `ClassesPage.tsx` (line 18) to `'../features/classes/AssessTaskModal/AssessTaskModal'`. Update the spec file's import of `googleClassroomAssignmentsService` from `'../../services/...'` to `'../../../services/...'`.
- Use query keys from `queryKeys.classPartials()` (`['classPartials']`) and `queryKeys.assignmentDefinitionPartials()` (`['assignmentDefinitionPartials']`) for `getQueryData()` calls. For cache-hit test scenarios (cases 5–8), pre-populate the QueryClient using `queryClient.setQueryData()` before rendering with `renderWithFrontendProviders`.
- Look up the `ClassPartial` by `classId` from the cached `classPartials` array before calling `findMatchingDefinition`. If not found in the array (distinct from full cache miss), treat as a blocking error.
- **Existing tests to update:** The "Start Assessment click" test suite (asserts button is a no-op) must be removed or rewritten to reflect the new wiring. The "Footer buttons across all states" test suite (asserts both Cancel and Start Assessment are always present) must be updated — the success state footer contains only a Close button.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/AGENTS.md`
- `src/frontend/src/test/renderWithFrontendProviders.tsx`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC.md`
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.spec.tsx`
- `src/frontend/src/test/renderWithFrontendProviders.tsx`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-logging-and-error-handling.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `src/frontend/src/errors/apiTransportError.ts`
- `src/frontend/src/query/queryKeys.ts`

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC.md`
- `src/frontend/src/test/renderWithFrontendProviders.tsx`

### Shared helper plan

None — component-level integration.

### Acceptance criteria

- Clicking "Start Assessment" with a selected assignment runs the matching logic.
- On match + successful API call: modal shows success `Alert` and footer has only "Close".
- On no-match: modal shows error `Alert` with "No matching assignment definition found for '[assignment title]'." message.
- On ambiguous: modal shows error `Alert` with ambiguity message.
- On backend error: modal shows error `Alert` with the error message.
- On `DefinitionStaleError` (code `DEFINITION_STALE`): modal shows warning `Alert`.
- When `classPartials` or `assignmentDefinitionPartials` are unavailable from cache: modal shows error `Alert`.
- When `classPartials` are available but the `classId` is not found in the array: modal shows error `Alert` with "Class not found in cached data. Please refresh and try again."
- Button remains disabled while assignments are loading (existing behaviour preserved).
- Button remains disabled when no assignment is selected (existing behaviour preserved).
- Success state includes the matched assignment title in the message.

### Required test cases (Red first)

Frontend component tests:

1. No assignment selected → button disabled.
2. Assignments loading → button disabled.
3. No match → error `Alert` displayed.
4. Ambiguous match → error `Alert` displayed.
5. Null topic → no-match error `Alert` displayed with correct message.
6. Null yearGroupKey → error `Alert` displayed with "Cannot determine year group for this class."
7. Successful match + API success → success `Alert` displayed, footer shows single Close button.
8. Successful match + API `DefinitionStaleError` → warning `Alert` displayed.
9. Successful match + API generic error → error `Alert` displayed.
10. Cache miss on `classPartials` → error `Alert` displayed.
11. `classPartials` in cache but `classId` not found in array → error `Alert` displayed.
12. Cache miss on `assignmentDefinitionPartials` → error `Alert` displayed.
13. During `startAssessmentRun` call → button shows loading state (Ant Design `loading` prop), reverts on completion. Use a deferred promise pattern (similar to `createPendingPromise` already in the existing spec). Mock `startAssessmentRun` from the `assignmentAssessmentService` module. For case 8 (DefinitionStaleError), mock rejection with `new ApiTransportError({ requestId: 'test-id', error: { code: 'DEFINITION_STALE', message: 'Definition is stale' } })`.
14. In success state, clicking the Close button calls `onClose`.
15. In success state, only the Close button is present in the footer; Cancel and Start Assessment are not rendered.

### Section checks

- `npm run frontend:test -- AssessTaskModal`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed for all delegated handoffs.

### Optional `@remarks` JSDoc follow-through

- Document the state machine for the modal body (loading → ready → matching → success/error) in a JSDoc `@remarks` on the `AssessTaskModal` component.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
- **Deviations from plan:**
- **Follow-up implications for later sections:** None — this is the final implementation section.

---

## Regression and contract hardening

### Objective

Ensure all touched test suites pass and no regressions are introduced.

### Constraints

- Prefer focused test runs before broader validation.

### Acceptance criteria

- All backend tests pass: `npm test`.
- All frontend tests pass: `npm run frontend:test`.
- Backend lint passes: `npm run lint:backend`.
- Frontend lint passes: `npm run lint:frontend`.

### Required test cases/checks

1. Run touched backend suites: `ClassroomApiClient`, `googleClassroomAssignments`.
2. Run touched frontend suites: `googleClassroomAssignments.zod`, `matchDefinitionForAssignment`, `assignmentAssessmentService`, `assignmentAssessment.zod`, `AssessTaskModal`.
3. Run full backend test suite.
4. Run full frontend test suite.
5. Run backend and frontend lint commands.
6. Verify mandatory-read evidence (`Files read`) is complete for every delegated regression handoff.
7. **Note:** `startAssessmentRun_` in `src/backend/z_Api/assignmentAssessment.js` has no dedicated test suite. After Section 2, manually smoke-test the `startAssessmentRun` API to confirm the GAS load order and global state are intact. Adding backend test coverage for this handler is deferred.

### Section checks

- `npm test`
- `npm run frontend:test`
- `npm run lint:backend && npm run lint:frontend`

### Implementation notes / deviations / follow-up

- **Implementation notes:**
- **Deviations from plan:**

---

## Documentation and rollout notes

### Objective

Update docs to match implemented feature and reconcile shared-helper entries.

### Constraints

- Only modify documents relevant to the touched areas.

### Acceptance criteria

- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` updated with `findMatchingDefinition` entry (reconcile `Not implemented` → implemented).
- `AssessTaskModal` JSDoc updated (if `@remarks` were added).
- No rollout dependencies beyond the existing deployed backend.

### Required checks

1. Verify shared-helper entry for `findMatchingDefinition` is reconciled in canonical docs.
2. Verify mandatory-read evidence (`Files read`) is complete for delegated docs/review handoffs.
3. Reconcile planned shared-helper entries in canonical docs: keep `Not implemented` where still pending, and update implemented entries where delivered.

### Optional `@remarks` JSDoc review

- Confirm that the `AssessTaskModal` state machine `@remarks` (if added in Section 6) is present before deleting the action plan.

### Implementation notes / deviations / follow-up

- ...

---

## Suggested implementation order

0. **Preliminary — Restructure AssessTaskModal into subfolder.** Before any implementation, create `src/frontend/src/features/classes/AssessTaskModal/`, move `AssessTaskModal.tsx` and `AssessTaskModal.spec.tsx` into it, update the import in `ClassesPage.tsx` (line 18) to `'../features/classes/AssessTaskModal/AssessTaskModal'`, and update the spec file's import of `googleClassroomAssignmentsService` from `'../../services/...'` to `'../../../services/...'`. Verify the app still compiles and existing tests pass before proceeding.
1. Section 1 — Backend: Extend `ClassroomApiClient.fetchCourseWork` with `topicId`.
2. Section 2 — Backend: Extend `getGoogleClassroomAssignments_` with `topicName` resolution.
3. Section 3 — Frontend: Extend Zod schema for GC assignments.
4. Section 4 — Frontend: Create matching function.
5. Section 5 — Frontend: Create `assignmentAssessmentService`.
6. Section 6 — Frontend: Wire `AssessTaskModal`.
7. Regression and contract hardening.
8. Documentation and rollout.
