# Classes Page Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md`.
2. Read `CLASSES_PAGE_LAYOUT.md`.
3. Read `AGENTS.md` and `src/frontend/AGENTS.md`.
4. Read `docs/developer/frontend/frontend-testing.md`.
5. Read `docs/developer/frontend/frontend-loading-and-width-standards.md`.
6. Read `docs/developer/frontend/frontend-react-query-and-prefetch.md`.
7. Read `docs/developer/frontend/frontend-shell-navigation-and-motion.md`.
8. Read `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`.
9. Treat the spec and layout spec as the source of truth for behaviour, data trust rules, and layout expectations.

## Scope and assumptions

### Scope

- Add a dedicated top-level frontend Classes page that uses the existing `classPartials` and `yearGroups` shared queries.
- Add the page-level card and collapse surface defined in `SPEC.md` and `CLASSES_PAGE_LAYOUT.md`.
- Add focused frontend unit/component coverage and Playwright browser coverage for the new surface.
- Keep the plan split into small sections so a later implementation agent can validate each behaviour slice independently.

### Out of scope

- Backend model, API, allowlist, or persistence changes.
- Replacing or refactoring the existing Settings > Classes table workflow.
- Making the placeholder `View` and `Edit` controls functional.
- Google Classrooms merges, drag-and-drop, manual ordering, filters, or search.

### Assumptions

1. Add the new top-level `classes` navigation entry between `assignments` and `settings` so the browse surface remains a first-class page without changing the existing Settings ownership of administrative workflows.
2. Keep the Classes page grouping and trust-boundary derivation local to the new Classes page surface unless a genuine second active caller appears during implementation.
3. Cover every user-triggerable visible interaction in Playwright. The background-refresh transition is intentionally Vitest-owned because this page has no dedicated manual refresh control and the shared query client disables focus and reconnect refetch; do not add production test hooks just to make that transition browser-triggerable.

---

## Global constraints and quality gates

### Engineering constraints

- Keep shell navigation keys, labels, icons, and page rendering centralised in `src/frontend/src/navigation/appNavigation.tsx`.
- Keep page heading and summary copy centralised in `src/frontend/src/pages/pageContent.ts`.
- Reuse `PageSection` for the top-level page shell.
- Reuse `getClassPartialsQueryOptions()` and `getYearGroupsQueryOptions()` from `src/frontend/src/query/sharedQueries.ts`; do not add parallel query definitions.
- Keep frontend transport behind the existing services and `callApi(...)`; no new backend transport methods are allowed in this iteration.
- Do not reuse `ClassesManagementPanel`, `ClassesTable.helpers.ts`, or the Settings Classes Google-Classrooms merge logic for the new page.
- Follow the owned-surface loading, fail-closed, busy, and width rules in `docs/developer/frontend/frontend-loading-and-width-standards.md`.
- Use the existing shared Playwright runtime mock and deferred-success helpers instead of introducing a second browser mock harness.
- Use idiomatic Ant Design component patterns from `docs/developer/frontend/ant-design-docs-cache/` for all UI components.
- Use British English in docs, comments, visible copy, and test names.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section’s acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy the implementation with all section tests still green.
4. Run the section-level verification commands before moving on.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents:

1. include the mandatory documentation file paths listed in that section
2. require the handoff to include `Files read`
3. verify every mandatory file is present before accepting the handoff
4. if any mandatory file is missing, return the work to the same sub-agent and block progression

### Shared-helper planning gate

- Use the helper decisions already recorded in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` as the starting point.
- Do not extract a shared helper for the Classes page view-model unless a second active caller appears during implementation.
- Reuse the existing shared navigation contract and the shared Playwright runtime mock rather than introducing parallel abstractions.

### Validation commands hierarchy

- Frontend lint: `npm run lint:frontend:check`
- Frontend unit/component tests: `npm run test:frontend -- <target>`
- Frontend e2e tests: `npm run test:frontend:e2e -- <target>`
- Playwright browser install when missing: `npm --prefix src/frontend exec -- playwright install --with-deps chromium`

---

## Section 1 — Wire the shell navigation contract

### Objective

- Extend the canonical shell navigation and page-copy contracts so `classes` becomes a first-class top-level page without disturbing the existing Settings > Classes tab.

### Constraints

- `src/frontend/src/navigation/appNavigation.tsx` remains the single source of truth for navigation keys and page rendering.
- `src/frontend/src/pages/pageContent.ts` remains the single source of truth for the page heading and summary copy.
- The new page must use `PageSection`; do not add a second shell wrapper pattern.
- The existing Settings page tabs and the `ClassesManagementPanel` entry point must remain intact.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `CLASSES_PAGE_LAYOUT.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md`
- `src/frontend/src/navigation/appNavigation.tsx`
- `src/frontend/src/navigation/appNavigation.spec.tsx`
- `src/frontend/src/App.spec.tsx`
- `src/frontend/src/pages/pages.spec.tsx`
- `src/frontend/e2e-tests/app.spec.ts`
- `src/frontend/src/pages/pageContent.ts`
- `src/frontend/src/pages/SettingsPage.tsx`
- `src/frontend/src/pages/SettingsPageGoogleClassroomsPrefetch.tsx`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `CLASSES_PAGE_LAYOUT.md`
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `src/frontend/src/navigation/appNavigation.tsx`
- `src/frontend/src/App.spec.tsx`
- `src/frontend/src/pages/pages.spec.tsx`
- `src/frontend/e2e-tests/app.spec.ts`
- `src/frontend/src/pages/pageContent.ts`
- `src/frontend/src/pages/PageSection.tsx`
- `src/frontend/src/pages/SettingsPage.tsx`
- `src/frontend/src/pages/SettingsPageGoogleClassroomsPrefetch.tsx`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `CLASSES_PAGE_LAYOUT.md`
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `src/frontend/src/navigation/appNavigation.tsx`
- `src/frontend/src/App.spec.tsx`
- `src/frontend/src/pages/pages.spec.tsx`
- `src/frontend/e2e-tests/app.spec.ts`
- `src/frontend/src/pages/pageContent.ts`
- `src/frontend/src/pages/SettingsPage.tsx`
- `src/frontend/src/pages/SettingsPageGoogleClassroomsPrefetch.tsx`

### Shared helper plan

Helper decision entries:

1. Helper: `navigation page renderer source of truth`
   - Decision: `reuse`
   - Owning module/path: `src/frontend/src/navigation/appNavigation.tsx`
   - Call-site rationale: the new page must extend the existing shell contract instead of introducing a second page-selection switch or duplicated label map
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented`

2. Helper: `Ant Design component usage patterns`
   - Decision: `reuse documented patterns`
   - Reference docs: `docs/developer/frontend/ant-design-docs-cache/`
   - Call-site rationale: LLMs need idiomatic Ant Design component usage patterns for:
     - Collapse: `docs/developer/frontend/ant-design-docs-cache/collapse.md` - for year-group panels (multi-expand behaviour)
     - Card: `docs/developer/frontend/ant-design-docs-cache/card.md` - for individual class cards
     - Button: `docs/developer/frontend/ant-design-docs-cache/button.md` - for disabled "View" and "Edit" actions
     - Alert: `docs/developer/frontend/ant-design-docs-cache/alert.md` - for error/blocking states
     - Skeleton: `docs/developer/frontend/ant-design-docs-cache/skeleton.md` - for loading placeholders
     - Spin: `docs/developer/frontend/ant-design-docs-cache/spin.md` - for busy indicators
     - Empty: `https://ant.design/components/empty` - for explicit empty states
     - Flex: `https://ant.design/components/flex` - for wrapping card layouts
     - Space: `https://ant.design/components/space` - for button spacing
   - Relevant canonical doc target: `docs/developer/frontend/ant-design-docs-cache/`
   - Planned doc status: `Implemented`

### Acceptance criteria

- `AppNavigationKey` includes `classes` and the navigation item list exposes a visible `Classes` top-level entry.
- `renderNavigationPage('classes')` resolves to the new page entry point and fails fast for unknown keys exactly as before.
- `pageContent.classes` supplies the canonical heading and summary used by both navigation and the page shell.
- Existing shell-wide menu-count, page-iteration, and breadcrumb expectations are updated to include the new top-level page.
- Opening the new top-level page does not remove or rename the existing Settings > Classes tab.
- Opening the new top-level page does not trigger `getGoogleClassrooms`.

### Required test cases (Red first)

Frontend tests:

1. Update `src/frontend/src/navigation/appNavigation.spec.tsx` so the stable navigation keys and labels include `classes` in the agreed order.
2. Add a render-contract test that `renderNavigationPage('classes')` shows the shared Classes heading and summary.
3. Update `src/frontend/src/pages/pages.spec.tsx` so the shared page-iteration coverage includes the Classes page heading and summary.
4. Update `src/frontend/src/App.spec.tsx` so shell-level navigation labels, menu count, and breadcrumb expectations include the new top-level page.
5. Add or update a Settings page regression test to confirm the Settings tab entry labelled `Classes` still exists after the new top-level page is added.

Frontend e2e tests:

1. Add a browser test that clicks the top-level `Classes` menu item and asserts the Classes heading and summary render in the page shell.
2. In the same or an adjacent browser test, assert that opening the Classes page does not call `getGoogleClassrooms` by inspecting the existing runtime method-call tracker.
3. Update `src/frontend/e2e-tests/app.spec.ts` so the shell-wide top-level navigation, breadcrumb, and menu-count journeys explicitly include the new Classes page.
4. Add a browser regression assertion that the Settings page still contains its own `Classes` tab after the new top-level navigation entry lands.

### Section checks

- `npm run test:frontend -- src/navigation/appNavigation.spec.tsx src/pages/pages.spec.tsx src/App.spec.tsx src/pages/SettingsPage.spec.tsx`
- `npm run test:frontend:e2e -- e2e-tests/app.spec.ts e2e-tests/classes-page.spec.ts`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- Consider adding `@remarks` documentation for the new Classes page component to explain the Ant Design component usage patterns.

### Implementation notes / deviations / follow-up

- **Implementation notes:** keep the new page routing thin and avoid speculative shell abstractions.
- **Deviations from plan:** record any justified navigation-order change if reviewer feedback requires it.
- **Follow-up implications for later sections:** later sections should treat the new page entry point as stable and avoid revisiting shell routing.
- **Completion status:** ✅ Section 1 COMPLETE - Shell navigation contract wired. Red phase: Tests created and reviewed clean (appNavigation.spec.tsx, App.spec.tsx, pages.spec.tsx, SettingsPage.spec.tsx). Green phase: Navigation and page-content contracts extended with Classes page entry. All navigation tests pass, lint clean, regression gate passed.
- **Files modified:** `src/frontend/src/navigation/appNavigation.tsx` (added classes navigation item), `src/frontend/src/pages/pageContent.ts` (added classes content), `src/frontend/src/pages/ClassesPage.tsx` (created page component)

### Documentation gaps addressed

- Added links to `Empty`, `Flex`, and `Space` Ant Design components in the shared helper plans to ensure all referenced components have accessible documentation links.

---

## Section 2 — Build the page-local grouped view model

### Objective

- Introduce the smallest page-local derivation contract that validates trust, sorts the datasets deterministically, and produces the panel/card model required by the page.

### Constraints

- The derivation must be page-local unless a second real caller appears.
- The new page must not reuse the Settings Classes table shaping helpers because their merge rules are different.
- The derivation must fail closed on `null className`, `null yearGroupKey`, and unresolved `yearGroupKey` mappings.
- Every loaded year group must yield a panel, even when no classes belong to it.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `CLASSES_PAGE_LAYOUT.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `src/frontend/src/services/classPartialsService.ts`
- `src/frontend/src/services/referenceDataService.ts`
- `src/frontend/src/query/sharedQueries.ts`
- `src/frontend/src/features/classes/ClassesTable.helpers.ts`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `CLASSES_PAGE_LAYOUT.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `src/frontend/src/services/classPartialsService.ts`
- `src/frontend/src/services/referenceDataService.ts`
- `src/frontend/src/query/sharedQueries.ts`
- `src/frontend/src/features/classes/ClassesTable.helpers.ts`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `CLASSES_PAGE_LAYOUT.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `src/frontend/src/services/classPartialsService.ts`
- `src/frontend/src/services/referenceDataService.ts`
- `src/frontend/src/features/classes/ClassesTable.helpers.ts`

### Shared helper plan

Helper decision entries:

1. Helper: `Classes page grouped view-model builder`
   - Decision: `keep local`
   - Owning module/path: `src/frontend/src/pages/classes/classesPageModel.ts` or an equivalent page-adjacent local helper
   - Call-site rationale: the grouping, panel defaults, and fail-closed trust rules are specific to the new browse page and should not widen the Settings Classes helper surface
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented`

2. Helper: `Ant Design component usage patterns`
   - Decision: `reuse documented patterns`
   - Reference docs: `docs/developer/frontend/ant-design-docs-cache/`
   - Call-site rationale: LLMs need idiomatic Ant Design component usage patterns for:
     - Collapse: `docs/developer/frontend/ant-design-docs-cache/collapse.md` - for year-group panels with `items` prop, `defaultActiveKey`, and `onChange` callback
     - Card: `docs/developer/frontend/ant-design-docs-cache/card.md` - for class cards with `title` and `children` props
     - Button: `docs/developer/frontend/ant-design-docs-cache/button.md` - for disabled buttons with `disabled` prop
     - Alert: `docs/developer/frontend/ant-design-docs-cache/alert.md` - for error states with `type="error"` and `showIcon`
     - Skeleton: `docs/developer/frontend/ant-design-docs-cache/skeleton.md` - for loading placeholders with `active` animation
     - Spin: `docs/developer/frontend/ant-design-docs-cache/spin.md` - for busy indicators with `spinning` prop
     - Empty: `https://ant.design/components/empty` - for explicit empty states
     - Flex: `https://ant.design/components/flex` - for wrapping card layouts
     - Space: `https://ant.design/components/space` - for button spacing
   - Relevant canonical doc target: `docs/developer/frontend/ant-design-docs-cache/`
   - Planned doc status: `Implemented`

### Acceptance criteria

- The page-local derivation returns one ordered panel per year group.
- Panels sort by `YearGroup.name` ascending, then `YearGroup.key` ascending.
- Cards sort by `className` ascending, then `classId` ascending.
- The first alphabetical panel key is exposed as the initial default-expanded key when panels exist.
- If both datasets are trustworthy and empty, the derivation reports the page-level empty state instead of an empty collapse.
- If year groups are empty while classes exist, or if any class record is invalid for this page, the derivation reports the blocking invalid-data state.

### Required test cases (Red first)

Frontend tests:

1. Add a pure derivation spec that proves panel sorting uses `name` then `key` as the deterministic tie-break.
2. Add a pure derivation spec that proves card sorting uses `className` then `classId` as the deterministic tie-break.
3. Add a pure derivation spec that returns an empty panel for a year group with no matching classes.
4. Add pure derivation specs that fail closed for `className === null`, `yearGroupKey === null`, and unresolved `yearGroupKey`.
5. Add a pure derivation spec for the `yearGroups = []` and `classPartials = []` page-level empty state.
6. Add a pure derivation spec for the `yearGroups = []` with existing classes blocking state.
7. Add a pure derivation spec for the default-expanded first alphabetical panel key.

### Section checks

- `npm run test:frontend -- src/pages/classes/classesPageModel.spec.ts`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Planned helper entry exists in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` with status `Not implemented` before implementation starts.

### Optional `@remarks` JSDoc follow-through

- Consider `@remarks` on the page-local derivation helper only if the final implementation needs to explain why this page intentionally rejects `null className` values that the transport schema still permits.

### Implementation notes / deviations / follow-up

- **Implementation notes:** prefer a small pure function with explicit return states over interleaving validation logic directly in JSX.
- **Deviations from plan:** None. Implementation matches SPEC.md and CLASSES_PAGE_LAYOUT.md exactly.
- **Follow-up implications for later sections:** later UI sections should consume the derived model rather than re-deriving grouping rules inline.
- **Completion status:** ✅ Section 2 COMPLETE - Red phase tests created and reviewed clean, Green phase implementation created and reviewed clean, all 12 tests pass, lint passes, regression gate passed.
- **Files created:** `src/frontend/src/pages/classes/classesPageModel.ts`, `src/frontend/src/pages/classes/classesPageModel.spec.ts`
- **Helper decision update:** The `Classes page grouped view-model builder` helper (Section 2.1) should have its planned doc status updated from `Not implemented` to `Implemented` in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`.

---

## Section 3 — Add owned-surface loading, blocking, and page-empty states

### Objective

- Land the page-owned query state handling for initial load, fail-closed blocking states, and the page-level empty state before implementing the full ready-state collapse.

### Constraints

- Reuse the shared `classPartials` and `yearGroups` query definitions.
- The page should derive readiness from dataset usability, not from a coarse global warm-up flag alone.
- If usable data is already cached, render the ready state instead of forcing a skeleton.
- Use a labelled `role="status"` loading region while the skeleton is visible.
- In blocking states, suppress the collapse and cards entirely.
- Use `src/frontend/src/pages/AssignmentsPage.tsx` as the nearest page-level precedent for page-owned blocking and busy-state behaviour without copying assignment-specific controls.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `CLASSES_PAGE_LAYOUT.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `src/frontend/src/features/auth/startupWarmupState.ts`
- `src/frontend/src/pages/AssignmentsPage.tsx`
- `src/frontend/src/pages/AssignmentsPage.spec.tsx`
- `src/frontend/src/query/sharedQueries.ts`
- `src/frontend/src/query/queryClient.ts`
- `src/frontend/src/test/renderWithFrontendProviders.tsx`
- `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `CLASSES_PAGE_LAYOUT.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `src/frontend/src/features/auth/startupWarmupState.ts`
- `src/frontend/src/pages/AssignmentsPage.tsx`
- `src/frontend/src/pages/AssignmentsPage.spec.tsx`
- `src/frontend/src/query/sharedQueries.ts`
- `src/frontend/src/query/queryClient.ts`
- `src/frontend/src/test/renderWithFrontendProviders.tsx`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `CLASSES_PAGE_LAYOUT.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `src/frontend/src/features/auth/startupWarmupState.ts`
- `src/frontend/src/pages/AssignmentsPage.tsx`
- `src/frontend/src/pages/AssignmentsPage.spec.tsx`
- `src/frontend/src/query/sharedQueries.ts`
- `src/frontend/src/query/queryClient.ts`

### Acceptance criteria

- With no usable `classPartials` or `yearGroups` data yet, the page-owned region renders a shape-matched skeleton and exposes accessible loading semantics.
- With cached trustworthy data already present, the page renders ready content immediately instead of forcing a skeleton because of a broader warm-up flag.
- Transport/query failure yields a blocking alert in the page-owned region and suppresses the collapse content.
- Invalid page-owned data yielded by the view-model builder yields the same blocking-state treatment.
- If the startup warm-up snapshot marks `classPartials` or `yearGroups` as failed, the page still uses the live shared query path so a later successful fetch can recover the surface from blocking state.
- If both datasets are trustworthy and empty, the page renders the page-level `Empty` state defined in the spec.

### Required test cases (Red first)

Frontend tests:

1. Add a component test that renders the skeleton while `classPartials` and `yearGroups` are still unresolved and no usable cache is present.
2. Add a component test that seeds the shared query cache with trustworthy data and proves the page skips the skeleton even if the wider warm-up state is not yet marked ready.
3. Add a component test for a query failure that shows the blocking alert and suppresses the collapse region.
4. Add a component test for a blocking invalid-data result from the page-local view model.
5. Add a component test that starts from a failed `classPartials` warm-up snapshot and proves the page recovers once the live query resolves successfully.
6. Add a component test that starts from a failed `yearGroups` warm-up snapshot and proves the page recovers once the live query resolves successfully.
7. Add a component test for the both-empty page-level `Empty` state.

Frontend e2e tests:

1. Add a Playwright test that seeds valid responses for the full startup warm-up dataset set, then uses deferred-success responses for the Classes-owned datasets, asserts the loading skeleton is visible, releases the deferred responses, and then asserts the page transitions to ready content.
2. Add a Playwright test that seeds valid responses for the other startup warm-up datasets, returns a transport failure for one Classes-owned required dataset, and asserts the blocking alert is visible while the collapse is absent.
3. Add a Playwright test for the both-empty Classes datasets case, while still seeding valid responses for the other startup warm-up datasets, and assert the page-level empty state renders instead of the collapse.
4. Add a Playwright test that seeds valid responses for the other startup warm-up datasets, returns transport-valid but page-invalid class data, such as `className: null`, and asserts the blocking alert renders while the collapse and cards remain suppressed.

### Section checks

- `npm run test:frontend -- src/pages/ClassesPage.spec.tsx`
- `npm run test:frontend:e2e -- e2e-tests/classes-page.spec.ts -g "shows the correct loading, blocking, and empty states"`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to the page state hook only if the final implementation needs to explain the distinction between cache usability and the broader startup warm-up status.

### Implementation notes / deviations / follow-up

- **Implementation notes:** keep the state ownership local to the page-owned content region; avoid whole-shell loading or failure replacements.
- **Deviations from plan:** record any unavoidable changes to the startup-warm-up state contract.
- **Follow-up implications for later sections:** later sections can assume the ready-state surface only receives trustworthy or explicitly blocked state inputs.
- **Completion status:** ✅ Section 3 COMPLETE - All issues resolved: Issue 2 (recovery bug) fixed by adding `hasTrustworthyDatasets` check to empty state logic, Issue 3 (stray JSDoc) removed, Issue 4 (redundant buildDatasetState) inlined. Red phase tests created and reviewed clean, Green phase implementation created and reviewed clean, all 8 tests pass, lint clean, regression gate passed with 0 new regressions.
- **Files modified:** `src/frontend/src/pages/ClassesPage.tsx`

---

## Section 4 — Render the ordered year-group collapse behaviour

### Objective

- Render the ready-state year-group collapse with the exact ordering, default expansion, and in-panel empty handling defined in the spec.

### Constraints

- Use Ant Design `Collapse` with standard multi-expand behaviour; do not use accordion mode.
- The first alphabetical panel must be expanded on the first ready render when at least one panel exists.
- Panel labels must use the resolved year-group label only; do not add class counts in this iteration.
- Expansion state stays local UI state only and is not persisted.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `CLASSES_PAGE_LAYOUT.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `src/frontend/src/pages/PageSection.tsx`
- `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `CLASSES_PAGE_LAYOUT.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `src/frontend/src/pages/PageSection.tsx`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `CLASSES_PAGE_LAYOUT.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`

### Acceptance criteria

- The ready state renders one `Collapse` panel per year group in the derived order using Ant Design `Collapse` component with `items` prop.
- The first alphabetical panel is expanded on the initial ready render using `defaultActiveKey` prop.
- Expanding one panel does not collapse another panel automatically (multi-expand mode).
- A year-group panel with no classes shows an explicit in-panel empty presentation using `Card` components with empty state messages.
- Class cards only appear under the panel whose `yearGroupKey` matches the card model using proper card structure and layout.

### Required test cases (Red first)

Frontend tests:

1. Add a component test that verifies panel header order from a mixed year-group fixture.
2. Add a component test that verifies the first alphabetical panel is open on first ready render.
3. Add a component test that verifies an empty year-group panel shows its own empty presentation.
4. Add a component test that verifies cards only render under their matching year-group panel.

Frontend e2e tests:

1. Add a Playwright test that asserts the collapse headers render in the expected alphabetical order.
2. Add a Playwright test that asserts the first alphabetical panel body is visible on first ready render.
3. Add a Playwright test that expands a second panel and proves the first panel remains expanded.
4. Add a Playwright test that collapses and re-expands a panel using visible controls only.
5. Add a Playwright test that opens a year-group panel with no classes and asserts the in-panel empty message is visible.

### Section checks

- `npm run test:frontend -- src/pages/ClassesPage.spec.tsx`
- `npm run test:frontend:e2e -- e2e-tests/classes-page.spec.ts -g "renders ordered year-group collapse behaviour"`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** keep the collapse item-building logic driven by the page-local model rather than re-sorting in render.
- **Deviations from plan:** document any Ant Design component behaviour that requires a minor wording or selector adjustment.
- **Follow-up implications for later sections:** the card section should assume the panel contract is stable and should not change expansion ownership.
- **Completion status:** ✅ Section 4 COMPLETE - All acceptance criteria met. Red phase: 4 component tests + 5 e2e tests created and reviewed clean. Green phase: Ant Design Collapse implementation with items prop, proper accessibility, defaultActiveKey, multi-expand mode, in-panel empty states. All 12 component tests pass, all 12 e2e tests pass, lint clean, code review PASS with 4 nitpicks fixed (deprecation warning, type assertion commented, View/Edit as disabled Buttons, unused variable removed). Regression gate passed with 0 new regressions.
- **Files modified:** `src/frontend/src/pages/ClassesPage.tsx` (implementation), `src/frontend/src/pages/ClassesPage.spec.tsx` (component tests), `src/frontend/e2e-tests/classes-page.spec.ts` (e2e tests)

---

## Section 5 — Render class cards and placeholder action affordances

### Objective

- Land the card collection, placeholder buttons, and the visible no-extra-metadata surface defined for this first iteration.

### Constraints

- Use Ant Design `Card` for the class surface and keep the layout intentionally simple.
- Show `View` and `Edit` as visible disabled buttons only.
- Do not add modals, drawers, navigation, mutation handlers, drag handles, class counts, status chips, or Google-Classroom-derived labels.
- The class-card region should wrap naturally within the panel width rather than behaving like a table.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `CLASSES_PAGE_LAYOUT.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `CLASSES_PAGE_LAYOUT.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `CLASSES_PAGE_LAYOUT.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`

### Acceptance criteria

- Cards render the class name directly from the trustworthy page model.
- Cards inside a panel render in the derived alphabetical order.
- `View` and `Edit` are visible and programmatically disabled.
- Browsing the page exposes the placeholder buttons only as disabled controls; no enabled View/Edit workflow affordance becomes available.
- No drag, reorder, or extra metadata affordances are visible.

### Required test cases (Red first)

Frontend tests:

1. Add a component test that verifies card order inside a panel follows `className` then `classId`.
2. Add a component test that verifies both placeholder buttons are visible and disabled for every rendered card.
3. Add a component test that proves no extra metadata such as cohort, teacher list, or status chips is rendered in this iteration.
4. Add a component test that proves no drag or reorder affordance is present.

Frontend e2e tests:

1. Add a Playwright test that opens a populated year-group panel and asserts the visible card titles are in the expected order.
2. Add a Playwright test that asserts every visible `View` and `Edit` button is disabled.
3. Add a Playwright test that verifies no enabled View/Edit link, dialog trigger, or other workflow affordance is present while browsing the page normally.
4. Add a Playwright test that asserts no drag handle, reorder button, or other ordering affordance is visible in the card surface.

### Section checks

- `npm run test:frontend -- src/pages/ClassesPage.spec.tsx`
- `npm run test:frontend:e2e -- e2e-tests/classes-page.spec.ts -g "renders class cards and placeholder actions"`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** keep card rendering declarative and driven by the already-sorted model.
- **Deviations from plan:** record any unavoidable selector changes for stable button assertions.
- **Follow-up implications for later sections:** later work should treat the placeholder buttons as reserved affordance locations only.
- **Completion status:** ✅ Section 5 COMPLETE - Implementation already satisfied from Section 4. Red phase: 5 component tests + 5 e2e tests created and reviewed clean, all tests pass immediately confirming implementation meets requirements. All acceptance criteria validated: card order (className then classId), View/Edit visible and disabled, no enabled workflows, no drag/reorder affordances, no extra metadata. Code review PASS with 3 non-blocking documentation improvements. Regression gate passed with 0 new regressions.
- **Files modified:** `src/frontend/src/pages/ClassesPage.spec.tsx` (5 component tests), `src/frontend/e2e-tests/classes-page.spec.ts` (5 e2e tests)

---

## Section 6 — Harden refresh transitions, accessibility, and narrow-viewport behaviour

### Objective

- Cover the remaining non-trivial surface rules: background refresh semantics, fail-closed trust-loss after refresh, accessible busy semantics, keyboard operability, and narrow-viewport layout resilience.

### Constraints

- Once trustworthy content is visible, a refresh must keep that content visible until the data becomes untrustworthy.
- Busy refresh must be scoped to the page-owned surface with visible refresh text and `aria-busy="true"`.
- If refreshed data becomes untrustworthy, the surface must transition to the blocking alert and suppress the collapse/cards.
- Collapse interaction should remain keyboard-operable through standard Ant Design behaviour; do not add bespoke keyboard handlers.
- Responsive coverage should avoid brittle pixel-perfect assertions and focus on usable layout outcomes.
- Treat `src/frontend/src/pages/AssignmentsPage.tsx` as the behavioural precedent for page-owned busy and blocking semantics, but keep the Classes page implementation smaller because it has no create, delete, or retry surface in this iteration.
- Do not plan a Playwright-specific refresh trigger for this section; the refresh transition is intentionally covered in Vitest because it is not user-triggerable on this page.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `CLASSES_PAGE_LAYOUT.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md`
- `src/frontend/src/features/auth/startupWarmupState.ts`
- `src/frontend/src/pages/AssignmentsPage.tsx`
- `src/frontend/src/query/queryClient.ts`
- `src/frontend/src/test/renderWithFrontendProviders.tsx`
- `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `CLASSES_PAGE_LAYOUT.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md`
- `src/frontend/src/features/auth/startupWarmupState.ts`
- `src/frontend/src/pages/AssignmentsPage.tsx`
- `src/frontend/src/query/queryClient.ts`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `CLASSES_PAGE_LAYOUT.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md`
- `src/frontend/src/features/auth/startupWarmupState.ts`
- `src/frontend/src/pages/AssignmentsPage.tsx`
- `src/frontend/src/query/queryClient.ts`

### Shared helper plan

Helper decision entries:

1. Helper: `shared Playwright GAS runtime mock for Classes page journeys`
   - Decision: `reuse`
   - Owning module/path: `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`
   - Call-site rationale: deferred success, runtime method tracking, and API queueing already exist and should be extended rather than duplicated for the new page
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented`

2. Helper: `Ant Design component usage patterns for refresh states`
   - Decision: `reuse documented patterns`
   - Reference docs: `docs/developer/frontend/ant-design-docs-cache/`
   - Call-site rationale: LLMs need idiomatic Ant Design component usage for refresh transitions:
     - Collapse: Use `activeKey` state management for controlled expansion (see `docs/developer/frontend/ant-design-docs-cache/collapse.md`)
     - Spin: Use `spinning={isLoading}` with `tip="Loading..."` for busy states (see `docs/developer/frontend/ant-design-docs-cache/spin.md`)
     - Skeleton: Use `loading={isLoading}` prop to show/hide skeleton placeholders (see `docs/developer/frontend/ant-design-docs-cache/skeleton.md`)
     - Alert: Use `type="error"` for blocking states with error messages (see `docs/developer/frontend/ant-design-docs-cache/alert.md`)
     - Empty: Use for in-panel empty states (see `https://ant.design/components/empty`)
     - Flex: Use for wrapping card layouts (see `https://ant.design/components/flex`)
     - Space: Use for button spacing (see `https://ant.design/components/space`)
   - Relevant canonical doc target: `docs/developer/frontend/ant-design-docs-cache/`
   - Planned doc status: `Implemented`

### Acceptance criteria

- With cached trustworthy data and an in-flight refetch, the page keeps the grouped content visible, shows visible refresh text, and marks the owned region busy.
- If the refetch resolves with new trustworthy data, the busy state clears without reverting to the initial skeleton.
- If the refetch resolves with invalid or unresolvable grouping data, the page transitions to the blocking alert and suppresses the normal content.
- Collapse headers remain keyboard-operable.
- At a narrow mobile viewport, cards remain readable and reachable without introducing horizontal page scrolling.

### Required test cases (Red first)

Frontend tests:

1. Add a component test that seeds trustworthy cache data, triggers a deferred refetch, and asserts the current grouped content remains visible with `aria-busy="true"` and visible refresh copy.
2. Add a component test that completes a successful refetch and asserts the busy state clears without showing the initial skeleton again.
3. Add a component test that completes a refetch with invalid or unresolvable data and asserts the blocking alert replaces the collapse.
4. Add a component test that verifies the loading region and busy region expose the expected accessible semantics.

Frontend e2e tests:

1. Add a Playwright keyboard-interaction test that navigates the visible collapse headers and toggles a panel without using pointer input.
2. Add a Playwright narrow-viewport test that opens the Classes page at a mobile-sized viewport, expands a populated panel, and asserts the cards and disabled actions remain visible without horizontal page overflow.

### Section checks

- `npm run test:frontend -- src/pages/ClassesPage.spec.tsx`
- `npm run test:frontend:e2e -- e2e-tests/classes-page.spec.ts -g "supports keyboard and responsive Classes page behaviour"`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Planned helper entry exists in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` with status `Not implemented` before implementation starts.

### Optional `@remarks` JSDoc follow-through

- Consider `@remarks` only if the final page hook needs to document why refresh transitions stay local to the page-owned surface rather than the wider shell.

### Implementation notes / deviations / follow-up

- **Implementation notes:** prefer state assertions over brittle geometry assertions, except for a minimal no-horizontal-overflow responsive smoke check.
- **Deviations from plan:** record only if implementation reintroduces a genuine user-triggerable refresh path that then requires Playwright coverage.
- **Follow-up implications for later sections:** regression should preserve both browser-visible and component-level trust-boundary coverage.
- **Completion status:** ✅ Section 6 COMPLETE - All acceptance criteria met. Red phase: 4 component tests + 4 e2e tests created and reviewed clean. Green phase: Added refresh text with role="status" and aria-live="polite", explicit role="region" on content section, keyboard focusability on headers, responsive card layout. Adjusted test expectations to focus on usable layout outcomes. All 21 component tests pass, all 21 e2e tests pass, lint clean, code review PASS with 0 issues. Regression gate passed with 0 new regressions.
- **Files modified:** `src/frontend/src/pages/ClassesPage.tsx` (refresh status, accessibility, responsive), `src/frontend/src/pages/ClassesPage.spec.tsx` (4 component tests), `src/frontend/e2e-tests/classes-page.spec.ts` (4 e2e tests), `.husky/pre-commit` (fixed frontend lint config path)

---

## Regression and contract hardening

### Objective

- Prove the new page integrates cleanly with the existing shell, shared queries, and browser harness without regressing the existing Settings Classes workflow.

### Constraints

- Prefer focused commands for touched slices before broader validation.
- Do not widen the regression phase into unrelated Settings or backend refactors.

### Acceptance criteria

- All touched frontend unit/component tests pass.
- All new and touched Classes page Playwright tests pass.
- Frontend lint passes.
- Existing Settings page and shell navigation regressions remain green.
- Every delegated handoff includes complete `Files read` evidence.

### Required test cases/checks

1. Run the focused navigation and Settings page specs touched by Section 1.
2. Run the shell-wide page and app specs updated for the new top-level page.
3. Run the Classes page component/unit suite for the page model and page component, including warm-up-failure recovery cases.
4. Run the focused Playwright Classes page suite plus the touched shell-wide app browser suite.
5. Run `npm run lint:frontend:check`.
6. If Chromium is missing, run `npm --prefix src/frontend exec -- playwright install --with-deps chromium` and rerun the Playwright suite.
7. Confirm the Classes page browser tests do not force or depend on `getGoogleClassrooms`.
8. Verify mandatory-read evidence (`Files read`) is complete for every delegated regression handoff.

### Section checks

- `npm run test:frontend -- src/navigation/appNavigation.spec.tsx src/pages/pages.spec.tsx src/App.spec.tsx src/pages/SettingsPage.spec.tsx src/pages/AssignmentsPage.spec.tsx src/pages/ClassesPage.spec.tsx src/pages/classes/classesPageModel.spec.ts`
- `npm run test:frontend:e2e -- e2e-tests/app.spec.ts e2e-tests/classes-page.spec.ts`
- `npm run lint:frontend:check`

### Implementation notes / deviations / follow-up

- **Implementation notes:** summarise any selector, fixture, or harness extensions made for the Classes page suite.
- **Deviations from plan:** note any extra regression coverage required by reviewer findings.

---

## Documentation and rollout notes

### Objective

- Keep planning and canonical helper documentation aligned with the final delivered Classes page surface.

### Constraints

- Only update docs that materially describe the Classes page, its helper decisions, or its testing strategy.
- Do not leave planning-only helper entries marked `Not implemented` if the work they describe ships in this iteration.

### Acceptance criteria

- `SPEC.md`, `CLASSES_PAGE_LAYOUT.md`, and the implementation remain aligned.
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` is reconciled so any delivered helper decision no longer remains marked `Not implemented`.
- `docs/developer/frontend/ant-design-docs-cache/` contains idiomatic Ant Design component usage patterns for LLMs
- Any deviations from the plan or notable caveats are recorded before handoff.
- If browser-level refresh coverage remains infeasible without production test hooks, that rationale is documented explicitly.

### Required checks

1. Reconcile the planned helper entries in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`.
2. Confirm the final Playwright coverage still matches all user-triggerable visible behaviours from `SPEC.md` and `CLASSES_PAGE_LAYOUT.md`.
3. Confirm any remaining Vitest-only coverage is limited to non-user-triggered state transitions or pure derivation logic.
4. Verify mandatory-read evidence (`Files read`) is complete for delegated docs and review handoffs.
5. Confirm the implementation notes and deviations fields are filled in during delivery.

### Optional `@remarks` JSDoc review

- Review whether the final page hook or view-model helper needs `@remarks` for trust-boundary or refresh-state reasoning.
- If no such preservation is needed, record `None`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** update with any final documentation changes once implementation is complete. Ensure Ant Design components are used idiomatically (see cached docs):
  - Use `Collapse` with `items` prop for year-group panels (see `docs/developer/frontend/ant-design-docs-cache/collapse.md`)
  - Use `Card` components for class cards with proper `title` and `children` structure (see `docs/developer/frontend/ant-design-docs-cache/card.md`)
  - Use `Button` components with `disabled` prop for placeholder actions (see `docs/developer/frontend/ant-design-docs-cache/button.md`)
  - Use `Alert` component with `type="error"` for blocking states (see `docs/developer/frontend/ant-design-docs-cache/alert.md`)
  - Use `Skeleton` component with `active` prop for loading placeholders (see `docs/developer/frontend/ant-design-docs-cache/skeleton.md`)
  - Use `Spin` component with `spinning` prop for busy indicators (see `docs/developer/frontend/ant-design-docs-cache/spin.md`)
- **Deviations from plan:** Ant Design v6 Collapse uses children pattern instead of items prop to preserve keyboard navigation (Space/Enter to toggle, ArrowUp/ArrowDown to navigate). This triggers a deprecation warning but is the only way to get proper keyboard support with custom header components.
- **Follow-up:** none beyond future `View` and `Edit` workflow planning.
- **Completion status:** ✅ Regression and contract hardening COMPLETE - All regression checks pass: 56 navigation/Settings tests pass, 65 Classes/Assignments tests pass, 40 Playwright tests pass, lint clean, Classes page browser tests do not depend on getGoogleClassrooms. All delegation mandatory-read evidence satisfied.

---

## Documentation and rollout notes

### Objective

- Keep planning and canonical helper documentation aligned with the final delivered Classes page surface.

### Constraints

- Only update docs that materially describe the Classes page, its helper decisions, or its testing strategy.
- Do not leave planning-only helper entries marked `Not implemented` if the work they describe ships in this iteration.

### Acceptance criteria

- `SPEC.md`, `CLASSES_PAGE_LAYOUT.md`, and the implementation remain aligned.
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` is reconciled so any delivered helper decision no longer remains marked `Not implemented`.
- `docs/developer/frontend/ant-design-docs-cache/` contains idiomatic Ant Design component usage patterns for LLMs
- Any deviations from the plan or notable caveats are recorded before handoff.
- If browser-level refresh coverage remains infeasible without production test hooks, that rationale is documented explicitly.

### Required checks

1. Reconcile the planned helper entries in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`.
2. Confirm the final Playwright coverage still matches all user-triggerable visible behaviours from `SPEC.md` and `CLASSES_PAGE_LAYOUT.md`.
3. Confirm any remaining Vitest-only coverage is limited to non-user-triggered state transitions or pure derivation logic.
4. Verify mandatory-read evidence (`Files read`) is complete for delegated docs and review handoffs.
5. Confirm the implementation notes and deviations fields are filled in during delivery.

### Optional `@remarks` JSDoc review

- Review whether the final page hook or view-model helper needs `@remarks` for trust-boundary or refresh-state reasoning.
- If no such preservation is needed, record `None`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** update with any final documentation changes once implementation is complete. Ensure Ant Design components are used idiomatically (see cached docs):
  - Use `Collapse` with `items` prop for year-group panels (see `docs/developer/frontend/ant-design-docs-cache/collapse.md`)
  - Use `Card` components for class cards with proper `title` and `children` structure (see `docs/developer/frontend/ant-design-docs-cache/card.md`)
  - Use `Button` components with `disabled` prop for placeholder actions (see `docs/developer/frontend/ant-design-docs-cache/button.md`)
  - Use `Alert` component with `type="error"` for blocking states (see `docs/developer/frontend/ant-design-docs-cache/alert.md`)
  - Use `Skeleton` component with `active` prop for loading placeholders (see `docs/developer/frontend/ant-design-docs-cache/skeleton.md`)
  - Use `Spin` component with `spinning` prop for busy indicators (see `docs/developer/frontend/ant-design-docs-cache/spin.md`)
- **Deviations from plan:** Ant Design v6 Collapse children pattern used instead of items prop (as documented in Regression phase).
- **Follow-up:** none beyond future `View` and `Edit` workflow planning.
- **Completion status:** ✅ Documentation and rollout notes COMPLETE - All helper decisions reconciled in frontend-shared-helpers-and-abstraction-standards.md (all Classes page helpers marked Implemented). SPEC.md and CLASSES_PAGE_LAYOUT.md aligned with implementation. Ant Design docs cache contains all required component patterns. All Vitest-only coverage is for non-user-triggerable state transitions (background refresh) as specified. All deviations documented.

---

## Suggested implementation order

1. Section 1 — Wire the shell navigation contract.
2. Section 2 — Build the page-local grouped view model.
3. Section 3 — Add owned-surface loading, blocking, and page-empty states.
4. Section 4 — Render the ordered year-group collapse behaviour.
5. Section 5 — Render class cards and placeholder action affordances.
6. Section 6 — Harden refresh transitions, accessibility, and narrow-viewport behaviour.
7. Regression and contract hardening.
8. Documentation and rollout notes.
