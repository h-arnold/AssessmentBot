# Frontend De-Sloppification Delivery Plan

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md`.
2. No dedicated frontend layout spec is required for this work because the scope is behaviour-preserving cleanup rather than layout redesign.
3. Treat `SPEC.md` as the source of truth for behaviour, scope boundaries, lifecycle rules, and the LOC acceptance gate.
4. Use this action plan to sequence delivery and validation; do not reopen settled product decisions during implementation.

## Scope and assumptions

### Scope

- Simplify the frontend areas covered by `SLOP_REVIEW.md` while preserving user-visible behaviour.
- Remove duplicated routing/render logic, repeated filter plumbing, single-use wrapper layers, duplicated classes bulk-action scaffolding, and repeated backend settings field wiring.
- Update directly affected frontend tests where existing test contracts duplicate production copy or preserved duplicate runtime machinery.

### Out of scope

- New frontend features, route changes, or workflow redesign.
- Backend transport or payload contract changes.
- Extracting a shared bulk modal shell for `BulkCreateModal` and `BulkSetSelectModal` in this pass.
- Any cleanup outside the explicit production LOC baseline unless later sections document an unavoidable dependency.

### Assumptions

1. Official Ant Design guidance has been consulted for `Table`, `Tabs`, `Form`, `Modal`, `Alert`, `Flex`, and `Space`, and implementation must prefer those built-in behaviours over local wrapper layers.
2. This cleanup uses a flexible verification workflow: red-first tests are preferred when they pin a stable behaviour contract, but regression-first or implementation-first sequencing is acceptable where strict red-first work would only snapshot transient internal structure.
3. The mandatory LOC pass/fail gate is measured against this production-file baseline, counting direct renames or successor files when code is moved rather than deleted: `src/frontend/src/pages/AssignmentsPage.tsx`, `src/frontend/src/navigation/appNavigation.tsx`, `src/frontend/src/AppShell.tsx`, `src/frontend/src/pages/SettingsPage.tsx`, `src/frontend/src/pages/TabbedPageSection.tsx`, `src/frontend/src/pages/PageSection.tsx`, `src/frontend/src/pages/DashboardPage.tsx`, `src/frontend/src/pages/pageContent.ts`, `src/frontend/src/pages/SettingsPageGoogleClassroomsPrefetch.tsx`, `src/frontend/src/features/classes/ClassesManagementPanel.tsx`, `src/frontend/src/features/classes/ClassesToolbar.tsx`, `src/frontend/src/features/classes/bulkMutationOrchestration.ts`, `src/frontend/src/features/classes/bulkSetCohortFlow.ts`, `src/frontend/src/features/classes/bulkSetYearGroupFlow.ts`, `src/frontend/src/features/classes/bulkSetCourseLengthFlow.ts`, `src/frontend/src/features/classes/bulkActiveStateFlow.ts`, `src/frontend/src/features/classes/bulkCreateFlow.ts`, `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`, `src/frontend/src/features/settings/backend/useBackendSettings.ts`, `src/frontend/src/features/settings/backend/backendSettingsFormMapper.ts`, and `src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts`.
4. Required test, documentation, and planning follow-through remain mandatory for delivery quality, but they do not replace the requirement for a net production-code LOC reduction across that baseline.

---

## Global constraints and quality gates

### Engineering constraints

- Preserve current runtime behaviour unless `SPEC.md` explicitly approves a simplification.
- Remove code before introducing code.
- Keep one authoritative render contract for shell navigation in `src/frontend/src/navigation/appNavigation.tsx`.
- Preserve the stable Settings `PageSection` frame, width-token routing, Classes remount-on-leave semantics, Backend settings mounted-state semantics, and Settings page prefetch behaviour.
- Preserve the split between top-level classes bulk outcomes and metadata modal outcomes.
- Preserve the backend settings ownership boundary: `BackendSettingsPanel` owns live form state and field meta; `useBackendSettings` owns load/save/refresh/rebase orchestration.
- Use British English in comments and docs.

### Verification workflow for this cleanup

For each section below:

1. Capture the relevant behaviour contract first using the cheapest stable evidence available.
2. Use red-first tests when the contract is easy to pin before refactoring.
3. Use regression-first or implementation-first sequencing when strict red-first work would only freeze temporary internal structure.
4. Add or update focused Vitest coverage before closing the section whenever lifecycle rules, failure handling, or invisible wiring are at risk.
5. Add or update Playwright coverage for every changed user-visible interaction before closing the section; do not treat browser coverage as optional for touched shell, tab, filter, modal, form, or bulk-action flows.
6. Run section-level verification and compare the current LOC trend against the baseline.

### LOC reduction gate

- Record baseline line counts for the explicit production-file baseline before implementation starts.
- After each section, confirm the cumulative production LOC is lower than baseline or that any temporary increase is documented and paid back in a later committed section.
- The cleanup is not complete unless the final production LOC total is lower than the starting baseline.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents, the plan must define and enforce mandatory documentation reads.

For each delegated phase (`Testing Specialist`, `Implementation`, `Code Reviewer`, `Docs`, or `De-Sloppification`):

1. list required documentation file paths under that phase before delegation
2. require the sub-agent handoff to include `Files read` with explicit file paths
3. verify every mandatory file is listed before accepting the handoff
4. if any mandatory file is missing, return the work to the same sub-agent and block progression to the next phase

### Shared-helper planning gate

Helper planning entries for this work already exist in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` with status `Not implemented`.

During implementation:

1. do not introduce new helpers outside those decisions unless a section explicitly records the change
2. reconcile the planned entries during the documentation pass
3. reject one-caller extractions that only move duplication

### Validation commands hierarchy

- Frontend lint: `npm run frontend:lint`
- Frontend unit tests: `npm run frontend:test -- <target>`
- Frontend e2e tests: `npm run frontend:test:e2e -- <target>`
- Frontend coverage when needed: `npm run frontend:test:coverage`

### Ant Design consultation evidence gate

When a delegated section changes Ant Design-driven UI behaviour, include the relevant official Ant Design documentation URLs in the phase mandatory reads and require them to appear in the delegated `Files read` evidence.

For this cleanup the relevant references are:

- `https://ant.design/components/tabs/`
- `https://ant.design/components/table/`
- `https://ant.design/components/form/`
- `https://ant.design/components/modal/`
- `https://ant.design/components/alert/`
- `https://ant.design/components/flex/`
- `https://ant.design/components/space/`

---

## Section 1 — Shell And Settings Frame Cleanup

### Objective

- Remove duplicate navigation/page rendering logic and collapse the single-caller Settings tab wrapper chain while preserving the stable Settings frame, dashboard content slot, width-token routing, and page-mount prefetch behaviour.

### Constraints

- `src/frontend/src/navigation/appNavigation.tsx` remains the authoritative navigation-key-to-page render contract.
- `src/frontend/src/AppShell.tsx` must not keep a second page-selection switch.
- The dashboard path must continue to pass injected dashboard content through unchanged.
- The Settings page must keep one stable `PageSection` frame across tab switches.
- The outer Settings frame must remain on the wide page-width token and the backend panel must remain centred on the default panel-width token.
- The Classes tab remounts on leave; Backend settings does not remount on ordinary tab switches.
- `SettingsPageGoogleClassroomsPrefetch` still runs on Settings page mount regardless of active tab.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `/workspaces/AssessmentBot/AGENTS.md`
- `/workspaces/AssessmentBot/src/frontend/AGENTS.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-testing.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-loading-and-width-standards.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-shell-navigation-and-motion.md`
- `/workspaces/AssessmentBot/SPEC.md`
- `/workspaces/AssessmentBot/ACTION_PLAN.md`
- `https://ant.design/components/tabs/`
- `https://ant.design/components/flex/`
- `https://ant.design/components/space/`

Implementation mandatory docs:

- `/workspaces/AssessmentBot/AGENTS.md`
- `/workspaces/AssessmentBot/src/frontend/AGENTS.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-shell-navigation-and-motion.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-loading-and-width-standards.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `/workspaces/AssessmentBot/SPEC.md`
- `/workspaces/AssessmentBot/ACTION_PLAN.md`
- `https://ant.design/components/tabs/`
- `https://ant.design/components/flex/`
- `https://ant.design/components/space/`

Code Reviewer mandatory docs:

- `/workspaces/AssessmentBot/AGENTS.md`
- `/workspaces/AssessmentBot/src/frontend/AGENTS.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-loading-and-width-standards.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-shell-navigation-and-motion.md`
- `/workspaces/AssessmentBot/SPEC.md`
- `/workspaces/AssessmentBot/ACTION_PLAN.md`
- `https://ant.design/components/tabs/`
- `https://ant.design/components/flex/`
- `https://ant.design/components/space/`

### Shared helper plan

1. Helper: navigation page render contract
   - Decision: `reuse`
   - Owning module/path: `src/frontend/src/navigation/appNavigation.tsx`
   - Call-site rationale: remove the duplicate render switch from `AppShell` and keep one authoritative runtime source
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented`
2. Helper: settings tab item construction
   - Decision: `keep local`
   - Owning module/path: `src/frontend/src/pages/SettingsPage.tsx`
   - Call-site rationale: simplify two fixed tabs without preserving a single-use wrapper layer
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented`

### Acceptance criteria

- One navigation render contract survives in `appNavigation.tsx`, and `AppShell` consumes it without a second page-selection switch.
- Invalid raw navigation keys still fail fast at the surviving shell input boundary after the duplicate render proxy is removed.
- The dashboard content slot still reaches `DashboardPage` unchanged.
- `SettingsPage` no longer depends on a single-caller wrapper chain for two fixed tabs unless a second real caller appears during implementation.
- The stable Settings frame, width-token routing, Classes remount-on-leave semantics, Backend settings mounted-state semantics, and page-mount prefetch behaviour remain unchanged.
- Any directly affected tests that duplicated navigation runtime logic or page copy are updated to assert against the surviving production contract.
- The cumulative production LOC trend is neutral-to-down after this section, with any temporary increase documented.

### Required test cases

Frontend unit/component tests:

1. Update `src/frontend/src/navigation/appNavigation.spec.tsx` to assert the surviving navigation render contract and dashboard slot passthrough.
2. Update `src/frontend/src/pages/SettingsPage.spec.tsx` to preserve stable frame, width-token, mounted-state, remount, and prefetch expectations after wrapper removal.
3. Update `src/frontend/src/App.spec.tsx` to assert that invalid raw navigation keys still fail fast at the surviving shell boundary.
4. Update `src/frontend/src/pages/pages.spec.tsx` only where the surviving navigation contract changes test setup.

Frontend e2e tests:

1. Update `src/frontend/e2e-tests/app.spec.ts` for changed shell navigation interactions.
2. Update `src/frontend/e2e-tests/settings-page.spec.ts` for changed Settings tab interactions, stable-frame assertions, or mount-time page behaviour.

### Section checks

- `npm run frontend:test -- src/navigation/appNavigation.spec.tsx`
- `npm run frontend:test -- src/pages/SettingsPage.spec.tsx`
- Run any additionally touched shell/page spec targets.
- `npm run frontend:test:e2e -- e2e-tests/app.spec.ts`
- `npm run frontend:test:e2e -- e2e-tests/settings-page.spec.ts`
- Recount the current production LOC total for the explicit baseline files touched in this section.
- Mandatory-read evidence gate passed for all delegated handoffs.

### Section 1 execution tracker (completed)

- [x] red tests added
- [x] red review clean
- [x] green implementation complete
- [x] green review clean
- [x] checks passed
- [x] action plan updated
- [ ] commit created (pending)
- [ ] push completed (pending)

### Section 1 review findings and resolutions

1. Finding: early red coverage leaned on wrapper/internal structure that would have become brittle after cleanup.
   - Resolution: moved assertions to stable contracts (navigation render ownership, fail-fast boundary, stable Settings frame and mount behaviour) and removed brittle internals from the test intent.
2. Finding: review requested explicit protection of invalid raw navigation-key handling after AppShell simplification.
   - Resolution: retained targeted fail-fast coverage at the surviving shell boundary and cleared red/green review after update.

### Section 1 approved workflow note

- Red phase was approved with contract-focused tests that intentionally removed brittle internal-structure expectations.

### Section 1 LOC tracking

- Baseline total: 4136
- After Section 1 cumulative total: 4034
- Cumulative delta: -102

### Optional `@remarks` JSDoc follow-through

- Consider `@remarks` only if the surviving navigation render contract or Settings remount behaviour becomes non-obvious after simplification.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Section 1 is complete; duplicate shell/settings wrapper machinery was removed while preserving the wide Settings frame, dashboard content slot, width-token routing, remount rules, and mount prefetch behaviour.
- **Deviations from plan:** none recorded for Section 1.
- **Follow-up implications for later sections:** Section 1 follow-up completed in Section 2; next active phase is **Section 3 red**, currently **pending start**.

---

## Section 2 — Assignments Filter Consolidation

### Objective

- Remove the repeated Assignments filter plumbing by replacing per-column setter duplication and repeated column filter wiring with one page-local typed filter path and descriptor-driven table configuration.

### Status

- Completed: Section 2 red and green phases are complete; checks are passing.

### Constraints

- Keep the existing five filterable fields, exact-match filter semantics, reset behaviour, accessible labels, and current visible rows for the same selected values.
- Keep the solution page-local unless a second active caller emerges inside the accepted scope.
- Do not add a new cross-feature filter abstraction.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `/workspaces/AssessmentBot/AGENTS.md`
- `/workspaces/AssessmentBot/src/frontend/AGENTS.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-testing.md`
- `/workspaces/AssessmentBot/SPEC.md`
- `/workspaces/AssessmentBot/ACTION_PLAN.md`
- `https://ant.design/components/table/`

Implementation mandatory docs:

- `/workspaces/AssessmentBot/AGENTS.md`
- `/workspaces/AssessmentBot/src/frontend/AGENTS.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `/workspaces/AssessmentBot/SPEC.md`
- `/workspaces/AssessmentBot/ACTION_PLAN.md`
- `https://ant.design/components/table/`

Code Reviewer mandatory docs:

- `/workspaces/AssessmentBot/AGENTS.md`
- `/workspaces/AssessmentBot/src/frontend/AGENTS.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `/workspaces/AssessmentBot/SPEC.md`
- `/workspaces/AssessmentBot/ACTION_PLAN.md`
- `https://ant.design/components/table/`

### Shared helper plan

1. Helper: assignments column-filter descriptor and single typed filter setter
   - Decision: `keep local`
   - Owning module/path: `src/frontend/src/pages/AssignmentsPage.tsx`
   - Call-site rationale: remove repeated filter plumbing inside one page without creating a speculative shared helper
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `AssignmentsPage` no longer contains five near-identical filter setter callbacks and repeated filter column wiring blocks.
- One typed local filter path and one local descriptor-driven configuration cover the current filterable columns.
- Filter behaviour, accessibility labels, reset behaviour, and delete workflow remain unchanged.
- The section removes lines from `AssignmentsPage.tsx` rather than shifting the same duplication into a new one-caller helper file.

### Required test cases

Frontend unit/component tests:

1. Update `src/frontend/src/pages/AssignmentsPage.spec.tsx` to keep coverage for filter selection, filter reset, delete flow, and visible row results.
2. Add focused unit assertions only if the new local descriptor path introduces behaviour not already covered by the page spec.

Frontend e2e tests:

1. Update `src/frontend/e2e-tests/assignments-page.spec.ts` for changed filter interactions, reset flow, or delete-flow selectors.

### Section checks

- `npm run frontend:test -- src/pages/AssignmentsPage.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/assignments-page.spec.ts`
- Recount the current production LOC total for `src/frontend/src/pages/AssignmentsPage.tsx`.
- Mandatory-read evidence gate passed for all delegated handoffs.

### Optional `@remarks` JSDoc follow-through

- None unless the local descriptor shape needs explanation to avoid accidental cross-feature extraction later.

### Section 2 execution tracker (completed)

- [x] red tests added
- [x] red review clean
- [x] green implementation complete
- [x] green review clean
- [x] checks passed
- [x] action plan updated
- [ ] commit created (pending)
- [ ] push completed (pending)

### Section 2 review findings and resolutions

1. Finding: early red-phase coverage included brittle raw-source assertions in the Assignments filter tests.
   - Resolution: replaced brittle raw-source assertions with regression-baseline behavioural tests that lock visible filter/reset/delete behaviour against the surviving runtime contract.

### Section 2 LOC tracking

- Baseline total: 4136
- After Section 1 cumulative total: 4034
- After Section 2 cumulative total: 3987
- Cumulative delta: -149
- `AssignmentsPage.tsx`: 851 -> 804 (-47)

### Implementation notes / deviations / follow-up

- **Implementation notes:** Section 2 is complete; Assignments filter wiring now uses a single local typed filter path and descriptor-driven column configuration while preserving filter semantics, reset behaviour, accessibility labels, and delete-flow outcomes.
- **Deviations from plan:** none recorded for Section 2 (solution remained page-local in `AssignmentsPage.tsx`).
- **Follow-up implications for later sections:** next active phase is **Section 3 red**, currently **pending start**.

---

## Section 3 — Classes Workflow Simplification

### Objective

- Remove duplicated classes bulk-action scaffolding, collapse repeated metadata flow logic, inline the one-caller panel render helper, and stop recomputing the same selected-row subset in parent and toolbar.

### Status

- Completed: Section 3 red and green phases are complete; checks are passing.

### Constraints

- Preserve `runBulkMutationOrchestration(...)` as the shared mutation boundary unless a simpler internal change within that contract is sufficient.
- Preserve separate outcome families for top-level bulk actions and metadata modal actions.
- Preserve create-modal defaults and validation, including initial `courseLength: 1`.
- Preserve current selection retention, refresh-required handling, and modal close versus inline modal error behaviour.
- The existing bulk modal-shell similarity between `BulkCreateModal` and `BulkSetSelectModal` remains out of scope unless it can be simplified without introducing a new shared shell abstraction or increasing LOC.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `/workspaces/AssessmentBot/AGENTS.md`
- `/workspaces/AssessmentBot/src/frontend/AGENTS.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-testing.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-loading-and-width-standards.md`
- `/workspaces/AssessmentBot/SPEC.md`
- `/workspaces/AssessmentBot/ACTION_PLAN.md`
- `https://ant.design/components/table/`
- `https://ant.design/components/modal/`
- `https://ant.design/components/alert/`
- `https://ant.design/components/space/`

Implementation mandatory docs:

- `/workspaces/AssessmentBot/AGENTS.md`
- `/workspaces/AssessmentBot/src/frontend/AGENTS.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-loading-and-width-standards.md`
- `/workspaces/AssessmentBot/SPEC.md`
- `/workspaces/AssessmentBot/ACTION_PLAN.md`
- `https://ant.design/components/table/`
- `https://ant.design/components/modal/`
- `https://ant.design/components/alert/`
- `https://ant.design/components/space/`

Code Reviewer mandatory docs:

- `/workspaces/AssessmentBot/AGENTS.md`
- `/workspaces/AssessmentBot/src/frontend/AGENTS.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-loading-and-width-standards.md`
- `/workspaces/AssessmentBot/SPEC.md`
- `/workspaces/AssessmentBot/ACTION_PLAN.md`
- `https://ant.design/components/table/`
- `https://ant.design/components/modal/`
- `https://ant.design/components/alert/`
- `https://ant.design/components/space/`

### Shared helper plan

1. Helper: bulk action descriptor feeding shared orchestration
   - Decision: `extend`
   - Owning module/path: `src/frontend/src/features/classes/bulkMutationOrchestration.ts`
   - Call-site rationale: remove repeated handler scaffolding, repeated action copy, and repeated modal-input plumbing while keeping one real orchestration contract
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented`
2. Helper: metadata bulk-update contract for editable existing rows
   - Decision: `new`
   - Owning module/path: `src/frontend/src/features/classes/bulkMetadataUpdateFlow.ts`
   - Call-site rationale: the metadata update flows repeat the same editable-row filtering, payload construction, mutation execution, and outcome mapping pattern and should converge on one feature-local contract before the panel layer is simplified further
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented`
3. Helper: selected-row derivation for toolbar consumers
   - Decision: `keep local`
   - Owning module/path: `src/frontend/src/features/classes/ClassesManagementPanel.tsx`
   - Call-site rationale: derive once in the feature root and pass downward rather than re-deriving in child components
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `ClassesManagementPanel` no longer contains repeated per-action orchestration skeletons that only vary by copy, eligibility, and mutation input.
- The metadata flows converge on one explicit feature-local bulk-update contract for cohort, year-group, and course-length updates where behaviour is truly the same.
- `ClassesToolbar` receives `selectedRows` from the parent instead of recomputing the same subset.
- The single-caller `renderClassesManagementPanelContent(...)` split is removed or replaced only by smaller coherent subcomponents with clear ownership.
- Top-level actions still resolve through panel-level alert/surface behaviour, and metadata modal actions still preserve inline modal error versus close-on-warning behaviour.
- The section achieves a net reduction across the classes baseline files it touches.

### Required test cases

Frontend unit/component tests:

1. Update `src/frontend/src/features/classes/ClassesManagementPanel.spec.tsx` for panel-level alert, modal, and selection-retention behaviour.
2. Update `src/frontend/src/features/classes/ClassesManagementPanel.bulkMetadataFailure.spec.tsx` to preserve metadata modal failure semantics.
3. Update `src/frontend/src/features/classes/ClassesToolbar.spec.tsx` for parent-supplied `selectedRows` semantics.
4. Update the touched bulk-flow specs: `bulkCreate.spec.tsx`, `bulkSetCohort.spec.tsx`, `bulkSetYearGroup.spec.tsx`, `bulkSetCourseLength.spec.tsx`, `bulkActiveState.spec.tsx`, and `bulkMutationOrchestration.spec.ts`.

Frontend e2e tests:

1. Update the touched classes bulk Playwright journeys for changed visible workflow contracts or selectors.
2. Extend `src/frontend/e2e-tests/classes-crud.harness.spec.ts` and the touched `src/frontend/e2e-tests/classes-crud-*.spec.ts` journeys when bulk-action interactions change.
3. Keep the shared classes CRUD harness authoritative if test changes touch bulk journeys.

### Section checks

- `npm run frontend:test -- src/features/classes/ClassesManagementPanel.spec.tsx`
- `npm run frontend:test -- src/features/classes/ClassesManagementPanel.bulkMetadataFailure.spec.tsx`
- `npm run frontend:test -- src/features/classes/ClassesToolbar.spec.tsx`
- `npm run frontend:test -- src/features/classes/bulkMutationOrchestration.spec.ts`
- Run the touched bulk-flow Vitest targets: `bulkCreate.spec.tsx`, `bulkSetCohort.spec.tsx`, `bulkSetYearGroup.spec.tsx`, `bulkSetCourseLength.spec.tsx`, and `bulkActiveState.spec.tsx`.
- `npm run frontend:test:e2e -- e2e-tests/classes-crud.harness.spec.ts`
- Run the touched classes Playwright target pattern: `npm run frontend:test:e2e -- e2e-tests/classes-crud-*.spec.ts`.
- Recount the cumulative production LOC total for the touched classes baseline files.
- Mandatory-read evidence gate passed for all delegated handoffs.

### Section 3 execution tracker (completed)

- [x] red tests added
- [x] red review clean
- [x] green implementation complete
- [x] green review clean
- [x] checks passed
- [x] action plan updated
- [ ] commit created (pending)
- [ ] push completed (pending)

### Section 3 red-phase findings and resolutions

1. Finding: early red-phase classes coverage included brittle source-structure assertions that would break on harmless refactors.
   - Resolution: removed brittle source-coupled assertions and kept behaviour-contract assertions for orchestration, modal outcomes, and selection semantics.
2. Finding: bulk journey coverage drifted across multiple classes e2e specs.
   - Resolution: unified bulk journey expectations through the shared classes CRUD harness and aligned touched `classes-crud-*.spec.ts` flows to that single authority.

### Section 3 green implementation notes and acceptance summary

- Green implementation removed duplicated per-action scaffolding in `ClassesManagementPanel`, converged cohort/year-group/course-length updates onto the shared feature-local metadata flow contract, and passed parent-derived `selectedRows` into `ClassesToolbar`.
- Acceptance summary: panel alert handling, modal outcome-family split, create defaults (`courseLength: 1`), refresh-required handling, selection retention, and modal close-vs-inline-error semantics remained aligned with the section acceptance criteria.

### Section 3 LOC tracking

- Baseline total: 4136
- After Section 1 cumulative total: 4034
- After Section 2 cumulative total: 3987
- After Section 3 cumulative total: 3896
- Cumulative delta: -240
- Touched Section 3 baseline files subtotal: 1302 -> 1211 (-91)
- New feature-local helper: `src/frontend/src/features/classes/bulkMetadataUpdateFlow.ts` +78
- Section 3 net including helper: -13

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` only if the surviving descriptor-driven orchestration boundary or metadata outcome split would otherwise be easy to flatten incorrectly later.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Section 3 is complete; classes bulk workflows now share the intended orchestration and metadata-update contracts while preserving modal outcomes, selection semantics, and existing defaults.
- **Deviations from plan:** one new feature-local helper file (`bulkMetadataUpdateFlow.ts`) was introduced to own a coherent multi-caller metadata contract; section net LOC including that helper remains reduced.
- **Follow-up implications for later sections:** next active phase is **Section 4 red**, currently **pending start**.

---

## Section 4 — Backend Settings Form Cleanup

### Objective

- Collapse repeated backend settings field wiring, remove mirrored validation error state, and preserve the current panel-versus-hook ownership boundary and API-key retention rules.

### Status

- Completed: Section 4 red and green phases are complete; checks are passing.

### Constraints

- `BackendSettingsPanel` remains the owner of the live Ant Design form instance, local edit state, and field meta.
- `useBackendSettings` remains responsible for query-backed load/save/refresh/rebase orchestration.
- A blank API key retains the stored key when one already exists.
- The frontend must never echo the masked read value into the API key input or write payload.
- Preserve current section cards, save workflow, blocking-load treatment, and scroll-to-first-error behaviour.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `/workspaces/AssessmentBot/AGENTS.md`
- `/workspaces/AssessmentBot/src/frontend/AGENTS.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-testing.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-loading-and-width-standards.md`
- `/workspaces/AssessmentBot/SPEC.md`
- `/workspaces/AssessmentBot/ACTION_PLAN.md`
- `https://ant.design/components/form/`
- `https://ant.design/components/modal/`
- `https://ant.design/components/alert/`
- `https://ant.design/components/space/`

Implementation mandatory docs:

- `/workspaces/AssessmentBot/AGENTS.md`
- `/workspaces/AssessmentBot/src/frontend/AGENTS.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-loading-and-width-standards.md`
- `/workspaces/AssessmentBot/SPEC.md`
- `/workspaces/AssessmentBot/ACTION_PLAN.md`
- `https://ant.design/components/form/`
- `https://ant.design/components/modal/`
- `https://ant.design/components/alert/`
- `https://ant.design/components/space/`

Code Reviewer mandatory docs:

- `/workspaces/AssessmentBot/AGENTS.md`
- `/workspaces/AssessmentBot/src/frontend/AGENTS.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-loading-and-width-standards.md`
- `/workspaces/AssessmentBot/SPEC.md`
- `/workspaces/AssessmentBot/ACTION_PLAN.md`
- `https://ant.design/components/form/`
- `https://ant.design/components/modal/`
- `https://ant.design/components/alert/`
- `https://ant.design/components/space/`

### Shared helper plan

1. Helper: local schema-aware field descriptor path for backend settings fields
   - Decision: `keep local`
   - Owning module/path: `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`
   - Call-site rationale: remove repeated `Form.Item` wiring inside one panel by driving the repeated field markup from a local descriptor path instead of introducing a one-caller wrapper file
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented`

### Acceptance criteria

- Repeated validated field wiring is materially reduced through one coherent local descriptor-based pattern inside `BackendSettingsPanel`.
- The duplicate field-error `Map` is removed or reduced to one authoritative source of truth, with Ant Design form meta as the surviving validation source unless implementation proves a tighter equivalent.
- The live form state remains in the panel and the load/save orchestration remains in the hook.
- Blank API key behaviour, masked-read handling, and save/refresh lifecycle remain unchanged.
- The section delivers a net LOC reduction across the backend settings production baseline files it touches.

### Required test cases

Frontend unit/component tests:

1. Update `src/frontend/src/features/settings/backend/BackendSettingsPanel.spec.tsx` for field rendering, validation, save flow, load/save error handling, and API-key retention behaviour.
2. Update `src/frontend/src/features/settings/backend/useBackendSettings.spec.ts` only if orchestration behaviour or ownership boundaries require expectation changes.
3. Update `src/frontend/src/features/settings/backend/backendSettingsFormMapper.spec.ts` and `backendSettingsForm.zod.spec.ts` if the cleanup changes the validation or mapping seams.

Frontend e2e tests:

1. Update `src/frontend/e2e-tests/settings-backend.spec.ts` for changed backend settings form interactions, validation presentation, or save-flow selectors.

### Section checks

- `npm run frontend:test -- src/features/settings/backend/BackendSettingsPanel.spec.tsx`
- `npm run frontend:test -- src/features/settings/backend/useBackendSettings.spec.ts`
- `npm run frontend:test -- src/features/settings/backend/backendSettingsFormMapper.spec.ts`
- `npm run frontend:test -- src/features/settings/backend/backendSettingsForm.zod.spec.ts`
- `npm run frontend:test:e2e -- e2e-tests/settings-backend.spec.ts`
- Recount the cumulative production LOC total for the touched backend settings baseline files.
- Mandatory-read evidence gate passed for all delegated handoffs.

### Section 4 execution tracker (completed)

- [x] red tests added
- [x] red review clean
- [x] green implementation complete
- [x] green review clean
- [x] checks passed
- [x] action plan updated
- [ ] commit created (pending)
- [ ] push completed (pending)

### Section 4 red-phase findings and resolutions

1. Finding: early red-phase backend settings coverage included brittle raw-source assertions that would fail on harmless refactors.
   - Resolution: removed brittle raw-source assertions and retained behaviour-contract assertions for field rendering, validation, save flow, and API-key retention.
2. Finding: hook refresh-failure coverage emitted a mock warning during the red phase.
   - Resolution: fixed the hook refresh-failure mock warning so red coverage runs cleanly while preserving the intended failure-path contract.

### Section 4 green implementation notes and acceptance summary

- Green implementation completed the descriptor-driven field wiring cleanup in `BackendSettingsPanel`, removed mirrored validation-error state in favour of Ant Design form meta, and preserved panel-versus-hook ownership boundaries.
- Acceptance summary: blank API-key retention, masked-read handling, save/refresh lifecycle, blocking-load treatment, section card structure, and scroll-to-first-error behaviour remained aligned with the section acceptance criteria.

### Section 4 LOC tracking

- Baseline total: 4136
- After Section 1 cumulative total: 4034
- After Section 2 cumulative total: 3987
- After Section 3 cumulative total: 3896
- After Section 4 cumulative total: 3709
- Cumulative delta: -427
- `BackendSettingsPanel.tsx`: 654 -> 467 (-187)

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` only if the final form-state versus orchestration boundary becomes easier to violate after simplification.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Section 4 is complete; backend settings form wiring and validation-state ownership are simplified while preserving save semantics and API-key retention rules.
- **Deviations from plan:** none recorded for Section 4.
- **Follow-up implications for later sections:** next active phase is **Section 5 red**, currently **pending start**.

---

## Section 5 — Low-Risk Cleanup Sweep

### Objective

- Close the remaining low-risk slop items within the accepted scope: test copy dedupe, trivial pass-through wrappers, duplicate comments, and over-commented glue code.

### Constraints

- No new abstractions.
- No layout or workflow changes.
- Keep the modal-shell extraction explicitly deferred unless it falls out for free without a new shared layer and without harming the LOC gate.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `/workspaces/AssessmentBot/AGENTS.md`
- `/workspaces/AssessmentBot/src/frontend/AGENTS.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-testing.md`
- `/workspaces/AssessmentBot/SPEC.md`
- `/workspaces/AssessmentBot/ACTION_PLAN.md`

Implementation mandatory docs:

- `/workspaces/AssessmentBot/AGENTS.md`
- `/workspaces/AssessmentBot/src/frontend/AGENTS.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `/workspaces/AssessmentBot/SPEC.md`
- `/workspaces/AssessmentBot/ACTION_PLAN.md`

Code Reviewer mandatory docs:

- `/workspaces/AssessmentBot/AGENTS.md`
- `/workspaces/AssessmentBot/src/frontend/AGENTS.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `/workspaces/AssessmentBot/SPEC.md`
- `/workspaces/AssessmentBot/ACTION_PLAN.md`

### Shared helper plan

1. Helper: page copy source of truth in tests
   - Decision: `reuse`
   - Owning module/path: `src/frontend/src/pages/pageContent.ts`
   - Call-site rationale: stop duplicating stable page copy in tests where strict data independence is not needed
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `pageExpectations` duplication is reduced or removed where production copy reuse is appropriate.
- Duplicate comments, trivial wrapper functions, and over-commented glue code within the accepted scope are removed.
- The final sweep does not introduce new helper layers or speculative abstractions.
- The total production LOC trend remains downward after this section.

### Required test cases

Frontend unit/component tests:

1. Update the touched page and shell tests that currently depend on `pageExpectations` duplication.
2. Run the touched classes or page specs if comment or wrapper cleanup touches covered code paths.

Frontend e2e tests:

1. Update the corresponding Playwright coverage if this sweep changes any user-visible interaction selectors or interaction copy.

### Section checks

- Run the touched frontend unit targets from Sections 1 to 4 again if this sweep changes their copied assertions, wrapper setup, or shared page copy sources.
- Run the corresponding Playwright targets from Sections 1 to 4 again if this sweep changes any user-visible interaction selectors or interaction copy.
- Recount the cumulative production LOC total for the explicit baseline files.
- Mandatory-read evidence gate passed for all delegated handoffs.

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** use this section for safe cleanup that does not justify a dedicated heavier refactor section.
- **Deviations from plan:** if a deferred modal-shell extraction is attempted here, stop and reopen planning unless it clearly removes code without a new abstraction.
- **Follow-up implications for later sections:** none.

---

## Regression and contract hardening

### Objective

- Verify that the full cleanup preserves runtime behaviour, preserves required interaction contracts, and satisfies the explicit production LOC reduction gate.

### Constraints

- Prefer targeted validation first, then broader frontend validation.
- Use visible-browser coverage where user-visible interactions were touched.

### Delegation mandatory reads

De-Sloppification mandatory docs:

- `/workspaces/AssessmentBot/AGENTS.md`
- `/workspaces/AssessmentBot/src/frontend/AGENTS.md`
- `/workspaces/AssessmentBot/SPEC.md`
- `/workspaces/AssessmentBot/ACTION_PLAN.md`
- `/workspaces/AssessmentBot/SLOP_REVIEW.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

Code Reviewer mandatory docs:

- `/workspaces/AssessmentBot/AGENTS.md`
- `/workspaces/AssessmentBot/src/frontend/AGENTS.md`
- `/workspaces/AssessmentBot/SPEC.md`
- `/workspaces/AssessmentBot/ACTION_PLAN.md`
- `/workspaces/AssessmentBot/SLOP_REVIEW.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-testing.md`

### Acceptance criteria

- Touched frontend unit/component suites pass.
- Touched Playwright suites pass for visible interaction changes.
- Frontend lint passes.
- The final measured production LOC total across the explicit baseline is lower than the recorded starting total.
- Mandatory-read evidence is complete for every delegated handoff.

### Required test cases/checks

1. Run touched frontend unit/component suites section by section.
2. Run touched Playwright suites for shell, settings, assignments, and classes interactions where visible behaviour changed.
3. Run `npm run frontend:lint`.
4. If the change surface is broad enough, run `npm run frontend:test:coverage` before closing.
5. Recount the explicit production baseline from this document and compare it with the recorded baseline from before implementation began.
6. Confirm deferred items remain deferred and were not reintroduced as new wrapper layers.

### Section checks

- Ensure all commands above are green.
- Record the starting LOC total and final LOC total in implementation notes.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record final production LOC delta against the explicit baseline.
- **Deviations from plan:** note any temporary LOC increase that was paid back later.

---

## Documentation and rollout notes

### Objective

- Reconcile planning-only helper entries with the implemented cleanup and document any non-obvious preserved contracts that future maintainers need to keep.

### Constraints

- Only update docs directly relevant to the touched frontend areas.
- Keep helper-policy updates in the canonical helper standards doc.

### Delegation mandatory reads

Docs mandatory docs:

- `/workspaces/AssessmentBot/AGENTS.md`
- `/workspaces/AssessmentBot/src/frontend/AGENTS.md`
- `/workspaces/AssessmentBot/SPEC.md`
- `/workspaces/AssessmentBot/ACTION_PLAN.md`
- `/workspaces/AssessmentBot/SLOP_REVIEW.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-loading-and-width-standards.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-shell-navigation-and-motion.md`

Code Reviewer mandatory docs:

- `/workspaces/AssessmentBot/AGENTS.md`
- `/workspaces/AssessmentBot/src/frontend/AGENTS.md`
- `/workspaces/AssessmentBot/SPEC.md`
- `/workspaces/AssessmentBot/ACTION_PLAN.md`
- `/workspaces/AssessmentBot/docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Acceptance criteria

- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` reflects which planned helper decisions were implemented and which remain deferred.
- Any non-obvious preserved contracts discovered during implementation are captured in code `@remarks` or canonical docs where appropriate.
- The explicit LOC baseline and final delta are recorded in the implementation notes before this action plan is retired.

### Required checks

1. Reconcile planned helper entries in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`.
2. Update any directly affected developer docs only if implementation changed their factual guidance.
3. Confirm deferred modal-shell work remains marked as deferred if still pending.
4. Verify mandatory-read evidence for delegated docs and review handoffs.

### Optional `@remarks` JSDoc review

- Confirm whether navigation render ownership, Settings remount semantics, classes outcome-family split, or backend API-key retention rules need durable `@remarks` in code.

### Implementation notes / deviations / follow-up

- Record final helper statuses, final production LOC delta, and any deliberate deferrals that remain after implementation.

---

## Suggested implementation order

1. Section 1 — Shell And Settings Frame Cleanup
2. Section 2 — Assignments Filter Consolidation
3. Section 3 — Classes Workflow Simplification
4. Section 4 — Backend Settings Form Cleanup
5. Section 5 — Low-Risk Cleanup Sweep
6. Regression and contract hardening
7. Documentation and rollout notes
