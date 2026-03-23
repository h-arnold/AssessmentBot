# Feature Delivery Plan (TDD-First)

## Scope and assumptions

### Scope

- Implement the Classes CRUD feature in the **Classes** tab on the top-level `SettingsPage`.
- Replace the current placeholder Classes-tab content in `src/frontend/src/pages/SettingsPage.tsx` with a real feature entry for CRUD-only class management.
- Use `CLASSES_TAB_LAYOUT_AND_MODALS.md` as the UI-layout and modal-state companion document for implementation details that sit below the product/data-contract level.
- Update backend reference-data models, controllers, and API handlers so cohorts and year groups use stable keys.
- Update `ABClass` transport and persistence contracts so class metadata stores `cohortKey` and `yearGroupKey` rather than mutable display names.
- Add the required frontend services, Zod schemas, React Query definitions, view-model mapping, page UI, modal workflows, browser-test harness support, and automated test coverage.
- Update shared prefetch behaviour so `cohorts` and `yearGroups` warm at startup alongside `classPartials` under the app-level auth/warm-up boundary, while `googleClassrooms` remains a Classes-tab entry prefetch.
- Add backend validation to prevent `active` updates from creating missing classes and to block deletion of in-use cohort or year-group records.
- Add `startYear` and `startMonth` to the cohort model so cohort-year calculations remain possible after moving to stable keys.
- Add a bulk/single-row edit workflow for `courseLength` alongside the other class metadata actions.
- Update class partial responses to return keys plus resolved cohort and year-group labels.
- Update the plan and rollout notes to record that some assessment-workflow paths depend on the current numeric `ABClass.yearGroup` behaviour and will require follow-on refactor work outside this delivery.

### Out of scope

- Class analysis features on the Settings-page Classes tab.
- Assessment-run controls on the Settings-page Classes tab.
- Inline editing inside the table.
- Dedicated bulk backend endpoints in this delivery.
- Manual Google Classroom refresh controls in this delivery.
- Builder changes unless implementation uncovers a genuine build-pipeline blocker.

### Assumptions

1. Rollout uses a one-off destructive reset of existing persisted data, so the new code may treat the key-based reference-data and `ABClass` contracts as blank-slate shapes without compatibility or backfill logic.
2. All cohort and year-group records are keyed records. Cohort keys and year-group keys are generated as UUIDs on create and remain immutable on rename.
3. Cohorts add `startYear` and `startMonth` as part of the v1 stable-key contract.
4. `googleClassrooms` remains a narrow page-entry dataset returning active Classroom rows only; the backend API surface already exists and this delivery adds the missing frontend service/query integration.
5. Frontend shared server-state continues to use React Query with shared query-key helpers and transport access routed through `callApi(...)` only.
6. The app-level auth/warm-up boundary owns startup readiness for `classPartials`, `cohorts`, and `yearGroups`.
7. The current `apiHandler` envelope remains the transport contract; changed payload shapes should be introduced through existing allowlisted methods unless implementation proves a new method is required.
8. Bulk actions are also the single-row edit path; selecting one row uses the same workflow and transport behaviour.
9. Bulk requests dispatch one request per selected row in parallel, continue across the full selection, and report failures per row.
10. Newly created classes default to `active=true`.
11. Class partial responses return keys plus resolved cohort and year-group labels.
12. All user-visible interactions introduced by this feature require Playwright coverage in addition to appropriate Vitest coverage.
13. Some assessment-workflow paths currently depend on `ABClass.yearGroup` as a numeric academic-year field; that downstream refactor is out of scope for this delivery and must be recorded in follow-up documentation.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API and entry points thin and delegate behaviour to controllers, services, hooks, or view-model helpers.
- Fail fast on invalid inputs, missing reference data, and persistence failures.
- Avoid defensive guards that hide wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.
- Keep `SettingsPage.tsx` as a composition layer; do not move feature orchestration into page-level shell components.
- Route all frontend-to-backend calls through `callApi(...)`; never call backend globals or `google.script.run` directly from feature code.
- Use Zod for new or updated frontend validation logic and derive TypeScript types from schemas.
- When shared server-state is introduced or changed, use shared query-key helpers and update canonical React Query documentation if policy changes.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section’s acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Validation commands hierarchy

- Backend lint: `npm run lint`
- Frontend lint: `npm run frontend:lint`
- Builder lint (if touched): `npm run builder:lint`
- Backend tests: `npm test -- <target>`
- Frontend unit tests: `npm run frontend:test -- <target>`
- Frontend e2e tests: `npm run frontend:test:e2e -- <target>`
- Frontend coverage (run after Green for a completed slice or before sign-off, not as the default per-section check): `npm run frontend:test:coverage`
- Frontend type-check: `npm exec tsc -- -b src/frontend/tsconfig.json`

---

## Section 1 — Reference-data key contract groundwork

### Objective

- Establish the stable-key contract for cohorts and year groups across models, controllers, API surfaces, transport docs, and frontend schemas before any UI work begins.

### Constraints

- Keep API handlers thin and push record-shape logic into the relevant model/controller layers.
- Preserve current cohort active-state semantics while introducing keys.
- Do not silently repurpose existing name fields to carry keys; keep key and display-name responsibilities explicit.
- Treat the new key-based reference-data shape as the only supported contract for this delivery.
- Generate UUID keys on create and keep them immutable on rename.
- All CRUD request shapes must identify target reference-data records by `key`, not by mutable display name.
- Cohorts must include `startYear` and `startMonth`, with defaults applied from the agreed academic-year rule.

### Acceptance criteria

- Cohort and year-group records expose stable keys in backend and frontend contracts.
- Backend and frontend code can rely on the blank-slate key-based contract without compatibility fallbacks.
- Backend and frontend schemas agree on the new reference-data shapes.
- The changed contract is reflected in the relevant canonical docs or queued explicitly in the documentation section.
- Cohort records expose `key`, `name`, `active`, `startYear`, and `startMonth`.
- Year-group records expose `key` and `name`.
- CRUD request and response shapes for reference data are fully keyed.

### Required test cases (Red first)

Backend model tests:

1. Cohort model serialises and deserialises `{ key, name, active, startYear, startMonth }` correctly.
2. Year-group model serialises and deserialises `{ key, name }` correctly.
3. Cohort and year-group constructors reject missing or malformed keys.
4. Cohort defaulting sets `startMonth` to September and derives `startYear` from the current month/year using the agreed academic-year rule.

Backend controller tests:

1. Reference-data list methods return keys and names in the expected plain-object shape.
2. Create and update paths preserve key integrity and duplicate protection rules.
3. Create and update paths for cohorts preserve `startYear` and `startMonth` rules.

API layer tests:

1. `getCohorts`, `createCohort`, `updateCohort`, `getYearGroups`, `createYearGroup`, and `updateYearGroup` expose the new key-bearing payloads.
2. Invalid reference-data payloads surface `INVALID_REQUEST` envelopes through the API layer when applicable.
3. Keyed update and delete request shapes are validated at the API boundary.

Frontend tests:

1. Updated Zod schemas accept valid key-bearing cohort and year-group payloads.
2. Updated frontend service contracts reject malformed key-bearing payloads.
3. Updated frontend schemas enforce the keyed CRUD request shapes.

### Section checks

- `npm test -- tests/api/<reference-data-api-targets>.test.js`
- `npm test -- tests/controllers/<reference-data-controller-targets>.test.js`
- `npm run frontend:test -- src/services/referenceData.zod.spec.ts src/services/referenceDataService.spec.ts`
- `npm run lint`
- `npm run frontend:lint`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` where key-generation or contract-shaping behaviour would otherwise be non-obvious.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 2 — `ABClass` contract update and partial-shape refresh

### Objective

- Update `ABClass` persistence and transport so class metadata stores `cohortKey` and `yearGroupKey`, and ensure partial responses match the new contract.

### Constraints

- Keep `ABClass.toJSON()` and `ABClass.toPartialJSON()` as the canonical source of truth for persisted and transport shapes.
- Preserve existing non-reference-data behaviour such as class-owner, teacher, and active-field handling.
- Treat the key-based `ABClass` metadata shape as the only supported contract for this delivery.

### Acceptance criteria

- `ABClass` serialisation and deserialisation use `cohortKey` and `yearGroupKey`.
- `getABClassPartials` returns the updated shape without leaking storage metadata and includes keys plus resolved cohort/year-group labels.
- Backend API docs and data-shape docs are ready to reflect the changed class-partial contract.
- Frontend service/schema code can parse the new partial shape.

### Required test cases (Red first)

Backend model tests:

1. `ABClass.toJSON()` emits `cohortKey` and `yearGroupKey`.
2. `ABClass.toPartialJSON()` emits `cohortKey`, `cohortName`, `yearGroupKey`, and `yearGroupName`.
3. `ABClass.fromJSON()` reconstructs key-based metadata correctly.

Backend controller tests:

1. `ABClassController.getAllClassPartials()` normalises and returns the key-based partial shape.
2. Partial upsert paths preserve the new metadata fields.

API layer tests:

1. `getABClassPartials` returns the updated payload shape through the transport layer.

Frontend tests:

1. `classPartials` Zod schema accepts the new key-based partial shape with resolved labels.
2. `classPartialsService` returns validated key-based partials with resolved labels.

### Section checks

- `npm test -- tests/models/abclass*.test.js tests/controllers/abclass-*.test.js tests/api/abclassPartials.test.js`
- `npm run frontend:test -- src/services/classPartials.zod.spec.ts src/services/classPartialsService.spec.ts`
- `npm run lint`
- `npm run frontend:lint`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` where key-based partial-shape behaviour would otherwise be hard to infer.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 3 — `ABClass` mutation validation hardening

### Objective

- Harden `upsertABClass`, `updateABClass`, and reference-data delete flows so they enforce the new key-based contracts and prevent invalid lifecycle mutations.

### Constraints

- Keep API-layer methods thin; put behavioural rules in controllers and/or dedicated validation helpers.
- Do not allow `active` updates to create missing classes.
- Delete guards for cohorts and year groups must be backend-authoritative.
- Use `abclass_partials` as the preferred source for in-use reference-data checks unless implementation proves it insufficient.

### Acceptance criteria

- `upsertABClass` accepts key-based metadata, rejects invalid keys, and defaults newly created classes to `active=true`.
- `updateABClass` rejects `active` updates when the class does not already exist.
- `deleteCohort` and `deleteYearGroup` fail when any stored `ABClass` still references the target key.
- Failure cases map cleanly to transport errors without hidden fallback behaviour.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. `ABClassController.upsertABClass()` rejects unknown `cohortKey` or `yearGroupKey` values and defaults newly created classes to `active=true`.
2. `ABClassController.updateABClass()` rejects `active` patches for missing classes.
3. `ReferenceDataController.deleteCohort()` rejects deletion of an in-use cohort key.
4. `ReferenceDataController.deleteYearGroup()` rejects deletion of an in-use year-group key.

API layer tests:

1. `upsertABClass` surfaces invalid key payloads as transport errors and returns newly created rows as active by default.
2. `updateABClass` surfaces invalid active-on-missing attempts as transport errors.
3. `deleteCohort` and `deleteYearGroup` surface in-use deletion failures as transport errors.

Frontend tests:

1. Updated frontend services correctly surface the new invalid-request cases to callers.

### Section checks

- `npm test -- tests/controllers/abclass-*.test.js tests/controllers/<reference-data-controller-targets>.test.js tests/api/abclassMutations.test.js tests/api/<reference-data-api-targets>.test.js`
- `npm run frontend:test -- src/services/referenceDataService.spec.ts src/services/classPartialsService.spec.ts`
- `npm run lint`
- `npm run frontend:lint`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to any validation helper or controller method where the reject-on-active-update rule or in-use delete guard may surprise future maintainers.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 4A — Frontend service and schema groundwork

### Objective

- Add or update the frontend service wrappers and Zod schemas needed by the Classes CRUD feature.

### Constraints

- Keep all backend access inside service modules that use `callApi(...)`.
- Runtime validation must happen at the service boundary before data is cached.
- Limit this section to service/schema behaviour only; do not depend on app-level warm-up or page-shell UI state here.

### Acceptance criteria

- A frontend `googleClassrooms` service and adjacent Zod schema exist.
- Updated frontend schemas and services support keyed cohorts, keyed year groups, and class partials with keys plus resolved labels.
- Service contracts preserve the `callApi(...)` transport boundary.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. Extend backend transport tests only if the frontend work uncovers a genuine transport mismatch.

Frontend tests:

1. `googleClassrooms` Zod schema accepts valid rows and rejects malformed payloads.
2. `googleClassroomsService` delegates to `callApi('getGoogleClassrooms')` and validates responses.
3. Updated reference-data schemas accept keyed payloads and reject malformed key-bearing payloads.
4. Updated class-partial schema accepts keys plus resolved labels and rejects malformed payloads.

### Section checks

- `npm run frontend:test -- src/services/googleClassrooms.zod.spec.ts src/services/googleClassroomsService.spec.ts src/services/referenceData.zod.spec.ts src/services/classPartials.zod.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` where new service/schema behaviour would not be obvious from type names alone.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 4B — Shared query keys and query-options groundwork

### Objective

- Add the shared query keys and query-option helpers needed by the Classes CRUD feature.

### Constraints

- Define shared query keys through `queryKeys.ts` only.
- Keep this section limited to query-key and query-option wiring.
- Do not implement startup readiness ownership or UI failure states in this section.

### Acceptance criteria

- Shared query helpers exist for `googleClassrooms`, `cohorts`, `yearGroups`, and `classPartials` as needed.
- Query helpers delegate to the validated service-layer functions introduced earlier.
- The canonical React Query documentation is updated if the shared-query baseline changes in this section.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. None.

Frontend tests:

1. Shared query helpers expose the correct query keys and query functions for `googleClassrooms`.
2. Shared query helpers expose the correct query keys and query functions for `classPartials`, `cohorts`, and `yearGroups`.
3. Shared query helper tests remain focused on query wiring rather than page-level readiness state.

### Section checks

- `npm run frontend:test -- src/query/queryKeys.spec.ts src/query/sharedQueries.query.spec.tsx`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` only if query-key naming or view-entry prefetch choices would otherwise be surprising.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 4C — App-level startup warm-up ownership and readiness contract

### Objective

- Implement the app-level warm-up ownership model for `classPartials`, `cohorts`, and `yearGroups` after authorisation.

### Constraints

- The app-level auth/warm-up boundary owns startup readiness.
- Startup warm-up fetches `classPartials`, `cohorts`, and `yearGroups` after authorisation.
- The warm-up client is considered ready only when all three startup-prefetched datasets succeed.
- Keep this section limited to readiness ownership and query orchestration; do not require the full Classes-tab UI shell yet.
- Startup warm-up does not add extra retry loops beyond the existing `apiHandler` retry behaviour.

### Acceptance criteria

- App-level warm-up orchestration fetches `classPartials`, `cohorts`, and `yearGroups` after authorisation.
- The warm-up marker is set only after all three startup-prefetched datasets resolve successfully.
- Startup readiness state is exposed in a way later Classes-tab sections can consume without duplicating warm-up logic.
- A failed startup-prefetch path remains a warm-up failure state owned by the app-level boundary, ready for later UI sections to render as blocking.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. None.

Frontend tests:

1. Startup warm-up orchestration fetches `classPartials`, `cohorts`, and `yearGroups` after authorisation.
2. The warm-up marker is set only after all three startup-prefetched datasets resolve successfully.
3. A failed startup-prefetch path leaves startup readiness unresolved and does not silently mark the app as warmed.
4. Existing auth-state behaviour remains intact for unauthorised and transport-failure cases.

### Section checks

- `npm run frontend:test -- src/features/auth/AppAuthGate.auth.spec.tsx src/query/sharedQueries.query.spec.tsx`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` where startup readiness ownership or warm-up gating semantics differ from the previous baseline.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 4D — Shared-query invalidation and post-mutation refetch contract

### Objective

- Define and implement the shared-query invalidation contract for reference-data mutations and the default re-fetch-failure behaviour.

### Constraints

- Cohort and year-group mutations invalidate and refresh the relevant shared queries.
- The default assumption is that stale table data should not remain visible if a required re-fetch fails.
- If a mutation succeeds but the follow-up re-fetch fails, the UI contract must preserve the success result while also warning that the page must be refreshed to see the latest data.
- Keep this section focused on contract and query behaviour; full page-level alert rendering lands later.

### Acceptance criteria

- Cohort and year-group mutation flows invalidate the correct shared queries.
- The post-success re-fetch contract is documented and encoded so later UI sections can show: successful update, failed refresh, and refresh-the-page guidance.
- Shared-query helpers expose the invalidation behaviour needed by later modal and table sections.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. None unless the invalidation work uncovers a transport mismatch.

Frontend tests:

1. Cohort mutation flows invalidate the `cohorts` query.
2. Year-group mutation flows invalidate the `yearGroups` query.
3. The post-success re-fetch-failure contract is represented in the feature or helper state without silently treating stale data as valid current data.

### Section checks

- `npm run frontend:test -- src/query/sharedQueries.query.spec.tsx src/features/classes/queryInvalidation.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` where re-fetch-failure handling or invalidation choices would otherwise be hard to infer.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 4E — Browser-test harness and transport-scenario fixtures

### Objective

- Establish the mocked browser-test fixtures needed to cover the visible Classes CRUD journeys deterministically.

### Constraints

- Follow the canonical frontend testing split: invisible behaviour in Vitest, visible behaviour in Playwright.
- Use the shared `google.script.run.apiHandler` mock rule documented in the frontend testing guidance.
- Keep this section focused on harness and scenario setup only.

### Acceptance criteria

- A shared Playwright scenario harness exists for the Classes CRUD feature.
- Shared fixtures cover at least: ready state, startup warm-up failure, Google Classroom entry failure, no-active-classrooms empty state, and a representative partial-success batch outcome.
- The harness allows later Playwright sections to focus on user-visible behaviour instead of duplicating transport mocking logic.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. None.

Frontend tests:

1. Harness-level tests or smoke journeys prove the Playwright fixture layer can drive the major visible state groups deterministically.
2. The mocked transport setup follows the shared frontend testing helper rules.

### Section checks

- `npm run frontend:test:e2e -- e2e-tests/classes-crud.harness.spec.ts`
- `npm run frontend:lint`

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 5A — Settings-page Classes-tab feature shell

### Objective

- Replace the placeholder Settings-page Classes-tab content with a real feature shell that consumes app-level readiness and page-entry query state.

### Constraints

- Keep `SettingsPage.tsx` thin and move orchestration into a feature hook or feature entry component.
- This section should not yet depend on the full merged table or modal workflows.
- The shell must be able to consume the app-owned startup readiness state introduced earlier.

### Acceptance criteria

- The Settings-page Classes tab renders a real feature entry component.
- The feature shell consumes app-level startup readiness and page-entry Google Classroom query state.
- The shell exposes only the minimal states needed for later table and alert sections.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. None.

Frontend tests:

1. `SettingsPage` renders the Classes-tab management feature entry.
2. The feature shell consumes the app-level warm-up state correctly.
3. The feature shell exposes the expected ready/loading/failure state contract for later sections.

### Section checks

- `npm run frontend:test -- src/pages/SettingsPage.spec.tsx src/features/classes/ClassesManagementPanel.spec.tsx src/features/classes/useClassesManagementShell.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` if the shell exists mainly to preserve the Settings-page composition boundary and that would not be obvious from the final code.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 5B — Merged row view-model derivation and default sorting

### Objective

- Build the merged row view model that combines Google Classroom rows, class partials, and resolved reference-data labels.

### Constraints

- Keep row derivation and sorting in pure helpers where possible.
- Class partials return keys plus resolved labels; the frontend should not need a second name-join just to render the baseline table.
- Sorting defaults must follow the agreed order.

### Acceptance criteria

- The merged row view model correctly combines Google Classroom rows, stored `ABClass` partials, and resolved label data.
- Default sort order is active, inactive, not created, then orphaned.
- The view-model helper can be tested independently of the rendered page shell.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. None.

Frontend tests:

1. The merged view-model helper derives the correct status for active, inactive, not-created, and orphaned rows.
2. The merged view-model helper preserves keys and resolved labels for cohorts and year groups.
3. The default sort order is applied correctly.

### Section checks

- `npm run frontend:test -- src/features/classes/classesManagementViewModel.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to the view-model helper if status resolution or sort precedence is non-obvious.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 6 — Main table rendering, selection, and status affordances

### Objective

- Implement the Ant Design table, row selection behaviour, status column, tooltips, and core read-only rendering rules for the Classes CRUD page.

### Constraints

- Use Ant Design table facilities such as `rowSelection` rather than bespoke checkbox wiring.
- Keep cells declarative and move data shaping into view-model code.
- Orphaned rows must be clearly identifiable and deletion-only.
- Bulk actions are also the single-row edit path; there is no separate row-edit affordance in v1.
- Selection should follow the common predictable path: after partial failure, only failed rows remain selected if still present; after delete or tab re-entry, selection resets to the currently visible eligible state.
- Any user-visible interaction introduced here must receive Playwright coverage.

### Acceptance criteria

- The table renders the agreed columns and row states.
- Not-created rows display unavailable fields as `—`.
- Orphaned rows display a warning affordance with explanatory tooltip.
- Row selection works correctly across eligible and ineligible states.
- Selection reset and retention behaviour follows the documented defaults.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. None.

Frontend tests:

Vitest:

1. Table renders the required columns and row content for active, inactive, `notCreated`, and orphaned rows.
2. Selection state updates correctly when rows are toggled from no selection to mixed and fully eligible selections.
3. Ineligible rows or actions surface the correct disabled states or tooltips, including deletion-only orphaned rows.
4. Selection reset and failed-row-retention rules behave as documented.
5. Summary-card counts and selection-summary text update correctly for mixed row-state datasets.

Playwright:

1. User opens the Settings page, switches to the Classes tab, and sees the default sorted table with summary and toolbar cards.
2. User sees the no-selection state with the bulk-action trigger disabled and the selection summary reset.
3. User selects eligible and ineligible rows and sees the correct enabled, disabled, and tooltip-backed bulk affordances.
4. User sees the first-run `notCreated` rendering and the orphaned warning affordance in the live table.

### Section checks

- `npm run frontend:test -- src/features/classes/ClassesTable.spec.tsx src/features/classes/ClassesToolbar.spec.tsx src/features/classes/selectionState.spec.ts`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-table.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to any table column factory or selection helper where status-specific affordances or selection-reset rules may be non-obvious.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 7 — Bulk create, delete, and active-state workflows

### Objective

- Implement the first set of modal-driven bulk workflows: create `ABClass`, delete `ABClass`, and set active or inactive.

### Constraints

- Bulk actions are also the single-row edit path.
- Bulk requests dispatch one request per selected row in parallel.
- Execution continues for every selected row and reports failures per row rather than stopping on first error.
- Summary ordering should follow the row order captured at submit time so user feedback remains predictable.
- If the user closes a modal while requests are already in flight, those requests continue; there is no cancellation mechanism in this delivery.
- Bulk actions must keep failed rows selected after partial failure.
- Create uses `cohortKey`, `yearGroupKey`, and `courseLength` with default `1`.
- Newly created classes default to `active=true`.
- Delete copy must make clear that both full and partial `ABClass` records are removed.
- Active-state updates must never create missing classes.
- Partial-failure modals remain open briefly with inline feedback, then close and hand off the persistent result to the top-level alert stack.

### Acceptance criteria

- Bulk create works for `notCreated` rows only.
- Bulk create sets `active=true` by default for newly created classes.
- Bulk delete works for active, inactive, and orphaned rows.
- Bulk set active or inactive works only for eligible existing rows.
- Partial-success summaries are shown and failed rows remain selected.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None beyond those already added if no new backend behaviour is required in this section.

API layer tests:

1. Extend mutation transport tests only if the frontend workflow reveals a transport mismatch.

Frontend tests:

Vitest:

1. Bulk create modal covers opening, ready, validation-error, submitting, partial-success-briefly-open, and success-close states.
2. Bulk create validates required cohort and year-group inputs, applies the default `courseLength` of `1`, dispatches one mutation per selected row in parallel, and marks created classes active by default.
3. Bulk delete confirmation copy states that both full and partial stored class records are removed.
4. Bulk delete workflow covers ready, submitting, partial-success-briefly-open, and submission-failure summary mapping.
5. Bulk active-state action blocks ineligible selections before open and maps submitting and partial-success outcomes correctly.
6. Partial failures keep failed rows selected and drive the top-level mutation summary state expected by the tab.
7. Closing the modal while requests are already in flight does not cancel the outstanding requests.

Playwright:

1. User selects `notCreated` rows, opens Bulk create, sees active-cohort-only options, validates required fields, and completes a successful create flow with active rows after refresh.
2. User triggers a bulk-create partial failure and sees inline warning feedback briefly before the modal closes and the tab-level summary persists.
3. User opens Bulk delete, sees the destructive copy, confirms, and receives success or partial-failure summary feedback.
4. User attempts an ineligible bulk active/inactive action and sees the blocked-before-open explanation.
5. User completes an eligible bulk active or inactive confirmation flow and sees the tab-level summary update after the modal closes.

### Section checks

- `npm run frontend:test -- src/features/classes/bulkCreate.spec.tsx src/features/classes/bulkDelete.spec.tsx src/features/classes/bulkActiveState.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-bulk-core.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` where batch-processing semantics, parallel dispatch, failed-row retention, or modal-close timing could confuse future maintainers.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 8 — Bulk set cohort workflow

### Objective

- Implement the bulk cohort update workflow for active and inactive classes.

### Constraints

- Bulk actions are also the single-row edit path.
- Cohort selectors must only offer active cohorts for assignment.
- Requests dispatch one per selected row in parallel and continue across the full selection.
- Partial-failure modals remain open briefly with inline feedback before closing.

### Acceptance criteria

- Bulk set cohort works for eligible active/inactive rows.
- Cohort selection offers only active cohorts.
- Partial failures keep failed rows selected and the tab-level summary reflects the final outcome after close.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None beyond any additional cases revealed by the workflow.

API layer tests:

1. Extend mutation transport tests only if a payload-shape or error-mapping mismatch is discovered.

Frontend tests:

Vitest:

1. Bulk cohort modal covers ready, validation-error, submitting, and partial-success-briefly-open states and offers only active cohorts.
2. Bulk cohort workflow dispatches one request per selected row in parallel and preserves failed-row selection.

Playwright:

1. User opens Bulk set cohort, sees active cohorts only, submits a valid change, and receives summary feedback.

### Section checks

- `npm run frontend:test -- src/features/classes/bulkSetCohort.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-bulk-cohort.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` where active-only cohort selection or partial-failure timing would not be obvious.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 9 — Bulk set year-group workflow

### Objective

- Implement the bulk year-group update workflow for active and inactive classes.

### Constraints

- Bulk actions are also the single-row edit path.
- Requests dispatch one per selected row in parallel and continue across the full selection.
- Partial-failure modals remain open briefly with inline feedback before closing.

### Acceptance criteria

- Bulk set year group works for eligible active/inactive rows.
- Partial failures keep failed rows selected and the tab-level summary reflects the final outcome after close.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None beyond any additional cases revealed by the workflow.

API layer tests:

1. Extend mutation transport tests only if a payload-shape or error-mapping mismatch is discovered.

Frontend tests:

Vitest:

1. Bulk year-group modal covers ready, validation-error, submitting, and partial-success-briefly-open states with key-based options and payloads.
2. Bulk year-group workflow dispatches one request per selected row in parallel and preserves failed-row selection.

Playwright:

1. User opens Bulk set year group, submits a valid change, and sees the updated value reflected after refresh.

### Section checks

- `npm run frontend:test -- src/features/classes/bulkSetYearGroup.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-bulk-year-group.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` where year-group option handling or partial-failure timing would not be obvious.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 10 — Bulk set course-length workflow

### Objective

- Implement the course-length edit workflow for existing classes using the same bulk modal pattern as the other class metadata updates.

### Constraints

- Bulk actions are also the single-row edit path.
- Requests dispatch one per selected row in parallel and continue across the full selection.
- `courseLength` must validate as an integer greater than or equal to `1`.
- Partial-failure modals remain open briefly with inline feedback before closing.

### Acceptance criteria

- Existing active/inactive classes can update `courseLength` through a dedicated bulk modal.
- The same workflow supports single-row edits by selecting one row.
- Partial failures keep failed rows selected and the tab-level summary reflects the final outcome after close.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None beyond any additional cases revealed by the workflow.

API layer tests:

1. Extend mutation transport tests only if a payload-shape or error-mapping mismatch is discovered.

Frontend tests:

Vitest:

1. Bulk course-length modal covers ready, validation-error, submitting, and partial-success-briefly-open states.
2. Bulk course-length workflow validates integer input, dispatches one request per selected row in parallel, and preserves failed-row selection.

Playwright:

1. User selects one or more existing classes, opens Bulk set course length, submits a valid value, and sees the updated value reflected after refresh.

### Section checks

- `npm run frontend:test -- src/features/classes/bulkSetCourseLength.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-bulk-course-length.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` where course-length validation or bulk-single-row dual use would not be obvious.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 11 — Cohort management modal

### Objective

- Implement the cohort management modal flows for create, edit, active-state change, and delete.

### Constraints

- Reference-data delete actions open a confirmation modal.
- Blocked delete state shows a disabled delete button plus explanatory warning state inside the confirmation modal.
- A blocked delete response keeps the modal open with inline feedback until the user closes it.
- Successful mutations invalidate and refresh the `cohorts` query.
- Visible modal interactions require Playwright coverage.

### Acceptance criteria

- Cohort management modal supports create, edit, delete, and active-state changes.
- In-use cohort delete attempts are surfaced clearly in the confirmation modal.
- Successful mutations refresh cohort data for active consumers.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None beyond any additional cases revealed by the modal-driven flows.

API layer tests:

1. Extend reference-data transport tests only if new payload-shape or error-mapping behaviour is introduced.

Frontend tests:

Vitest:

1. Manage cohorts modal covers opening/list-loading, empty, ready, mutation-in-progress, and list-reload-warning states.
2. Create/Edit cohort modal covers opening, ready, validation-error, submitting, success-close, and submission-failure states.
3. Delete cohort confirmation covers ready, blocked-with-disabled-delete, blocked-inline-feedback, submitting, success-close, and submission-failure states.

Playwright:

1. User opens Manage cohorts, exercises empty or ready states as applicable, then completes create, edit, active-state change, and delete flows.
2. User attempts to delete an in-use cohort and sees the blocked confirmation modal remain open with explanatory warning state.

### Section checks

- `npm run frontend:test -- src/features/classes/manageCohorts.spec.tsx src/features/classes/manageCohortDelete.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-manage-cohorts.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` where active-state toggling, invalidation, or blocked-delete handling would not be obvious from the final code.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 12 — Year-group management modal

### Objective

- Implement the year-group management modal flows for create, edit, and delete.

### Constraints

- Reference-data delete actions open a confirmation modal.
- Blocked delete state shows a disabled delete button plus explanatory warning state inside the confirmation modal.
- A blocked delete response keeps the modal open with inline feedback until the user closes it.
- Successful mutations invalidate and refresh the `yearGroups` query.
- Visible modal interactions require Playwright coverage.

### Acceptance criteria

- Year-group management modal supports create, edit, and delete.
- In-use year-group delete attempts are surfaced clearly in the confirmation modal.
- Successful mutations refresh year-group data for active consumers.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None beyond any additional cases revealed by the modal-driven flows.

API layer tests:

1. Extend reference-data transport tests only if new payload-shape or error-mapping behaviour is introduced.

Frontend tests:

Vitest:

1. Manage year groups modal covers opening/list-loading, empty, ready, mutation-in-progress, and list-reload-warning states.
2. Create/Edit year group modal covers opening, ready, validation-error, submitting, success-close, and submission-failure states.
3. Delete year group confirmation covers ready, blocked-with-disabled-delete, blocked-inline-feedback, submitting, success-close, and submission-failure states.

Playwright:

1. User opens Manage year groups and completes create, edit, and delete flows.
2. User attempts to delete an in-use year group and sees the blocked confirmation modal remain open with explanatory warning state.

### Section checks

- `npm run frontend:test -- src/features/classes/manageYearGroups.spec.tsx src/features/classes/manageYearGroupDelete.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-manage-year-groups.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` where invalidation or blocked-delete handling would not be obvious from the final code.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 13 — Error states, loading states, and empty-state integration

### Objective

- Finish the page-level UX for blocking failures, loading states, and empty states.

### Constraints

- Use top-level Ant Design `Alert` for blocking failures by default.
- Startup warm-up failure is owned by the app-level boundary and rendered here as blocking.
- Google Classroom entry failure is blocking.
- The default assumption is that stale table data should not remain visible when a required refresh fails.
- Keep this section focused on load/error/empty-state rendering rather than mutation-summary persistence rules.

### Acceptance criteria

- Blocking startup-prefetch failure renders a top-level `Alert` with normal interaction disabled.
- Blocking Google Classroom entry failure renders a top-level `Alert` rather than an empty state.
- Empty states are correct for no active Google Classrooms and first-run no-`ABClass` cases.
- Summary and toolbar shells render the correct blocked, loading, and ready states.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. None.

Frontend tests:

Vitest:

1. Alert stack renders no-alert, blocking startup-prefetch failure, blocking Google Classroom entry failure, and partial-load warning states in severity order.
2. Summary card covers initial loading, ready-with-data, ready-with-zero-values, and blocked suppression behaviour.
3. Toolbar card covers no-selection, mixed eligible/ineligible selection, mutation-in-progress, and ready states.
4. Table empty-state and blocking-failure rendering matches the agreed no-active-classrooms and first-run rules.

Playwright:

1. User encounters a startup-prefetch failure and sees the blocking top-level alert with normal interaction disabled.
2. User encounters a Google Classroom entry failure and sees the blocking error rather than an empty state.
3. User encounters the no-active-classrooms empty state and still has access to cohort and year-group management launchers.

### Section checks

- `npm run frontend:test -- src/features/classes/ClassesAlertStack.spec.tsx src/features/classes/ClassesSummaryCard.spec.tsx src/features/classes/ClassesEmptyStates.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-load-states.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` if the final hook or page code contains non-obvious load-state behaviour.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 14 — Mutation-summary persistence and re-fetch-failure integration

### Objective

- Finish the page-level mutation summary UX, including the default re-fetch-failure behaviour after successful mutations.

### Constraints

- Mutation summaries must persist clearly enough for users to understand partial success.
- If a mutation succeeds but the follow-up re-fetch fails, the alert must report that the update succeeded but the refresh failed and that the user must refresh the page to see changes.
- The default assumption is that stale table data should not remain visible after that failed refresh.
- Partial-failure bulk modals remain open briefly with inline feedback before closing and handing off to the top-level alert stack.

### Acceptance criteria

- Mutation summaries persist clearly enough for users to understand success and partial success.
- Post-success re-fetch failures render the combined message: successful update, failed refresh, refresh-the-page guidance.
- The page does not leave stale table data visible after a required refresh fails.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. None.

Frontend tests:

Vitest:

1. Mutation summary alerts render the correct counts, severity, persistence behaviour, and replacement rules.
2. Post-success re-fetch-failure state renders success-plus-warning guidance and suppresses stale table data.
3. Partial-failure modal-close timing hands off inline feedback to the top-level alert stack correctly.

Playwright:

1. User completes a mutation that yields success or partial-failure feedback and sees the alert-stack summary persist clearly after modal close.
2. User completes a mutation whose data refresh fails and sees an alert explaining that the update succeeded but the page must be refreshed to see changes.

### Section checks

- `npm run frontend:test -- src/features/classes/mutationSummary.spec.tsx src/features/classes/refetchFailureState.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-mutation-summary.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` if the final hook or page code contains non-obvious summary or re-fetch-failure behaviour.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Regression and contract hardening

### Objective

- Verify that the end-to-end Classes CRUD feature, its backend contracts, and its shared-query behaviour are stable after all sections are complete.

### Constraints

- Prefer focused test runs before broader validation.
- Include both invisible-behaviour and visible-behaviour checks in line with the frontend testing policy.
- Run broader checks only after section-level failures are resolved.

### Acceptance criteria

- Touched backend model, controller, and API-layer tests pass.
- Touched frontend service, hook, component, and view-model tests pass.
- Required Playwright journeys for new user-visible behaviour pass.
- Backend and frontend linting pass.
- Frontend type-check passes.

### Required test cases/checks

1. Run touched backend model/controller/API suites.
2. Run touched frontend service/UI suites.
3. Run backend and frontend lint commands.
4. Run required Playwright tests for Classes CRUD interactions.
5. Run frontend coverage after Green for a completed slice or before sign-off so the touched suites can confirm branch coverage once the feature path is working.
6. Run frontend type-check.

### Section checks

- `npm test -- tests/models/<model-test-path> tests/controllers/<controller-test-path> tests/api/<api-test-path>`
- `npm run frontend:test -- src/features/classes/<feature-test-path> src/services/<service-test-path> src/query/<query-test-path>`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-table.spec.ts e2e-tests/classes-crud-bulk-core.spec.ts e2e-tests/classes-crud-bulk-cohort.spec.ts e2e-tests/classes-crud-bulk-year-group.spec.ts e2e-tests/classes-crud-bulk-course-length.spec.ts e2e-tests/classes-crud-manage-cohorts.spec.ts e2e-tests/classes-crud-manage-year-groups.spec.ts e2e-tests/classes-crud-load-states.spec.ts e2e-tests/classes-crud-mutation-summary.spec.ts`
- `npm run lint`
- `npm run frontend:lint`
- `npm run frontend:test:coverage`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Implementation notes / deviations / follow-up

- **Implementation notes:** summarise what was done during regression phase.
- **Deviations from plan:** note any additional work discovered or done.

---

## Documentation and rollout notes

### Objective

- Update docs to match the implemented feature and capture rollout implications for changed contracts and cached shared lookups.

### Constraints

- Only modify documents relevant to the touched areas.
- Prefer canonical docs over duplicating policy text in multiple places.
- Keep rollout notes explicit where contract or rollout caveats need to be preserved.

### Acceptance criteria

- Documentation accurately reflects the final `ABClass`, cohort, and year-group data shapes.
- API docs reflect any changed request and response payloads.
- React Query/prefetch docs reflect the new startup warm-up and invalidation behaviour.
- Any contract caveats or deferred follow-up items are documented.
- Documentation records that rollout assumed a one-off destructive reset of existing persisted data.
- Documentation records the deferred assessment-workflow refactor required by the `yearGroup` contract change.

### Required checks

1. Verify docs mention the final persistence and transport strategy for key-based metadata.
2. Verify API docs list changed request and response shapes for `ABClass`, cohort, and year-group flows.
3. Verify React Query docs describe the updated warm-up and invalidation behaviour.
4. Confirm notes and deviations fields are filled during implementation.

### Optional `@remarks` JSDoc review

- Confirm whether any non-obvious design decisions, gotchas, or cross-component interactions discovered during implementation should be preserved in `@remarks` documentation.
- If earlier sections planned `@remarks`, verify that the relevant code now contains them before deleting the action plan.
- If no `@remarks` are needed, record `None`.

### Implementation notes / deviations / follow-up

- ...

---

## Suggested implementation order

1. Section 1 — Reference-data key contract groundwork
2. Section 2 — `ABClass` contract update and partial-shape refresh
3. Section 3 — `ABClass` mutation validation hardening
4. Section 4A — Frontend service and schema groundwork
5. Section 4B — Shared query keys and query-options groundwork
6. Section 4C — App-level startup warm-up ownership and readiness contract
7. Section 4D — Shared-query invalidation and post-mutation refetch contract
8. Section 4E — Browser-test harness and transport-scenario fixtures
9. Section 5A — Settings-page Classes-tab feature shell
10. Section 5B — Merged row view-model derivation and default sorting
11. Section 6 — Main table rendering, selection, and status affordances
12. Section 7 — Bulk create, delete, and active-state workflows
13. Section 8 — Bulk set cohort workflow
14. Section 9 — Bulk set year-group workflow
15. Section 10 — Bulk set course-length workflow
16. Section 11 — Cohort management modal
17. Section 12 — Year-group management modal
18. Section 13 — Error states, loading states, and empty-state integration
19. Section 14 — Mutation-summary persistence and re-fetch-failure integration
20. Regression and contract hardening
21. Documentation and rollout notes
