# Feature Delivery Plan (TDD-First)

## Scope and assumptions

### Scope

- Implement the Classes CRUD feature in the **Classes** tab on the top-level `SettingsPage`.
- Replace the current placeholder Classes-tab content in `src/frontend/src/pages/SettingsPage.tsx` with a real feature entry for CRUD-only class management.
- Use `CLASSES_TAB_LAYOUT_AND_MODALS.md` as the UI-layout and modal-state companion document for implementation details that sit below the product/data-contract level.
- Update backend reference-data models, controllers, and API handlers so cohorts and year groups use stable keys.
- Update `ABClass` transport and persistence contracts so class metadata stores `cohortKey` and `yearGroupKey` rather than mutable display names.
- Add the required frontend services, Zod schemas, React Query definitions, view-model mapping, page UI, modal workflows, and automated test coverage.
- Update shared prefetch behaviour so `cohorts` and `yearGroups` warm at startup alongside `classPartials`, while `googleClassrooms` remains a Classes-tab entry prefetch.
- Add backend validation to prevent `active` updates from creating missing classes and to block deletion of in-use cohort or year-group records.
- Add `startYear` and `startMonth` to the cohort model so cohort-year calculations remain possible after moving to stable keys.
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
6. The current `apiHandler` envelope remains the transport contract; changed payload shapes should be introduced through existing allowlisted methods unless implementation proves a new method is required.
7. All user-visible interactions introduced by this feature require Playwright coverage in addition to appropriate Vitest coverage.
8. Some assessment-workflow paths currently depend on `ABClass.yearGroup` as a numeric academic-year field; that downstream refactor is out of scope for this delivery and must be recorded in follow-up documentation.

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
- Frontend coverage: `npm run frontend:test:coverage`
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
- `getABClassPartials` returns the updated shape without leaking storage metadata.
- Backend API docs and data-shape docs are ready to reflect the changed class-partial contract.
- Frontend service/schema code can parse the new partial shape.

### Required test cases (Red first)

Backend model tests:

1. `ABClass.toJSON()` emits `cohortKey` and `yearGroupKey`.
2. `ABClass.toPartialJSON()` emits `cohortKey` and `yearGroupKey`.
3. `ABClass.fromJSON()` reconstructs key-based metadata correctly.

Backend controller tests:

1. `ABClassController.getAllClassPartials()` normalises and returns the key-based partial shape.
2. Partial upsert paths preserve the new metadata fields.

API layer tests:

1. `getABClassPartials` returns the updated payload shape through the transport layer.

Frontend tests:

1. `classPartials` Zod schema accepts the new key-based partial shape.
2. `classPartialsService` returns validated key-based partials.

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

- `upsertABClass` accepts key-based metadata and rejects invalid keys.
- `updateABClass` rejects `active` updates when the class does not already exist.
- `deleteCohort` and `deleteYearGroup` fail when any stored `ABClass` still references the target key.
- Failure cases map cleanly to transport errors without hidden fallback behaviour.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. `ABClassController.upsertABClass()` rejects unknown `cohortKey` or `yearGroupKey` values.
2. `ABClassController.updateABClass()` rejects `active` patches for missing classes.
3. `ReferenceDataController.deleteCohort()` rejects deletion of an in-use cohort key.
4. `ReferenceDataController.deleteYearGroup()` rejects deletion of an in-use year-group key.

API layer tests:

1. `upsertABClass` surfaces invalid key payloads as transport errors.
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

## Section 4 — Frontend service, schema, and shared-query groundwork

### Objective

- Add or update the frontend services, Zod schemas, React Query keys, and shared query definitions needed by the Classes CRUD feature.

### Constraints

- Keep all backend access inside service modules that use `callApi(...)`.
- Define shared query keys through `queryKeys.ts` only.
- Runtime validation must happen at the service boundary before data is cached.
- Keep startup warm-up and invalidation logic aligned with the canonical React Query policy docs.

### Acceptance criteria

- A frontend `googleClassrooms` service and adjacent Zod schema exist.
- Shared query helpers exist for `googleClassrooms`, `cohorts`, `yearGroups`, and `classPartials` as needed.
- Startup warm-up can fetch `classPartials`, `cohorts`, and `yearGroups`.
- Cohort and year-group mutations invalidate and refresh the relevant shared queries.
- The warm-up client is considered warmed only when all three startup-prefetched datasets succeed.
- Startup warm-up does not add extra retry loops beyond the existing `apiHandler` retry behaviour.
- If any startup-prefetched dataset fails, the feature surfaces a fail-fast/loud top-level alert rather than silently continuing with a partially warmed state.

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
3. Shared query helpers expose the correct query keys and query functions for `googleClassrooms`.
4. Startup warm-up orchestration fetches `classPartials`, `cohorts`, and `yearGroups` after authorisation.
5. Cohort and year-group mutation flows invalidate the correct shared queries.
6. The warm-up marker is set only after all three startup-prefetched datasets resolve successfully.
7. A failed startup-prefetch path surfaces the expected fail-fast/loud alert state without additional retry orchestration.

### Section checks

- `npm run frontend:test -- src/services/googleClassrooms*.spec.ts src/query/sharedQueries.query.spec.tsx src/features/auth/AppAuthGate*.spec.tsx`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` where warm-up policy or invalidation choices differ from the previous baseline and would not be obvious from the final code.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 5 — Settings-page Classes-tab entry and merged view-model orchestration

### Objective

- Replace the placeholder Settings-page Classes-tab content with a real feature entry that loads the shared datasets and builds the merged row view model.

### Constraints

- Keep `SettingsPage.tsx` thin and move orchestration into a feature hook or view-model helper.
- The merged row model must represent `active`, `inactive`, `notCreated`, and `orphaned` rows.
- Sorting defaults must follow the agreed order.
- This section must remain CRUD-only; do not add analysis or assessment-run behaviour.

### Acceptance criteria

- The Settings-page Classes tab renders a real feature entry component.
- The merged row view model correctly combines Google Classroom rows, stored `ABClass` partials, and reference-data lookups.
- Default sort order is active, inactive, not created, then orphaned.
- The page exposes the required loading and partial-load state needed for later UI sections.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. None.

Frontend tests:

1. `SettingsPage` renders the Classes-tab management feature entry.
2. The merged view-model helper derives the correct status for active, inactive, not-created, and orphaned rows.
3. The merged view-model helper resolves cohort and year-group names from keys.
4. The default sort order is applied correctly.
5. The feature hook exposes the expected loading, error, and data states.

### Section checks

- `npm run frontend:test -- src/pages/SettingsPage.spec.tsx src/features/classes/*.spec.ts src/features/classes/**/*.spec.tsx`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to the merged view-model helper or hook if status resolution, sorting precedence, or orphaned-row semantics are non-obvious.

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
- Any user-visible interaction introduced here must receive Playwright coverage.

### Acceptance criteria

- The table renders the agreed columns and row states.
- Not-created rows display unavailable fields as `—`.
- Orphaned rows display a warning affordance with explanatory tooltip.
- Row selection works correctly across eligible and ineligible states.

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
2. Table loading state renders with shell structure intact during initial Google Classroom entry fetch.
3. Selection state updates correctly when rows are toggled from no selection to mixed and fully eligible selections.
4. Ineligible rows or actions surface the correct disabled states or tooltips, including deletion-only orphaned rows.
5. Summary-card counts and selection-summary text update correctly for mixed row-state datasets.

Playwright:

1. User opens the Settings page, switches to the Classes tab, and sees the default sorted table with summary and toolbar cards.
2. User sees the no-selection state with the bulk-action trigger disabled and the selection summary reset.
3. User selects eligible and ineligible rows and sees the correct enabled, disabled, and tooltip-backed bulk affordances.
4. User sees the first-run `notCreated` rendering and the orphaned warning affordance in the live table.
5. User sees the no-active-classrooms empty state without losing the management launchers.

### Section checks

- `npm run frontend:test -- src/features/classes/**/*.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to any table column factory or selection helper where status-specific affordances or disabled-state rules may be non-obvious.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 7 — Bulk create, delete, and active-state workflows

### Objective

- Implement the first set of modal-driven bulk workflows: create `ABClass`, delete `ABClass`, and set active or inactive.

### Constraints

- Bulk actions must keep failed rows selected after partial failure.
- Create uses `cohortKey`, `yearGroupKey`, and `courseLength` with default `1`.
- Delete copy must make clear that both full and partial `ABClass` records are removed.
- Active-state updates must never create missing classes.

### Acceptance criteria

- Bulk create works for `notCreated` rows only.
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

1. Bulk create modal covers opening, ready, validation-error, submitting, partial-success, and success-close states.
2. Bulk create validates required cohort and year-group inputs, applies the default `courseLength` of `1`, and dispatches one mutation per selected row.
3. Bulk delete confirmation copy states that both full and partial stored class records are removed.
4. Bulk delete workflow covers ready, submitting, partial-success, and submission-failure summary mapping.
5. Bulk active-state action blocks ineligible selections before open and maps submitting and partial-success outcomes correctly.
6. Partial failures keep failed rows selected and drive the top-level mutation summary state expected by the tab.

Playwright:

1. User selects `notCreated` rows, opens Bulk create, sees active-cohort-only options, validates required fields, and completes a successful create flow.
2. User triggers a bulk-create partial failure and sees failed rows remain selected with warning feedback after close.
3. User opens Bulk delete, sees the destructive copy, confirms, and receives success or partial-failure summary feedback.
4. User attempts an ineligible bulk active/inactive action and sees the blocked-before-open explanation.
5. User completes an eligible bulk active or inactive confirmation flow and sees the tab-level summary update after the modal closes.

### Section checks

- `npm run frontend:test -- src/features/classes/**/*.spec.tsx src/features/classes/**/*.spec.ts`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud.spec.ts -g "bulk"`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` where batch-processing semantics, failed-row retention, or modal-state handling could confuse future maintainers.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 8 — Bulk cohort/year-group updates and reference-data management modals

### Objective

- Implement the remaining class-metadata bulk actions plus the secondary modals for cohort and year-group CRUD.

### Constraints

- Cohort selectors must only offer active cohorts for assignment.
- Reference-data delete actions must surface blocked states clearly when values are in use.
- Reference-data modals must invalidate and refresh shared queries on successful mutation.
- Visible modal interactions require Playwright coverage.

### Acceptance criteria

- Bulk set cohort and bulk set year group work for eligible active/inactive rows.
- Cohort management modal supports create, edit, delete, and active-state changes.
- Year-group management modal supports create, edit, and delete.
- In-use delete attempts are surfaced clearly to the user.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None beyond any additional cases revealed by new modal-driven reference-data flows.

API layer tests:

1. Extend reference-data transport tests only if new payload-shape or error-mapping behaviour is introduced.

Frontend tests:

Vitest:

1. Bulk cohort modal covers ready, validation-error, submitting, and partial-success states and offers only active cohorts.
2. Bulk year-group modal covers ready, validation-error, submitting, and partial-success states with key-based options and payloads.
3. Manage cohorts modal covers opening/list-loading, empty, ready, mutation-in-progress, and list-reload-warning states.
4. Create/Edit cohort modal covers opening, ready, validation-error, submitting, success-close, and submission-failure states.
5. Delete cohort confirmation covers ready, blocked, submitting, success-close, and submission-failure states, including in-use delete messaging.
6. Manage year groups modal covers opening/list-loading, empty, ready, mutation-in-progress, and list-reload-warning states.
7. Create/Edit year group modal covers opening, ready, validation-error, submitting, success-close, and submission-failure states.
8. Delete year group confirmation covers ready, blocked, submitting, success-close, and submission-failure states.

Playwright:

1. User opens Bulk set cohort, sees active cohorts only, submits a valid change, and receives summary feedback.
2. User opens Bulk set year group, submits a valid change, and sees the updated year-group value reflected in the table.
3. User opens Manage cohorts, exercises empty or ready states as applicable, then completes create, edit, active-state change, and delete flows.
4. User attempts to delete an in-use cohort and sees the blocked state clearly before the modal closes.
5. User opens Manage year groups and completes create, edit, and delete flows.
6. User attempts to delete an in-use year group and sees the blocked state clearly before the modal closes.

### Section checks

- `npm run frontend:test -- src/features/classes/**/*.spec.tsx src/features/classes/**/*.spec.ts`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud.spec.ts -g "cohort|year group"`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` where reference-data invalidation, active-only cohort selection, or delete-blocked handling would not be obvious from the final code.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 9 — Error states, polish, and page-level integration completeness

### Objective

- Finish the page-level UX by adding blocking and partial-load alerts, empty states, mutation summary persistence, and any remaining integration glue.

### Constraints

- Use top-level Ant Design `Alert` for blocking failures by default.
- Keep stale data visible where the shared-query policy calls for background refresh rather than hard replacement.
- Do not widen scope into non-CRUD page functionality.

### Acceptance criteria

- Blocking load failures render a top-level `Alert`.
- Partial-load failures keep usable data visible with a warning `Alert`.
- Empty states are correct for no active Google Classrooms and first-run no-`ABClass` cases.
- Mutation summaries persist clearly enough for users to understand partial success.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. None.

Frontend tests:

Vitest:

1. Alert stack renders no-alert, blocking startup-prefetch failure, blocking Google Classroom entry failure, partial-load warning, and mutation-summary states in severity order.
2. Summary card covers initial loading, ready-with-data, ready-with-zero-values, and blocked suppression behaviour.
3. Toolbar card covers no-selection, mixed eligible/ineligible selection, mutation-in-progress, and ready states.
4. Table empty-state and failure-state rendering matches the agreed no-active-classrooms, first-run, partial-load, and blocking-failure rules.
5. Mutation summary alerts render the correct counts, severity, persistence behaviour, and replacement rules.

Playwright:

1. User encounters a startup-prefetch failure and sees the blocking top-level alert with normal interaction disabled.
2. User encounters a Google Classroom entry failure and sees the blocking error rather than an empty state.
3. User encounters a partial-load warning and still sees usable summary, toolbar, and table content.
4. User encounters the no-active-classrooms empty state and still has access to cohort and year-group management launchers.
5. User completes a mutation that yields success or partial-failure feedback and sees the alert-stack summary persist clearly after modal close.

### Section checks

- `npm run frontend:test -- src/features/classes/**/*.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud.spec.ts -g "error|empty|summary"`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` if the final hook or page code contains non-obvious load-state or summary-state behaviour.

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
5. Run frontend coverage if the touched suites need a confidence pass against the coverage gate.
6. Run frontend type-check.

### Section checks

- `npm test -- tests/models/<model-test-path> tests/controllers/<controller-test-path> tests/api/<api-test-path>`
- `npm run frontend:test -- src/features/classes/<feature-test-path> src/services/<service-test-path> src/query/<query-test-path>`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud.spec.ts`
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
4. Section 4 — Frontend service, schema, and shared-query groundwork
5. Section 5 — Settings-page Classes-tab entry and merged view-model orchestration
6. Section 6 — Main table rendering, selection, and status affordances
7. Section 7 — Bulk create, delete, and active-state workflows
8. Section 8 — Bulk cohort/year-group updates and reference-data management modals
9. Section 9 — Error states, polish, and page-level integration completeness
10. Regression and contract hardening
11. Documentation and rollout notes
