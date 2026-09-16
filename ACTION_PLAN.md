# Student Name Forename/Surname Split — Delivery Plan (TDD-First)

## Delivery status

- Current section/phase: Regression and documentation
- Baseline: established on 2026-09-16 for session `feature/student-name-forename-surname-split`.
- Accepted baseline technical debt: `backend-lint-check` reports ten existing `max-lines` warnings; `frontend-lint-check` exits 2 with its pre-existing baseline failure. No regressions or new failures were reported.
- Section 1 complete: generator, canonical compact fixtures, naming test, and synthetic-data documentation delivered. Section 1 regression comparison reported zero regressions and zero new failures; `npm run test:synthetic` passed 220/220 and `npm run lint:synthetic:check` passed with zero warnings.
- Section 2 complete: shared `splitStudentName` helper and co-located edge-case spec delivered. Section 2 regression comparison reported zero regressions and zero new failures; targeted splitter tests, frontend lint, and frontend TypeScript build passed.
- Section 3 complete: both tables now use Forename/Surname columns and shared derived comparators; default and clear/reset class-page ordering remains full-name ascending; E2E expectations and helper roster updated. Section 3 regression comparison reported zero regressions and zero new failures; touched unit suites, frontend lint/typecheck, task-heatmap, heatmaps, and navigation screenshots passed.
- Regression, contract hardening, and documentation complete: data-shapes docs verified unchanged (no transport-shape change). The shared-helper tracker records `splitStudentName` and `compareStudentNamePart` as `Implemented` with both canonical consumers and the standing Forename/Surname requirement; the Task Heatmap canonical entry reflects the two sticky split columns, shared comparators, preserved full-name default order, and current width tokens; `src/frontend/AGENTS.md` signposts the standing requirement; the `SPEC.md` width guidance now uses the shipped tokens and records removal of the former token. No `Not implemented` entry remains for this feature.
- Cleanup outcome: the temporary split-specific spec files (`classPageModelForenameSurname.spec.ts`, `studentAveragesForenameSurname.spec.tsx`, `taskHeatmapForenameSurname.spec.tsx`) were removed, with their coverage living in the canonical co-located specs (`classPageModel.spec.ts`, `studentAveragesTableColumns.spec.tsx`, `StudentAveragesTableCard.spec.tsx`, `TaskHeatmapTable.spec.tsx`).

## Read-First Context

1. `@SPEC.md` — product behaviour and scope for this feature.

## Scope and assumptions

### Scope

- **First (Section 1, hard prerequisite):** update the synthetic data generator (`scripts/synthetic-test-data/generateClassRosters.js`) to stop producing honourific-prefixed person names, regenerate committed profiles, and update `docs/developer/testing/synthetic-test-data.md`.
- New shared frontend name-split helper; Forename/Surname columns replace the single Student Name column in `StudentAveragesTableCard` (class page) and `TaskHeatmapTable` (per-assignment and merged heatmap).
- Sorting per split column; default full-name ascending order unchanged.
- E2E helper roster updates (`task-heatmap-end-to-end-helpers.ts`).
- Documentation of the standing requirement for all future student-name tables.

### Out of scope

- Backend or transport changes (none permitted).
- Column drag/reorder or preference persistence (dropped).
- Honourific-aware parsing.

### Assumptions

1. Single-token names render Forename only, Surname empty.
2. Metric-cell aria-labels continue to carry the full name string.

---

## Global constraints and quality gates

### Engineering constraints

- Changes minimal and localised; no defaults invented; British English.
- Shared-helper standard (`frontend-shared-helpers-and-abstraction-standards.md`) governs the new helper.
- Spacing/width standards (`frontend-spacing-and-padding-standards.md`, `frontend-loading-and-width-standards.md`) govern any width token changes.

### TDD workflow

Red → Green → Refactor per section; verify with the commands below.

### Delegation mandatory-read gate

Every delegated handoff lists mandatory files as `@`-prefixed paths and must return `Files read` evidence. Missing evidence blocks progression.

### Validation commands hierarchy

- `npm run lint:frontend`
- `npm run test:frontend -- <target>`
- `npm run test:frontend:e2e -- <target>`

---

## Section 1 — Honourific-free synthetic names and fixtures (Red first)

This section is a **hard prerequisite**: it must be fully delivered and committed before Sections 2–3 begin, so the name-split work consumes honourific-free canonical fixtures.

### Objective

- Update `scripts/synthetic-test-data/generateClassRosters.js` so generated person names (student and teacher) contain no leading honourific token, regenerate the committed compact profiles, and establish the honourific-free fixture basis on which the Forename/Surname columns are built.

### Identified changes (normal Change scope)

Code:

- `scripts/synthetic-test-data/generateClassRosters.js` — only generator source touching person names (`buildStudents` and `buildTeacher` via `faker.person.fullName()`).
- Regenerated committed view files under `tests/__mocks__/data/synthetic-analysis/{small,medium,large-representative}/` — `classesById.json`, `assignmentsByKey.json`, and any view carrying roster/teacher names (e.g. `classPartials.json`); only files that actually change are committed.

Tests:

- New synthetic generator test asserting no generated roster or teacher name begins with any honourific from the stripped set, per committed-profile seed (Red first). Test file location: **`tests/synthetic-analysis/syntheticRosterNaming.test.ts`** (already inside both the `test:synthetic` and `lint:synthetic:check` scopes, so no config changes are needed).
- `tests/synthetic-analysis/syntheticCommittedFixtureRegeneration.test.ts` — byte-for-byte regeneration comparison must pass against the regenerated committed profiles.
- Broader synthetic suites (`npm run test:synthetic`) re-run boundedly: generation, validation, and graph-integrity specs that consume rosters.
- No frontend/e2e test literals reference generated names (verified by search); only fixture data itself changes.

### Constraints

- Generator change is deterministic and seeded; strip a leading honourific token from a small constant set (`Mr`, `Mrs`, `Miss`, `Ms`, `Dr`, `Prof`, plus any documented honourific set chosen at implementation) after `faker.person.fullName()` — apply to both student and teacher names; keep samples otherwise unchanged.
- Regenerate committed profiles with `npm run fixtures:synthetic` and commit the changed fixture files; committed-fixture regeneration must stay byte-for-byte reproducible per `docs/developer/testing/synthetic-test-data.md`.
- Update `docs/developer/testing/synthetic-test-data.md` in the same change with the honourific-free naming invariant.
- Only **leading** honourific tokens are stripped; Faker suffix tokens (e.g. "DDS", "MD") deliberately remain part of the stored name (recorded assumption: acceptable quirk, matching the first-token split rule).
- Name fixtures for honourific names must not appear anywhere after this change.
- Do not hand-craft name fixtures that bypass the generator.
- E2E helper rosters (`task-heatmap-end-to-end-helpers.ts`, literal names) are out of scope here; they keep obeying the standing honourific-free rule trivially.

### Delegation mandatory reads

All delegated agents:

- `@SPEC.md`, `@docs/developer/testing/synthetic-test-data.md`, `@scripts/synthetic-test-data/generateClassRosters.js`, `@scripts/synthetic-test-data/fixtureWriter.js`, `@tests/synthetic-analysis/syntheticCommittedFixtureRegeneration.test.ts`

### Required test cases (Red first)

Backend/synthetic script tests:

1. Generator assertion: no committed-profile roster or teacher name begins with any honourific from the stripped set.
2. Existing committed-fixture comparison spec passes with regenerated fixtures.

### Section checks

- `npm run test:synthetic`
- `npm run lint:synthetic:check`
- Regenerated fixtures committed after all validations pass.
- Mandatory-read evidence gate passed.

---

## Section 2 — Shared split helper (Red first)

### Objective

- Provide a single deterministic splitter: first token = forename; remaining tokens joined by single spaces = surname; empty name → both empty strings.

### Constraints

- New helper (decision: `new`) — no existing splitter exists; export as a function (not a const arrow).
- Owning path: `src/frontend/src/utils/` (final filename per frontend conventions), with a co-located `.spec.ts`.
- Runs after Section 1 so the helper's canonical-fixture expectations are honourific-free.

### Delegation mandatory reads

Testing Specialist:

- `@SPEC.md`, `@docs/developer/frontend/frontend-testing.md`, `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

Implementation:

- `@SPEC.md`, `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`, `@src/frontend/src/utils/`

Code Reviewer:

- `@SPEC.md`, `@AGENTS.md`, `@src/frontend/AGENTS.md`

### Acceptance criteria

- Splitter handles: empty string, single token, two tokens, apostrophe tokens ("Burnice O'Kon"), middle/multi-token surnames, leading/trailing/multiple internal spaces (surname collapse).
- No honourific special-casing in the splitter (agreed decision 1); honourific-shaped inputs are covered only by a non-behaviour lock-in test, because Section 1 guarantees fixtures contain no such names.

### Shared-helper planning entry (before implementation)

- Before any implementation, add a planned entry to `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`: helper name (final filename per Section 2 ownership), owning path `src/frontend/src/utils/...`, consumers (both tables' column definitions and comparators), status **`Not implemented`**. This pre-empts the "implementation-status tracker" anti-pattern; it is later reconciled to `Implemented` in the Documentation phase.

### Required test cases (Red first)

Frontend tests:

1. Empty string → ("", "").
2. "Alice" → ("Alice", "").
3. "Alice Smith" → ("Alice", "Smith").
4. "Miss Katarina Sauer" → ("Miss", "Katarina Sauer") — documents the non-behaviour only.
5. "Burnice O'Kon" → ("Burnice", "O'Kon").
6. Double internal space → single space in surname.
7. Whitespace-only string → ("", "").

### Section checks

- Failing-then-passing evidence for `npm run test:frontend -- src/frontend/src/utils/<splitter>.spec.ts` (Red then Green demonstrated for the splitter).
- `npm run lint:frontend`
- Mandatory-read evidence gate passed.
- Planned shared-helper entry exists in the canonical doc with `Not implemented` status before implementation.

---

## Section 3 — Forename/Surname columns in the two tables (Red first)

### Objective

- Replace the Student Name column with Forename + Surname columns in `studentAveragesTableColumns.tsx`/`StudentAveragesTableCard.tsx` and `TaskHeatmapTable.tsx`/`taskHeatmapTableColumns.tsx`, with per-column sorting and unchanged default ordering.

### Identified changes (normal Change scope)

Code:

- `src/frontend/src/features/classPage/studentAveragesTableColumns.tsx` — split columns and per-column sorters.
- `src/frontend/src/features/classPage/StudentAveragesTableCard.tsx` — duplicate `SortColumn` type (the only named one, line ~76) and `normaliseSorter` reset logic must move from the `studentName` key to the new forename/surname sort keys.
- `src/frontend/src/features/classPage/classPageModel.ts` — inline `column: 'studentName' | MetricColumnKey` type in `buildClassPageViewModel`'s input and the `studentName` sort branch must be reworked onto the new keys; missing/cleared sort state resolves to full-name ascending. The former `DEFAULT_SORT` export is removed because the model's null/undefined fallback is the single default-ordering path.
- `src/frontend/src/features/taskHeatmap/taskHeatmapTableColumns.tsx` and `TaskHeatmapTable.tsx` — split columns; sticky-name column layout re-verified at implementation (two top-level columns replacing one `fixed: 'start'` column; low layout risk, no spec change).

Tests:

- Component specs for both tables; `classPageModel` sort-state spec; heatmap e2e specs `task-heatmap.spec.ts` (literal `'Student Name'` header assertion) and `heatmaps.spec.ts` (merged heatmap full-name aria-labels) updated in the same section.
- `src/frontend/e2e-tests/navigation-screenshots.spec.ts` commits three screenshots of which the two affected ones (class-page overview, task heatmap) will likely go stale; the third (`heatmaps-builder-chromium-linux.png`) captures the empty builder state with no student-name table and should be re-run unchanged. The Playwright handoff must decide per snapshot, not relying on the `maxDiffPixelRatio: 0.1` tolerance absorbing the change without checking: if a run-without-regeneration diff of an affected snapshot exceeds tolerance, regenerate with `npm run test:frontend:e2e -- navigation-screenshots --update-snapshots`; if within tolerance, record the observation rather than regenerating blindly.

### Constraints

- Default initial order is the unchanged `compareStudentNames` full-name ascending sort with `studentId` tie-break; the clear-sort/reset fallback in `classPageModel.ts`/`StudentAveragesTableCard.tsx` also resolves to that ordering.
- Comparator ownership (settled decision, not implementation discretion): derived forename/surname comparators are built from the Section 2 split helper module; the default ordering remains `compareStudentNames` unchanged; **no new comparator module** is added to `services/dataAnalysis/` unless implementation reveals a structural need, in which case the deviation is recorded here.
- Metric-cell aria-labels keep the full name.
- Any width token additions go into `theme/spacing.ts` following width standards (read doc before touching).
- Shared-helper planning gate: Splitter reused (decision `reuse` from Section 2).

### Delegation mandatory reads

Testing Specialist:

- `@SPEC.md`, `@docs/developer/frontend/frontend-testing.md`, `@src/frontend/src/features/classPage/studentAveragesTableColumns.tsx`, `@src/frontend/src/features/classPage/StudentAveragesTableCard.tsx`, `@src/frontend/src/features/classPage/classPageModel.ts`, `@src/frontend/src/features/taskHeatmap/TaskHeatmapTable.tsx`, `@src/frontend/src/features/taskHeatmap/taskHeatmapTableColumns.tsx`

Implementation:

- `@SPEC.md`, `@docs/developer/frontend/frontend-spacing-and-padding-standards.md`, `@docs/developer/frontend/frontend-loading-and-width-standards.md`, `@docs/developer/data-shapes/INDEX.md`, files listed for Testing Specialist above.

Playwright (E2E test work):

- `@SPEC.md`, `@.opencode/agents/playwright.md`, `@docs/developer/frontend/frontend-playwright-e2e.md`, `@src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts`, `@src/frontend/e2e-tests/task-heatmap.spec.ts`, `@src/frontend/e2e-tests/heatmaps.spec.ts`, `@src/frontend/e2e-tests/navigation-screenshots.spec.ts`

Code Reviewer:

- `@SPEC.md`, `@AGENTS.md`, `@src/frontend/AGENTS.md`, `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Acceptance criteria

- Both tables render Forename then Surname columns.
- Each column sorts by its own derived value; default initial order unchanged; class-page clear-sort falls back to full-name ascending.
- E2E negative tests asserting no drag affordances (`src/frontend/e2e-tests/classes-page.spec.ts`, `src/frontend/src/pages/ClassesPage.spec.tsx`) keep passing (no drag UI introduced).

### Required test cases (Red first)

Frontend component tests:

1. Student Averages table renders Forename and Surname headers; first row reflects split values.
2. Surname column sort orders rows by surname deterministically.
3. `classPageModel.ts`: missing/default sort state maps to full-name ascending; explicit forename/surname sort keys and clear-reset normalise correctly.
4. Task Heatmap table renders split columns; metric-cell aria-labels retain full name.
5. One-token students render surname cell empty without crashing.

E2E (Playwright):

6. `task-heatmap-end-to-end-helpers.ts` roster updated; `task-heatmap.spec.ts` asserts Forename/Surname headers and split cell content.
7. `heatmaps.spec.ts` merged-heatmap assertions updated to split columns with full-name aria-labels intact.
8. `navigation-screenshots.spec.ts` snapshot screenshots regenerated (or within-tolerance status recorded) after the column split, using the documented tolerance-check procedure.

### Section checks

- `npm run lint:frontend`
- `npm run test:frontend -- studentAverages` and heatmap suites.
- `npm run test:frontend:e2e -- task-heatmap`, `npm run test:frontend:e2e -- heatmaps`, and `npm run test:frontend:e2e -- navigation-screenshots`.
- Mandatory-read evidence gate passed for every delegated handoff (including Playwright).

---

## Regression and contract hardening

### Acceptance criteria

- Full `npm run lint:frontend` green; touched unit suites green; `npm run test:frontend:e2e -- task-heatmap`, `npm run test:frontend:e2e -- heatmaps`, and `npm run test:frontend:e2e -- navigation-screenshots` green.
- Data-shapes docs verified unchanged (no transport-shape change); update only if review finds drift.

### Section checks

- `npm run lint:frontend && npm run test:frontend -- ...` (touched suites)
- `npm run test:frontend:e2e -- task-heatmap && npm run test:frontend:e2e -- heatmaps && npm run test:frontend:e2e -- navigation-screenshots`

---

## Documentation and rollout notes

Status: **Complete**.

### Acceptance criteria

- Shared-helpers canonical doc: the Section 2 planned splitter entry is reconciled to `Implemented` with owning path `src/frontend/src/utils/splitStudentName.ts`, the `splitStudentName` and `compareStudentNamePart` contracts, and both consumers (Student Averages and Task Heatmap column definitions/comparators).
- `src/frontend/AGENTS.md` signposts the standing requirement: "All tables displaying a student name use Forename and Surname columns derived via the shared split helper."
- The Task Heatmap canonical entry no longer describes a single sticky Student Name column, the removed `APP_COL_WIDTH_STUDENT_NAME` token, `defaultSortOrder`, or a local comparator.
- No backend/data-shape docs change (verified; transport shapes unchanged).

### Checks

1. Docs reflect actual implementation (no `Not implemented` entries left for this feature).
2. Mandatory-read evidence for Docs/De-Sloppification handoffs complete.
3. No production code, tests, fixtures, or E2E files modified by the documentation pass.

---

## Suggested implementation order

1. Section 1 (honourific-free generator + regenerated fixtures — hard prerequisite)
2. Section 2 (shared splitter + tests)
3. Section 3 (two tables' columns + component tests)
4. Regression and documentation
