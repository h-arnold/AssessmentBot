# Feature Delivery Plan (TDD-First) — Sticky Table Scroll and Frozen Student-Name Columns

## Read-First Context

1. Read `@SPEC.md` (repository root) — the reviewed, clean core spec for GitHub issue h-arnold/AssessmentBot#344. It is the source of truth for product behaviour, the DOM contract, and scope boundaries.
2. Read `@STUDENT_TABLES_STICKY_SCROLL_LAYOUT.md` (repository root) — the reviewed, clean layout spec for the three affected surfaces.
3. Treat those documents as settled. This plan sequences delivery and testing only; it does not redefine behaviour, contracts, or layout rules.
4. No backend, transport, persistence, validation, or data-shape change exists in this feature. There are therefore no `docs/developer/data-shapes/` entries to plan and no per-section data-shape planning blocks in this plan; if implementation ever proposes one, stop and return to the spec first.

## Scope and assumptions

### Scope

- Frontend only, on branch `feat/frozen-columns-and-working-horizontal-scrolling`.
- Shared student-name column builder simplification: `src/frontend/src/features/shared/studentNameTableColumns.tsx` always emits `fixed: 'start'` Forename/Surname columns; the `sticky` option, its JSDoc, and the `StudentNameTableColumnsOptions` type are removed; both call sites updated.
- `sticky` prop added to the Ant Design `Table` in `src/frontend/src/features/classPage/StudentAveragesTableCard.tsx` and `src/frontend/src/features/taskHeatmap/TaskHeatmapTable.tsx` (covers the embedded Class-page heatmap via `TaskHeatmapPage` and the standalone Heatmaps page via `HeatmapBuilderSurface` — one code path).
- Vitest re-scoping of locators that become ambiguous under the split render, plus new sticky-structure assertions.
- Playwright migration of existing table-locator E2E specs and helpers, plus a new E2E spec proving sticky-bar geometry, header pinning, fixed-column stability, and absence of document-level horizontal overflow on all three surfaces.
- Documentation updates listed in `SPEC.md` "Documentation and rollout notes".

### Out of scope

- Any backend, API, persistence, validation schema, or data-shape change.
- `scroll.y`, fixed-height table regions, internal vertical scrolling, dynamic row-count adaptation.
- Custom scrollbar styling, theme changes, new wrapper components, hooks, or CSS modules.
- Tables that do not display student names (Classes, Assignments, Settings, Reference Data).
- Document-level horizontal overflow on any page; the §7.1 fluid-width exception stays heatmap-only.

### Assumptions

1. antd is pinned at `6.6.7` (`@rc-component/table` 1.11.1), which provides the split sticky render described in `SPEC.md` §"Rendered DOM structure". The red-phase Vitest assertions confirm the structure against the installed package at implementation time; any mismatch stops the section and returns to the spec.
2. The application header is not fixed, so sticky offsets stay at Ant Design defaults (`0`).
3. The document remains the only scroll container: no ancestor of either table introduces an overflow or clipping container. No change is planned to `index.css` or shell components, so this invariant holds by inspection plus the E2E no-document-overflow assertions.
4. Test fixture basis: Vitest component specs use their existing committed local literals, with class metadata selected from the committed canonical corpus via `src/frontend/src/test/abClass/abClassMetadataFixtures.ts` (`small`/`medium`/`large-representative` raw views plus `cloneMetadata`). Playwright specs reuse the committed `createHeatmapScenario` fixture (10 students, 3 tasks), whose class-metadata snapshot selects from the committed `small` canonical corpus via `e2e-tests/helpers/class-metadata-fixtures.ts`. No synthetic-generator change, no new canonical profile or view, and no generator extension are planned; invalid/boundary fixtures stay local and none are needed for this geometry feature.
5. Headless Playwright Chromium hides native scrollbars, so Ant Design's cached scrollbar measurement is `0`; the hidden-state assertions scroll the scroll region's bottom edge to or above the viewport bottom rather than asserting a one-scrollbar-height boundary.

## Global constraints and quality gates

### Engineering constraints

- Express the behaviour only through Ant Design `Table` props (`sticky`, existing `scroll={{ x: 'max-content' }}`, column `fixed: 'start'`). No new wrapper, hook, CSS module, or bespoke scrollbar.
- Keep changes minimal, localised, and consistent with existing patterns; British English in comments, docs, and tests.
- Fail loudly; no catch-and-ignore. Frontend files over 550 lines in scope for the change are decomposed in the same change; this plan additionally keeps any file at or above the 500-line mark from growing (see the LOC notes per section).
- Never import `features/classPage/**` from `features/taskHeatmap/**`; the shared column module is the only permitted cross-feature owner.

### TDD workflow (mandatory per section)

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.
5. **Docs sync**: when the section changes documented behaviour, run the docs pass before the section regression gate and record the outcome.
6. **Plan compaction**: compact the completed section per the action-plan implementer workflow, retaining contracts, decisions, constraints, and follow-ups relevant to later sections.

### Delegation mandatory reads

Every delegated handoff in a section lists its mandatory docs as `@`-prefixed paths in that section. The `at-mention-inject` plugin attaches file contents automatically; never paste file contents into a prompt body. Vitest work delegates to `Testing Specialist`, Playwright work to `Playwright`, component changes to `Implementation`, doc updates to `Docs`, and the resulting diffs to `Code Reviewer`. No `Data Shapes Agent` pass is required (no shape changes).

### Validation commands hierarchy

- Frontend lint: `npm run lint:frontend` (fix) / `npm run lint:frontend:check` (verify)
- Frontend unit/component tests: `npm run test:frontend -- <target>`
- Frontend coverage: `npm run test:frontend:coverage`
- Frontend E2E: `npm run test:frontend:e2e -- <target>`
- Type gate: `npm run typecheck:all`
- Full gate: `npm run run-all-checks`

---

## Section 1 — Planned-only canonical-doc entries (`Not implemented`) before any implementation

### Objective

Land the planned-only entries that must exist in the canonical docs before any implementation starts:

1. In `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` — a §3.6 note that both tables always receive fixed name columns and that the builder option is being removed, and a one-line §9 register entry recording the same decision — each marked `Not implemented` (required by `SPEC.md`).
2. In `docs/developer/frontend/frontend-playwright-e2e.md` §"Shared Helpers and Imports" — a planned-only entry for the shared sticky-table E2E locator helper anticipated in Section 5's shared-helper plan (decision `new`, audit-conditional `keep local` fallback), marked `Not implemented`.

This section is the gate that must complete before Sections 2–3 start implementing.

### Constraints

- Entries are planned-only and marked `Not implemented`; they describe the target decision, not delivered code.
- While editing §3.6 of the shared-helpers doc, scope the existing purity bullet explicitly to `utils/splitStudentName.ts`. This is an unconditional accuracy correction (the column-builder module is not pure today — it imports Ant Design `Typography` and JSX), so it carries no `Not implemented` marker; the marker applies only to the always-fixed/option-removal decision entries, the §9 register line, and the playwright-doc helper entry.
- No code changes in this section.

### Delegation mandatory reads

- Docs agent: `@SPEC.md`, `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`, `@docs/developer/frontend/frontend-playwright-e2e.md`

### Acceptance criteria

- §3.6 of the shared-helpers doc records the always-fixed decision and the option removal with status `Not implemented`, and the purity bullet is scoped to `utils/splitStudentName.ts`.
- The §9 register gains one line recording the same decision with status `Not implemented`.
- §"Shared Helpers and Imports" of the playwright doc gains a planned-only entry for the Section 5 sticky-table locator helper with status `Not implemented`.
- `npm run lint:check` is unaffected (docs-only change); no tests are added, so the red-first rule is satisfied vacuously — verification is the doc diff itself.

### Required test cases (Red first)

- None (documentation-only section).

### Section checks

- All three planned-only entries present with the `Not implemented` marker: the §3.6 note and the §9 register line in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`, and the sticky-table locator helper entry in `docs/developer/frontend/frontend-playwright-e2e.md` §"Shared Helpers and Imports".
- No production or test code touched.

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record the exact entry wording chosen.
- **Deviations from plan:** none expected.
- **Follow-up implications for later sections:** Sections 2 and 7 remove the `Not implemented` markers as the decision is delivered.

---

## Section 2 — Shared column builder always emits fixed name columns (Vitest red-first)

### Objective

Simplify `buildStudentNameColumns` in `src/frontend/src/features/shared/studentNameTableColumns.tsx` so Forename and Surname always carry `fixed: 'start'`; remove the `StudentNameTableColumnsOptions` type, the options parameter, and the `sticky`-option JSDoc; update both call sites to drop the option argument.

### Constraints

- Owning module stays at `src/frontend/src/features/shared/studentNameTableColumns.tsx` (decision: keep the existing owner, remove the option — do not extract anything new).
- Column keys, titles, widths (`APP_COL_WIDTH_FORENAME` 104px, `APP_COL_WIDTH_SURNAME` 96px), sorters, and renderers are unchanged.
- No `defaultSortOrder` is introduced.
- LOC: `studentNameTableColumns.tsx` 75 → ~62 lines; `studentNameTableColumns.spec.tsx` 105 → ~120 lines (builder-level assertions only — the split-render re-scoping of this spec is Section 3's work, because `.ant-table-body` does not exist until `sticky` is enabled); `studentAveragesTableColumns.tsx` 193 → ~190 lines. All far below 500 — no file separation needed.

### Delegation mandatory reads

- Testing Specialist: `@SPEC.md`, `@src/frontend/src/features/shared/studentNameTableColumns.tsx`, `@src/frontend/src/features/shared/studentNameTableColumns.spec.tsx`, `@src/frontend/src/features/classPage/studentAveragesTableColumns.tsx`, `@src/frontend/src/features/taskHeatmap/TaskHeatmapTable.tsx`, `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`, `@docs/developer/frontend/frontend-testing.md`
- Implementation: `@SPEC.md`, `@src/frontend/src/features/shared/studentNameTableColumns.tsx`, `@src/frontend/src/features/classPage/studentAveragesTableColumns.tsx`, `@src/frontend/src/features/taskHeatmap/TaskHeatmapTable.tsx`, `@docs/developer/frontend/frontend-architecture.md`
- Code Reviewer: `@SPEC.md`, `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`, plus the touched files

### Shared helper plan

1. Helper: `buildStudentNameColumns<Row>` — **Decision: `extend`** (simplify the existing owner in place — remove the option rather than add a new helper).
   - Owning module/path: `src/frontend/src/features/shared/studentNameTableColumns.tsx`
   - Call-site rationale: both current callers (`studentAveragesTableColumns.tsx`, `TaskHeatmapTable.tsx`) require fixed columns per `SPEC.md` decision 5, so the option has no non-fixed consumer and is removed with its type and JSDoc.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §3.6 and §9 (planned-only `Not implemented` entries landed in Section 1).
   - Planned doc status: `Not implemented` until Section 7 reconciles it.

### Acceptance criteria

- `buildStudentNameColumns<Row>()` takes no options and returns Forename and Surname columns that both carry `fixed: 'start'`.
- `StudentNameTableColumnsOptions` is no longer exported; both call sites compile without an options argument.
- No behavioural change to widths, sorters, renderers, or column order.

### Required test cases (Red first)

Frontend tests (Vitest, in `studentNameTableColumns.spec.tsx`):

1. Red: builder output for a row type has `fixed: 'start'` on both the Forename and Surname column definitions.
2. The removal of the `StudentNameTableColumnsOptions` export and of the options parameter is inherently type-level: a runtime `in` probe cannot fail (type-only exports are erased), so this criterion is verified by the `npm run typecheck:all` gate — any stale named import of the removed type fails the build. Its red obligation is carried by case 1, which fails at runtime before the change (`buildStudentNameColumns()` called without arguments dereferences `options.sticky`).
3. Existing sorter/renderer and single-table structural assertions for both row types keep passing unchanged (the class-side half is rendered without `sticky` or `scroll`, so it stays a single table; the heatmap half is likewise still a single table at this point — its `.ant-table-body` re-scoping belongs to Section 3, once `sticky` creates that element).

Canonical-fixture note: these component specs use existing committed local row literals; no canonical profile selection changes and no synthetic-generator change is planned. Invalid/boundary fixtures stay local; none are needed here.

### Section checks

- `npm run test:frontend -- src/frontend/src/features/shared/studentNameTableColumns.spec.tsx` green.
- `npm run test:frontend -- src/frontend/src/features/classPage/studentAveragesTableColumns` and the `TaskHeatmapTable` suites that consume the builder still green (call sites updated).
- `npm run lint:frontend:check` green and `npm run typecheck:all` green (frontend projects included).
- Section 1 planned entries still present with `Not implemented` (this section must not remove them; Section 7 does).

### Optional `@remarks` JSDoc follow-through

- Update the module JSDoc in `studentNameTableColumns.tsx` to state that both columns are always fixed start columns and that the former option was removed per `SPEC.md` decision 5.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record final LOC and any call-site touch-ups.
- **Deviations from plan:** none expected.
- **Follow-up implications for later sections:** Section 3 adds `sticky` to the tables; with fixed columns now unconditional, the split render in Section 3 exercises them immediately.

---

## Section 3 — `sticky` on both student tables plus Vitest re-scoping of the named suites

### Objective

Add the `sticky` prop to the `Table` in `StudentAveragesTableCard.tsx` and `TaskHeatmapTable.tsx`, and re-scope the Vitest locators that the split render makes ambiguous: `TaskHeatmapPage.spec.tsx`, `HeatmapBuilderSurface.spec.tsx`, `ClassPageHeatmapView.spec.tsx`, and the heatmap half of `studentNameTableColumns.spec.tsx`; add the sticky-header-holder assertion for the Student Averages table.

**Recorded deviation from `SPEC.md`:** the spec's "Testing expectations" says to add the Student Averages sticky-header-holder assertion to `StudentAveragesTableCard.spec.tsx`. This plan deliberately supersedes that pointer: the file is exactly 500 lines (verified with `wc -l`), and this plan's own rule keeps files at or above 500 lines from growing. The assertion lands in a new co-located `StudentAveragesTableCard.sticky.spec.tsx` instead. Record the same deviation in this section's deviations field during implementation.

### Constraints

- `sticky` with no offset object — offsets stay at default `0`. Do not add `scroll.y`.
- Both tables already set `scroll={{ x: 'max-content' }}`; unchanged.
- The Task Heatmap table keeps `aria-label="Task Heatmap"`; after the split it lands on both header and body tables — accepted, do not "fix".
- Locator convention: row and cell assertions base on `.ant-table-body`; column-header assertions base on `.ant-table-header.ant-table-sticky-holder`; never resolve a sticky table by accessible name. Wrapper/Card scoping is valid only for roles whose occurrence count is unchanged (e.g. named column headers); `table` role count doubles and `row` occurrences are redistributed with total unchanged.
- Student Averages remains unnamed in both halves: locate its wrapper via the surrounding Card, then the structural bases.
- The other `TaskHeatmapTable.*.spec.tsx` suites use unscoped column-header and button locators that keep resolving (header cells stay in the accessibility tree) — do not re-scope them unless the DOM changes beyond this plan.
- LOC: `StudentAveragesTableCard.tsx` 280 → ~281; `TaskHeatmapTable.tsx` 230 → ~231; `taskHeatmapTableColumns.tsx` 464 → unchanged (the builder call site lives in `TaskHeatmapTable.tsx`). Spec deltas: `TaskHeatmapPage.spec.tsx` 285, `HeatmapBuilderSurface.spec.tsx` 438, `ClassPageHeatmapView.spec.tsx` 371 are re-scoped; `TaskHeatmapTable.spec.tsx` 478 gains only the new holder/aria-label assertions (it has no name-based table locators to re-scope), so it is projected close to the 500-line no-growth threshold — if it crosses 500, split its sticky-structure assertions into a new co-located `TaskHeatmapTable.sticky.spec.tsx` in the same change. **`StudentAveragesTableCard.spec.tsx` is at exactly 500 lines today**: the new sticky assertions must NOT be added to it. Plan file separation: create a new co-located `StudentAveragesTableCard.sticky.spec.tsx` (~80 lines) owning the sticky-holder/split-structure assertions for the Student Averages table; the existing 500-line spec is touched only if a locator inside it breaks.

### Delegation mandatory reads

- Testing Specialist: `@SPEC.md`, `@STUDENT_TABLES_STICKY_SCROLL_LAYOUT.md`, `@src/frontend/src/features/classPage/StudentAveragesTableCard.tsx`, `@src/frontend/src/features/classPage/StudentAveragesTableCard.spec.tsx`, `@src/frontend/src/features/taskHeatmap/TaskHeatmapTable.tsx`, `@src/frontend/src/features/taskHeatmap/TaskHeatmapPage.spec.tsx`, `@src/frontend/src/features/taskHeatmap/HeatmapBuilderSurface.spec.tsx`, `@src/frontend/src/features/classPage/ClassPageHeatmapView.spec.tsx`, `@src/frontend/src/features/shared/studentNameTableColumns.spec.tsx`, `@docs/developer/frontend/frontend-testing.md`, `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- Implementation: `@SPEC.md`, `@src/frontend/src/features/classPage/StudentAveragesTableCard.tsx`, `@src/frontend/src/features/taskHeatmap/TaskHeatmapTable.tsx`, `@docs/developer/frontend/frontend-architecture.md`
- Code Reviewer: `@SPEC.md`, `@STUDENT_TABLES_STICKY_SCROLL_LAYOUT.md`, all touched files

### Shared helper plan

- No new helpers. The split-render locator convention is a testing convention, not a shared production helper; its doc target is `frontend-testing.md` / `frontend-playwright-e2e.md` (landed in Section 7). Planned doc status: `Not implemented` until then.

### Acceptance criteria

- Both table components render with `sticky` and no `scroll.y`.
- In the happy-dom test environment, each sticky table renders `.ant-table-header.ant-table-sticky-holder` and `.ant-table-body` (no measured overflow there, so the sticky bar does not render — bar behaviour is E2E-only, Section 6).
- The full accessible-name family the spec enumerates — `getByRole('table', { name: 'Task Heatmap' })`, `getByLabelText`, `queryByLabelText`, `queryByRole`, and any `findBy*` variants — is gone from the four named suites (the fourth being the heatmap half of `studentNameTableColumns.spec.tsx`; its class-side half stays single-table and keeps its name-based locator), including the negative `queryBy*` probes, which would keep passing but violate the never-resolve-by-name convention — all replaced by wrapper-/holder-/body-scoped locators.
- `TaskHeatmapPage.spec.tsx`, `HeatmapBuilderSurface.spec.tsx`, `ClassPageHeatmapView.spec.tsx`, `studentNameTableColumns.spec.tsx`, the `TaskHeatmapTable.*` suites, and the `studentAveragesTableColumns.*` suites are all green.

### Required test cases (Red first)

Frontend tests (Vitest):

1. Red: `StudentAveragesTableCard.sticky.spec.tsx` (new file) asserts the Student Averages table renders `.ant-table-header.ant-table-sticky-holder` and `.ant-table-body` when `sticky` is set — fails before the prop is added.
2. Red: `TaskHeatmapTable.spec.tsx` asserts the holder structure and the `aria-label` on both header and body tables (documenting the accepted double-name posture), and the heatmap half of `studentNameTableColumns.spec.tsx` re-scopes its structural `col` and row probes to the body table under `.ant-table-body` so the header table's colgroup is not measured by mistake (the class-side half stays a single table, rendered without `sticky`/`scroll`) — all of these fail before `sticky`, since `.ant-table-body` does not exist yet.
3. Red: in `TaskHeatmapPage.spec.tsx`, `HeatmapBuilderSurface.spec.tsx`, `ClassPageHeatmapView.spec.tsx`, replace name-resolved table locators with structural bases; the red is carried by the presence/structure assertions, which fail against the pre-change single-table render where the holder is absent (re-scoped absence probes pass vacuously pre-change by nature), then pass after Green.
4. Green: add `sticky` to both `Table` components.
5. Refactor: confirm the untouched `TaskHeatmapTable.*` suites (preview, merged, baseline, status, zeroWeight, excludedColumnMarking) still pass with unscoped locators.

Canonical-fixture note: all suites here use existing committed local literals and the `small`/`medium`/`large-representative` canonical views via `abClassMetadataFixtures.ts` where metadata is needed; no generator extension is planned, and no existing test migrates to a different canonical profile (opportunistic migration: none required — the touched suites already select supported canonical views).

### Section checks

- `npm run test:frontend -- src/frontend/src/features/taskHeatmap src/frontend/src/features/classPage src/frontend/src/features/shared` green.
- New `StudentAveragesTableCard.sticky.spec.tsx` exists and passes; `StudentAveragesTableCard.spec.tsx` remains at ≤500 lines.
- `npm run lint:frontend:check` green and `npm run typecheck:all` green (frontend projects included).

### Optional `@remarks` JSDoc follow-through

- `TaskHeatmapTable.tsx` and `StudentAveragesTableCard.tsx` JSDoc should note the split render and the accepted `aria-label` duplication for the heatmap.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record final LOC per touched file and the antd-version confirmation (assumption 1).
- **Deviations from plan:** the sticky-header-holder assertion for Student Averages lands in the new `StudentAveragesTableCard.sticky.spec.tsx`, not in `StudentAveragesTableCard.spec.tsx` as `SPEC.md` names it (500-line gate — recorded in this section's objective); plus any suite that needed re-scoping beyond the four named ones.
- **Follow-up implications for later sections:** Sections 4–6 inherit the locator convention; Section 7 documents it.

---

## Section 4 — One-off Vitest locator audit across all co-located table specs

### Objective

Run a one-off audit spanning the Vitest layer for any remaining co-located spec that probes student tables, and re-scope only locators that are actually ambiguous under the split render.

### Constraints

- Audit includes unscoped content-filtered row locators such as `getByRole('row').filter({ hasText: ... })`: their match set is unchanged by the split, so they are audited for attribution and robustness only — confirming the content filter still selects the intended rows — not because the split altered matching.
- Re-scope only what breaks or becomes ambiguous; do not churn working locators.
- Candidate surface: the full list of `*.spec.tsx` under `src/frontend/src/features/classPage/`, `src/frontend/src/features/taskHeatmap/`, and `src/frontend/src/features/shared/`, with priority on the suites named in `SPEC.md` "Testing expectations".

### Delegation mandatory reads

- Testing Specialist: `@SPEC.md`, `@docs/developer/frontend/frontend-testing.md`, `@src/frontend/src/features/classPage`, `@src/frontend/src/features/taskHeatmap`, `@src/frontend/src/features/shared`. Note: the three `@`-prefixed directory tokens deliver directory listings only, not file contents — the agent must open each candidate spec file itself.
- Code Reviewer (conditional — only if the audit re-scopes locators): `@SPEC.md` plus the touched spec files.

### Acceptance criteria

- Every Vitest spec in the three feature folders is either green unchanged or re-scoped with a recorded reason.
- A short audit list (file → locator → verdict) is recorded in this section's implementation notes.

### Required test cases (Red first)

- For each ambiguous locator found: red assertion demonstrating ambiguity (e.g. strict-mode violation from two matching tables), then re-scope, then green.

Canonical-fixture note: no new fixtures; the audit reuses the suites' existing canonical/local data. No generator change.

### Section checks

- `npm run test:frontend -- src/frontend/src` (full frontend Vitest run) green.
- `npm run test:frontend:coverage` still meets the 85% minimum.

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** the audit list goes here.
- **Deviations from plan:** record any suite whose DOM changed beyond the planned split render.
- **Follow-up implications for later sections:** the audit's locator verdicts seed the E2E migration in Section 5.

---

## Section 5 — Playwright migration of existing table-locator E2E specs and helpers

### Objective

Migrate every E2E spec and helper on the three surfaces that resolves a student table by accessible name, scopes headers/rows/cells through a `table` role locator, or probes `.ant-table-content`, so the suite survives the split render.

### Constraints

- Specs to migrate (from `SPEC.md`): `heatmaps.spec.ts`, `heatmaps-layout.spec.ts`, `class-page-baseline-mode.spec.ts`, `task-heatmap.spec.ts`, `task-heatmap-summary.spec.ts`, `task-heatmap-re-run-assessment.spec.ts`, `task-preview-card.spec.ts`, `task-preview-source-link.spec.ts`, `task-preview-source-link.visual.spec.ts`, `assessment-error-previews.spec.ts`, `assessment-error-merged-previews.spec.ts`, `legacy-assignment-results.spec.ts`, `navigation-screenshots.spec.ts`, `metric-range-filter.spec.ts`, `post-analysis-metadata.feedback.spec.ts`, `post-analysis-metadata.persistence.spec.ts`, and helpers `task-preview-source-link-helpers.ts`, `assessment-error-preview-journeys.ts`.
- `heatmaps-layout.spec.ts` migrates its `.ant-table-content` probe to `.ant-table-body`, including its card-ancestor XPath probe (class-contains `ant-card`), which must start from a wrapper-scoped base rather than the ambiguous table name.
- In `task-heatmap.spec.ts` and `metric-range-filter.spec.ts`, `getByRole('table').last()` still resolves to the Student Averages body table; both migrate to wrapper-scoped locators for robustness anyway. `metric-range-filter.spec.ts`'s nested `columnheader` locator must move to the header table base.
- `task-preview-source-link-helpers.ts`'s `revealMetricCellForPointer` keeps its window-scroll reveal as a no-op (the document does not overflow — do not turn it into document-level horizontal panning) and its stale docblock claim is corrected in the same change.
- `class-page-baseline-mode.spec.ts`'s unscoped `getByRole('row').filter({ hasText: ... })` keeps its match set; audit for attribution/robustness only.
- LOC: current lines — `assessment-error-merged-previews.spec.ts` 497, `class-page-baseline-mode.spec.ts` 474, `task-heatmap.spec.ts` 458, `task-heatmap-summary.spec.ts` 416, `task-preview-source-link.visual.spec.ts` 411, `assessment-error-previews.spec.ts` 390, `legacy-assignment-results.spec.ts` 362, `post-analysis-metadata.feedback.spec.ts` 294, `task-heatmap-re-run-assessment.spec.ts` 280, `task-preview-source-link.spec.ts` 251, `task-preview-card.spec.ts` 191, `heatmaps.spec.ts` 168, `post-analysis-metadata.persistence.spec.ts` 124, `navigation-screenshots.spec.ts` 105, `heatmaps-layout.spec.ts` 102, `metric-range-filter.spec.ts` 64, `helpers/task-preview-source-link-helpers.ts` 443, `helpers/assessment-error-preview-journeys.ts` 257. Locator migrations must be line-count-neutral (replacement, not addition): any new shared locator helper goes into `e2e-tests/helpers/`, and `assessment-error-merged-previews.spec.ts` (497 lines) must not gain net lines — if a spec is projected to exceed 500 lines, split its table-touching cases into a co-located `*.sticky-locators.spec.ts` in the same change.

### Delegation mandatory reads

- Playwright: `@SPEC.md`, `@STUDENT_TABLES_STICKY_SCROLL_LAYOUT.md`, `@docs/developer/frontend/frontend-playwright-e2e.md`, `@src/frontend/e2e-tests/heatmaps-layout.spec.ts`, `@src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts`, `@src/frontend/e2e-tests/helpers/task-preview-source-link-helpers.ts`, `@src/frontend/e2e-tests/helpers/class-metadata-fixtures.ts`, `@src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`. Note: of the migration targets named in the constraints above, `heatmaps-layout.spec.ts` is attached here as the migration exemplar; the other 15 specs and `assessment-error-preview-journeys.ts` are work targets the Playwright agent must open itself — the `@`-prefixed tokens listed here deliver only the docs, helpers, and exemplar spec attached above.
- Code Reviewer: `@SPEC.md`, the touched specs/helpers

### Shared helper plan

1. Helper: shared sticky-table locator helper for the E2E layer — **Decision: `new`** (a single shared module owned under `src/frontend/e2e-tests/helpers/`, e.g. `sticky-table-locators.ts`, exposing wrapper-scoped bases for `.ant-table-header.ant-table-sticky-holder`, `.ant-table-body`, and `.ant-table-sticky-scroll`; fall back to `keep local` per-spec locators only if the audit shows fewer than three specs need the same base).
   - Owning module/path: `src/frontend/e2e-tests/helpers/` (new file, named per the existing helper conventions)
   - Call-site rationale: the 16-spec migration in this section must not duplicate the same structural bases per spec; Section 6's new sticky spec reuses them.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-playwright-e2e.md` §"Shared Helpers and Imports" (planned-only entry landed there by Section 1; catalogue the delivered helper there in Section 7).
   - Planned doc status: `Not implemented` (entry landed in Section 1; marker removed when the helper is delivered and catalogued in Section 7).

### Acceptance criteria

- No E2E file on the three surfaces resolves a sticky student table by accessible name (`getByRole('table', { name: 'Task Heatmap' })`, `getByLabelText`/`queryByLabelText` and their `queryByRole`/`findBy*` variants), scopes that table's headers/rows/cells through a `table` role locator, or probes its `.ant-table-content`. Out-of-scope tables (Classes, Assignments, modal tables) keep their existing table-scoped locators untouched.
- All listed specs pass against the sticky implementation (Sections 2–3 green first — this section runs after them).
- Helper docblocks match reality (`revealMetricCellForPointer` no-op claim corrected).

### Required test cases (Red first)

- Red: each migrated locator is first shown to fail/strict-mode-violate against the sticky build (run the spec before re-scoping), then re-scoped, then green.

Canonical-fixture note: all migrated specs keep the committed `createHeatmapScenario` fixture (10 students, 3 tasks; roster, score evidence, and assignment-definition partial are committed local literals; the class-metadata snapshot selects from the committed `small` canonical corpus via `class-metadata-fixtures.ts`). No synthetic-generator change and no new canonical profile/view; invalid/boundary fixtures stay local and none are needed.

### Section checks

- `npm run test:frontend:e2e -- <each touched spec>` green.
- `npm run lint:frontend:check` and the E2E project type-check (part of `npm run typecheck:all`) green.
- No spec file crosses 500 lines.

### Optional `@remarks` JSDoc follow-through

- Correct the stale docblock in `task-preview-source-link-helpers.ts` as part of the migration.

### Implementation notes / deviations / follow-up

- **Implementation notes:** per-spec migration summary.
- **Deviations from plan:** none expected.
- **Follow-up implications for later sections:** Section 6 adds new sticky-behaviour specs that reuse the migrated helper bases.

---

## Section 6 — New Playwright coverage for sticky scroll, pinned header, and fixed columns on all three surfaces

### Objective

Add a new E2E spec (`src/frontend/e2e-tests/sticky-table-scroll.spec.ts`) proving, on the Class page overview (Student Averages), the Class page assignment heatmap, and the standalone Heatmaps page: sticky-bar viewport-bottom geometry, drag/scroll synchronisation, Forename/Surname stability during horizontal panning, header pinning, operable sort/filter while pinned, bar hidden at the table's end, and no document-level horizontal overflow — at both a narrow and a wide viewport.

### Constraints

- Narrow viewport must be narrow in both dimensions: width below each surface's horizontal-overflow threshold measured at runtime (`scrollWidth > clientWidth` on `.ant-table-body`; the repo's 390px `NARROW_VIEWPORT` convention from `heatmaps-layout.spec.ts` pins the width only) and height chosen at runtime below the measured `.ant-table-body` height. Scroll each table until its scroll region crosses the viewport bottom edge (the document top offset includes page title, nav cards, and selection/summary regions).
- Headless Chromium hides native scrollbars, so Ant Design's cached scrollbar measurement is 0: assert the hidden state by scrolling the scroll region's bottom edge to or above the viewport bottom; do not assert a one-scrollbar-height boundary unless a visible-scrollbar browser project is added.
- Poll for the sticky bar's presence (`expect.poll` / `toBeVisible` with polling); never assert it synchronously or exactly at the visibility boundary.
- Wide-viewport cases: sticky bar absent on all three surfaces (none overflows at that width) and no document horizontal overflow.
- While the header is pinned, a sort or filter control must still open and apply on at least one surface.

### Delegation mandatory reads

- Playwright: `@SPEC.md`, `@STUDENT_TABLES_STICKY_SCROLL_LAYOUT.md`, `@docs/developer/frontend/frontend-playwright-e2e.md`, `@src/frontend/e2e-tests/heatmaps-layout.spec.ts` (NARROW_VIEWPORT convention), `@src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts`, `@src/frontend/e2e-tests/helpers/task-preview-source-link-helpers.ts` (migrated bases), `@src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`
- Code Reviewer: `@SPEC.md`, `@STUDENT_TABLES_STICKY_SCROLL_LAYOUT.md`, the new spec

### Acceptance criteria

- At the narrow viewport, on each of the three surfaces: the bar `.ant-table-sticky-scroll` appears while the scroll region crosses the viewport bottom, is pinned to the viewport bottom (bottom offset 0) and spans the scroll region's visible width; dragging/scrolling horizontally moves `.ant-table-body` and keeps the `.ant-table-sticky-scroll-bar` thumb synchronised; Forename/Surname header and body cells keep their viewport x-position while metric/task columns move; the header `.ant-table-header.ant-table-sticky-holder` pins at viewport top (top offset 0); on at least one surface a sort or filter control opens and applies while pinned; once the scroll region's bottom edge is at or above the viewport bottom the bar is hidden and the table's own horizontal scrollbar is reachable; `document.scrollingElement.scrollWidth <= clientWidth` throughout.
- At the wide viewport, on all three surfaces: no `.ant-table-sticky-scroll` is rendered and no document horizontal overflow exists.

### Required test cases (Red first)

- Red mechanic (this section runs after Sections 2–3 have already delivered `sticky`, so the red step cannot use a pre-change build): write the new spec, then temporarily remove the one-line `sticky` prop from both `StudentAveragesTableCard.tsx` and `TaskHeatmapTable.tsx`, run the new spec, and observe every sticky assertion fail — no holder, no bar, and the fixed-column assertions fail because their `.ant-table-body` locators no longer resolve (the fixed columns themselves still stick in the single-table render; only the table-level `sticky` prop is removed, not the columns); restore the prop and see the spec go green. Record the temporary-removal run in this section's implementation notes as the discharged red obligation. Do not commit the removal.

Canonical-fixture note: the new spec reuses the committed `createHeatmapScenario` fixture (10 students, 3 tasks) for all three surfaces; its roster, per-student score evidence, and assignment-definition partial are committed local literals accepted because the behaviour under test is table geometry, not scoring; its class-metadata snapshot selects from the committed `small` canonical corpus. The 10 rows exceed the runtime-chosen short viewport height once `.ant-table-body` is measured. No synthetic-generator change, no generator extension, no canonical profile migration; invalid/boundary fixtures stay local and none are needed.

### Section checks

- `npm run test:frontend:e2e -- sticky-table-scroll.spec.ts` green, plus a focused flakiness re-run (`playwright test --repeat-each` per `frontend-playwright-e2e.md`).
- `npm run lint:frontend:check` and E2E type-check green.

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record the runtime-measured viewport height/overflow values chosen per surface.
- **Deviations from plan:** any assertion that needed a visible-scrollbar browser project is recorded here and returned to the user, not silently added.
- **Follow-up implications for later sections:** none.

---

## Section 7 — Documentation updates and marker reconciliation

### Objective

Land the doc updates named in `SPEC.md` "Documentation and rollout notes" and reconcile the Section 1 planned entries against the delivered implementation.

### Constraints

- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`: §3.6 records that both tables always receive fixed name columns and that the builder option was removed (remove the `Not implemented` marker landed in Section 1); scope the purity bullet explicitly to `utils/splitStudentName.ts`; reconcile the one-line §9 register entry landed in Section 1 (remove its `Not implemented` marker).
- `docs/developer/frontend/frontend-loading-and-width-standards.md`: keep §7.1 unchanged for the heatmap fluid-width exception and add a sibling subsection recording the sticky bar and sticky header for both the heatmap and the Student Averages table, with each table keeping its own horizontal scrolling.
- `docs/developer/frontend/frontend-testing.md` (Vitest) and `docs/developer/frontend/frontend-playwright-e2e.md` (browser): add the sticky-table locator convention — a sticky table splits into `.ant-table-header.ant-table-sticky-holder` and `.ant-table-body` (+ `.ant-table-sticky-scroll` when overflowing); base row/cell queries on `.ant-table-body`, header queries on the holder, and never resolve the table by accessible name. If Section 5 delivered the shared E2E locator helper, catalogue it in `frontend-playwright-e2e.md` §"Shared Helpers and Imports" and remove its `Not implemented` marker.
- Docs-only changes must not alter behaviour; run the relevant lint/type gates.

### Delegation mandatory reads

- Docs: `@SPEC.md`, `@STUDENT_TABLES_STICKY_SCROLL_LAYOUT.md`, `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`, `@docs/developer/frontend/frontend-loading-and-width-standards.md`, `@docs/developer/frontend/frontend-testing.md`, `@docs/developer/frontend/frontend-playwright-e2e.md`, plus the delivered code files for accuracy

### Acceptance criteria

- All four docs match the implemented behaviour; no `Not implemented` marker remains for the §3.6/§9 entries delivered by this feature.
- The sticky locator convention appears in both testing docs.
- The width-standards doc has the new sibling subsection next to §7.1.
- If the shared E2E locator helper from Section 5 was delivered, it is catalogued in `frontend-playwright-e2e.md` §"Shared Helpers and Imports" with its marker removed; otherwise that entry is recorded as not needed.

### Required test cases (Red first)

- None (documentation-only section; red-first is vacuous — verification is the doc diff plus repo checks).

### Section checks

- `npm run lint:check` green for unrelated-code safety; markdown formatting of the edited docs is covered by the pre-commit prettier hook. `npm run typecheck:all` green.
- Canonical-doc reconciliation recorded: planned entries in §3.6/§9 now read `Implemented` (or the doc's equivalent delivered status).

### Optional `@remarks` JSDoc review

- Confirm the `@remarks` follow-throughs planned in Sections 2 and 3 are present in the code; record `None` if not needed.

### Implementation notes / deviations / follow-up

- **Implementation notes:** list every doc file updated.
- **Deviations from plan:** none expected.
- **Follow-up implications for later sections:** none — this is the final content section.

---

## Regression and contract hardening

### Objective

Prove the whole feature holds together and no unrelated surface regressed.

### Constraints

- Prefer focused runs first, then the full gate.
- No backend tests are affected (no backend change); do not run backend suites as a substitute for frontend gates.

### Acceptance criteria

- Full frontend Vitest suite green with coverage ≥ 85%.
- All touched E2E specs plus the new sticky spec green.
- Lint and type gates green; production build succeeds.

### Required test cases/checks

1. `npm run test:frontend -- src/frontend/src` (full Vitest run).
2. `npm run test:frontend:coverage`.
3. `npm run test:frontend:e2e --` for every spec touched in Sections 5–6 (list recorded in implementation notes).
4. `npm run lint:frontend:check`.
5. `npm run typecheck:all`.
6. `npm run build:production` (via `npm run run-all-checks` if a single command is preferred).

### Section checks

- All commands above green in one final pass.
- Contract hardening: confirm no file under `docs/developer/data-shapes/` changed and no backend file changed (`git status` evidence recorded); the aria-label duplication and split render remain the accepted posture.

### Implementation notes / deviations / follow-up

- **Implementation notes:** summarise the final gate results.
- **Deviations from plan:** record anything discovered during regression.

---

## Documentation and rollout notes

### Objective

Confirm the docs landed in Section 7 match the shipped behaviour and record any caveats; no migration, data reset, or rollout dependency exists.

### Constraints

- Only the four docs named in Section 7 change.

### Acceptance criteria

- Docs accurately describe the sticky scroll and fixed columns on all three surfaces.
- Planned shared-helper entries reconciled: `Not implemented` markers removed where delivered.
- Caveats recorded: the doubled `aria-label` on the split heatmap tables and the pointer-only sticky bar are documented as accepted posture.

### Required checks

1. Re-read the four docs against the final code.
2. Confirm notes/deviations fields in earlier sections are filled.

### Optional `@remarks` JSDoc review

- Verify Sections 2–3 `@remarks` plans are present in code before the plan is retired.

### Implementation notes / deviations / follow-up

- ...

---

## Suggested implementation order

1. Section 1 — planned-only `Not implemented` entries in the shared-helper doc (gate).
2. Section 2 — shared column builder always-fixed simplification (Vitest red-first).
3. Section 3 — `sticky` on both tables + Vitest re-scoping and the new `StudentAveragesTableCard.sticky.spec.tsx`.
4. Section 4 — one-off Vitest locator audit.
5. Section 5 — Playwright migration of existing specs/helpers.
6. Section 6 — new sticky-scroll E2E spec on all three surfaces.
7. Section 7 — documentation updates and marker reconciliation.
8. Regression and contract hardening, then documentation and rollout notes.

---

## Deferred and Out-of-Scope Findings

No deferred or out-of-scope findings are recorded at planning time. If any arise during delivery, they are logged here and, for nitpicks, in `.opencode/scratchpad/feat-frozen-columns-and-working-horizontal-scrolling-deferred-findings.md`.

| Finding | Severity | Scope rationale | Evidence | Disposition | User decision |
| ------- | -------- | --------------- | -------- | ----------- | ------------- |
| —       | —        | —               | —        | —           | —             |
