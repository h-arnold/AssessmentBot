# Assess Task — Classes Page Workflow Delivery Plan (TDD-First)

## Plan Status

- **Section 1** ✅ Complete — `ClassroomApiClient.fetchCourseWork()` implemented and reviewed. Committed as `0a88ffb`.
- **Section 2** ✅ Complete — `getGoogleClassroomAssignments_` handler + allowlist entry. Committed as `ce0799b`.
- **Section 3** ✅ Complete — Frontend service, Zod schema, and query key. Commit pending.
- **Section 3** ⬜ Pending
- **Section 4** ⬜ Pending
- **Section 5** ⬜ Pending
- **Section 6** ⬜ Pending

---

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md`.
2. Read `ASSESS_TASK_MODAL_LAYOUT.md`.
3. Read `docs/developer/frontend/frontend-modal-patterns.md`.
4. Read `docs/developer/frontend/frontend-loading-and-width-standards.md`.
5. Read `docs/developer/frontend/frontend-react-query-and-prefetch.md`.
6. Treat those documents as the source of truth for product behaviour, contracts, and layout rules.

## Scope and assumptions

### Scope

- New `fetchCourseWork(courseId)` method on `ClassroomApiClient` in `src/backend/GoogleClassroom/ClassroomApiClient.js`.
- New `z_Api` transport file `src/backend/z_Api/googleClassroomAssignments.js` with trailing-underscore handler.
- New allowlist entry in `src/backend/z_Api/z_apiHandler.js`.
- New frontend service module `src/frontend/src/services/googleClassroomAssignmentsService.ts` with adjacent Zod schema.
- New query key factory `googleClassroomAssignments` in `src/frontend/src/query/queryKeys.ts`.
- Updated `ClassesPage` class cards: replace disabled "Edit" button with "Assess Task" icon button.
- New `AssessTaskModal` component under `src/frontend/src/features/classes/AssessTaskModal.tsx`.
- E2E mock infrastructure, scenario helpers, and Playwright tests covering card-level and modal states.

### Out of scope

- Assessment triggering, trigger creation, or pipeline execution.
- Assignment-definition creation or editing.
- Task parsing or document ID collection.
- Any workflow beyond selecting an assignment and enabling the "Start Assessment" button.

### Assumptions

1. `ClassPartial.classId` is the Google Classroom course ID and is the authoritative value passed to `fetchCourseWork`.
2. The existing `Classroom.Courses.CourseWork.list()` GAS call is the correct API to reuse.
3. The response sorts by `updateTime` descending (matching the deprecated `GoogleClassroomManager.getAssignments()` behaviour).
4. On-demand fetch via local state in the modal is appropriate (no React Query caching needed at this stage).

---

## Global constraints and quality gates

### Engineering constraints

- Keep API entry points thin; delegate behaviour to controllers or API clients.
- Fail fast on invalid inputs and persistence failures.
- Avoid defensive guards that hide wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.
- All frontend-to-backend calls through `callApi` (`apiService.ts`).
- Zod-first: define schemas, then `z.infer<typeof>` for types.

### TDD workflow (mandatory per section)

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

Every delegated handoff must include a `Mandatory Reading` section with explicit file paths.
If mandatory documentation is missing from `Files read`, return the work to the same sub-agent and do not proceed.

### Shared-helper planning gate

Each section records helper decisions before implementation. Planned helper entries are added to relevant canonical docs with status `Not implemented` and reconciled during the documentation pass.

### Validation commands hierarchy

- Backend lint: `npm run lint:backend`
- Frontend lint: `npm run lint:frontend`
- Backend tests: `npm run test:backend -- <target>`
- Frontend unit tests: `npm run test:frontend -- <target>`
- Frontend e2e tests: `npm run test:frontend:e2e -- <target>`
- All lint checks: `npm run lint`
- All test suites: `npm test`

---

## Section 1 — Backend: ClassroomApiClient.fetchCourseWork()

### Objective

Add `fetchCourseWork(courseId)` to `ClassroomApiClient` that calls `Classroom.Courses.CourseWork.list()` and returns sorted assignment summaries.

### Constraints

- Must call `Classroom.Courses.CourseWork.list(courseId)` — the same GAS API used by the deprecated `GoogleClassroomManager.getAssignments()`.
- Must return `Array<{ id: string; title: string; updateTime: string }>` sorted by `updateTime` descending (most recent first). The `updateTime` is used for sorting only and is not part of the transport response.
- Must throw on Google Classroom API failure (matching `fetchTopicName` pattern), not catch-and-return `[]` (matching `fetchAllActiveClassrooms` pattern). This is so the transport layer can distinguish "no assignments" from "fetch failure".
- Must paginate through all pages using `nextPageToken` (following the existing `fetchAllActiveClassrooms` pagination pattern).
- Must log fetch success via `ABLogger.info` with `courseId` and `count`.
- Must use `ABLogger` for logging rather than `ProgressTracker`. This is a deliberate consolidation toward `ABLogger` for new `ClassroomApiClient` methods. The existing codebase has a mixed logging pattern (`fetchTopicName` uses `ProgressTracker.logError`, `fetchCourseUpdateTime` uses `ABLogger`). The new `fetchCourseWork` follows `fetchCourseUpdateTime`'s logging approach while following `fetchTopicName`'s throw-on-failure approach.

### Delegation mandatory reads

Implementation mandatory docs:

- `src/backend/GoogleClassroom/ClassroomApiClient.js` (existing patterns)
- `src/backend/AGENTS.md`
- `docs/developer/backend/backend-logging-and-error-handling.md`

Code Reviewer mandatory docs:

- `src/backend/GoogleClassroom/ClassroomApiClient.js`
- `src/backend/AGENTS.md`

### Shared helper plan

1. Helper: `fetchCourseWork` on `ClassroomApiClient`
   - Decision: `new`
   - Owning path: `src/backend/GoogleClassroom/ClassroomApiClient.js`
   - Call-site rationale: single new method extending existing `ClassroomApiClient` surface; no extraction needed
   - Relevant canonical doc target: `docs/developer/backend/AssessmentFlow.md` (Shared Helper Status section)
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `fetchCourseWork(courseId)` returns sorted assignments for a valid course ID.
- Returns empty array for a course with no assignments.
- Throws on Google Classroom API failure.
- Paginates correctly when more than one page of results exists.
- Items are sorted by `updateTime` descending.

### Required test cases (Red first)

Backend unit tests:

1. `fetchCourseWork` returns sorted assignments for a course with multiple assignments.
2. `fetchCourseWork` returns empty array for a course with no assignments (no `courseWork` property in response).
3. `fetchCourseWork` throws when `Classroom.Courses.CourseWork.list` throws.
4. `fetchCourseWork` paginates correctly when `nextPageToken` is present.

### Section checks

- `npm run test:backend -- tests/backend/GoogleClassroom/ClassroomApiClient.test.js` (or equivalent test file)
- `npm run lint:backend` passes with no new warnings.
- Mandatory-read evidence gate passed for all delegated handoffs.

### Optional `@remarks` JSDoc follow-through

- Document why this method throws on failure (unlike `fetchAllActiveClassrooms` and `fetchTeachers` which catch-and-return `[]`/`null`) — the transport layer needs to distinguish "no assignments" (empty list) from "fetch failure" (error). `fetchTopicName` also throws for the same reason; the new method follows that precedent. Also note the deliberate use of `ABLogger` over `ProgressTracker` — this consolidates toward `ABLogger` for new `ClassroomApiClient` methods, matching `fetchCourseUpdateTime`.

---

## Section 2 — Backend: z_Api handler and allowlist registration

### Objective

Create `src/backend/z_Api/googleClassroomAssignments.js` with a trailing-underscore handler `getGoogleClassroomAssignments_` and register it in `ALLOWLISTED_METHOD_HANDLERS`.

### Constraints

- Must follow the existing `z_Api` trailing-underscore handler pattern (see `googleClassrooms.js` for reference).
- Transport-boundary validation: `classId` must be a non-empty, trimmed string without `/`, `\`, `..`, or ASCII control characters.
- Must call `ClassroomApiClient.fetchCourseWork(classId)`.
- Must map `{ id, title }` to `{ assignmentId, title }` in the response.
- Must exclude `updateTime` from the transport response (used for sort only).
- Must throw `ApiValidationError` on invalid `classId` (mapped to `INVALID_REQUEST` envelope by `apiHandler`).
- Must throw `ApiValidationError` on malformed Classroom API response rows.
- Must use `validateParametersObject_` or equivalent for params validation (following existing patterns).
- Must export via guarded `module.exports` for Node unit tests.

### Delegation mandatory reads

Implementation mandatory docs:

- `src/backend/z_Api/googleClassrooms.js` (reference pattern)
- `src/backend/z_Api/z_apiHandler.js` (import and allowlist pattern)
- `src/backend/z_Api/assignmentDefinitionPartials.js` (validation helper patterns)
- `docs/developer/backend/api-layer.md`
- `src/backend/AGENTS.md`

Code Reviewer mandatory docs:

- Same as Implementation mandatory docs.

### Shared helper plan

1. Helper: `getGoogleClassroomAssignments_` handler
   - Decision: `new`
   - Owning path: `src/backend/z_Api/googleClassroomAssignments.js`
   - Call-site rationale: single new handler following existing pattern; no extraction needed
   - Relevant canonical doc target: `docs/developer/backend/api-layer.md` (Current migrated endpoints section)
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `getGoogleClassroomAssignments({ classId: '123' })` returns `Array<{ assignmentId, title }>`.
- Returns `INVALID_REQUEST` envelope when `classId` is missing, empty, or contains path characters.
- Returns `INVALID_REQUEST` envelope when `params` is not a plain object.
- Returns `INVALID_REQUEST` envelope when a Classroom API row is malformed (missing `id` or `title`).
- Returns `INTERNAL_ERROR` envelope when `ClassroomApiClient.fetchCourseWork` throws.
- Returns empty array for a course with no assignments.

### Required test cases (Red first)

API layer tests:

1. Valid `classId` returns assignment list in success envelope.
2. Missing `classId` returns `INVALID_REQUEST`.
3. Empty `classId` returns `INVALID_REQUEST`.
4. `classId` with `/` returns `INVALID_REQUEST`.
5. `classId` with `..` returns `INVALID_REQUEST`.
6. `params` not a plain object returns `INVALID_REQUEST`.
7. Malformed Classroom row (missing `id`) returns `INVALID_REQUEST`.
8. Malformed Classroom row (missing `title`) returns `INVALID_REQUEST`.
9. `ClassroomApiClient.fetchCourseWork` throws → `INTERNAL_ERROR`.
10. Course with no assignments returns empty array with success envelope.

### Section checks

- `npm run test:backend -- tests/api/googleClassroomAssignments.test.js`
- `npm run lint:backend` passes with no new warnings.
- Mandatory-read evidence gate passed for all delegated handoffs.

### Implementation notes / deviations / follow-up

- The `getGoogleClassroomAssignments_` handler must be imported via `require` in the Node test block of `z_apiHandler.js`, following the same pattern used for `getGoogleClassrooms_`.

---

## Section 3 — Frontend: Service module, Zod schema, and query key

### Objective

Create the frontend service module, Zod validation schema, and query key factory entry for the `getGoogleClassroomAssignments` transport.

### Constraints

- Service module: `src/frontend/src/services/googleClassroomAssignmentsService.ts`.
- Schema file: `src/frontend/src/services/googleClassroomAssignments.zod.ts`.
- Query key: new factory in `src/frontend/src/query/queryKeys.ts`.
- The service function calls `callApi('getGoogleClassroomAssignments', { classId })` and returns typed data. The method name string must be `'getGoogleClassroomAssignments'` — an exact match with the `ALLOWLISTED_METHOD_HANDLERS` key defined in Section 2.
- Zod schema validates response as `Array<{ assignmentId: string; title: string }>`.
- `assignmentId` and `title` must both be non-empty strings.
- Schema uses `.strict()` to reject unexpected fields — the response shape is fixed per the spec.
- Follow the existing service module pattern from `referenceDataService.ts` and its Zod companion.

### Delegation mandatory reads

Implementation mandatory docs:

- `src/frontend/src/services/referenceDataService.ts` (reference pattern)
- `src/frontend/src/services/referenceData.zod.ts` (reference pattern)
- `src/frontend/src/services/apiService.ts` (callApi signature)
- `src/frontend/src/query/queryKeys.ts` (existing factory patterns)
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`

Code Reviewer mandatory docs:

- Same as Implementation mandatory docs.

### Shared helper plan

1. Helper: `getGoogleClassroomAssignments` service function
   - Decision: `new`
   - Owning path: `src/frontend/src/services/googleClassroomAssignmentsService.ts`
   - Call-site rationale: new service following existing pattern; single caller (AssessTaskModal)
   - Relevant canonical doc target: `docs/developer/frontend/frontend-react-query-and-prefetch.md` (Query-key convention section)
   - Planned doc status: `Not implemented`

2. Helper: `googleClassroomAssignments` query key factory
   - Decision: `new`
   - Owning path: `src/frontend/src/query/queryKeys.ts`
   - Call-site rationale: scoped key factory following existing `assignmentDefinitionByKey` pattern
   - Relevant canonical doc target: `docs/developer/frontend/frontend-react-query-and-prefetch.md` (Query-key convention section)
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `getGoogleClassroomAssignments('123')` calls `callApi` with correct method and params.
- Response is validated against Zod schema and returned typed.
- Invalid response shape throws (Zod parse error).
- Query key factory produces `['googleClassroomAssignments', classId] as const`.

### Required test cases (Red first)

Frontend service tests:

1. `getGoogleClassroomAssignments` calls `callApi` with `{ classId: '123' }`.
2. Valid response is parsed and returned correctly.
3. Response missing `assignmentId` throws Zod error.
4. Response missing `title` throws Zod error.
5. Response with unexpected fields is rejected by `.strict()` schema.

### Section checks

- `npm run test:frontend -- src/services/googleClassroomAssignmentsService.spec.ts`
- `npm run lint:frontend` passes with no new warnings.
- Mandatory-read evidence gate passed for all delegated handoffs.

---

## Section 4 — Frontend: ClassesPage card button update and E2E mock infrastructure

### Objective

Replace the disabled "Edit" button on each class card with an "Assess Task" icon button. Set up the E2E mock infrastructure for `getGoogleClassroomAssignments`. Verify card-level behaviour with E2E tests before the modal exists.

### Constraints

- The disabled "Edit" button is removed; the disabled "View" button is unchanged.
- New button is icon-only with tooltip "Assess Task".
- Icon: any Ant Design icon suggestive of assessment (e.g., `AuditOutlined`, `CheckSquareOutlined`, `FormOutlined`).
- Button must have `aria-label="Assess Task"` (icon-only button accessibility requirement per layout spec).
- Tooltip uses Ant Design `Tooltip` component.
- Modal state (open/close, selected `classId` and `className`) managed in `ClassesPage`. In this section the button's `onClick` handler is a no-op stub (`() => {}`). The modal-open wiring to `AssessTaskModal` is completed in Section 5.
- The card `classId` and `className` come from the existing `ClassPartial` data on the card.
- The `EXPECTED_BUTTONS_PER_CARD` constant stays at 2 (unchanged value; only button identity changes).
- Update `assertAllViewEditButtonsDisabled` helper in the existing `classes-page.spec.ts` to reflect the Edit→Assess Task replacement.
- Set up E2E mock infrastructure: add `getGoogleClassroomAssignments` to `RuntimeScenario` type in `endToEndRuntimeMocks.ts`, add `'getGoogleClassroomAssignments'` to the `allMethods` array inside `installRuntimeMock`, and add scenario factory helpers for different assignment responses.

### Delegation mandatory reads

Implementation mandatory docs:

- `ASSESS_TASK_MODAL_LAYOUT.md`
- `docs/developer/frontend/ant-design-docs-cache/tooltip.md`
- `docs/developer/frontend/ant-design-docs-cache/button.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `src/frontend/AGENTS.md`
- `src/frontend/src/pages/ClassesPage.tsx` (current implementation)
- `src/frontend/e2e-tests/classes-page.spec.ts` (existing E2E patterns to update)
- `src/frontend/e2e-tests/helpers/classes-page-end-to-end-helpers.ts` (helper patterns)
- `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts` (runtime mock patterns)
- `docs/developer/frontend/frontend-testing.md`

Code Reviewer mandatory docs:

- `ASSESS_TASK_MODAL_LAYOUT.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `src/frontend/AGENTS.md`

### Shared helper plan

No new production helpers. Button wiring is page-local state management.

1. Helper: `getGoogleClassroomAssignments` entry in `RuntimeScenario`
   - Decision: `extend`
   - Owning path: `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`
   - Call-site rationale: new API method needs mock support; extend existing `RuntimeScenario` type
   - Relevant canonical doc target: `docs/developer/frontend/frontend-testing.md`
   - Planned doc status: `Not implemented`

2. Helper: assignment fixtures/scenario factories in E2E helpers
   - Decision: `new`
   - Owning path: `src/frontend/e2e-tests/helpers/classes-page-end-to-end-helpers.ts`
   - Call-site rationale: needed for E2E test scenarios with different assignment responses
   - Planned doc status: `Not implemented`

### Acceptance criteria

- Each class card shows "View" (disabled) and "Assess Task" (enabled, icon+tooltip) buttons.
- The "Edit" button no longer exists on any card.
- Card width stays at 268 px (icon-only button does not overflow).
- Hovering over the "Assess Task" button shows "Assess Task" tooltip.
- Existing Classes page E2E tests pass with the updated helper constants and button assertions.
- E2E mock infrastructure is in place: `RuntimeScenario` updated, `allMethods` updated, scenario helpers exist.

### Required test cases (Red first)

Frontend component tests:

1. Assess Task button replaces Edit button on each card.
2. View button remains unchanged (disabled).
3. Assess Task button has `aria-label="Assess Task"`.
4. Card width stays within 268 px with the new icon button.

Playwright E2E tests (card-level):

5. **Assess Task button on cards**: Verify each card has View (disabled) and Assess Task (enabled, icon-only, with tooltip). Hover over the Assess Task button and verify the tooltip "Assess Task" appears. Verify Assess Task button has `aria-label="Assess Task"`.
6. **Existing Classes page regression after button swap**: Run the existing `classes-page.spec.ts` suite after updating helpers. Verify all tests pass.

### Section checks

- `npm run test:frontend -- src/pages/ClassesPage.spec.tsx`
- `npm run test:frontend:e2e -- e2e-tests/classes-page.spec.ts` (regression after button swap)
- `npm run lint:frontend` passes with no new warnings.
- Manual: verify card width does not overflow at 268 px.
- Mandatory-read evidence gate passed for all delegated handoffs.

### Implementation notes / deviations / follow-up

- `EXPECTED_BUTTONS_PER_CARD = 2` is unchanged (View + Assess Task still equals 2 since Edit is replaced).
- Update `assertAllViewEditButtonsDisabled` to `assertCardButtonStates` reflecting View (disabled) + Assess Task (enabled). The function body must change from asserting all View and Edit buttons are disabled to asserting View buttons are disabled and Assess Task buttons (`aria-label="Assess Task"`) are enabled.
- **Critical**: Add `'getGoogleClassroomAssignments'` to the `allMethods` array inside `installRuntimeMock` in `endToEndRuntimeMocks.ts`. Search for `allMethods` in the file to locate the array. Without this entry, the mock will silently refuse all calls to the new method.
- The `RuntimeScenario` type in `endToEndRuntimeMocks.ts` needs `getGoogleClassroomAssignments?: ReadonlyArray<ResponseItem>`.

---

## Section 5 — Frontend: AssessTaskModal component and modal E2E tests

### Objective

Create the `AssessTaskModal` component with all five states and wire it to the card button from Section 4. Verify the full modal workflow with E2E tests.

### Constraints

- Modal uses Ant Design `Modal`, `Select`, `Button`, `Alert`, `Spin`, `Empty`, `Space`, and `Typography`.
- Modal title: `"Assess Task — {className}"` where `className` comes from the card's `ClassPartial`.
- Fetch assignments on modal open via `useEffect` + local `useState` (not React Query — transient data tied to modal lifecycle).
- Error state: show `Alert type="error"` inside modal body, no dropdown visible, Start Assessment disabled.
- Loading state: show `Spin` centred in modal body, Start Assessment disabled.
- Ready state (no selection): show `Select` with placeholder, "Select assignment" label above, Start Assessment disabled.
- Ready state (selection made): show `Select` with value, `Typography.Text type="secondary"` below confirming selection, Start Assessment enabled.
- Empty state: show `Empty` with message "No assignments found for this class", Start Assessment disabled.
- "Start Assessment" click is a no-op (no loading state, no navigation).
- Cancel and mask click close the modal; any selection is discarded.
- Internal state (selection, loading, error) must reset on each open.
- Reset via `key={classId}` on the modal — this guarantees a fresh mount (and thus fresh internal state) whenever a different class's card is clicked. This is the sole reset mechanism per `ASSESS_TASK_MODAL_LAYOUT.md` §Motion.
- Do **not** set `destroyOnHidden`. Per the layout spec, this modal has no form state to reset, so `destroyOnHidden` adds unnecessary DOM remounts without benefit. The `key={classId}` reset and the `useEffect` triggered by `open` are sufficient.
- Follow `frontend-modal-patterns.md` §7 for error display pattern.
- Follow `frontend-loading-and-width-standards.md` for loading states.

### Delegation mandatory reads

Implementation mandatory docs:

- `SPEC.md`
- `ASSESS_TASK_MODAL_LAYOUT.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/ant-design-docs-cache/modal.md`
- `docs/developer/frontend/ant-design-docs-cache/select.md`
- `docs/developer/frontend/ant-design-docs-cache/spin.md`
- `docs/developer/frontend/ant-design-docs-cache/alert.md`
- `docs/developer/frontend/ant-design-docs-cache/empty.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `src/frontend/src/features/classes/BulkDeleteModal.tsx` (reference modal pattern)
- `src/frontend/src/services/googleClassroomAssignmentsService.ts` (new service from Section 3)
- `src/frontend/src/pages/ClassesPage.tsx` (updated in Section 4 — button now opens this modal)
- `src/frontend/e2e-tests/helpers/classes-page-end-to-end-helpers.ts` (mock scenario helpers from Section 4)
- `docs/developer/frontend/frontend-testing.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `ASSESS_TASK_MODAL_LAYOUT.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `src/frontend/AGENTS.md`

### Shared helper plan

1. Helper: `AssessTaskModal` component
   - Decision: `keep local`
   - Owning path: `src/frontend/src/features/classes/AssessTaskModal.tsx`
   - Call-site rationale: single caller (ClassesPage), one-off workflow; per `frontend-modal-patterns.md` §4 keep-local rule
   - Relevant canonical doc target: N/A (keep-local, no planned extraction)
   - Planned doc status: N/A

### Acceptance criteria

- Modal opens with correct title including class name.
- Loading state shows spinner with Start Assessment disabled.
- Ready state shows dropdown populated with assignments.
- Selecting an assignment enables Start Assessment and shows confirmation text.
- Empty state shows Empty component when course has no assignments.
- Error state shows Alert when fetch fails.
- Start Assessment click does nothing (no visual state change beyond native click feedback).
- Cancel and mask click close modal and discard selection.
- Opening modal for a different class resets state.
- Footer layout stays stable across all states (Cancel and Start Assessment buttons always present).
- All E2E tests covering modal states and interactions pass.

### Required test cases (Red first)

Frontend component tests:

1. Modal renders with correct title including `className`.
2. Loading state: `Spin` visible, Select not rendered, Start Assessment disabled. Cancel button is present.
3. Ready state (no selection): Select visible with placeholder, "Select assignment" `Typography.Text` label visible above Select, Start Assessment disabled. Cancel button is present.
4. Ready state (selection made): Select shows value, confirmation text visible, Start Assessment enabled. Cancel button is present.
5. Empty state: `Empty` visible, Start Assessment disabled. Cancel button is present.
6. Error state: `Alert` visible, Select not rendered, Start Assessment disabled. Cancel button is present.
7. Selecting assignment then clicking Cancel closes modal.
8. Clicking mask closes modal.
9. Fetch called on modal open, not on component mount.
10. Reopening modal for different class triggers fresh fetch.
11. Start Assessment click does not trigger any backend call.
12. Footer renders both Cancel and Start Assessment buttons in all five states (loading, ready-no-selection, ready-selection-made, empty, error).

Playwright E2E tests (modal workflow):

13. **Modal open via button click**: Click Assess Task on a specific card. Verify modal opens with title "Assess Task — {className}". Verify modal has Select dropdown and disabled Start Assessment button.
14. **Select assignment and enable Start Assessment**: With mock assignments returned, select one. Verify Start Assessment becomes enabled. Verify selected title appears below dropdown as confirmation text.
15. **Start Assessment click is no-op**: With assignment selected, click Start Assessment. Verify modal stays open, no backend call is made, no visual state change beyond native click feedback.
16. **Cancel closes modal**: Open modal, select assignment, click Cancel. Verify modal closes and state is discarded.
17. **Mask click closes modal**: Open modal, click backdrop. Verify modal closes.
18. **Reopen modal resets state**: Open modal for class A, select assignment, close. Open modal for class B. Verify fresh fetch, no stale selection.
19. **Error state**: Mock `getGoogleClassroomAssignments` to return failure. Open modal. Verify `Alert` with error message is shown, Start Assessment is disabled.
20. **Empty state**: Mock `getGoogleClassroomAssignments` to return empty array. Open modal. Verify `Empty` component with "No assignments found for this class" is shown, Start Assessment is disabled.
21. **Loading state**: Verify loading spinner appears when modal opens and is replaced by Select after fetch completes.

### Section checks

- `npm run test:frontend -- src/features/classes/AssessTaskModal.spec.tsx`
- `npm run test:frontend:e2e -- e2e-tests/classes-page-assess-task.spec.ts` (new modal E2E file)
- `npm run lint:frontend` passes with no new warnings.
- Mandatory-read evidence gate passed for all delegated handoffs.

### Optional `@remarks` JSDoc follow-through

- Document why this modal uses local state + `useEffect` instead of React Query (transient data, no caching benefit, single caller).
- Document why `destroyOnHidden` is deliberately **not** used (no form state to reset; `key={classId}` alone provides fresh-mount reset for different classes; `useEffect` triggered by `open` handles same-class reopens).

---

## Section 6 — Regression and contract hardening

### Objective

Ensure no regressions across all touched surfaces and verify the full feature works end-to-end with the existing Classes page E2E suite.

### Constraints

- All existing backend tests must pass.
- All existing frontend unit tests must pass.
- All existing frontend E2E tests must pass (including the updated `classes-page.spec.ts` from Section 4).
- Lint must pass for all touched components.

### Acceptance criteria

- `npm run test:backend` — all backend tests passing.
- `npm run test:frontend` — all frontend unit tests passing, coverage ≥ 85%.
- `npm run test:frontend:e2e` — all frontend E2E tests passing (both existing and new).
- `npm run lint:backend` — clean.
- `npm run lint:frontend` — clean.

### Required test cases/checks

1. Run backend test suite: `npm run test:backend`.
2. Run frontend unit suite: `npm run test:frontend`.
3. Run frontend E2E suite: `npm run test:frontend:e2e`.
4. Run backend lint: `npm run lint:backend`.
5. Run frontend lint: `npm run lint:frontend`.
6. Run all lint: `npm run lint`.
7. Run all tests: `npm test`.
8. Verify mandatory-read evidence (`Files read`) is complete for every delegated handoff.
9. **Existing Classes page regression**: Verify the existing `classes-page.spec.ts` suite passes after the helper updates from Section 4.

### Section checks

- All commands above return clean.
- No new lint warnings or errors.
- Coverage thresholds maintained.

### Implementation notes / deviations / follow-up

- Record helper reconciliation in canonical docs:
  - `docs/developer/backend/AssessmentFlow.md`: add `fetchCourseWork` to Shared Helper Status as `Implemented`.
  - `docs/developer/backend/api-layer.md`: add `getGoogleClassroomAssignments` to Current migrated endpoints.
  - `docs/developer/frontend/frontend-react-query-and-prefetch.md`: add `googleClassroomAssignments` query key.
