# Feature Delivery Plan (TDD-First) — Sticky Table Scroll and Frozen Student-Name Columns

## Progress tracker

- **Current section:** plan complete — all 7 content sections, hardening, de-sloppification and final documentation pass done, plus a user-approved nitpick-fix round. All pushes confirmed. Commits: `54482724`, `f39d9dbd`, `0607b1e7`, `61e80563`, `0d9f0155`, `ccf8f6e9`, `d5abc050`, `aca7bf54`, `797fe2f3`.
- **Regression baseline (Mandatory Gate 1):** established 2026-11-13, mode `baseline`, session `feat/frozen-columns-and-working-horizontal-scrolling`, report at `.ts-regression-checker/reports/session-feat-frozen-columns-and-working-horizontal-scrolling/baseline/baseline.txt`. Status: 7 of 8 checks pass; `backend-lint-check` exits 1 with 4 pre-existing `max-lines` warnings (0 errors) in backend test files outside this feature's scope (`tests/backend-api/assignmentDefinitionPartials.unit.test.js`, `tests/dbManager/dbManager.test.js`, `tests/googleClassroom/classroomApiClient.test.js`, `tests/utils/batchUpdateUtility.test.js`). Documented as accepted technical debt; the tree was untouched when measured. No regressions, no new failures.

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

**Outcome (compacted):** All three planned-only entries landed with `Not implemented` markers: §3.6 and the §9 register entry 9.30 in `frontend-shared-helpers-and-abstraction-standards.md`, and the shared sticky-table locator entry in `frontend-playwright-e2e.md` §"Shared Helpers and Imports". The §3.6 purity bullet was also scoped to `utils/splitStudentName.ts`; that correction is unconditional and carries no marker, because `studentNameTableColumns.tsx` imports Ant Design `Typography` and renders JSX. Code Reviewer returned PASS with no findings. No production or test code was touched, so there were no test cases. Docs-sync was skipped: this section's output is the documentation itself.

### Retained for later sections

Exact wording landed:

- Shared-helpers §3.6: "Always-fixed name columns (`Not implemented`): both consumers need fixed name columns, so `buildStudentNameColumns` will always emit `fixed: 'start'` on Forename and Surname. The `options` parameter, the `StudentNameTableColumnsOptions` type and its `sticky`-option JSDoc will be removed, and both call sites (`features/classPage/studentAveragesTableColumns.tsx` and `features/taskHeatmap/TaskHeatmapTable.tsx`) will drop the option argument."
- Shared-helpers §9 register: "**9.30 Always-fixed student-name columns** — … **Status: `Not implemented`**." Its body mirrors the §3.6 wording above.
- Playwright doc §"Shared Helpers and Imports": "Sticky-table locators (`Not implemented`): a shared module under `src/frontend/e2e-tests/helpers/` (for example `sticky-table-locators.ts`) will expose wrapper-scoped structural bases for `.ant-table-header.ant-table-sticky-holder`, `.ant-table-body` and `.ant-table-sticky-scroll`, so specs never resolve a sticky table by accessible name. Keep a base local to its spec if fewer than three specs need it."
- §3.6 purity bullet: "`src/frontend/src/utils/splitStudentName.ts` is pure: no React, Ant Design, I/O, or state dependencies. `studentNameTableColumns.tsx` is not: it imports Ant Design `Typography` and renders JSX."

Register placement: 9.30 sits in a new `### Pending decisions` subsection between "Rejected and superseded designs" and "Delivered decisions kept for existing cross-references". Section 7 must move 9.30 into the delivered area and delete the then-empty subsection.

Out-of-scope observations:

- `SPEC.md` "Documentation and rollout notes" also covers `frontend-loading-and-width-standards.md` and `frontend-testing.md`. Those are later sections' work, already sequenced in Section 7.
- The §9 register already carries two entries numbered 9.24 ("Generic wizard orchestrator…" and "Stale-definition recovery"). Pre-existing; out of scope.

### Section checks

Passed: all three markers present (reviewer-verified); `npm run lint:frontend:check`, `npm run lint:builder:check`, `npm run lint:synthetic:check` and prettier on the edited docs clean; `npm run lint:check` shows only the backend `max-lines` warnings already accepted in the Progress tracker; no production or test file changed.

### Implementation notes / deviations / follow-up

- **Implementation notes:** files touched — `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (§3.6 entry plus purity scope, §9 entry 9.30) and `docs/developer/frontend/frontend-playwright-e2e.md` (§"Shared Helpers and Imports"); entry wording quoted above. Regression baseline unchanged from the Progress tracker (7 of 8 checks; backend `max-lines` debt only). Section regression gate passed 2026-11-13 07:01 UTC: zero regressions, zero new failures (report `.ts-regression-checker/reports/session-feat-frozen-columns-and-working-horizontal-scrolling/runs/2026-11-13T07-01-30.083Z/comparison.txt`). Commit `54482724` — "docs(frontend): land planned-only sticky-table helper entries (issue #344 section 1)" on branch `feat/frozen-columns-and-working-horizontal-scrolling`; `git push` confirmed (`3c096617..54482724`).
- **Deviations from plan:** none.
- **Follow-up implications for later sections:** Sections 2 and 7 remove the §3.6/§9 `Not implemented` markers as the decision is delivered; Section 7 moves 9.30 into the delivered register area and removes the playwright helper marker when the Section 5 helper is catalogued. The duplicated 9.24 IDs are noted and out of scope.

---

## Section 2 — Shared column builder always emits fixed name columns (Vitest red-first)

**Outcome (compacted):** `buildStudentNameColumns<Row>()` in `src/frontend/src/features/shared/studentNameTableColumns.tsx` takes no options and always emits `fixed: 'start'` on Forename (104px) and Surname (96px). `StudentNameTableColumnsOptions` and the options parameter are removed, both call sites (`studentAveragesTableColumns.tsx:181`, `TaskHeatmapTable.tsx:147`) are zero-arg, and the module/function JSDoc records the always-fixed behaviour and the decision-5 removal. Red-first added a builder-level describe block; no split-render locators were re-scoped here. Code Reviewer returned PASS; the single red-phase nitpick (pin the column order) was fixed and re-reviewed clean.

### Retained for later sections

- **Contract:** the builder is zero-argument and always emits `fixed: 'start'`; keys, titles, widths (104px/96px), sorters, renderers and column order are unchanged, and no `defaultSortOrder` is introduced. A new consumer must not reintroduce an options parameter (`SPEC.md` decision 5).
- **Section 3:** the split render exercises the unconditional fixed columns as soon as `sticky` is added. `studentNameTableColumns.spec.tsx` (139 lines) still renders both halves as single tables; its heatmap half is re-scoped to `.ant-table-body` in Section 3.
- **Section 7:** the canonical shared-helpers doc §3.6 entry and the §9 register entry 9.30 still read `Not implemented`. This section's checks require those markers to survive; Section 7 removes them and moves 9.30 into the delivered register area.
- **Vitest invocation:** the original `npm run test:frontend -- src/frontend/src/...` form does not match, because Vitest runs with cwd `src/frontend`; the working form is `npm run test:frontend -- src/features/...`. Later section checks must use it.
- **Tooling note for `studentNameTableColumns.tsx`:** frontend lint applies `unicorn.configs.all`, whose `unicorn/consistent-arrow-return-style` requires the multi-line `return (...)` form in the JSX render callbacks. Editor format-on-write collapses it and breaks lint, so edit this file through the shell. The pre-commit Prettier glob (`\.(js|json|md|ts)$`) does not cover `.tsx`.

### Section checks

Passed: shared spec 2/2; `taskHeatmap`/`classPage`/`shared` suites 608/608; `npm run lint:frontend:check` exit 0 (only pre-existing unrelated `max-lines` warnings); `npm run typecheck:all` exit 0; full coverage 3151/3151 at 95.67%. Section 1 `Not implemented` markers unchanged.

### Implementation notes / deviations / follow-up

- **Implementation notes:** final LOC — `studentNameTableColumns.tsx` 75 → 70 against ~62 projected, the delta being the required decision-5 JSDoc paragraph; `studentAveragesTableColumns.tsx` 193 → 191; `studentNameTableColumns.spec.tsx` 105 → 139. The antd structure confirmation is deferred to Section 3, which first creates `.ant-table-body`. Docs-sync skipped: the `@remarks` JSDoc follow-through landed in the green change, and the canonical shared-helpers reconciliation is Section 7's by design. Section regression gate passed 2026-11-13 08:18 UTC: zero regressions, zero new failures (report `.ts-regression-checker/reports/session-feat-frozen-columns-and-working-horizontal-scrolling/runs/2026-11-13T08-18-30.889Z/comparison.txt`). Commit `f39d9dbd` — "refactor(frontend): student-name columns always fixed start (issue #344 section 2)" on branch `feat/frozen-columns-and-working-horizontal-scrolling`; `git push` confirmed (`54482724..f39d9dbd`).
- **Deviations from plan:** none behavioural. Command-form deviation: the Vitest filter path recorded above.
- **Follow-up implications for later sections:** Section 3 re-scopes the heatmap half of the shared spec; Section 7 removes the §3.6/§9 markers and relocates entry 9.30. The section regression gate and commit/push follow this compaction.

---

## Section 3 — `sticky` on both student tables plus Vitest re-scoping of the named suites

**Outcome (compacted):** Both Tables carry a bare `sticky` prop: `StudentAveragesTableCard.tsx` (280 → 287) and `TaskHeatmapTable.tsx` (228 → 236), the deltas being the required JSDoc. `@remarks` on both records the split render, the unnamed Student Averages halves, and the accepted heatmap dual `aria-label="Task Heatmap"` (decision 8; never deduplicated). Red phase created `StudentAveragesTableCard.sticky.spec.tsx` (92 lines) and, under the LOC rule, `TaskHeatmapTable.sticky.spec.tsx` (66 lines); re-scoped the heatmap half of `studentNameTableColumns.spec.tsx` (221) and `TaskHeatmapPage.spec.tsx` (294), `HeatmapBuilderSurface.spec.tsx` (438), `ClassPageHeatmapView.spec.tsx` (371) to structural holder/body bases with no accessible-name resolution left. Red and green review loops closed with PASS verdicts; the one red nitpick (compound holder selector in `TaskHeatmapPage.spec.tsx`) was fixed and re-reviewed clean.

### Retained for later sections

- **Binding locator convention (Sections 4–6):** rows and cells base on `.ant-table-body`; column headers base on `.ant-table-header.ant-table-sticky-holder`; never resolve a sticky table by accessible name, including negative probes. Wrapper/Card scoping is valid only for roles whose occurrence count is unchanged. The heatmap dual `aria-label` is accepted and is never a resolution path; Student Averages is located via its surrounding Card/wrapper, then structural bases. Section 7 documents this in `frontend-testing.md` and `frontend-playwright-e2e.md`.
- **Delivered files and LOC:** `StudentAveragesTableCard.tsx` 280 → 287; `TaskHeatmapTable.tsx` 228 → 236; `StudentAveragesTableCard.sticky.spec.tsx` 92 (new); `TaskHeatmapTable.sticky.spec.tsx` 66 (new); `studentNameTableColumns.spec.tsx` 221; `TaskHeatmapPage.spec.tsx` 294; `HeatmapBuilderSurface.spec.tsx` 438; `ClassPageHeatmapView.spec.tsx` 371. Section 4 audits from this list. Untouched and still at their limit: `StudentAveragesTableCard.spec.tsx` exactly 500, `TaskHeatmapTable.spec.tsx` 478.
- **happy-dom posture:** the split render is present there, but the sticky bar never renders (no measured overflow); bar behaviour is E2E-only, Section 6.
- **Recorded deviation from `SPEC.md`:** the Student Averages sticky-header-holder assertion lives in the new co-located `StudentAveragesTableCard.sticky.spec.tsx`, not in the 500-line `StudentAveragesTableCard.spec.tsx`, because the 500-line no-growth rule forbids growing that file.
- **antd 6.6.7 (assumption 1):** confirmed at implementation time to produce the documented split structure.

### Section checks

Passed: six Section 3 spec files 28/28; `taskHeatmap`/`classPage`/`shared` suites 610/610 (78 files); full coverage 3153/3153 at 95.67%; `npm run lint:frontend:check` exit 0 (only pre-existing unrelated `max-lines` warnings); `npm run typecheck:all` exit 0.

### Implementation notes / deviations / follow-up

- **Implementation notes:** final LOC and the antd confirmation are listed above. Docs-sync skipped: the `@remarks` JSDoc follow-through landed in the green change, and the locator-convention docs plus canonical reconciliation are Section 7's by design. Section regression gate 2026-11-13 12:07 UTC: 7 of 8 checks green (no regressions in Vitest, lint, builder, tsc); `frontend-e2e-check` fails with 82 deterministic strict-mode violations on `getByRole('table', { name: 'Task Heatmap' })` — the sticky split render resolves that name to two tables — which are precisely the locators `SPEC.md` enumerates for Section 5's migration. User decision (asked and approved 2026-11-13): Sections 3–4 gates proceed on the 7 green checks with these E2E failures documented as plan-sequenced intentional failures; Section 5's gate must show `frontend-e2e-check` fully green. Gate report: `.ts-regression-checker/reports/session-feat-frozen-columns-and-working-horizontal-scrolling/runs/2026-11-13T12-07-23.822Z/comparison.txt`. Commit `0607b1e7` — "feat(frontend): sticky split render on both student tables (issue #344 section 3)" on branch `feat/frozen-columns-and-working-horizontal-scrolling`; `git push` confirmed (`9ca82d5f..0607b1e7`).
- **Deviations from plan:** the co-located `StudentAveragesTableCard.sticky.spec.tsx` deviation recorded above; `TaskHeatmapTable.sticky.spec.tsx` created under the LOC rule, as the plan mandated if 500 lines would be crossed; no suite needed re-scoping beyond the four named ones.
- **Follow-up implications for later sections:** Sections 4–6 inherit the convention; Section 7 documents it; Section 4's audit list builds on the delivered re-scoping; Section 5 removes the 82 E2E strict-mode violations and must leave `frontend-e2e-check` green at its gate.

---

## Section 4 — One-off Vitest locator audit across all co-located table specs

**Outcome (compacted):** Verification-only audit completed 2026-11-13 across all 37 candidate specs (13 `classPage`, 23 `taskHeatmap`, 1 `shared`). Every suite is green unchanged, no locator is genuinely ambiguous, so nothing was re-scoped and the red-first obligation is discharged vacuously. No production or spec file was edited, so the conditional Code Reviewer pass was not required.

### Retained for later sections

- **Structural counts** (measured with a temporary probe spec, run then deleted): heatmap split render — 2 `table` roles, 10 `columnheader`s, 5 `row`s (2 header + 3 body), 24 `cell`s, 1 `thead` (header table only), 1 `.ant-table`, 1 `.ant-table-wrapper`; Student Averages split render — 2 `table` roles, 6 `columnheader`s, 2 `row`s (1 header + 1 body), 6 `cell`s, 1 `thead`, 1 `.ant-table`. `getByRole('table', { name: 'Task Heatmap' })` still throws a strict-mode "Found multiple elements" violation, so the four Section 3 suites must stay re-scoped.
- **Row attribution:** no Vitest spec uses `getByRole('row').filter({ hasText: … })`; every row probe is `:scope tbody tr[data-row-key=…]`, which resolves to the body table only. Section 5 audits the E2E content-filtered case (`class-page-baseline-mode.spec.ts`) on the same basis.
- **Pre-existing duplicate header text:** antd's `tr.ant-table-measure-row` repeats header titles as body text (`getAllByText('Forename')` = 2 in both sticky and non-sticky `scroll.x` renders), so header assertions must stay role-based. No audited spec used `getByText` on a header title; Section 5's E2E migration must not reintroduce text-based header probes.

### Audit list

| Spec file(s)                                                                                                                             | Locator family                                                                                                                                                                                            | Verdict                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `ClassPageHeatmapView.spec.tsx`, `TaskHeatmapPage.spec.tsx`, `HeatmapBuilderSurface.spec.tsx`, `shared/studentNameTableColumns.spec.tsx` | Structural `.ant-table-body` / `.ant-table-header.ant-table-sticky-holder` bases with `within` scoping; `col` and row probes anchored to the body table                                                   | Section 3 re-scope, re-verified green                                                                      |
| `StudentAveragesTableCard.spec.tsx` (500 lines), `StudentAveragesTableCard.sticky.spec.tsx`                                              | `container.querySelector('.ant-table')`, unscoped `getAllByRole('columnheader')`, `.ant-table-column-sorters`, filter trigger/placeholder/text queries; structural holder + body in the sticky spec       | Split-safe, unchanged; 6 `columnheader`s keep pre-split order and the unique `Forename` match              |
| `TaskHeatmapTable.spec.tsx` plus `.baseline`, `.excludedColumnMarking`, `.merged`, `.preview`, `.status`, `.sticky`, `.zeroWeight`       | Unscoped `getByRole('columnheader', { name })` and `queryByRole` variants, indexed `getAllByRole`, `th`/`td`/`:scope tbody tr[data-row-key]` probes, `document.querySelectorAll('thead .ant-table-cell')` | Split-safe, unchanged; one `thead` in source order, body-only row probes, no strict-mode duplicate matches |

N/A, 23 specs with no student table in the DOM: `ClassPage.spec.tsx`, `ClassPageContent.spec.tsx`, `ClassPage.modeControl.spec.tsx`, `ClassPage.reRunAssessment.spec.tsx`, `ClassPageHeaderActions.spec.tsx`, `RecentAssignmentCard.spec.tsx`, `RecentAssignmentsSection.spec.tsx` (page shells and cards); `studentAveragesTableColumns.spec.tsx`, `.accessibility.spec.tsx`, `.excluded.spec.tsx` (exercise column definitions and renderers, never render a `Table`); `HeatmapSelectionBar.spec.tsx`; `TaskHeatmapPage.assignmentQuery.spec.tsx`, `.legacy.spec.tsx`, `.reRunAssessment.spec.tsx` (`TaskHeatmapTable` mocked); `TaskMetricPreviewCell.spec.tsx`, `.focus`, `.focusSession`, `.openChange`; `TaskMetricPreviewContent.spec.tsx`; `TaskPreviewCard.spec.tsx`, `.errors`, `.sourceLink`, `.status`.

### Section checks

Passed: `npm run test:frontend -- src` 326 files / 3153 tests green; `npm run test:frontend:coverage` 95.67% statements (91.85% branches, 95.45% functions, 96.36% lines), above the 85% minimum; `npm run lint:frontend:check` exit 0 (0 errors; the 16 `max-lines` warnings are pre-existing and in untouched files).

### Implementation notes / deviations / follow-up

- **Implementation notes:** the Audit list above is the record; the probe spec was temporary and is not committed. Docs-sync skipped: an audit-only section changed no code, test, or documented behaviour. Section regression gate 2026-11-13 13:24 UTC: 7 of 8 checks green, zero regressions in Vitest/lint/builder/tsc; `frontend-e2e-check` red with the same plan-sequenced strict-mode violation set (approved gate-gap decision — no code changed in this section, so the E2E set is unchanged). Gate report: `.ts-regression-checker/reports/session-feat-frozen-columns-and-working-horizontal-scrolling/runs/2026-11-13T13-24-57.502Z/comparison.txt`. Commit `61e80563` — "docs(plan): record section 4 vitest locator audit outcome (issue #344)" on branch `feat/frozen-columns-and-working-horizontal-scrolling`; `git push` confirmed (`0607b1e7..61e80563`).
- **Deviations from plan:** none — no suite's DOM changed beyond the planned split render, and no production or spec file was edited.
- **Follow-up implications for later sections:** the audit's verdicts seed Section 5's E2E migration, whose gate must leave `frontend-e2e-check` fully green (approved gate-gap decision, Deferred findings and Section 3).

---

## Section 5 — Playwright migration of existing table-locator E2E specs and helpers

**Outcome (compacted):** All 16 in-scope specs and both helpers (`task-preview-source-link-helpers.ts`, `assessment-error-preview-journeys.ts`) now resolve the sticky student tables through the shared `sticky-table-locators.ts` helper. No `table`-role scoping, accessible-name resolution (`getByRole('table', { name: … })`, `getByLabelText`, `queryBy*`/`findBy*`) or `.ant-table-content` probe remains on the three student-table surfaces; only out-of-scope tables (Classes, Assignments, modal tables) keep table-scoped locators. Each batch captured strict-mode-violation red evidence on the dual-labelled split tables before migrating, then green. The combined Code Reviewer pass over the full section diff returned **PASS with zero findings**. Line-count neutral — replacement, not addition, plus one unavoidable import where nothing was removable — with no file over 500 and `assessment-error-merged-previews.spec.ts` at exactly 497.

### Retained for later sections

**Helper API — `src/frontend/e2e-tests/helpers/sticky-table-locators.ts` (109 lines, new).** The `StickyTableScope = Page | Locator` argument must contain exactly one sticky table: the `Page` on the standalone Heatmaps page and the Class assignment heatmap view, the owning `.ant-card` filter on the Class overview (Student Averages).

| Base                             | Returns                                     | Use                                                                                                                            |
| -------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `stickyTableWrapper(scope)`      | `.ant-table-wrapper`                        | readiness gates, `toHaveCount(0)` absence probes, ancestor XPath (card probe), roles whose count the split leaves unchanged    |
| `stickyTableHeaderHolder(scope)` | `.ant-table-header.ant-table-sticky-holder` | all `columnheader`, header `th` and `thead` probes                                                                             |
| `stickyTableBody(scope)`         | `.ant-table-body`                           | all row and cell probes; owns the table's horizontal overflow                                                                  |
| `stickyTableScrollBar(scope)`    | `.ant-table-sticky-scroll`                  | Section 6's bar assertions; thumb is `.ant-table-sticky-scroll-bar`. Exported but unused in Section 5 — Section 6 consumes it. |

- **Measure row:** the body `tbody` starts with an `aria-hidden` `tr.ant-table-measure-row` that repeats the column titles as text. `tbody tr.ant-table-row` counts data rows only; a bare `tbody tr` is measure-row-inclusive, which `metric-range-filter.spec.ts` keeps by design (11 included / 2 filtered — the same `.ant-table-body` element the pre-migration `getByRole('table').last()` resolved to).
- **Absence-probe contract:** `.ant-table-wrapper` and the sticky holder render whenever the antd `Table` mounts (the Spin wrappers sit between wrapper and table), so a `toHaveCount(0)` probe on either base cannot false-positive on a mounted-but-loading table; it passes only when the table is genuinely unmounted.
- **Dead code:** `HEATMAP_TABLE_NAME` (`helpers/task-preview-source-link-fixtures.ts:170`) is exported but unused repo-wide. Left in place as instructed; Section 7's doc sweep decides its removal.
- **Evidence:** per-batch red/green runs under `.opencode/scratchpad/batch-b-migration/` and `.opencode/scratchpad/batch-c-migration/` (batch A used its own scratchpad files); combined review at `.opencode/scratchpad/review-section5-playwright-migration.md`.
- **Docs-sync skipped:** test-only change; the E2E helper register and locator-convention docs are Section 7's planned surface (Section 1 landed those entries marked `Not implemented`), so the `sticky-table-locators.ts` doc marker stays `Not implemented` until Section 7 catalogues it.
- **Follow-up:** Section 6 builds `sticky-table-scroll.spec.ts` on this helper; this section's gate and the final section gate require `frontend-e2e-check` fully green (approved E2E gate-gap decision, Deferred findings).

**Final line counts** (the 500-line gate and Section 7's doc sweep reference these):

| File                                           | Lines |
| ---------------------------------------------- | ----- |
| `assessment-error-merged-previews.spec.ts`     | 497   |
| `class-page-baseline-mode.spec.ts`             | 473   |
| `task-heatmap.spec.ts`                         | 460   |
| `task-heatmap-summary.spec.ts`                 | 417   |
| `task-preview-source-link.visual.spec.ts`      | 411   |
| `assessment-error-previews.spec.ts`            | 390   |
| `legacy-assignment-results.spec.ts`            | 362   |
| `post-analysis-metadata.feedback.spec.ts`      | 295   |
| `task-heatmap-re-run-assessment.spec.ts`       | 280   |
| `task-preview-source-link.spec.ts`             | 251   |
| `task-preview-card.spec.ts`                    | 191   |
| `heatmaps.spec.ts`                             | 168   |
| `post-analysis-metadata.persistence.spec.ts`   | 125   |
| `navigation-screenshots.spec.ts`               | 106   |
| `heatmaps-layout.spec.ts`                      | 102   |
| `metric-range-filter.spec.ts`                  | 67    |
| `helpers/task-preview-source-link-helpers.ts`  | 443   |
| `helpers/assessment-error-preview-journeys.ts` | 258   |
| `helpers/sticky-table-locators.ts`             | 109   |

### Section checks

Passed on the combined review pass: `npm run lint:frontend:check` exit 0 (0 errors; the 16 `max-lines` warnings are pre-existing in untouched files), `npm run typecheck:all` exit 0, prettier clean on all 19 files, `npm run test:frontend:coverage` 3153/3153 at 95.67% statements, and `npm run test:frontend:e2e` 107 passed over the 16 touched specs plus the transitive `task-preview-source-link.states.spec.ts`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** combined review PASS with zero findings (report `.opencode/scratchpad/review-section5-playwright-migration.md`). Section regression gate 2026-11-13 16:04 UTC (run `2026-11-13T16-04-18.847Z`): `frontend-e2e-check` fully green — the approved Section 5 gate requirement is met; `Regressions Count: 0`, `New Failures Count: 0`; the only failing check is `backend-lint-check` with the 4 pre-existing `max-lines` warnings (accepted baseline debt, unchanged). An earlier gate attempt (run `2026-11-13T15-49-32.122Z`) showed one flake in `classes-crud-bulk-cohort.spec.ts` ("keeps the cohort modal open with inline feedback when all selected updates fail") — an untouched out-of-scope file: Playwright marked it flaky (failed attempt 1 on a 10s toast-visibility timeout under gate load, passed on retry), it passes 4/4 solo with `--retries=0`, and nothing in this section's diff can affect it (test-only changes, no shared worker state). That run is superseded by the clean 16:04 run; no rework was needed. Docs-sync skipped (test-only change; E2E helper register and conventions docs are Section 7's planned surface). Commit `0d9f0155` — "test(e2e): migrate sticky student-table locators to shared helper (issue #344 section 5)" on branch `feat/frozen-columns-and-working-horizontal-scrolling`; `git push` confirmed (`61e80563..0d9f0155`).
- **Deviations from plan:** none. Batch B needed one continuation checkpoint after its first agent reached its step budget (4 of 6 specs done; the follow-up finished the last two); no plan change resulted.
- **Follow-up implications for later sections:** Section 6 consumes `stickyTableScrollBar` and the other three bases; Section 7 catalogues the helper, removes its `Not implemented` marker, and decides the `HEATMAP_TABLE_NAME` removal.

---

## Section 6 — New Playwright coverage for sticky scroll, pinned header, and fixed columns on all three surfaces

**Outcome (compacted):** `src/frontend/e2e-tests/sticky-table-scroll.spec.ts` (493 lines) covers all three surfaces with six tests: three narrow journeys (Class overview, Class embedded heatmap, standalone Heatmaps) and three wide cases. It is the first consumer of Section 5's `stickyTableScrollBar` and uses the other three bases for every structural probe. The red obligation was discharged with the plan's temporary prop-removal mechanic — 6/6 failed at `.ant-table-body` resolution, and both production files were restored byte-identical (`git diff src/frontend/src/features` empty). The spec is 6/6 green, then 12/12 under `--repeat-each=2 --workers=1`; lint 0 errors, E2E typecheck and prettier clean. Combined red+green Code Reviewer review: **PASS with zero findings**.

### Retained for later sections

- **User-approved deviation on the Class-page document-overflow assertion** (disposition `approved`; recorded in the `## Deferred and Out-of-Scope Findings` ledger): at 390px the Class page chrome overflows the document independently of the tables (header-actions `Space`; `scrollWidth` 785 against `clientWidth` 390, predating this feature), so the strict `scrollWidth <= clientWidth` assertion is unachievable on the two Class-page surfaces. There the spec encodes the feature-scoped invariant — document `scrollWidth` identical with the table's card hidden and shown — and keeps the strict assertion on the Heatmaps page and all three wide tests. Section 7's docs must not contradict this encoding.
- **Spec mechanics worth reusing** (Section 7's conventions refresh, future specs):
  - Collapse the shell navigation first (`collapseShellNavigation`, the "Collapse navigation" button) before the Class-page narrow resize; the sider otherwise stays expanded at 390px and squeezes the cards.
  - Narrow height is chosen at runtime as half the measured `.ant-table-body` height, floored at 320px; the journey then polls `scrollWidth > clientWidth`.
  - Sort-while-pinned uses the fixed Surname sorter (two clicks → descending → first row `"Two"`), because filter triggers are off-screen at 390px once panned.
  - The bar unmounts when hidden, so absence is `toHaveCount(0)` after scrolling the region's bottom edge to or above the viewport bottom — never a one-scrollbar-height boundary.
  - Thumb sync is polled with `SYNC_TOLERANCE = 0.05` against rc-table's exact relation `scrollLeft / scrollable == thumbOffset / thumbRange`; geometry comparisons use the committed 1px tolerance from `heatmaps-layout.spec.ts`.
  - Row probes use `tbody tr.ant-table-row`, so the `aria-hidden` measure row is excluded.
- **Evidence:** red run `.opencode/scratchpad/sticky-shots/red-run-sticky-prop-removal.txt`; review `.opencode/scratchpad/review-section6-sticky-table-scroll.md`.
- **Docs-sync skipped:** test-only change; the E2E conventions doc is Section 7's planned surface.
- **Section 7 implication:** `frontend-playwright-e2e.md` should record the delivered sticky-scroll spec alongside the locator convention it already plans to add.

### Implementation notes / deviations / follow-up

- **Implementation notes:** review PASS with zero findings (report `.opencode/scratchpad/review-section6-sticky-table-scroll.md`). Docs-sync skipped (test-only; Section 7 owns the conventions docs). Section regression gate: run `2026-11-13T19-05-18.520Z` (session `feat-frozen-columns-and-working-horizontal-scrolling`, report at `.ts-regression-checker/reports/session-feat-frozen-columns-and-working-horizontal-scrolling/runs/2026-11-13T19-05-18.520Z/`) — **passed**: only `backend-lint-check` fails (the 4 pre-existing accepted `max-lines` warnings, identical to baseline); zero regressions, zero new failures. Two earlier gate attempts flaked in untouched out-of-scope checks under full-suite load and were superseded: run `2026-11-13T18-29-57.211Z` (`classes-crud-bulk-progress.spec.ts` dialog-close timeout, marked flaky, passed on retry and green solo 6/6 `--retries=0`); run `2026-11-13T18-44-54.852Z` (`frontend-test-coverage-check` exit 1 despite underlying Vitest `success: true`, 0 failed; solo re-run passes at 95.67% statements, matching the Section 4 figure). Commit hash/push range to be recorded here after the commit gate. **Commit:** `ccf8f6e9` — `test(e2e): add sticky-table-scroll coverage spec (issue #344 section 6)` — on branch `feat/frozen-columns-and-working-horizontal-scrolling`; `git push` confirmed (remote `0d9f0155..ccf8f6e9`).
- **Deviations from plan:** the user-approved Class-page document-overflow deviation above (recorded in the ledger). Two authoring findings were fixed in-section: the sider collapse before the Class-page resize, and the Surname-sorter sort-while-pinned step.
- **Follow-up implications for later sections:** Section 7 records this spec in the E2E conventions doc and must keep the feature-scoped overflow encoding accurate; the final regression pass must run this spec.

---

## Section 7 — Documentation updates and marker reconciliation

**Outcome (compacted):** All four docs named in `SPEC.md` "Documentation and rollout notes" landed and match the delivered code. `frontend-shared-helpers-and-abstraction-standards.md` records the zero-option always-`fixed: 'start'` builder and that the removed option must not return, and entry 9.30 now sits under `### Delivered decisions`. `frontend-loading-and-width-standards.md` gained §7.2 beside the untouched §7.1 heatmap exception. `frontend-testing.md` and `frontend-playwright-e2e.md` each gained a split-render section, the Playwright doc catalogued the helper and the coverage spec, and the stale "314 tests" count became a `npm run test:e2e` pointer. The user-approved dead `HEATMAP_TABLE_NAME` export was deleted in the same change (ledger row). Code Reviewer: **PASS, zero findings**.

### Retained for later sections

- **Each layer's sticky-table conventions now have one home.** Column builders and consumers: shared-helpers §3.6 and §9.30, plus `frontend-loading-and-width-standards.md` §7.2 (scroll affordances, the document as the only scroll container, no `scroll.y`, the unchanged heatmap fluid-width exception). Tests: `frontend-testing.md` §8 for Vitest and `frontend-playwright-e2e.md` §"Sticky Table Split Render" for Playwright. Both testing docs carry the same rules: rows and cells from `.ant-table-body`, headers from `.ant-table-header.ant-table-sticky-holder`, never resolve a sticky table by accessible name, and `tbody tr.ant-table-row` to exclude the `aria-hidden` measure row. The final "Documentation and rollout notes" pass re-reads these four docs and must not restate them elsewhere.
- **No `Not implemented` marker remains in `docs/developer/frontend/`**, so the planned-entry reconciliation is complete for this feature.
- **The `HEATMAP_TABLE_NAME` removal is delivered.** Its ledger row keeps disposition `approved`; three lines left `helpers/task-preview-source-link-fixtures.ts` (JSDoc, export, blank line), and `git grep` now matches this plan's historical prose only.
- **`@remarks` review result: `None needed`.** The Sections 2–3 follow-throughs (split render, unnamed Student Averages halves, accepted dual `aria-label`) are present in both table components; no further `@remarks` was required.
- **Evidence:** `.opencode/scratchpad/review-section7-docs-and-marker-reconciliation.md`, with the command outputs in `.opencode/scratchpad/review-s7-*.txt`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** doc files updated — `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (§3.6 consumer bullet merged into the delivered form, §9 `### Pending decisions` renamed `### Delivered decisions`, markers removed), `docs/developer/frontend/frontend-loading-and-width-standards.md` (§7.2 additions only), `docs/developer/frontend/frontend-testing.md` (§8 split-render section; "314 tests" replaced by a `npm run test:e2e` pointer), `docs/developer/frontend/frontend-playwright-e2e.md` (§"Sticky Table Split Render", `sticky-table-locators.ts` and `sticky-table-scroll.spec.ts` entries in §"Shared Helpers and Imports"), and the dead-code removal in `src/frontend/e2e-tests/helpers/task-preview-source-link-fixtures.ts`. Docs-sync: not applicable — this section was the docs pass, so a separate sync has no subject. `@remarks`: `None needed`.
- **Section checks passed:** Prettier clean on all five files; `npm run typecheck:all` exit 0; `npm run lint:frontend:check` exit 0 (16 pre-existing `max-lines` warnings, none in the changed files); `npm run lint:check` stops only at the 4 accepted backend `max-lines` warnings, identical to baseline; the E2E project type-checks clean; the reviewer additionally re-ran `npm run test:frontend:coverage` green (326 files, 3153 tests, 95.67% statements). The change alters no behaviour, so no Playwright run was gated.
- **Section regression gate and commit:** gate run `2026-11-13T20-30-09.742Z` (session `feat-frozen-columns-and-working-horizontal-scrolling`, report at `.ts-regression-checker/reports/session-feat-frozen-columns-and-working-horizontal-scrolling/runs/2026-11-13T20-30-09.742Z/`) — **passed**: only `backend-lint-check` fails (the 4 pre-existing accepted `max-lines` warnings, identical to baseline); zero regressions, zero new failures, first attempt. **Commit:** `d5abc050` — `docs(frontend): record sticky-table conventions and reconcile helper register (issue #344 section 7)` — on branch `feat/frozen-columns-and-working-horizontal-scrolling`; `git push` confirmed (remote `ccf8f6e9..d5abc050`); pre-commit hooks (prettier, staged lint, typecheck) all green.
- **Deviations from plan:** none. The dead-code removal was user-authorised and is logged in the `## Deferred and Out-of-Scope Findings` ledger.
- **Follow-up implications for later sections:** the "Documentation and rollout notes" pass re-reads the four docs against the shipped code and confirms the `@remarks` result recorded above; the final regression pass and the `git status` contract check remain.

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

- **Implementation notes:** all checks green on the final tree. Full-section regression gate run `2026-11-13T20-30-09.742Z` (report at `.ts-regression-checker/reports/session-feat-frozen-columns-and-working-horizontal-scrolling/runs/2026-11-13T20-30-09.742Z/`) passed on the post-Section-7 tree — it covers `lint:check` (all scopes), `frontend-test-coverage-check` (full Vitest suite + coverage, 3153 tests, 95.67% statements ≥ 85%), `frontend-e2e-check` (the complete Playwright suite, which includes every spec touched in Sections 5–6 and the Section 6 sticky-scroll spec), `frontend-test-coverage-check` for builder, and `typescript-compile-check` (`typecheck:all` equivalent) — with only the 4 pre-existing accepted backend `max-lines` warnings failing, identical to baseline; zero regressions, zero new failures. `npm run build:production` green on the same tree (127 files materialised, determinism checksums emitted; UI/ReactApp.html 1757131 bytes). Contract hardening: `git diff --name-only HEAD -- src/backend tests docs/developer/data-shapes` is empty (no backend file and no data-shapes doc changed in this feature); the doubled `aria-label="Task Heatmap"` on the split heatmap tables and the pointer-only sticky bar remain the accepted posture, as documented in Section 7's four docs. `npm run test:frontend -- src/frontend/src` was not run separately: the coverage run at the gate executes the identical suites (3153/3153 passed), so a second uncovered run would add no signal.
- **Deviations from plan:** none discovered during regression.

### De-sloppification outcome (§5.1 final pass)

- **De-Sloppification agent:** pass with no blocking slop; two minor worth-fixing items and one duplication improvement, all introduced by this feature's own commits. Report delivered in-session (findings summarised here).
- **Cleanup implemented** (6 files): stale false "Red phase" comment deleted from `studentNameTableColumns.spec.tsx`; duplicated DOM guards extracted to new `src/frontend/src/test/shared/domGuards.ts` (`requireElement`/`requireTableElement`) used across `studentNameTableColumns.spec.tsx`, `StudentAveragesTableCard.sticky.spec.tsx` and `TaskHeatmapTable.sticky.spec.tsx`; glued `### 3.3` heading in `frontend-shared-helpers-and-abstraction-standards.md` restored to its own line; `domGuards.ts` catalogued in `frontend-testing.md` (§ Shared test helpers) and the shared-helpers doc (§3.4). Code Reviewer re-review: **PASS, zero findings** (`.opencode/scratchpad/review-desloppification-cleanup-344.md`). Targeted Vitest for the three specs green; tsc, lint and Prettier clean.
- **Nitpicks disregarded** (recorded in `.opencode/scratchpad/feat-frozen-columns-and-working-horizontal-scrolling-deferred-findings.md`): index-based wrapper selection; page-scoped row filter in `class-page-baseline-mode.spec.ts` (plan-accepted carve-out, optional hardening noted); `ASSIGNMENTS_CONTROL_INDEX` constant duplication (under the three-spec threshold); one compound two-element guard left inline.
- **Post-cleanup final regression comparison (§5.1 step 5):** run `2026-11-13T21-21-35.905Z` — report at `.ts-regression-checker/reports/session-feat-frozen-columns-and-working-horizontal-scrolling/runs/2026-11-13T21-21-35.905Z/`. First attempt (`2026-11-13T20-55` class) flaked in the untouched out-of-scope `classes-crud-bulk-progress.spec.ts` dialog-close timeout (the same known load-flake, green solo `--retries=0` and in two prior full gate runs); the superseding re-run **passed**: all checks green except the 4 pre-existing accepted backend `max-lines` warnings; zero regressions, zero unaccounted new failures. Branch ready for documentation sync.
- **Cleanup commit:** `aca7bf54` — `refactor(test): extract shared DOM guards and reconcile helper register (issue #344 cleanup)` — on branch `feat/frozen-columns-and-working-horizontal-scrolling`; `git push` confirmed (remote `d5abc050..aca7bf54`); pre-commit hooks (prettier, staged lint, typecheck) all green.
- **Final documentation pass (§5.2):** delegated to `Docs` at tree `aca7bf54`; **no drift found, no files touched** — cross-doc locator rules consistent, both helper registers list the new modules, no `Not implemented` marker remains, no contradiction of the approved 390px deviation, `@remarks` present, `AGENTS.md`/`code-reviewer.md` routing accurate, Prettier clean. Five pre-existing out-of-scope items reported and disregarded into the deferred-findings log (stale `metric-icon-display.md` citations; two pre-existing JSDoc ambiguities; §7.2 summary wording; duplicate §9 9.24 IDs already ledgered). No doc commit needed.

### User-approved nitpick-fix round (post-plan, 2026-11-14)

- The user approved all eight nitpicks in the deferred-findings log (`.opencode/scratchpad/feat-frozen-columns-and-working-horizontal-scrolling-deferred-findings.md`): dispositions changed `disregarded` → `approved`; delivered in commit `797fe2f3` (`test: address approved nitpicks from the deferred-findings log (issue #344)`), pushed `69aa412d..797fe2f3`, pre-commit hooks green. 13 files (12 modified + new `src/frontend/e2e-tests/helpers/shell-controls.ts`), 35 insertions / 23 deletions; `assessment-error-merged-previews.spec.ts` still exactly 497 lines.
- Code Reviewer: **PASS, zero findings** (`.opencode/scratchpad/review-nitpick-round-344.md`) — semantics preserved, no over-engineering (the spread + `LAST_ELEMENT_INDEX` form is the minimal lint/type-correct realisation of the `.at(-1)` nit: `no-magic-numbers` forbids an inline `-1`; `NodeList` has no `.at()`), constant centralisation verified against the three-spec threshold (four consumers), viewport-crossing condition now consistent across the three docs, scope clean. Targeted Vitest 2/2; five affected E2E specs 28/28 solo; both `tsc -b` builds exit 0; lint 0 errors / 16 pre-existing warnings; Prettier clean.
- Regression gate: run `2026-11-14T07-57-31.461Z` (report at `.ts-regression-checker/reports/session-feat-frozen-columns-and-working-horizontal-scrolling/runs/2026-11-14T07-57-31.461Z/`) — **passed first attempt**; only `backend-lint-check` fails (the 4 pre-existing accepted `max-lines` warnings, identical to baseline); zero regressions, zero new failures.
- Plan-ledger rows are NOT affected by this round: the duplicate §9 9.24 register IDs and the 390px Class-page chrome overflow remain open/unaddressed (no user approval to fix them; the chrome overflow fix would be new work beyond this plan).

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

- **Implementation notes:** confirmed. The Section 7 Code Reviewer PASS (`.opencode/scratchpad/review-section7-docs-and-marker-reconciliation.md`) re-read all four docs against the final code on the current tree — every claim verified against the delivered sources, no contradiction of the approved Class-page document-overflow deviation, no `Not implemented` marker remaining in `docs/developer/frontend/`, and the caveats documented as accepted posture in the docs: the doubled `aria-label="Task Heatmap"` on the split heatmap tables and the pointer-only sticky bar. No migration, data reset, or rollout dependency exists. Notes/deviations fields in Sections 1–7 and the hardening pass are all filled; the `@remarks` follow-throughs from Sections 2–3 were verified present in both table components (`None needed`).
- **Deviations from plan:** none.

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

| Finding                                                                                                                                                                                                                         | Severity | Scope rationale                                                                                                                                                           | Evidence                                                                                                                                                                | Disposition | User decision                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E2E gate gap: `frontend-e2e-check` red (82 strict-mode violations on `getByRole('table', { name: 'Task Heatmap' })`) at the Section 3 and 4 gates, pending Section 5's locator migration                                        | Material | Plan-sequenced: Sections 3–4 land Vitest-side work; Section 5 migrates the E2E locators; the plan's own red mechanic for Section 5 requires these failures to exist first | `.ts-regression-checker/.../runs/2026-11-13T12-07-23.822Z/comparison.txt`; strict-mode errors naming two `<table aria-label="Task Heatmap">` elements                   | `approved`  | Approved 2026-11-13: Sections 3–4 gates proceed on the 7 green checks with these failures documented as plan-sequenced intentional failures; Section 5's gate must show `frontend-e2e-check` fully green.                                                                                    |
| §9 register carries two entries numbered 9.24 (pre-existing duplication)                                                                                                                                                        | Minor    | Pre-existing doc defect outside this feature's change surface                                                                                                             | `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9 (noted by Section 1 Docs agent)                                                       | `noted`     | —                                                                                                                                                                                                                                                                                            |
| Class-page chrome horizontal overflow at 390px (header-actions `Space`; document `scrollWidth` 785 vs `clientWidth` 390) makes the plan's strict document-overflow assertion unachievable on the two Class-page surfaces        | Material | Pre-existing chrome overflow predating this feature (commits #272/#305/#336/#353); fixing it is outside Section 6's change surface                                        | Visual/geometry evidence `.opencode/scratchpad/sticky-shots/`; runtime measurements reported by Section 6's Playwright agent; encoding in `sticky-table-scroll.spec.ts` | `approved`  | Approved 2026-11-13: the spec asserts the feature-scoped contribution invariant on the two Class-page surfaces (document `scrollWidth` identical with the table's card hidden vs shown) and keeps the strict `scrollWidth <= clientWidth` assertion on the Heatmaps page and all wide tests. |
| Dead `HEATMAP_TABLE_NAME` export at `src/frontend/e2e-tests/helpers/task-preview-source-link-fixtures.ts:170` orphaned by Section 5's accessible-name migration (its last importers were migrated off table-by-name resolution) | Minor    | Introduced by this feature's own diff (Section 5), but Section 7's planned surface is docs-only; removal needed user authorisation to widen the section                   | `git grep HEATMAP_TABLE_NAME 61e80563 -- src/frontend` shows the two helpers-file usages Section 5 removed; zero usages repo-wide at Section 7 start                    | `approved`  | Approved 2026-11-13: remove the dead export in Section 7 alongside the docs work (user: "Please remove the dead code").                                                                                                                                                                      |
